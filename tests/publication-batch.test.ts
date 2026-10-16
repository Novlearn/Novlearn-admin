import { describe, expect, it, vi } from 'vitest';
import native from './fixtures/publication-journal-sql.json';
import { planPublication } from '@/lib/publication';
import {
  PublicationBatch,
  MAX_PUBLICATION_BATCH,
  batchUrl,
  parseBatchQuery,
  batchCandidate,
  type BatchCandidate,
} from '@/lib/publication-batch';
import type {
  PublicationCommand,
  PublicationSummary,
} from '@/lib/publication-view';
const id = (i: number, family = 1) =>
  `a7000000-0000-4000-800${family}-${String(i).padStart(12, '0')}`;
const batch = id(1, 9);
const candidate = (i: number): BatchCandidate => ({
  versionId: id(i),
  exerciseId: String(BigInt('9007199254740993') + BigInt(i)),
  catalogId: id(i, 2),
  title: 'Exercice ' + i,
  revision: 1,
  fingerprint: 'a'.repeat(64),
  epoch: '9007199254740993',
  status: 'approved',
  archived: false,
});
const summary = (
  i: number,
  state: PublicationSummary['state'] = 'planned',
): PublicationSummary => ({
  id: id(i, 3),
  batchId: batch,
  sourceVersionId: id(i),
  catalogId: id(i, 2),
  revision: 1,
  mode: 'publish',
  state,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  outcome:
    state === 'committed'
      ? { ...native.outcome, result: 'published', catalogId: id(i, 2) }
      : null,
  error: state === 'failed' ? 'not_applied' : null,
});
const prepared = (i: number) => ({
  operation: summary(i),
  confirmation: 'Zml4dHVyZQ.' + 'a'.repeat(64),
  plan: {
    ...planPublication(native.payload, native.inspection, 'publish'),
    catalogId: id(i, 2),
  },
});
function setup(count = 3, enabled = true) {
  const candidates = Array.from({ length: count }, (_, i) => candidate(i + 1));
  const calls: PublicationCommand[] = [];
  const send = vi.fn(async (command: PublicationCommand) => {
    calls.push(command);
    const i = Number(
      ('versionId' in command ? command.versionId : command.operationId).slice(
        -12,
      ),
    );
    return command.action === 'prepare'
      ? prepared(i)
      : summary(i, command.action === 'cancel' ? 'cancelled' : 'committed');
  });
  const runner = new PublicationBatch(
    batch,
    candidates.map((c) => ({ versionId: c.versionId, operationId: null })),
    candidates,
    enabled,
    send,
  );
  const review = () => {
    for (const c of candidates) runner.review(c.versionId, true);
  };
  return { runner, candidates, calls, send, review };
}
describe('batch selection and bounded durable identities', () => {
  it('rejects empty, duplicate, excessive, malformed and capability-bearing URLs', () => {
    for (const query of [
      '',
      'version=wrong',
      `version=${id(1)}&version=${id(1).toUpperCase()}`,
      `version=${id(1)}~${id(1, 3)}`,
      `version=${id(1)}&confirmation=secret`,
      Array.from(
        { length: MAX_PUBLICATION_BATCH + 1 },
        (_, i) => 'version=' + id(i + 1),
      ).join('&'),
    ])
      expect(parseBatchQuery(new URLSearchParams(query))).toBeNull();
    expect(
      parseBatchQuery(new URLSearchParams(`version=${id(1)}&version=${id(2)}`))
        ?.items,
    ).toHaveLength(2);
  });
  it('keeps bigint identities and epochs exact and rejects rounded numbers', () => {
    expect(batchCandidate(candidate(1))).toBe(true);
    expect(
      batchCandidate({
        ...candidate(1),
        exerciseId: Number(candidate(1).exerciseId),
      }),
    ).toBe(false);
    expect(
      batchCandidate({ ...candidate(1), epoch: Number(candidate(1).epoch) }),
    ).toBe(false);
    expect(
      () =>
        new PublicationBatch(
          batch,
          [
            { versionId: id(1), operationId: null },
            { versionId: id(2), operationId: null },
          ],
          [
            candidate(1),
            { ...candidate(2), catalogId: candidate(1).catalogId },
          ],
          true,
        ),
    ).toThrow('une seule révision');
  });
  it('does not send anything when disabled or when sources are missing or unapproved', async () => {
    const f = setup(2, false);
    await f.runner.run('prepare');
    await f.runner.run('confirm');
    expect(f.send).not.toHaveBeenCalled();
    const send = vi.fn();
    const runner = new PublicationBatch(
      batch,
      [1, 2].map((i) => ({ versionId: id(i), operationId: null })),
      [{ ...candidate(1), status: 'draft' }, null],
      true,
      send,
    );
    await runner.run('prepare');
    expect(send).not.toHaveBeenCalled();
  });
});
describe('independent transactions without automatic retry', () => {
  it('prepares sequentially under one batch and requires a separate reviewed confirmation for each item', async () => {
    const f = setup();
    await f.runner.run('prepare');
    expect(f.calls.map((c) => c.action)).toEqual([
      'prepare',
      'prepare',
      'prepare',
    ]);
    expect(
      f.calls.every((c) => c.action !== 'prepare' || c.batchId === batch),
    ).toBe(true);
    await f.runner.run('confirm');
    expect(f.calls).toHaveLength(3);
    f.runner.review(id(2), true);
    await f.runner.run('confirm');
    expect(f.calls.at(-1)).toMatchObject({
      action: 'confirm',
      operationId: id(2, 3),
    });
    expect(f.runner.snapshot().rows.map((r) => r.operation?.state)).toEqual([
      'planned',
      'committed',
      'planned',
    ]);
    expect(f.runner.checkpoint()).not.toContain('Zml4dHVyZQ');
    expect(f.runner.checkpoint()).not.toContain('fingerprint');
  });
  it('stops on an uncertain second result and recovers without reapplying or consuming the third confirmation', async () => {
    const f = setup();
    await f.runner.run('prepare');
    f.review();
    f.send.mockImplementation(async (command) => {
      f.calls.push(command);
      return summary(
        Number(
          ('operationId' in command ? command.operationId : id(1)).slice(-12),
        ),
        'operationId' in command && command.operationId === id(2, 3)
          ? 'uncertain'
          : 'committed',
      );
    });
    await f.runner.run('confirm');
    expect(f.calls.filter((c) => c.action === 'confirm')).toHaveLength(2);
    expect(f.runner.snapshot().rows.map((r) => r.phase)).toEqual([
      'known',
      'verify',
      'ready',
    ]);
    expect(f.runner.snapshot().rows[2].reviewed).toBe(false);
    f.runner.review(id(3), true);
    await f.runner.run('confirm');
    expect(f.calls.filter((c) => c.action === 'confirm')).toHaveLength(2);
    f.send.mockImplementation(async (command) => {
      f.calls.push(command);
      return summary(2, 'committed');
    });
    await f.runner.run('recover');
    expect(f.calls.at(-1)).toMatchObject({
      action: 'recover',
      operationId: id(2, 3),
    });
    expect(f.runner.snapshot().rows[2].prepared).not.toBeNull();
    expect(f.calls.filter((c) => c.action === 'prepare')).toHaveLength(3);
  });
  it('consumes a token before a lost response and forbids both a second confirmation and blind cancellation', async () => {
    const f = setup(2);
    await f.runner.run('prepare');
    f.review();
    f.send.mockRejectedValueOnce(Error('lost response'));
    await f.runner.run('confirm');
    expect(f.runner.snapshot().rows[0]).toMatchObject({
      phase: 'verify',
      prepared: null,
      operation: null,
    });
    await f.runner.run('confirm');
    expect(f.send).toHaveBeenCalledTimes(3);
    // Only the other known planned operation may be cancelled.
    f.send.mockImplementation(async (command) => {
      f.calls.push(command);
      return summary(2, 'cancelled');
    });
    await f.runner.run('cancel');
    expect(f.calls.at(-1)).toMatchObject({
      action: 'cancel',
      operationId: id(2, 3),
    });
  });
  it('does not continue preparation after a failed/unknown response or retry it automatically', async () => {
    const f = setup();
    f.send.mockRejectedValueOnce(Error('unknown preparation'));
    await f.runner.run('prepare');
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.runner.snapshot().rows.map((r) => r.phase)).toEqual([
      'blocked',
      'idle',
      'idle',
    ]);
    await f.runner.run('prepare');
    expect(
      f.calls.filter((c) => c.action === 'prepare').map((c) => c.versionId),
    ).toEqual([id(2), id(3)]);
  });
  it.each([
    'batchId',
    'sourceVersionId',
    'catalogId',
    'revision',
    'mode',
  ] as const)('rejects a response bound to another %s', async (field) => {
    const f = setup(1);
    const invalid = prepared(1);
    (invalid.operation as Record<string, unknown>)[field] =
      field === 'revision' ? 2 : field === 'mode' ? 'rollback' : id(99);
    f.send.mockResolvedValueOnce(invalid);
    await f.runner.run('prepare');
    expect(f.runner.snapshot().rows[0].phase).toBe('blocked');
    expect(f.runner.snapshot().rows[0].prepared).toBeNull();
  });
  it('reconstructs only observation rights from URL identities, never confirmation tokens', async () => {
    const f = setup(2);
    await f.runner.run('prepare');
    const locator = parseBatchQuery(
      new URL('http://fixture' + f.runner.checkpoint()).searchParams,
    )!;
    const send = vi.fn(async (command: PublicationCommand) =>
      summary(
        Number(
          ('operationId' in command ? command.operationId : id(1)).slice(-12),
        ),
        'planned',
      ),
    );
    const restored = new PublicationBatch(
      locator.batchId!,
      locator.items,
      f.candidates,
      true,
      send,
    );
    await restored.run('confirm');
    await restored.run('prepare');
    expect(send).not.toHaveBeenCalled();
    await restored.run('recover');
    expect(send.mock.calls.every(([c]) => c.action === 'recover')).toBe(true);
    expect(
      restored
        .snapshot()
        .rows.every((r) => r.phase === 'verify' && r.prepared === null),
    ).toBe(true);
    restored.replan(id(1));
    expect(restored.snapshot().rows[0].phase).toBe('verify');
  });
  it('requires explicit replanning after a confirmed cancellation and preserves other results', async () => {
    const f = setup(2);
    await f.runner.run('prepare');
    await f.runner.run('cancel');
    expect(
      f.runner.snapshot().rows.every((r) => r.operation?.state === 'cancelled'),
    ).toBe(true);
    await f.runner.run('prepare');
    expect(f.send).toHaveBeenCalledTimes(4);
    f.runner.replan(id(1));
    expect(f.runner.snapshot().rows[0]).toMatchObject({
      phase: 'idle',
      operationId: null,
    });
    expect(f.runner.snapshot().rows[1].operation?.state).toBe('cancelled');
  });
  it('rechecks expiration between transfers and never sends the expired second plan', async () => {
    let clock = Date.now();
    const candidates = [candidate(1), candidate(2)];
    const send = vi.fn(async (command: PublicationCommand) => {
      const i = Number(
        ('versionId' in command
          ? command.versionId
          : command.operationId
        ).slice(-12),
      );
      if (command.action === 'prepare') {
        const p = prepared(i);
        p.operation.expiresAt = new Date(clock + 1000).toISOString();
        return p;
      }
      clock += 2000;
      return summary(i, 'committed');
    });
    const runner = new PublicationBatch(
      batch,
      candidates.map((c) => ({ versionId: c.versionId, operationId: null })),
      candidates,
      true,
      send,
      undefined,
      () => clock,
    );
    await runner.run('prepare');
    runner.review(id(1), true);
    runner.review(id(2), true);
    await runner.run('confirm');
    expect(
      send.mock.calls.filter(([c]) => c.action === 'confirm'),
    ).toHaveLength(1);
    expect(runner.snapshot().rows[1].error).toContain('expiré');
  });
  it('blocks concurrent UI actions and stops further sends on dispose even if an in-flight response arrives late', async () => {
    const f = setup(2);
    let finish!: (v: ReturnType<typeof prepared>) => void;
    f.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = f.runner.run('prepare');
    await f.runner.run('prepare');
    expect(f.send).toHaveBeenCalledTimes(1);
    f.runner.dispose();
    finish(prepared(1));
    await first;
    expect(f.send).toHaveBeenCalledTimes(1);
    f.runner.activate();
    await f.runner.run('prepare');
    expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('takes detached snapshots so UI inspection cannot manufacture a confirmation', async () => {
    const f = setup(1);
    await f.runner.run('prepare');
    const copy = f.runner.snapshot();
    copy.rows[0].reviewed = true;
    copy.rows[0].prepared!.confirmation = 'forged';
    await f.runner.run('confirm');
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.runner.snapshot().rows[0].prepared!.confirmation).not.toBe(
      'forged',
    );
    expect(
      batchUrl(batch, [{ versionId: id(1), operationId: id(1, 3) }]),
    ).toContain('version=');
  });
});
