import 'server-only';
import { authorizeAdmin, type AuthGateway } from './auth/authorization';
import { isFingerprint, isUuid } from './catalogue';
import {
  parsePublicationPayload,
  parsePublicationInspection,
  planPublication,
  type PublicationMode,
} from './publication';
import {
  publicationOperation,
  publicationEpoch,
  publicationTargetKey,
  publicationOutcome,
  type PublicationOperation,
  type PublicationOutcome,
} from './publication-journal';

/** Dedicated, initially idle PostgreSQL connection. No connection is configured here. */
export type PublicationConnection = {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
};
export class PublicationJournalError extends Error {
  constructor(
    public readonly code:
      | 'forbidden'
      | 'unavailable'
      | 'invalid'
      | 'conflict'
      | 'missing',
  ) {
    super(code);
  }
}
const translate = (error: unknown) => {
  if (error instanceof PublicationJournalError) return error;
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null;
  return new PublicationJournalError(
    code === '42501'
      ? 'forbidden'
      : code === '40001'
        ? 'conflict'
        : code === 'P0002'
          ? 'missing'
          : code === '22023'
            ? 'invalid'
            : 'unavailable',
  );
};
/** Private server capability only. It does not connect, publish, or enable an HTTP route. */
export class PublicationJournal {
  constructor(
    private readonly auth: AuthGateway,
    private readonly connect: () => Promise<PublicationConnection>,
  ) {}
  private async actor() {
    const access = await authorizeAdmin(this.auth);
    if (!access.allowed)
      throw new PublicationJournalError(
        access.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    return access.userId;
  }
  private async query(sql: string, values: unknown[]) {
    let connection: PublicationConnection | undefined;
    try {
      connection = await this.connect();
      const result = await connection.query(sql, values);
      const item = publicationOperation(result.rows[0]?.operation);
      if (!item) throw new PublicationJournalError('unavailable');
      return item;
    } catch (error) {
      throw translate(error);
    } finally {
      connection?.release();
    }
  }
  async prepare(input: {
    batchId: string;
    versionId: string;
    fingerprint: string;
    epoch: string;
    targetKey: string;
    mode: PublicationMode;
    payload: unknown;
    inspection: unknown;
  }) {
    const actor = await this.actor();
    const payload = parsePublicationPayload(input.payload),
      inspection = parsePublicationInspection(input.inspection);
    if (
      !isUuid(input.batchId) ||
      !isUuid(input.versionId) ||
      !isFingerprint(input.fingerprint) ||
      !publicationEpoch(input.epoch) ||
      !publicationTargetKey(input.targetKey) ||
      !payload ||
      !inspection
    )
      throw new PublicationJournalError('invalid');
    try {
      planPublication(payload, inspection, input.mode);
    } catch {
      throw new PublicationJournalError('invalid');
    }
    return this.query(
      'SELECT novlearn_admin_private.prepare_publication_operation($1::uuid,$2::uuid,$3::uuid,$4::text,$5::bigint,$6::jsonb,$7::text,$8::text,$9::jsonb) AS operation',
      [
        actor,
        input.batchId,
        input.versionId,
        input.fingerprint,
        input.epoch,
        payload.definitionJson,
        input.targetKey,
        input.mode,
        JSON.stringify(inspection),
      ],
    );
  }
  async get(id: string) {
    const actor = await this.actor();
    if (!isUuid(id)) throw new PublicationJournalError('invalid');
    return this.query(
      'SELECT novlearn_admin_private.get_publication_operation($1::uuid,$2::uuid) AS operation',
      [actor, id],
    );
  }
  async claim(id: string, digest: string, action: 'claim' | 'cancel') {
    const actor = await this.actor();
    if (
      !isUuid(id) ||
      !isFingerprint(digest) ||
      !['claim', 'cancel'].includes(action)
    )
      throw new PublicationJournalError('invalid');
    return this.query(
      'SELECT novlearn_admin_private.claim_publication_operation($1::uuid,$2::uuid,$3::text,$4::text) AS operation',
      [actor, id, digest, action],
    );
  }
  /** Machine observation, including after initiator revocation. Call only with a
   * private operation and an actual verified target observation, never form data. */
  async record(
    operation: PublicationOperation,
    expected: 'executing' | 'uncertain',
    state: 'uncertain' | 'committed' | 'failed',
    outcome: PublicationOutcome | null = null,
    error: 'validation' | 'target_rejected' | 'not_applied' | null = null,
  ) {
    const own = publicationOperation(operation);
    if (
      !own ||
      !['executing', 'uncertain'].includes(expected) ||
      !['uncertain', 'committed', 'failed'].includes(state) ||
      (state === 'committed'
        ? !publicationOutcome(outcome, own.payload, own.mode) || error !== null
        : outcome !== null ||
          (state === 'failed'
            ? !error ||
              !['validation', 'target_rejected', 'not_applied'].includes(error)
            : error !== null))
    )
      throw new PublicationJournalError('invalid');
    return this.query(
      'SELECT novlearn_admin_private.record_publication_outcome($1::uuid,$2::text,$3::text,$4::text,$5::jsonb,$6::text) AS operation',
      [
        own.id,
        own.plan_digest,
        expected,
        state,
        outcome === null ? null : JSON.stringify(outcome),
        error,
      ],
    );
  }
  /** Keep a dedicated source transaction open throughout work. Journal writes
   * acquire a separate connection and commit independently of this read guard. */
  async withSourceLease<T>(
    id: string,
    digest: string,
    work: (
      operation: PublicationOperation,
      recheckAccess: () => Promise<void>,
    ) => Promise<T>,
  ): Promise<T> {
    const actor = await this.actor();
    if (!isUuid(id) || !isFingerprint(digest))
      throw new PublicationJournalError('invalid');
    let connection: PublicationConnection | undefined;
    let began = false;
    let destroy = false;
    let working = false;
    try {
      connection = await this.connect();
      await connection.query('BEGIN');
      began = true;
      await connection.query(
        "SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='10s'; SET LOCAL idle_in_transaction_session_timeout='60s'",
      );
      const result = await connection.query(
        'SELECT novlearn_admin_private.lock_publication_source($1::uuid,$2::uuid,$3::text) AS operation',
        [actor, id, digest],
      );
      const operation = publicationOperation(result.rows[0]?.operation);
      if (
        !operation ||
        operation.actor_id !== actor ||
        operation.state !== 'executing'
      )
        throw new PublicationJournalError('unavailable');
      const recheckAccess = async () => {
        if ((await this.actor()) !== actor)
          throw new PublicationJournalError('forbidden');
        // A dead/expired source connection must never look like a held lease.
        await connection!.query('SELECT 1');
      };
      await recheckAccess();
      working = true;
      return await work(operation, recheckAccess);
    } catch (error) {
      if (working) throw error;
      throw translate(error);
    } finally {
      if (connection) {
        if (began)
          try {
            await connection.query('ROLLBACK');
          } catch {
            destroy = true;
          }
        connection.release(destroy);
      }
    }
  }
}
