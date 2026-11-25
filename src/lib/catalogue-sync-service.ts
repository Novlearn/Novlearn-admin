import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeAdmin, type AuthGateway } from './auth/authorization';
import { isFingerprint, isUuid } from './catalogue';
import {
  catalogueSyncInspection,
  catalogueSyncPayload,
  catalogueSyncReceipt,
  catalogueSyncReceiptMatches,
  catalogueSyncTargetErrorClass,
  type CatalogueSyncCandidate,
  type CatalogueSyncPayload,
  type CatalogueSyncReceipt,
} from './catalogue-sync';
import type { CatalogueSyncConfiguration } from './catalogue-sync-config';
import {
  createPublicationPgPools,
  type PublicationConnection,
} from './publication-pg';

export class CatalogueSyncError extends Error {
  constructor(
    public readonly code:
      | 'disabled'
      | 'forbidden'
      | 'invalid'
      | 'conflict'
      | 'blocked'
      | 'uncertain'
      | 'unavailable',
    public readonly sqlState: string | null = null,
  ) {
    super(code);
  }
}

type Operation = {
  id: string;
  planDigest: string;
  payload: CatalogueSyncPayload;
  inspection: Record<string, unknown>;
  state: string;
  expiresAt: string;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!object(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
};
const digest = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
const errorCode = (error: unknown) =>
  error &&
  typeof error === 'object' &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : null;
const asOperation = (value: unknown): Operation | null => {
  if (!object(value)) return null;
  const payload = catalogueSyncPayload(value.payload),
    inspection = catalogueSyncInspection(value.inspection),
    id = value.id,
    planDigest = value.plan_digest ?? value.planDigest,
    state = value.state,
    expiresAt = value.expires_at ?? value.expiresAt;
  return isUuid(id) &&
    isFingerprint(planDigest) &&
    payload &&
    inspection &&
    typeof state === 'string' &&
    typeof expiresAt === 'string' &&
    Number.isFinite(Date.parse(expiresAt))
    ? { id, planDigest, payload, inspection, state, expiresAt }
    : null;
};
const authFailure = async (auth: AuthGateway, expected: string) => {
  const access = await authorizeAdmin(auth);
  if (!access.allowed)
    throw new CatalogueSyncError(
      access.reason === 'unavailable' ? 'unavailable' : 'forbidden',
    );
  if (access.userId !== expected) throw new CatalogueSyncError('forbidden');
};

/** Server-side transfer through the catalogue sync SQL contract. */
export class CatalogueSyncService {
  private readonly pools;
  constructor(
    private readonly auth: AuthGateway,
    private readonly sourceClient: SupabaseClient,
    private readonly config: CatalogueSyncConfiguration,
  ) {
    this.pools = createPublicationPgPools(config);
  }
  async close() {
    await this.pools.close();
  }

  async targetReady() {
    return catalogueSyncTargetReady(this.pools);
  }

  async list(after = '', limit = 50) {
    if (
      after.length > 200 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new CatalogueSyncError('invalid');
    const { data, error } = await this.sourceClient.rpc(
      'admin_list_catalogue_sync_ready',
      {
        p_after: after,
        p_limit: limit,
      },
    );
    if (error) throw this.sourceError(error);
    return data;
  }

  private sourceError(error: { code?: string }) {
    return new CatalogueSyncError(
      error.code === '42501'
        ? 'forbidden'
        : error.code === '23503'
          ? 'blocked'
          : error.code === '40001' || error.code === 'PT409'
            ? 'conflict'
            : 'unavailable',
      error.code ?? null,
    );
  }

  async prepare(batchId: string, candidates: CatalogueSyncCandidate[]) {
    if (
      !isUuid(batchId) ||
      candidates.length < 1 ||
      candidates.length > 100 ||
      candidates.some((c) => !c || c.status === 'blocked') ||
      new Set(candidates.map((c) => `${c.kind}:${c.catalogId}`)).size !==
        candidates.length
    )
      throw new CatalogueSyncError('invalid');
    const actor = await authorizeAdmin(this.auth);
    if (!actor.allowed)
      throw new CatalogueSyncError(
        actor.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    const prepared: {
      operation: Operation;
      candidate: CatalogueSyncCandidate;
    }[] = [];
    try {
      for (const candidate of candidates) {
        await authFailure(this.auth, actor.userId);
        const { data: rawPayload, error: exportError } =
          await this.sourceClient.rpc('admin_export_catalogue_sync_item', {
            p_kind: candidate.kind,
            p_catalog_id: candidate.catalogId,
            p_expected_fingerprint: candidate.fingerprint,
          });
        if (exportError) throw this.sourceError(exportError);
        const payload = catalogueSyncPayload(rawPayload);
        if (
          !payload ||
          payload.kind !== candidate.kind ||
          payload.catalogId !== candidate.catalogId ||
          payload.fingerprint !== candidate.fingerprint
        )
          throw new CatalogueSyncError('conflict');
        const target = await this.pools.target();
        let inspectionValue: unknown;
        try {
          const result = await target.query(
            'SELECT novlearn_admin_private.inspect_catalogue_sync_item($1::text,$2::uuid) AS inspection',
            [candidate.kind, candidate.catalogId],
          );
          inspectionValue = result.rows[0]?.inspection;
        } finally {
          target.release();
        }
        const inspection = catalogueSyncInspection(inspectionValue);
        if (!inspection) throw new CatalogueSyncError('unavailable');
        await authFailure(this.auth, actor.userId);
        const { data: operationValue, error: prepareError } =
          await this.sourceClient.rpc(
            'admin_prepare_catalogue_sync_operation',
            {
              p_batch_id: batchId,
              p_kind: candidate.kind,
              p_catalog_id: candidate.catalogId,
              p_fingerprint: payload.fingerprint,
              p_target_key: this.config.targetKey,
              p_inspection: inspection,
            },
          );
        if (prepareError) throw this.sourceError(prepareError);
        const operation = asOperation(operationValue);
        if (
          !operation ||
          operation.payload.kind !== candidate.kind ||
          operation.payload.catalogId !== candidate.catalogId ||
          operation.payload.fingerprint !== candidate.fingerprint ||
          operation.state !== 'planned'
        )
          throw new CatalogueSyncError('unavailable');
        prepared.push({ operation, candidate });
      }
      const source = await this.pools.source();
      let batchDigest: unknown;
      try {
        const result = await source.query(
          'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
          [batchId],
        );
        batchDigest = result.rows[0]?.digest;
      } finally {
        source.release();
      }
      if (!isFingerprint(batchDigest))
        throw new CatalogueSyncError('unavailable');
      return {
        batchId,
        batchDigest,
        payloadDigest: digest(
          prepared
            .map(({ operation }) => ({
              payload: operation.payload,
              inspection: operation.inspection,
            }))
            .sort((a, b) =>
              `${a.payload.kind}:${a.payload.catalogId}`.localeCompare(
                `${b.payload.kind}:${b.payload.catalogId}`,
              ),
            ),
        ),
        items: prepared.map(({ operation, candidate }) => ({
          kind: operation.payload.kind,
          catalogId: operation.payload.catalogId,
          fingerprint: operation.payload.fingerprint,
          action: operation.payload.action,
          status: candidate.status,
          revision: operation.payload.revision ?? null,
          data: operation.payload.data,
          dependencies: operation.payload.dependencies,
          expiresAt: operation.expiresAt,
        })),
      };
    } catch (error) {
      if (error instanceof CatalogueSyncError) throw error;
      throw new CatalogueSyncError('unavailable');
    }
  }

  async confirm(batchId: string, payloadDigest: string) {
    if (!isUuid(batchId) || !isFingerprint(payloadDigest))
      throw new CatalogueSyncError('invalid');
    const actor = await authorizeAdmin(this.auth);
    if (!actor.allowed)
      throw new CatalogueSyncError(
        actor.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    const source = await this.pools.source();
    let batchDigest: unknown;
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
        [batchId],
      );
      batchDigest = result.rows[0]?.digest;
    } finally {
      source.release();
    }
    if (!isFingerprint(batchDigest))
      throw new CatalogueSyncError('unavailable');
    return this.withTargetLease((target) =>
      this.applyClaimedBatch(
        target,
        actor.userId,
        batchId,
        batchDigest,
        payloadDigest,
      ),
    );
  }

  private async applyClaimedBatch(
    target: PublicationConnection,
    actorId: string,
    batchId: string,
    batchDigest: string,
    payloadDigest: string,
  ) {
    await authFailure(this.auth, actorId);
    const journal = await this.pools.source();
    let claimed: unknown;
    try {
      const result = await journal.query(
        'SELECT novlearn_admin_private.claim_catalogue_sync_batch($1::uuid,$2::uuid,$3::text) AS batch',
        [actorId, batchId, batchDigest],
      );
      claimed = result.rows[0]?.batch;
    } catch (error) {
      const code = errorCode(error);
      throw new CatalogueSyncError(
        code === '40001'
          ? 'conflict'
          : code === '42501'
            ? 'forbidden'
            : 'unavailable',
        code,
      );
    } finally {
      journal.release();
    }
    if (
      !object(claimed) ||
      claimed.batchId !== batchId ||
      claimed.batchDigest !== batchDigest ||
      !Array.isArray(claimed.operations) ||
      !claimed.operations.every(
        (operation: unknown) =>
          object(operation) && operation.target_key === this.config.targetKey,
      )
    )
      throw new CatalogueSyncError('unavailable');
    const operations = claimed.operations.map(asOperation);
    if (
      operations.length < 1 ||
      operations.length > 100 ||
      operations.some(
        (op) =>
          !op || op.state !== 'executing' || op.payload.action === undefined,
      )
    )
      throw new CatalogueSyncError('unavailable');
    const valid = operations as Operation[];
    const actualDigest = digest(
      valid
        .map((op) => ({ payload: op.payload, inspection: op.inspection }))
        .sort((a, b) =>
          `${a.payload.kind}:${a.payload.catalogId}`.localeCompare(
            `${b.payload.kind}:${b.payload.catalogId}`,
          ),
        ),
    );
    if (actualDigest !== payloadDigest)
      throw new CatalogueSyncError('conflict');
    const items = valid.map((op) => ({
      payload: op.payload,
      inspection: op.inspection,
    }));
    let receipt: CatalogueSyncReceipt | null = null;
    let rejected: string | null = null;
    let rollbackKnown = false;
    try {
      await target.query('BEGIN');
      const result = await target.query(
        'SELECT novlearn_admin_private.apply_catalogue_sync_batch($1::uuid,$2::text,$3::jsonb) AS receipt',
        [batchId, payloadDigest, JSON.stringify(items)],
      );
      const value = catalogueSyncReceipt(result.rows[0]?.receipt, batchId);
      if (
        !value ||
        !catalogueSyncReceiptMatches(
          value,
          valid.map((op) => op.payload),
        )
      )
        throw Object.assign(new Error('invalid receipt'), {
          code: 'RECEIPT_INVALID',
        });
      if ((await target.query('COMMIT')).command !== 'COMMIT')
        throw new CatalogueSyncError('uncertain');
      receipt = value;
    } catch (error) {
      rejected = errorCode(error);
      try {
        await target.query('ROLLBACK');
        rollbackKnown = true;
      } catch {
        rollbackKnown = false;
      }
    }
    if (!receipt) {
      const observed = await this.observeTarget(target, batchId, payloadDigest);
      if (
        observed.state === 'committed' &&
        observed.receipt &&
        catalogueSyncReceiptMatches(
          observed.receipt,
          valid.map((op) => op.payload),
        )
      )
        receipt = observed.receipt;
      else if (
        observed.state === 'not_applied' &&
        rollbackKnown &&
        rejected !== 'RECEIPT_INVALID'
      ) {
        await this.record(
          actorId,
          batchId,
          batchDigest,
          'executing',
          'failed',
          null,
          rejected === '40001' ? 'not_applied' : 'target_rejected',
        );
        throw new CatalogueSyncError(
          catalogueSyncTargetErrorClass(rejected),
          rejected,
        );
      } else {
        await this.record(
          actorId,
          batchId,
          batchDigest,
          'executing',
          'uncertain',
          null,
          null,
        ).catch(() => undefined);
        throw new CatalogueSyncError('uncertain', rejected);
      }
    }
    try {
      await this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        'committed',
        receipt,
        null,
      );
      return { state: 'committed' as const, receipt };
    } catch {
      await this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        'uncertain',
        null,
        null,
      ).catch(() => undefined);
      throw new CatalogueSyncError('uncertain');
    }
  }

  async recover(actorId: string, batchId: string, payloadDigest: string) {
    if (!isUuid(batchId) || !isFingerprint(payloadDigest))
      throw new CatalogueSyncError('invalid');
    await authFailure(this.auth, actorId);
    const source = await this.pools.source();
    let batchDigest: unknown;
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
        [batchId],
      );
      batchDigest = result.rows[0]?.digest;
    } finally {
      source.release();
    }
    if (!isFingerprint(batchDigest))
      throw new CatalogueSyncError('unavailable');
    return this.withTargetLease((target) =>
      this.reconcileBatch(target, actorId, batchId, batchDigest, payloadDigest),
    );
  }

  private async reconcileBatch(
    target: PublicationConnection,
    actorId: string,
    batchId: string,
    batchDigest: string,
    payloadDigest: string,
  ) {
    const observed = await this.observeTarget(target, batchId, payloadDigest);
    if (observed.state === 'committed' && observed.receipt) {
      await this.recordRecovering(
        actorId,
        batchId,
        batchDigest,
        'committed',
        observed.receipt,
        null,
      );
      return { state: 'committed' as const, receipt: observed.receipt };
    }
    if (observed.state === 'not_applied') {
      await this.recordRecovering(
        actorId,
        batchId,
        batchDigest,
        'failed',
        null,
        'not_applied',
      );
      return { state: 'failed' as const, receipt: null };
    }
    await this.recordRecovering(
      actorId,
      batchId,
      batchDigest,
      'uncertain',
      null,
      null,
    ).catch(() => undefined);
    return { state: 'uncertain' as const, receipt: null };
  }

  private async recordRecovering(
    actorId: string,
    batchId: string,
    batchDigest: string,
    state: 'uncertain' | 'committed' | 'failed',
    receipt: CatalogueSyncReceipt | null,
    error: 'not_applied' | null,
  ) {
    try {
      return await this.record(
        actorId,
        batchId,
        batchDigest,
        'uncertain',
        state,
        receipt,
        error,
      );
    } catch (failure) {
      if (
        !(failure instanceof CatalogueSyncError) ||
        failure.code !== 'conflict'
      )
        throw failure;
      return this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        state,
        receipt,
        error,
      );
    }
  }

  /** Hold the SQL contract's lock across the source transition too, so recovery
   * cannot observe absence between a claim and its target transaction. */
  private async withTargetLease<T>(
    work: (target: PublicationConnection) => Promise<T>,
  ) {
    const target = await this.pools.target();
    let locked = false;
    let destroy = true;
    try {
      await target.query(
        "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('novlearn-catalogue-sync-v1',0))",
      );
      locked = true;
      return await work(target);
    } finally {
      if (locked) {
        try {
          const result = await target.query(
            "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('novlearn-catalogue-sync-v1',0)) AS unlocked",
          );
          destroy = result.rows[0]?.unlocked !== true;
        } catch {
          // Do not reuse a session whose lock release was not confirmed.
        }
      }
      target.release(destroy);
    }
  }

  private async observeTarget(
    target: PublicationConnection,
    batchId: string,
    payloadDigest: string,
  ) {
    try {
      const result = await target.query(
        'SELECT novlearn_admin_private.observe_catalogue_sync_batch($1::uuid,$2::text) AS observation',
        [batchId, payloadDigest],
      );
      const value = result.rows[0]?.observation;
      if (
        !object(value) ||
        value.batchId !== batchId ||
        value.payloadDigest !== payloadDigest ||
        !['not_applied', 'committed'].includes(String(value.state))
      )
        return { state: 'uncertain' as const, receipt: null };
      const receipt =
        value.state === 'committed'
          ? catalogueSyncReceipt(value.receipt, batchId)
          : null;
      if (value.state === 'committed' && !receipt)
        return { state: 'uncertain' as const, receipt: null };
      return { state: value.state as 'not_applied' | 'committed', receipt };
    } catch {
      return { state: 'uncertain' as const, receipt: null };
    }
  }

  private async record(
    actorId: string,
    batchId: string,
    batchDigest: string,
    expectedState: 'executing' | 'uncertain',
    state: 'uncertain' | 'committed' | 'failed',
    receipt: CatalogueSyncReceipt | null,
    error: 'not_applied' | 'target_rejected' | null,
  ) {
    await authFailure(this.auth, actorId);
    const source = await this.pools.source();
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.record_catalogue_sync_batch($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text) AS operations',
        [
          actorId,
          batchId,
          batchDigest,
          expectedState,
          state,
          receipt ? JSON.stringify(receipt) : null,
          error,
        ],
      );
      const operations = result.rows[0]?.operations;
      if (
        !Array.isArray(operations) ||
        operations.length < 1 ||
        operations.length > 100 ||
        operations.some(
          (item) => !asOperation(item) || asOperation(item)?.state !== state,
        )
      )
        throw new CatalogueSyncError('unavailable');
      return operations;
    } catch (failure) {
      if (failure instanceof CatalogueSyncError) throw failure;
      const code = errorCode(failure);
      throw new CatalogueSyncError(
        code === '40001' ? 'conflict' : 'unavailable',
        code,
      );
    } finally {
      source.release();
    }
  }
}

async function catalogueSyncTargetReady(
  pools: ReturnType<typeof createPublicationPgPools>,
) {
  let target: PublicationConnection | undefined;
  try {
    target = await pools.target();
    const result = await target.query(
      'SELECT novlearn_admin_private.catalogue_sync_target_contract() AS contract',
    );
    return result.rows[0]?.contract === 'atomic-catalogue-target-v1';
  } catch {
    return false;
  } finally {
    target?.release();
  }
}

export async function catalogueSyncTargetAvailable(
  config: CatalogueSyncConfiguration,
) {
  const pools = createPublicationPgPools(config);
  try {
    return await catalogueSyncTargetReady(pools);
  } finally {
    await pools.close().catch(() => undefined);
  }
}
