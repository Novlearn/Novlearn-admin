import 'server-only';
import { revisionDiff } from './catalogue';
import {
  parsePublicationPayload,
  parsePublicationInspection,
  planPublication,
  type PublicationPayload,
  type PublicationInspection,
  type PublicationMode,
} from './publication';
import {
  publicationOperation,
  publicationOutcome,
  publicationTargetKey,
  type PublicationOperation,
  type PublicationOutcome,
} from './publication-journal';
import type { PublicationConnection } from './publication-journal-server';

export class PublicationTargetError extends Error {
  constructor(public readonly code: 'invalid' | 'unavailable') {
    super(code);
  }
}
export type TargetExecution =
  | { state: 'committed'; outcome: PublicationOutcome }
  | { state: 'aborted' }
  | { state: 'uncertain' };
export type TargetObservation =
  | { state: 'committed'; outcome: PublicationOutcome }
  | { state: 'not_applied' }
  | { state: 'uncertain' };
export type TargetLease = {
  apply(
    operation: PublicationOperation,
    beforeCommit: () => Promise<void>,
  ): Promise<TargetExecution>;
  observe(): Promise<TargetObservation>;
};
const same = (a: unknown, b: unknown) => revisionDiff(a, b).length === 0;
const lockSql =
  "SELECT pg_advisory_lock(hashtextextended('novlearn-publication:'||$1::uuid::text,0))";
const unlockSql =
  "SELECT pg_advisory_unlock(hashtextextended('novlearn-publication:'||$1::uuid::text,0)) AS unlocked";
const beginSql = 'BEGIN ISOLATION LEVEL REPEATABLE READ';

/** Private target primitive. Call only after fresh source authorization and
 * keep its lease until the source journal has durably recorded the result.
 * No configuration, source approval, Engine test or HTTP route is activated here. */
export class PublicationTarget {
  constructor(
    private readonly connect: () => Promise<PublicationConnection>,
    private readonly targetKey: string,
  ) {
    if (!publicationTargetKey(targetKey))
      throw new PublicationTargetError('invalid');
  }
  private async inspectOn(
    connection: PublicationConnection,
    payload: PublicationPayload,
    mode: PublicationMode,
  ) {
    const result = await connection.query(
      'SELECT public.inspect_exercise_publication($1::jsonb,$2::text) AS inspection',
      [JSON.stringify(payload), mode],
    );
    const inspection = parsePublicationInspection(result.rows[0]?.inspection);
    if (!inspection) throw new PublicationTargetError('unavailable');
    // Validate identity and runtime compatibility even when just inspecting.
    planPublication(payload, inspection, mode);
    return inspection;
  }
  async inspect(
    input: unknown,
    mode: PublicationMode,
  ): Promise<PublicationInspection> {
    const payload = parsePublicationPayload(input);
    if (!payload || !['publish', 'rollback'].includes(mode))
      throw new PublicationTargetError('invalid');
    let connection: PublicationConnection | undefined;
    let destroy = false;
    try {
      connection = await this.connect();
      await connection.query(beginSql);
      return await this.inspectOn(connection, payload, mode);
    } catch {
      throw new PublicationTargetError('unavailable');
    } finally {
      if (connection) {
        try {
          if ((await connection.query('ROLLBACK')).command !== 'ROLLBACK')
            destroy = true;
        } catch {
          destroy = true;
        }
        connection.release(destroy);
      }
    }
  }
  async withLease<T>(
    input: PublicationOperation,
    work: (lease: TargetLease) => Promise<T>,
  ): Promise<T> {
    const decoded = publicationOperation(input);
    if (
      !decoded ||
      decoded.target_key !== this.targetKey ||
      !['planned', 'executing', 'uncertain'].includes(decoded.state)
    )
      throw new PublicationTargetError('invalid');
    const operation = structuredClone(decoded);
    let connection: PublicationConnection;
    try {
      connection = await this.connect();
    } catch {
      throw new PublicationTargetError('unavailable');
    }
    let locked = false,
      transaction = false,
      released = false,
      active = true,
      busy = false,
      applied = false;
    const drop = () => {
      if (!released) {
        released = true;
        connection.release(true);
      }
    };
    const rollback = async () => {
      if (!transaction) return true;
      if (released) return false;
      try {
        const result = await connection.query('ROLLBACK');
        transaction = false;
        return result.command === 'ROLLBACK';
      } catch {
        return false;
      }
    };
    const enter = () => {
      if (!active || released || busy)
        throw new PublicationTargetError('unavailable');
      busy = true;
    };
    const converged = (
      inspection: PublicationInspection,
      result: 'published' | 'rolled_back' | 'unchanged',
    ): PublicationOutcome | null => {
      if (
        !same(inspection.desiredHeader, operation.inspection.desiredHeader) ||
        planPublication(operation.payload, inspection, operation.mode)
          .action !== 'unchanged' ||
        inspection.state.candidate?.definitionJson !==
          operation.payload.definitionJson
      )
        return null;
      return publicationOutcome(
        {
          catalogId: operation.payload.catalogId,
          revision: operation.payload.revision,
          businessDigest: operation.payload.businessDigest,
          exerciseId: inspection.state.parent?.id,
          versionId: inspection.state.active?.id,
          stateToken: inspection.state.stateToken,
          result,
        },
        operation.payload,
        operation.mode,
      );
    };
    try {
      // A SESSION lock is acquired before beginning the repeatable-read snapshot.
      // It waits for previous applies and stays held across COMMIT, verification
      // and source-journal recording. The SQL apply's transaction lock is reentrant.
      await connection.query(lockSql, [operation.payload.catalogId]);
      locked = true;
      const lease: TargetLease = {
        apply: async (claimed, beforeCommit) => {
          enter();
          const current = publicationOperation(claimed);
          if (
            applied ||
            operation.state === 'uncertain' ||
            !current ||
            current.state !== 'executing' ||
            typeof beforeCommit !== 'function' ||
            !same(
              {
                ...current,
                state: operation.state,
                updated_at: operation.updated_at,
              },
              operation,
            )
          ) {
            busy = false;
            throw new PublicationTargetError('invalid');
          }
          let commitAttempted = false;
          try {
            applied = true;
            transaction = true;
            await connection.query(beginSql);
            const before = await this.inspectOn(
              connection,
              operation.payload,
              operation.mode,
            );
            const plan = planPublication(
              operation.payload,
              before,
              operation.mode,
            );
            if (
              !same(before.desiredHeader, operation.inspection.desiredHeader) ||
              (before.state.stateToken !==
                operation.inspection.state.stateToken &&
                plan.action !== 'unchanged')
            )
              throw new PublicationTargetError('invalid');
            const response = await connection.query(
              'SELECT public.apply_exercise_publication($1::jsonb,$2::text,$3::text) AS applied',
              [
                JSON.stringify(operation.payload),
                operation.inspection.state.stateToken,
                operation.mode,
              ],
            );
            const value = response.rows[0]?.applied;
            if (!value || typeof value !== 'object' || Array.isArray(value))
              throw new PublicationTargetError('unavailable');
            const record = value as Record<string, unknown>;
            const expectedResult =
              plan.action === 'unchanged'
                ? 'unchanged'
                : operation.mode === 'rollback'
                  ? 'rolled_back'
                  : 'published';
            if (
              Object.keys(record).sort().join(',') !==
                'businessDigest,result,target' ||
              record.businessDigest !== operation.payload.businessDigest ||
              record.result !== expectedResult
            )
              throw new PublicationTargetError('unavailable');
            const appliedState = parsePublicationInspection({
              desiredHeader: before.desiredHeader,
              state: record.target,
            });
            if (
              !appliedState ||
              !converged(
                appliedState,
                record.result as 'published' | 'rolled_back' | 'unchanged',
              )
            )
              throw new PublicationTargetError('unavailable');
            // This must recheck live Auth and the source lease immediately before
            // commit; a callback failure rolls back all uncommitted target writes.
            if (!active || released)
              throw new PublicationTargetError('unavailable');
            await beforeCommit();
            if (!active || released)
              throw new PublicationTargetError('unavailable');
            commitAttempted = true;
            const committed = await connection.query('COMMIT');
            transaction = false;
            if (committed.command !== 'COMMIT')
              throw new PublicationTargetError('unavailable');
            transaction = true;
            await connection.query(beginSql);
            const after = await this.inspectOn(
              connection,
              operation.payload,
              operation.mode,
            );
            const outcome = converged(
              after,
              record.result as 'published' | 'rolled_back' | 'unchanged',
            );
            if (
              !outcome ||
              outcome.stateToken !== appliedState.state.stateToken
            )
              throw new PublicationTargetError('unavailable');
            if (!(await rollback())) drop();
            return { state: 'committed', outcome };
          } catch {
            if (commitAttempted) {
              drop();
              return { state: 'uncertain' };
            }
            const aborted = await rollback();
            if (!aborted) {
              drop();
              return { state: 'uncertain' };
            }
            return { state: 'aborted' };
          } finally {
            busy = false;
          }
        },
        observe: async () => {
          enter();
          if (!['executing', 'uncertain'].includes(operation.state)) {
            busy = false;
            throw new PublicationTargetError('invalid');
          }
          try {
            transaction = true;
            await connection.query(beginSql);
            const state = await this.inspectOn(
              connection,
              operation.payload,
              operation.mode,
            );
            if (!active || released) return { state: 'uncertain' };
            const outcome = converged(state, 'unchanged');
            if (outcome) return { state: 'committed', outcome };
            if (
              planPublication(
                operation.payload,
                operation.inspection,
                operation.mode,
              ).action !== 'unchanged' &&
              state.state.stateToken === operation.inspection.state.stateToken
            )
              return { state: 'not_applied' };
            return { state: 'uncertain' };
          } catch {
            return { state: 'uncertain' };
          } finally {
            if (!(await rollback())) drop();
            busy = false;
          }
        },
      };
      const result = await work(Object.freeze(lease));
      if (busy) {
        active = false;
        drop();
        throw new PublicationTargetError('unavailable');
      }
      return result;
    } catch (error) {
      if (!locked) {
        drop();
        throw new PublicationTargetError('unavailable');
      }
      throw error;
    } finally {
      active = false;
      if (busy) drop();
      if (!released) {
        if (!(await rollback())) drop();
        if (locked && !released) {
          try {
            if (
              (await connection.query(unlockSql, [operation.payload.catalogId]))
                .rows[0]?.unlocked !== true
            )
              drop();
          } catch {
            drop();
          }
        }
        if (!released) {
          released = true;
          connection.release(false);
        }
      }
    }
  }
}
