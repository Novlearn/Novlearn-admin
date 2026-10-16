import { beforeEach, describe, expect, it, vi } from 'vitest';
import sql from './fixtures/publication-sql.json';
import { parsePublicationInspection } from '@/lib/publication';
import journalSql from './fixtures/publication-journal-sql.json';
import {
  publicationOperation,
  type PublicationOperation,
} from '@/lib/publication-journal';
import type { PublicationConnection } from '@/lib/publication-journal-server';
import { PublicationTarget, type TargetLease } from '@/lib/publication-target';
vi.mock('server-only', () => ({}));
const initial = () =>
  parsePublicationInspection({
    ...structuredClone(sql.inspection),
    state: {
      ...structuredClone(sql.inspection.state),
      parent: null,
      candidate: null,
      active: null,
      latestRevision: 0,
      stateToken: 'a'.repeat(64),
    },
  })!;
const final = () =>
  parsePublicationInspection({
    ...structuredClone(sql.inspection),
    state: {
      ...structuredClone(sql.inspection.state),
      stateToken: 'b'.repeat(64),
    },
  })!;
const operation = (state: 'planned' | 'executing' | 'uncertain' = 'planned') =>
  publicationOperation({
    ...structuredClone(journalSql),
    state,
    outcome: null,
    error_code: null,
    payload: structuredClone(sql.payload),
    inspection: initial(),
  })!;
const claimed = (item: PublicationOperation) => ({
  ...structuredClone(item),
  state: 'executing' as const,
  updated_at: '2026-10-15T16:00:00Z',
});
const query = vi.fn<PublicationConnection['query']>();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));
const events: string[] = [];
let inspectionCount = 0;
const defaultQuery: PublicationConnection['query'] = async (text) => {
  events.push(text);
  if (text.includes('pg_advisory_unlock'))
    return { rows: [{ unlocked: true }], command: 'SELECT' };
  if (text.includes('inspect_exercise_publication'))
    return {
      rows: [{ inspection: ++inspectionCount === 1 ? initial() : final() }],
      command: 'SELECT',
    };
  if (text.includes('apply_exercise_publication'))
    return {
      rows: [
        {
          applied: {
            result: 'published',
            businessDigest: sql.payload.businessDigest,
            target: final().state,
          },
        },
      ],
      command: 'SELECT',
    };
  return {
    rows: [],
    command:
      text === 'COMMIT'
        ? 'COMMIT'
        : text === 'ROLLBACK'
          ? 'ROLLBACK'
          : 'SELECT',
  };
};
beforeEach(() => {
  events.length = 0;
  inspectionCount = 0;
  query.mockReset().mockImplementation(defaultQuery);
  release.mockReset();
  connect.mockClear();
});
const target = () => new PublicationTarget(connect, operation().target_key);
const execute = (guard = async () => {}) => {
  const item = operation();
  return target().withLease(item, (lease) => lease.apply(claimed(item), guard));
};
const observe = () =>
  target().withLease(operation('uncertain'), (lease) => lease.observe());
describe('Publication cible : transaction et observation privée', () => {
  it('holds the lock before source claim and until durable journal recording, verifies after commit', async () => {
    const item = operation();
    const result = await target().withLease(item, async (lease) => {
      events.push('source claim');
      const result = await lease.apply(claimed(item), async () => {
        events.push('fresh source recheck');
      });
      events.push('durable source journal');
      return result;
    });
    expect(result).toMatchObject({
      state: 'committed',
      outcome: {
        result: 'published',
        businessDigest: sql.payload.businessDigest,
        exerciseId: sql.inspection.state.parent.id,
      },
    });
    expect(events[0]).toContain('pg_advisory_lock');
    expect(events[1]).toBe('source claim');
    expect(events[events.indexOf('COMMIT') - 1]).toBe('fresh source recheck');
    expect(
      events.filter((text) => text.includes('inspect_exercise_publication')),
    ).toHaveLength(2);
    expect(events.indexOf('durable source journal')).toBeLessThan(
      events.findIndex((text) => text.includes('pg_advisory_unlock')),
    );
    expect(release).toHaveBeenCalledWith(false);
    const call = query.mock.calls.find(([text]) =>
      text.includes('apply_exercise_publication'),
    )!;
    expect(call[1]).toEqual([
      JSON.stringify(sql.payload),
      'a'.repeat(64),
      'publish',
    ]);
  });
  it('rejects another configured destination before opening a connection', async () => {
    await expect(
      new PublicationTarget(connect, 'another-target').withLease(
        operation(),
        async () => null,
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('rejects terminal source records before opening a connection', async () => {
    await expect(
      target().withLease(
        { ...operation(), state: 'failed', error_code: 'not_applied' },
        async () => null,
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('does not execute a changed private confirmation', async () => {
    const item = operation();
    await expect(
      target().withLease(item, (lease) =>
        lease.apply(
          { ...claimed(item), plan_digest: 'd'.repeat(64) },
          async () => {},
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(
      query.mock.calls.some(([text]) => text.includes('apply_exercise')),
    ).toBe(false);
  });
  it('never blindly reapplies an uncertain operation', async () => {
    const item = operation('uncertain');
    await expect(
      target().withLease(item, (lease) =>
        lease.apply(claimed(item), async () => {}),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
  it('invalidates an escaped lease after the callback ends', async () => {
    let escaped: TargetLease | undefined;
    await target().withLease(operation('executing'), async (lease) => {
      escaped = lease;
    });
    const count = query.mock.calls.length;
    await expect(escaped!.observe()).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(query).toHaveBeenCalledTimes(count);
  });
  it('prevents concurrent use of the same dedicated connection', async () => {
    const item = operation();
    let entered!: () => void;
    let resume!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resumed = new Promise<void>((resolve) => {
      resume = resolve;
    });
    await target().withLease(item, async (lease) => {
      const apply = lease.apply(claimed(item), async () => {
        entered();
        await resumed;
      });
      await waiting;
      await expect(lease.observe()).rejects.toMatchObject({
        code: 'unavailable',
      });
      resume();
      expect((await apply).state).toBe('committed');
    });
  });
  it('destroys an unfinished lease and prevents a detached source check from committing later', async () => {
    const item = operation();
    let entered!: () => void;
    let resume!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resumed = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let detached: Promise<unknown> | undefined;
    await expect(
      target().withLease(item, async (lease) => {
        detached = lease.apply(claimed(item), async () => {
          entered();
          await resumed;
        });
        await waiting;
        return 'caller forgot to await the result';
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    resume();
    expect(await detached).toEqual({ state: 'uncertain' });
    expect(events).not.toContain('COMMIT');
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('rolls back a changed target token before applying', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('inspect_exercise')
        ? {
            rows: [
              {
                inspection: {
                  ...initial(),
                  state: { ...initial().state, stateToken: 'e'.repeat(64) },
                },
              },
            ],
          }
        : defaultQuery(text, values),
    );
    expect(await execute()).toEqual({ state: 'aborted' });
    expect(
      query.mock.calls.some(([text]) => text.includes('apply_exercise')),
    ).toBe(false);
    expect(events).toContain('ROLLBACK');
  });
  it('refuses silently changed target reference mapping', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('inspect_exercise')
        ? {
            rows: [
              {
                inspection: {
                  ...initial(),
                  desiredHeader: {
                    ...initial().desiredHeader,
                    competences: ['another-target-skill'],
                  },
                },
              },
            ],
          }
        : defaultQuery(text, values),
    );
    expect(await execute()).toEqual({ state: 'aborted' });
    expect(
      query.mock.calls.some(([text]) => text.includes('apply_exercise')),
    ).toBe(false);
  });
  it('rolls back a SQL apply rejection without calling commit', async () => {
    query.mockImplementation(async (text, values) => {
      if (text.includes('apply_exercise')) throw Error('PRIVATE SQL');
      return defaultQuery(text, values);
    });
    expect(await execute()).toEqual({ state: 'aborted' });
    expect(events).not.toContain('COMMIT');
    expect(release).toHaveBeenCalledWith(false);
  });
  it('rolls back all target work when fresh source access is revoked before commit', async () => {
    expect(
      await execute(async () => {
        throw Error('source revoked');
      }),
    ).toEqual({ state: 'aborted' });
    expect(events).toContain('ROLLBACK');
    expect(events).not.toContain('COMMIT');
  });
  it('refuses an invalid apply response before commit', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('apply_exercise')
        ? { rows: [{ applied: { result: 'published' } }] }
        : defaultQuery(text, values),
    );
    expect(await execute()).toEqual({ state: 'aborted' });
    expect(events).not.toContain('COMMIT');
  });
  it('accepts an already converged target only as an unchanged result', async () => {
    query.mockImplementation(async (text, values) => {
      if (text.includes('inspect_exercise'))
        return { rows: [{ inspection: final() }] };
      if (text.includes('apply_exercise'))
        return {
          rows: [
            {
              applied: {
                result: 'unchanged',
                businessDigest: sql.payload.businessDigest,
                target: final().state,
              },
            },
          ],
        };
      return defaultQuery(text, values);
    });
    expect(await execute()).toMatchObject({
      state: 'committed',
      outcome: { result: 'unchanged' },
    });
  });
  it('refuses an apply result that calls a creation unchanged', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('apply_exercise')
        ? {
            rows: [
              {
                applied: {
                  result: 'unchanged',
                  businessDigest: sql.payload.businessDigest,
                  target: final().state,
                },
              },
            ],
          }
        : defaultQuery(text, values),
    );
    expect(await execute()).toEqual({ state: 'aborted' });
    expect(events).not.toContain('COMMIT');
  });
  it('reactivates an older published revision only with the explicit rollback mode', async () => {
    const before = final();
    const after = final();
    const newer = {
      ...before.state.active!,
      id: 'a6400000-0000-4000-8000-000000000001',
      revision: 2,
      businessDigest: 'd'.repeat(64),
      definitionJson: JSON.stringify({
        ...JSON.parse(sql.payload.definitionJson),
        revision: '2',
      }),
    };
    before.state.active = newer;
    before.state.parent!.activeVersionId = newer.id;
    before.state.latestRevision = 2;
    before.state.stateToken = 'a'.repeat(64);
    after.state.latestRevision = 2;
    const item = publicationOperation({
      ...operation(),
      mode: 'rollback',
      inspection: before,
    })!;
    let reads = 0;
    query.mockImplementation(async (text, values) => {
      if (text.includes('inspect_exercise'))
        return { rows: [{ inspection: ++reads === 1 ? before : after }] };
      if (text.includes('apply_exercise'))
        return {
          rows: [
            {
              applied: {
                result: 'rolled_back',
                businessDigest: sql.payload.businessDigest,
                target: after.state,
              },
            },
          ],
        };
      return defaultQuery(text, values);
    });
    expect(
      await target().withLease(item, (lease) =>
        lease.apply(claimed(item), async () => {}),
      ),
    ).toMatchObject({
      state: 'committed',
      outcome: { result: 'rolled_back', revision: 1 },
    });
    expect(
      query.mock.calls.find(([text]) =>
        text.includes('apply_exercise'),
      )![1]?.[2],
    ).toBe('rollback');
  });
  it('does not claim a definite failure after losing the rollback acknowledgement', async () => {
    query.mockImplementation(async (text, values) => {
      if (text === 'ROLLBACK') throw Error('lost rollback');
      return defaultQuery(text, values);
    });
    expect(
      await execute(async () => {
        throw Error('revoke');
      }),
    ).toEqual({ state: 'uncertain' });
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each(['reject', 'wrong-command'])(
    'preserves uncertainty after a commit %s',
    async (failure) => {
      query.mockImplementation(async (text, values) => {
        if (text === 'COMMIT') {
          events.push(text);
          if (failure === 'reject') throw Error('lost ack');
          return { rows: [], command: 'ROLLBACK' };
        }
        return defaultQuery(text, values);
      });
      expect(await execute()).toEqual({ state: 'uncertain' });
      expect(events.at(-1)).toBe('COMMIT');
      expect(release).toHaveBeenCalledExactlyOnceWith(true);
    },
  );
  it('requires a real post-commit read instead of trusting the apply response', async () => {
    query.mockImplementation(async (text, values) => {
      if (text.includes('inspect_exercise') && inspectionCount === 1)
        throw Error('verification unavailable');
      return defaultQuery(text, values);
    });
    expect(await execute()).toEqual({ state: 'uncertain' });
    expect(events).toContain('COMMIT');
    expect(release).toHaveBeenCalledWith(true);
  });
  it('refuses a different post-commit state token even if content converges', async () => {
    query.mockImplementation(async (text, values) => {
      if (text.includes('inspect_exercise') && inspectionCount === 1)
        return {
          rows: [
            {
              inspection: {
                ...final(),
                state: { ...final().state, stateToken: 'e'.repeat(64) },
              },
            },
          ],
        };
      return defaultQuery(text, values);
    });
    expect(await execute()).toEqual({ state: 'uncertain' });
    expect(release).toHaveBeenCalledWith(true);
  });
  it('preserves the verified commit fact if only cleanup of the read transaction fails', async () => {
    query.mockImplementation(async (text, values) => {
      if (text === 'ROLLBACK') throw Error('cleanup lost');
      return defaultQuery(text, values);
    });
    expect((await execute()).state).toBe('committed');
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('destroys a connection whose session lock cannot be released', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('pg_advisory_unlock')
        ? { rows: [{ unlocked: false }] }
        : defaultQuery(text, values),
    );
    expect((await execute()).state).toBe('committed');
    expect(release).toHaveBeenCalledWith(true);
  });
  it('preserves a callback error and still releases its session lock', async () => {
    const error = Error('caller failed');
    await expect(
      target().withLease(operation(), async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(events.at(-1)).toContain('pg_advisory_unlock');
    expect(release).toHaveBeenCalledWith(false);
  });
  it('does not enter a callback after failing to obtain the lock', async () => {
    query.mockRejectedValue(Error('busy lock'));
    const work = vi.fn();
    await expect(target().withLease(operation(), work)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(work).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledWith(true);
  });
  it('does not apply twice on one lease', async () => {
    const item = operation();
    await target().withLease(item, async (lease) => {
      expect((await lease.apply(claimed(item), async () => {})).state).toBe(
        'committed',
      );
      await expect(
        lease.apply(claimed(item), async () => {}),
      ).rejects.toMatchObject({ code: 'invalid' });
    });
  });
});
describe('Publication cible : reprise sans transfert', () => {
  it('observes convergence as unchanged without asserting historical ownership of the commit', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('inspect_exercise')
        ? { rows: [{ inspection: final() }] }
        : defaultQuery(text, values),
    );
    expect(await observe()).toMatchObject({
      state: 'committed',
      outcome: { result: 'unchanged' },
    });
    expect(
      query.mock.calls.some(
        ([text]) => text.includes('apply_exercise') || text === 'COMMIT',
      ),
    ).toBe(false);
    expect(events[0]).toContain('pg_advisory_lock');
    expect(events[1]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ');
  });
  it('confirms not_applied only from the original token after waiting on the shared lock', async () => {
    expect(await observe()).toEqual({ state: 'not_applied' });
    expect(events[0]).toContain('pg_advisory_lock');
  });
  it('does not classify a different state as known not_applied', async () => {
    query.mockImplementation(async (text, values) =>
      text.includes('inspect_exercise')
        ? {
            rows: [
              {
                inspection: {
                  ...initial(),
                  state: { ...initial().state, stateToken: 'f'.repeat(64) },
                },
              },
            ],
          }
        : defaultQuery(text, values),
    );
    expect(await observe()).toEqual({ state: 'uncertain' });
  });
  it('does not infer failure for an original no-op that could have committed', async () => {
    const item = { ...operation('uncertain'), inspection: final() };
    query.mockImplementation(async (text, values) =>
      text.includes('inspect_exercise')
        ? {
            rows: [
              {
                inspection: {
                  ...final(),
                  desiredHeader: {
                    ...final().desiredHeader,
                    competences: ['renamed-reference'],
                  },
                },
              },
            ],
          }
        : defaultQuery(text, values),
    );
    expect(await target().withLease(item, (lease) => lease.observe())).toEqual({
      state: 'uncertain',
    });
  });
  it('keeps an unavailable observation uncertain and never writes the target', async () => {
    query.mockImplementation(async (text, values) => {
      if (text.includes('inspect_exercise'))
        throw Error('private target error');
      return defaultQuery(text, values);
    });
    expect(await observe()).toEqual({ state: 'uncertain' });
    expect(
      query.mock.calls.some(([text]) => text.includes('apply_exercise')),
    ).toBe(false);
  });
  it('refuses recovery of a merely prepared plan', async () => {
    await expect(
      target().withLease(operation(), (lease) => lease.observe()),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
  it('reads a preparation snapshot and rolls back its reference locks', async () => {
    expect(await target().inspect(sql.payload, 'publish')).toEqual(initial());
    expect(events).toContain('ROLLBACK');
    expect(release).toHaveBeenCalledWith(false);
  });
  it.each(['missing-rollback', 'implicit-rollback'])(
    'reports a business conflict for %s without applying or leaking reference locks',
    async (kind) => {
      const snapshot = kind === 'missing-rollback' ? initial() : final();
      if (kind === 'implicit-rollback') {
        const active = snapshot.state.active!;
        snapshot.state.active = {
          ...active,
          id: 'af100000-0000-4000-8000-000000000001',
          revision: active.revision + 1,
          definitionJson: JSON.stringify({
            ...JSON.parse(active.definitionJson),
            revision: String(active.revision + 1),
          }),
          businessDigest: 'c'.repeat(64),
        };
        snapshot.state.parent!.activeVersionId = snapshot.state.active.id;
        snapshot.state.latestRevision = snapshot.state.active.revision;
      }
      query.mockImplementation((text) =>
        text.includes('inspect_exercise_publication')
          ? Promise.resolve({
              rows: [{ inspection: snapshot }],
              command: 'SELECT',
            })
          : defaultQuery(text),
      );
      await expect(
        target().inspect(
          sql.payload,
          kind === 'missing-rollback' ? 'rollback' : 'publish',
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(events).toContain('ROLLBACK');
      expect(
        query.mock.calls.some(([text]) =>
          text.includes('apply_exercise_publication'),
        ),
      ).toBe(false);
      expect(release).toHaveBeenCalledWith(false);
    },
  );
  it.each(['malformed-response', 'transport', 'wrong-catalog'])(
    'keeps %s an unavailable inspection rather than a publication conflict',
    async (kind) => {
      query.mockImplementation((text) => {
        if (text.includes('inspect_exercise_publication')) {
          if (kind === 'transport')
            throw Object.assign(Error('private driver detail'), {
              code: 'rollback_unavailable',
            });
          if (kind === 'wrong-catalog') {
            const snapshot = initial();
            snapshot.state.catalogId = 'af200000-0000-4000-8000-000000000001';
            return Promise.resolve({
              rows: [{ inspection: snapshot }],
              command: 'SELECT',
            });
          }
          return Promise.resolve({
            rows: [{ inspection: { invalid: true } }],
            command: 'SELECT',
          });
        }
        return defaultQuery(text);
      });
      await expect(
        target().inspect(sql.payload, 'rollback'),
      ).rejects.toMatchObject({ code: 'unavailable', message: 'unavailable' });
      expect(events).toContain('ROLLBACK');
      expect(release).toHaveBeenCalledWith(false);
    },
  );
  it.each([null, {}, { ...sql.payload, catalogId: 'bad' }])(
    'rejects invalid inspection input %# before connecting',
    async (payload) => {
      await expect(target().inspect(payload, 'publish')).rejects.toMatchObject({
        code: 'invalid',
      });
      expect(connect).not.toHaveBeenCalled();
    },
  );
});
