import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { authorizeAdmin, type AuthGateway } from './auth/authorization';
import { isUuid, revisionDiff } from './catalogue';
import { certifiedEngineIdentity } from './engine-identity';
import { acquirePreviewJob, PreviewError } from './preview-server';
import { planPublication, type PublicationMode } from './publication';
import {
  publicationOperation,
  publicationTargetKey,
  type PublicationOperation,
} from './publication-journal';
import {
  PublicationJournalError,
  type PublicationJournal,
} from './publication-journal-server';
import {
  isPublicationSelection,
  PublicationSourceError,
  type PublicationSelection,
  type PublicationSource,
} from './publication-source';
import {
  PublicationTargetError,
  type PublicationTarget,
  type TargetExecution,
  type TargetObservation,
} from './publication-target';
import {
  PublicationVerificationError,
  type PublicationVerification,
} from './publication-verification';

export class PublicationServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid'
      | 'forbidden'
      | 'unavailable'
      | 'conflict'
      | 'missing'
      | 'busy'
      | 'verification'
      | 'recovery_required',
  ) {
    super(code);
  }
}
/** Separate, persistent server secret; no key is generated or enabled implicitly. */
export function readPublicationConfirmationKey(
  env: Record<string, string | undefined>,
  localFixture = false,
): Buffer | null {
  const value = localFixture
    ? env.ADMIN_LOCAL_PUBLICATION_CONFIRMATION_KEY
    : env.ADMIN_PUBLICATION_CONFIRMATION_KEY;
  return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : null;
}
type Dependencies = {
  auth: AuthGateway;
  journal: Pick<
    PublicationJournal,
    'prepare' | 'get' | 'claim' | 'withSourceLease' | 'record' | 'pending'
  >;
  target: Pick<PublicationTarget, 'inspect' | 'withLease'>;
  targetKey: string;
  confirmationKey: Buffer;
  source: (
    selection: PublicationSelection,
    signal: AbortSignal,
  ) => Promise<PublicationSource>;
  verify: (
    source: PublicationSource,
    signal: AbortSignal,
  ) => Promise<PublicationVerification>;
  acquire?: (owner: string) => () => void;
  now?: () => number;
};
const same = (a: unknown, b: unknown) => revisionDiff(a, b).length === 0;
const domain = 'novlearn-admin-publication-confirmation-v1\0';
const terminal = (op: PublicationOperation) =>
  ['committed', 'failed', 'cancelled'].includes(op.state);
/** Explicit browser projection. Private snapshots, cases and receipts stay server-side. */
function summary(op: PublicationOperation) {
  return {
    id: op.id,
    batchId: op.batch_id,
    sourceVersionId: op.version_id,
    catalogId: op.payload.catalogId,
    revision: op.payload.revision,
    mode: op.mode,
    state: op.state,
    expiresAt: op.expires_at,
    outcome: op.outcome,
    error: op.error_code,
  };
}
export type PublicationSummary = ReturnType<typeof summary>;

/** Coordinates existing capabilities; it neither configures a database nor
 * activates an HTTP route. Engine verification is mandatory at both steps. */
export class PublicationService {
  private readonly key: Buffer;
  private readonly now: () => number;
  constructor(private readonly deps: Dependencies) {
    if (
      !publicationTargetKey(deps.targetKey) ||
      !Buffer.isBuffer(deps.confirmationKey) ||
      deps.confirmationKey.length !== 32
    )
      throw new PublicationServiceError('invalid');
    this.key = Buffer.from(deps.confirmationKey);
    this.now = deps.now ?? Date.now;
  }
  private async actor(expected?: string) {
    const access = await authorizeAdmin(this.deps.auth);
    if (!access.allowed)
      throw new PublicationServiceError(
        access.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    if (
      !isUuid(access.userId) ||
      (expected !== undefined && access.userId !== expected)
    )
      throw new PublicationServiceError('forbidden');
    return access.userId;
  }
  private operation(input: unknown, actor?: string) {
    const op = publicationOperation(input);
    if (!op) throw new PublicationServiceError('unavailable');
    if (actor && op.actor_id !== actor)
      throw new PublicationServiceError('forbidden');
    return structuredClone(op);
  }
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof PublicationServiceError) throw error;
      if (error instanceof PublicationVerificationError)
        throw new PublicationServiceError('verification');
      if (
        error instanceof PublicationJournalError ||
        error instanceof PublicationSourceError
      )
        throw new PublicationServiceError(error.code);
      if (error instanceof PreviewError && error.status === 429)
        throw new PublicationServiceError('busy');
      if (error instanceof PublicationTargetError)
        throw new PublicationServiceError(error.code);
      if (
        error instanceof Error &&
        ['AbortError', 'TimeoutError'].includes(error.name)
      )
        throw error;
      throw new PublicationServiceError('unavailable');
    }
  }
  private matchesSource(op: PublicationOperation, source: PublicationSource) {
    if (
      !same(op.payload, source.payload) ||
      !same(op.source_snapshot, source.source)
    )
      throw new PublicationServiceError('conflict');
  }
  private async load(id: string, actor: string) {
    const op = this.operation(await this.deps.journal.get(id), actor);
    if (op.id !== id) throw new PublicationServiceError('unavailable');
    return op;
  }
  private claims(
    op: PublicationOperation,
    verification: PublicationVerification,
  ) {
    if (
      verification.engineArchiveSha256 !==
        certifiedEngineIdentity.engineArchiveSha256 ||
      verification.engineArchiveSha256 !== op.payload.engineArchiveSha256
    )
      throw new PublicationServiceError('verification');
    // Metadata is kept small and bound to the exact approved report. It is not
    // accepted as proof for confirm: confirm executes Engine again regardless.
    const report = op.source_snapshot
      .report as PublicationSource['source']['report'];
    if (
      !report ||
      verification.definitionDigest !== report.definitionDigest ||
      !Array.isArray(verification.seeds) ||
      !same(
        verification.seeds,
        report.seeds.map((s) => s.seed),
      ) ||
      !Number.isSafeInteger(verification.checkedAt) ||
      verification.checkedAt < 1 ||
      verification.checkedAt > this.now()
    )
      throw new PublicationServiceError('verification');
    return {
      version: 1,
      operationId: op.id,
      planDigest: op.plan_digest,
      actor: op.actor_id,
      targetKey: op.target_key,
      expiresAt: Date.parse(op.expires_at),
      verification: {
        definitionDigest: verification.definitionDigest,
        engineArchiveSha256: verification.engineArchiveSha256,
        seeds: [...verification.seeds],
        checkedAt: verification.checkedAt,
      },
    };
  }
  private sign(
    op: PublicationOperation,
    verification: PublicationVerification,
  ) {
    if (Date.parse(op.expires_at) <= this.now())
      throw new PublicationServiceError('conflict');
    const body = Buffer.from(
      JSON.stringify(this.claims(op, verification)),
    ).toString('base64url');
    return `${body}.${createHmac('sha256', this.key).update(domain).update(body).digest('hex')}`;
  }
  private checkToken(token: unknown, op: PublicationOperation) {
    if (
      typeof token !== 'string' ||
      token.length > 4096 ||
      !/^[-_a-zA-Z0-9]+\.[a-f0-9]{64}$/.test(token)
    )
      throw new PublicationServiceError('invalid');
    const [body, signature] = token.split('.');
    const expected = createHmac('sha256', this.key)
      .update(domain)
      .update(body)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new PublicationServiceError('invalid');
    try {
      const claims = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      );
      const canonical = Buffer.from(
        JSON.stringify(this.claims(op, claims.verification)),
      ).toString('base64url');
      if (body !== canonical || Date.parse(op.expires_at) <= this.now())
        throw new PublicationServiceError('conflict');
    } catch (error) {
      if (error instanceof PublicationServiceError) throw error;
      throw new PublicationServiceError('invalid');
    }
  }
  async prepare(
    input: PublicationSelection & { mode: PublicationMode; batchId?: string },
    signal: AbortSignal,
  ) {
    return this.run(async () => {
      const { mode, batchId = randomUUID(), ...selection } = input;
      if (
        !isPublicationSelection(selection) ||
        !['publish', 'rollback'].includes(mode) ||
        !isUuid(batchId)
      )
        throw new PublicationServiceError('invalid');
      signal.throwIfAborted();
      const actor = await this.actor();
      const release = (this.deps.acquire ?? acquirePreviewJob)(actor);
      try {
        const source = await this.deps.source(selection, signal);
        const verification = await this.deps.verify(source, signal);
        signal.throwIfAborted();
        await this.actor(actor);
        const inspection = await this.deps.target.inspect(source.payload, mode);
        signal.throwIfAborted();
        const op = this.operation(
          await this.deps.journal.prepare({
            ...selection,
            batchId,
            mode,
            targetKey: this.deps.targetKey,
            payload: source.payload,
            inspection,
          }),
          actor,
        );
        if (
          op.state !== 'planned' ||
          op.batch_id !== batchId ||
          op.target_key !== this.deps.targetKey ||
          op.mode !== mode ||
          op.version_id !== selection.versionId ||
          op.source_fingerprint !== selection.fingerprint ||
          op.source_epoch !== selection.epoch ||
          !same(op.inspection, inspection)
        )
          throw new PublicationServiceError('conflict');
        this.matchesSource(op, source);
        return {
          operation: summary(op),
          plan: planPublication(op.payload, op.inspection, op.mode),
          confirmation: this.sign(op, verification),
        };
      } finally {
        release();
      }
    });
  }
  async confirm(
    id: string,
    token: string,
    signal: AbortSignal,
  ): Promise<PublicationSummary> {
    return this.run(async () => {
      if (!isUuid(id)) throw new PublicationServiceError('invalid');
      signal.throwIfAborted();
      const actor = await this.actor();
      const op = await this.load(id, actor);
      if (terminal(op)) return summary(op);
      if (op.target_key !== this.deps.targetKey)
        throw new PublicationServiceError('conflict');
      if (op.state !== 'planned')
        throw new PublicationServiceError('recovery_required');
      this.checkToken(token, op);
      const release = (this.deps.acquire ?? acquirePreviewJob)(actor);
      try {
        const selection = {
          versionId: op.version_id,
          fingerprint: op.source_fingerprint,
          epoch: op.source_epoch,
        };
        const source = await this.deps.source(selection, signal);
        this.matchesSource(op, source);
        const verification = await this.deps.verify(source, signal);
        this.claims(op, verification);
        signal.throwIfAborted();
        await this.actor(actor);
        return await this.deps.target.withLease(op, async (lease) => {
          signal.throwIfAborted();
          // Holding the target lease before claiming prevents recovery from
          // observing an empty target while an active transfer is preparing.
          let claim: PublicationOperation;
          try {
            claim = await this.deps.journal.claim(
              op.id,
              op.plan_digest,
              'claim',
            );
          } catch (error) {
            // A lost claim acknowledgement may already have persisted executing.
            if (
              error instanceof PublicationJournalError &&
              error.code === 'unavailable'
            )
              throw new PublicationServiceError('recovery_required');
            throw error;
          }
          const claimed = this.operation(claim, actor);
          if (
            claimed.state !== 'executing' ||
            !same(
              { ...claimed, state: op.state, updated_at: op.updated_at },
              op,
            )
          )
            throw new PublicationServiceError('recovery_required');
          let result: TargetExecution,
            applyStarted = false;
          try {
            result = await this.deps.journal.withSourceLease(
              op.id,
              op.plan_digest,
              async (locked, recheck) => {
                if (!same(locked, claimed))
                  throw new PublicationServiceError('conflict');
                signal.throwIfAborted();
                applyStarted = true;
                return lease.apply(locked, async () => {
                  signal.throwIfAborted();
                  await recheck();
                  signal.throwIfAborted();
                });
              },
            );
          } catch {
            // Before apply, no target write was attempted. After apply starts,
            // an unexpected exception cannot establish whether COMMIT occurred.
            result = { state: applyStarted ? 'uncertain' : 'aborted' };
          }
          return summary(await this.record(claimed, result));
        });
      } finally {
        release();
      }
    });
  }
  private async record(
    op: PublicationOperation,
    result: TargetExecution | TargetObservation,
  ) {
    if (op.state !== 'executing' && op.state !== 'uncertain')
      throw new PublicationServiceError('invalid');
    const state =
      result.state === 'committed'
        ? 'committed'
        : result.state === 'uncertain'
          ? 'uncertain'
          : 'failed';
    try {
      // No request cancellation here: after a possible commit, bookkeeping
      // must complete even if the browser disconnected. The target lock stays held.
      const saved = this.operation(
        await this.deps.journal.record(
          op,
          op.state,
          state,
          result.state === 'committed' ? result.outcome : null,
          state === 'failed' ? 'not_applied' : null,
        ),
      );
      if (
        saved.id !== op.id ||
        saved.plan_digest !== op.plan_digest ||
        saved.state !== state ||
        !same(
          saved.outcome,
          result.state === 'committed' ? result.outcome : null,
        )
      )
        throw new PublicationServiceError('unavailable');
      return saved;
    } catch {
      throw new PublicationServiceError('recovery_required');
    }
  }
  async cancel(id: string, signal: AbortSignal) {
    return this.run(async () => {
      if (!isUuid(id)) throw new PublicationServiceError('invalid');
      signal.throwIfAborted();
      const actor = await this.actor();
      const op = await this.load(id, actor);
      if (op.state === 'cancelled') return summary(op);
      if (op.state !== 'planned') throw new PublicationServiceError('conflict');
      signal.throwIfAborted();
      const cancelled = this.operation(
        await this.deps.journal.claim(id, op.plan_digest, 'cancel'),
        actor,
      );
      if (cancelled.id !== id || cancelled.state !== 'cancelled')
        throw new PublicationServiceError('unavailable');
      return summary(cancelled);
    });
  }
  private async observe(op: PublicationOperation) {
    return this.deps.target.withLease(op, async (lease) =>
      this.record(op, await lease.observe()),
    );
  }
  async recover(id: string, signal: AbortSignal) {
    return this.run(async () => {
      if (!isUuid(id)) throw new PublicationServiceError('invalid');
      signal.throwIfAborted();
      const actor = await this.actor();
      const op = await this.load(id, actor);
      if (terminal(op) || op.state === 'planned') return summary(op);
      if (op.target_key !== this.deps.targetKey)
        throw new PublicationServiceError('conflict');
      signal.throwIfAborted();
      return summary(await this.observe(op));
    });
  }
  /** Private bounded machine recovery. It may observe after human revocation;
   * it cannot claim or apply, and never remaps an operation to a new project. */
  async recoverPage(after: string | null = null) {
    return this.run(async () => {
      const page = await this.deps.journal.pending(after),
        items: { id: string; state: string }[] = [];
      let deferred = 0;
      for (const item of page.items) {
        const op = this.operation(item);
        if (op.target_key !== this.deps.targetKey) {
          deferred++;
          continue;
        }
        if (op.state !== 'executing' && op.state !== 'uncertain')
          throw new PublicationServiceError('unavailable');
        const observed = await this.observe(op);
        items.push({ id: observed.id, state: observed.state });
      }
      return { items, deferred, next: page.next };
    });
  }
}
