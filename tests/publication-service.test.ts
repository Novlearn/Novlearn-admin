import { beforeEach, expect, it, vi } from 'vitest';
import native from './fixtures/publication-journal-sql.json';
import {
  PublicationService,
  readPublicationConfirmationKey,
} from '@/lib/publication-service';
import { PublicationJournalError } from '@/lib/publication-journal-server';
import { PublicationVerificationError } from '@/lib/publication-verification';
import { PreviewError } from '@/lib/preview-server';
import {
  publicationOperation,
  type PublicationOperation,
} from '@/lib/publication-journal';
import { parsePublicationSource } from '@/lib/publication-source';
import type {
  TargetLease,
  TargetExecution,
  TargetObservation,
} from '@/lib/publication-target';
import { PublicationTargetError } from '@/lib/publication-target';
vi.mock('server-only', () => ({}));
const actor = native.actor_id,
  id = native.id;
const selection = {
  versionId: native.version_id,
  fingerprint: native.source_fingerprint,
  epoch: native.source_epoch,
};
const signal = () => new AbortController().signal;
const original = () =>
  publicationOperation({
    ...structuredClone(native),
    state: 'planned',
    outcome: null,
    error_code: null,
  })!;
const exported = () =>
  parsePublicationSource(
    { payload: native.payload, source: native.source_snapshot },
    selection,
  )!;
it('preserves a target business conflict without preparing a journal operation or applying a transfer', async () => {
  const fixture = setup();
  fixture.target.inspect.mockRejectedValueOnce(
    new PublicationTargetError('conflict'),
  );
  await expect(fixture.prepare()).rejects.toMatchObject({ code: 'conflict' });
  expect(fixture.journal.prepare).not.toHaveBeenCalled();
  expect(fixture.apply).not.toHaveBeenCalled();
});
function setup() {
  let state = original(),
    clock = Date.parse(native.created_at) + 2000,
    locked = false;
  const trace: string[] = [];
  const auth = {
    getVerifiedUser: vi.fn(async () => ({ id: actor, isAnonymous: false })),
    getProfileRole: vi.fn(async () => 'admin'),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  const acquire = vi.fn(() => {
    trace.push('acquire');
    return () => trace.push('release-job');
  });
  const source = vi.fn(async () => {
    trace.push('source');
    return exported();
  });
  const verify = vi.fn(async () => {
    trace.push('verify');
    return {
      definitionDigest: native.source_snapshot.report.definitionDigest,
      engineArchiveSha256: native.payload.engineArchiveSha256,
      seeds: [0, 42],
      checkedAt: clock,
    };
  });
  const apply = vi.fn(
    async (
      _op: PublicationOperation,
      beforeCommit: () => Promise<void>,
    ): Promise<TargetExecution> => {
      trace.push('apply');
      await beforeCommit();
      trace.push('commit');
      return {
        state: 'committed',
        outcome: structuredClone(native.outcome) as NonNullable<
          PublicationOperation['outcome']
        >,
      };
    },
  );
  const observe = vi.fn(
    async (): Promise<TargetObservation> => ({
      state: 'committed',
      outcome: {
        ...structuredClone(native.outcome),
        result: 'unchanged',
      } as NonNullable<PublicationOperation['outcome']>,
    }),
  );
  const target = {
    inspect: vi.fn(async () => {
      trace.push('inspect');
      return structuredClone(native.inspection);
    }),
    withLease: async <T>(
      _op: PublicationOperation,
      work: (lease: TargetLease) => Promise<T>,
    ) => {
      trace.push('lock-target');
      locked = true;
      try {
        return await work({ apply, observe });
      } finally {
        locked = false;
        trace.push('unlock-target');
      }
    },
  };
  const recheck = vi.fn(async () => {
    trace.push('source-recheck');
  });
  const journal = {
    prepare: vi.fn(async (input: { batchId: string }) => {
      trace.push('prepare');
      state = { ...state, batch_id: input.batchId };
      return structuredClone(state);
    }),
    get: vi.fn(async () => structuredClone(state)),
    claim: vi.fn(
      async (_id: string, _digest: string, action: 'claim' | 'cancel') => {
        if (action === 'claim') expect(locked).toBe(true);
        trace.push(action);
        state = {
          ...state,
          state: action === 'claim' ? 'executing' : 'cancelled',
        };
        return structuredClone(state);
      },
    ),
    withSourceLease: async <T>(
      _id: string,
      _digest: string,
      work: (
        op: PublicationOperation,
        recheck: () => Promise<void>,
      ) => Promise<T>,
    ) => {
      trace.push('lock-source');
      return work(structuredClone(state), recheck);
    },
    record: vi.fn(
      async (
        _op: PublicationOperation,
        _expected: 'executing' | 'uncertain',
        next: 'committed' | 'uncertain' | 'failed',
        outcome: PublicationOperation['outcome'] = null,
        error: PublicationOperation['error_code'] = null,
      ) => {
        expect(locked).toBe(true);
        trace.push('record');
        state = { ...state, state: next, outcome, error_code: error };
        return structuredClone(state);
      },
    ),
    pending: vi.fn(async () => ({
      items: [structuredClone(state)],
      next: null as string | null,
    })),
  };
  const targetLeaseSpy = vi.spyOn(target, 'withLease');
  const sourceLeaseSpy = vi.spyOn(journal, 'withSourceLease');
  const deps = {
    auth,
    journal,
    target,
    targetKey: native.target_key,
    confirmationKey: Buffer.alloc(32, 7),
    source,
    verify,
    acquire,
    now: () => clock,
  };
  const service = new PublicationService(deps);
  const prepare = () =>
    service.prepare({ ...selection, mode: 'publish' }, signal());
  return {
    service,
    deps,
    prepare,
    trace,
    auth,
    journal,
    target,
    source,
    verify,
    apply,
    observe,
    recheck,
    acquire,
    targetLeaseSpy,
    sourceLeaseSpy,
    get state() {
      return state;
    },
    set state(value: PublicationOperation) {
      state = value;
    },
    advance: () => {
      clock = Date.parse(native.expires_at) + 1;
    },
  };
}
let fixture: ReturnType<typeof setup>;
beforeEach(() => {
  fixture = setup();
});
it('requires a separate explicit server key of exactly 32 bytes', () => {
  for (const key of [
    undefined,
    '',
    'replace_me',
    'a'.repeat(63),
    'z'.repeat(64),
  ])
    expect(
      readPublicationConfirmationKey({
        ADMIN_PUBLICATION_CONFIRMATION_KEY: key,
      }),
    ).toBeNull();
  expect(
    readPublicationConfirmationKey({
      ADMIN_PUBLICATION_CONFIRMATION_KEY: 'ab'.repeat(32),
    }),
  ).toEqual(Buffer.alloc(32, 0xab));
  expect(
    () =>
      new PublicationService({
        ...fixture.deps,
        confirmationKey: Buffer.alloc(31),
      }),
  ).toThrow('invalid');
});
it('prepares only after fresh source and Engine, returns the immutable diff and a minimal projection', async () => {
  const plan = await fixture.prepare();
  expect(plan.operation).toMatchObject({
    id,
    state: 'planned',
    sourceVersionId: native.version_id,
  });
  expect(plan.plan.action).toBe('create_exercise');
  expect(plan.confirmation).toMatch(/^[-_a-zA-Z0-9]+\.[a-f0-9]{64}$/);
  expect(fixture.trace).toEqual([
    'acquire',
    'source',
    'verify',
    'inspect',
    'prepare',
    'release-job',
  ]);
  expect(JSON.stringify(plan.operation)).not.toMatch(
    /PRIVATE_|source_snapshot|receiptId|report|cases|definitionJson|plan_digest/,
  );
  expect(fixture.auth.getVerifiedUser).toHaveBeenCalledTimes(2);
});
it.each(['getVerifiedUser', 'getProfileRole'] as const)(
  'denies unauthorized %s before source, Engine or private SQL',
  async (method) => {
    if (method === 'getVerifiedUser')
      fixture.auth.getVerifiedUser.mockResolvedValue(null as never);
    else fixture.auth.getProfileRole.mockResolvedValue('user');
    await expect(fixture.prepare()).rejects.toHaveProperty('code', 'forbidden');
    expect(fixture.source).not.toHaveBeenCalled();
    expect(fixture.target.inspect).not.toHaveBeenCalled();
    expect(fixture.journal.prepare).not.toHaveBeenCalled();
  },
);
it('rechecks the actor after Engine and releases the shared slot on role revocation', async () => {
  fixture.verify.mockImplementation(async () => {
    fixture.auth.getProfileRole.mockResolvedValue('user');
    return {
      definitionDigest: native.source_snapshot.report.definitionDigest,
      engineArchiveSha256: native.payload.engineArchiveSha256,
      seeds: [0, 42],
      checkedAt: Date.parse(native.created_at) + 2000,
    };
  });
  await expect(fixture.prepare()).rejects.toHaveProperty('code', 'forbidden');
  expect(fixture.journal.prepare).not.toHaveBeenCalled();
  expect(fixture.trace.at(-1)).toBe('release-job');
});
it('fails before preparing when Engine fails or shared admission is full', async () => {
  fixture.verify.mockRejectedValueOnce(new PublicationVerificationError());
  await expect(fixture.prepare()).rejects.toHaveProperty(
    'code',
    'verification',
  );
  expect(fixture.journal.prepare).not.toHaveBeenCalled();
  fixture.acquire.mockImplementation(() => {
    throw new PreviewError(429, 'busy');
  });
  await expect(fixture.prepare()).rejects.toHaveProperty('code', 'busy');
});
it('refuses an export changed while the private plan was prepared', async () => {
  fixture.journal.prepare.mockImplementation(async () => ({
    ...fixture.state,
    source_fingerprint: 'a'.repeat(64),
  }));
  await expect(fixture.prepare()).rejects.toHaveProperty('code', 'unavailable');
  expect(fixture.apply).not.toHaveBeenCalled();
});
it('retests before claim, locks target before claim, rechecks source before commit and records before unlock', async () => {
  const plan = await fixture.prepare();
  fixture.trace.length = 0;
  const result = await fixture.service.confirm(id, plan.confirmation, signal());
  expect(result).toMatchObject({
    state: 'committed',
    outcome: { result: 'published' },
  });
  expect(fixture.trace).toEqual([
    'acquire',
    'source',
    'verify',
    'lock-target',
    'claim',
    'lock-source',
    'apply',
    'source-recheck',
    'commit',
    'record',
    'unlock-target',
    'release-job',
  ]);
  expect(fixture.verify).toHaveBeenCalledTimes(2);
  expect(fixture.apply).toHaveBeenCalledTimes(1);
});
it.each(['altered', 'expired', 'other-key', 'other-actor', 'other-target'])(
  'refuses a %s confirmation without a target write',
  async (variant) => {
    const plan = await fixture.prepare();
    let service = fixture.service,
      token = plan.confirmation;
    if (variant === 'altered')
      token = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    if (variant === 'expired') fixture.advance();
    if (variant === 'other-key')
      service = new PublicationService({
        ...fixture.deps,
        confirmationKey: Buffer.alloc(32, 8),
      });
    if (variant === 'other-actor')
      fixture.auth.getVerifiedUser.mockResolvedValue({
        id: '98500000-0000-4000-8000-000000000002',
        isAnonymous: false,
      });
    if (variant === 'other-target')
      service = new PublicationService({
        ...fixture.deps,
        targetKey: 'different-target',
      });
    await expect(service.confirm(id, token, signal())).rejects.toHaveProperty(
      'code',
    );
    expect(fixture.journal.claim).not.toHaveBeenCalled();
    expect(fixture.apply).not.toHaveBeenCalled();
  },
);
it('binds the confirmation to the exact private plan digest', async () => {
  const plan = await fixture.prepare();
  fixture.state = { ...fixture.state, plan_digest: 'a'.repeat(64) };
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toHaveProperty('code', 'conflict');
  expect(fixture.journal.claim).not.toHaveBeenCalled();
});
it('does not claim a changed source snapshot or a failed fresh Engine test', async () => {
  const plan = await fixture.prepare();
  fixture.source.mockImplementationOnce(async () => {
    const changed = exported();
    changed.source.reviewId = '98500000-0000-4000-8000-000000000003';
    return changed;
  });
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toHaveProperty('code', 'conflict');
  fixture.verify.mockRejectedValueOnce(new PublicationVerificationError());
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toHaveProperty('code', 'verification');
  expect(fixture.journal.claim).not.toHaveBeenCalled();
  expect(fixture.target.withLease).not.toHaveBeenCalled();
});
it('records a known abort without reporting a publication', async () => {
  const plan = await fixture.prepare();
  fixture.apply.mockResolvedValueOnce({ state: 'aborted' });
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).resolves.toMatchObject({
    state: 'failed',
    outcome: null,
    error: 'not_applied',
  });
});
it('keeps a lost COMMIT acknowledgement uncertain and never retries automatically', async () => {
  const plan = await fixture.prepare();
  fixture.apply.mockResolvedValueOnce({ state: 'uncertain' });
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).resolves.toMatchObject({ state: 'uncertain', outcome: null });
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toHaveProperty('code', 'recovery_required');
  expect(fixture.apply).toHaveBeenCalledTimes(1);
});
it('preserves a committed fact after browser cancellation', async () => {
  const plan = await fixture.prepare(),
    abort = new AbortController();
  fixture.apply.mockImplementationOnce(async (_op, before) => {
    await before();
    abort.abort();
    return {
      state: 'committed',
      outcome: structuredClone(native.outcome) as NonNullable<
        PublicationOperation['outcome']
      >,
    };
  });
  await expect(
    fixture.service.confirm(id, plan.confirmation, abort.signal),
  ).resolves.toHaveProperty('state', 'committed');
  expect(fixture.journal.record).toHaveBeenCalledTimes(1);
});
it('does not turn an unknown claim acknowledgement into failure or reapplication', async () => {
  const plan = await fixture.prepare();
  fixture.journal.claim.mockRejectedValueOnce(
    new PublicationJournalError('unavailable'),
  );
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toHaveProperty('code', 'recovery_required');
  expect(fixture.apply).not.toHaveBeenCalled();
  expect(fixture.journal.record).not.toHaveBeenCalled();
});
it('leaves a committed target pending recovery if durable source recording fails', async () => {
  const plan = await fixture.prepare();
  fixture.journal.record.mockRejectedValueOnce(new Error('PRIVATE DB FAILURE'));
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).rejects.toMatchObject({
    code: 'recovery_required',
    message: 'recovery_required',
  });
  expect(fixture.state.state).toBe('executing');
  expect(fixture.apply).toHaveBeenCalledTimes(1);
  expect(fixture.journal.record).toHaveBeenCalledTimes(1);
});
it('records no target application if source protection fails before apply', async () => {
  const plan = await fixture.prepare();
  fixture.sourceLeaseSpy.mockRejectedValueOnce(
    new PublicationJournalError('forbidden'),
  );
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).resolves.toMatchObject({ state: 'failed', error: 'not_applied' });
  expect(fixture.apply).not.toHaveBeenCalled();
});
it('uses an uncertain outcome for an unexpected exception after apply starts', async () => {
  const plan = await fixture.prepare();
  fixture.apply.mockRejectedValueOnce(new Error('connection lost'));
  await expect(
    fixture.service.confirm(id, plan.confirmation, signal()),
  ).resolves.toHaveProperty('state', 'uncertain');
});
it('cancels only an owned planned operation, even after its old target configuration changes', async () => {
  const service = new PublicationService({
    ...fixture.deps,
    targetKey: 'new-target',
  });
  await expect(service.cancel(id, signal())).resolves.toHaveProperty(
    'state',
    'cancelled',
  );
  expect(fixture.journal.claim).toHaveBeenCalledWith(
    id,
    native.plan_digest,
    'cancel',
  );
  expect(fixture.source).not.toHaveBeenCalled();
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(fixture.target.withLease).not.toHaveBeenCalled();
});
it('returns an owned terminal outcome without applying it again', async () => {
  fixture.state = publicationOperation(native)!;
  await expect(
    fixture.service.confirm(id, 'old-token', signal()),
  ).resolves.toHaveProperty('state', 'committed');
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(fixture.target.withLease).not.toHaveBeenCalled();
});
it.each(['committed', 'not_applied', 'uncertain'] as const)(
  'recovers %s by observation only under the target lease',
  async (state) => {
    fixture.state = { ...fixture.state, state: 'uncertain' };
    if (state !== 'committed') fixture.observe.mockResolvedValueOnce({ state });
    const result = await fixture.service.recover(id, signal());
    expect(result.state).toBe(state === 'not_applied' ? 'failed' : state);
    if (state === 'committed') expect(result.outcome?.result).toBe('unchanged');
    expect(fixture.apply).not.toHaveBeenCalled();
    expect(fixture.journal.claim).not.toHaveBeenCalled();
    expect(fixture.verify).not.toHaveBeenCalled();
    expect(fixture.trace).toEqual(['lock-target', 'record', 'unlock-target']);
  },
);
it('allows private machine observation after initiator revocation without granting any transfer', async () => {
  fixture.state = { ...fixture.state, state: 'executing' };
  fixture.auth.getProfileRole.mockResolvedValue('user');
  await expect(fixture.service.recover(id, signal())).rejects.toHaveProperty(
    'code',
    'forbidden',
  );
  await expect(fixture.service.recoverPage()).resolves.toEqual({
    items: [{ id, state: 'committed' }],
    deferred: 0,
    next: null,
  });
  expect(fixture.apply).not.toHaveBeenCalled();
  expect(fixture.journal.claim).not.toHaveBeenCalled();
});
it('keeps operations for another physical target pending instead of remapping them', async () => {
  fixture.state = {
    ...fixture.state,
    state: 'uncertain',
    target_key: 'other-project',
  };
  await expect(fixture.service.recoverPage()).resolves.toEqual({
    items: [],
    deferred: 1,
    next: null,
  });
  expect(fixture.target.withLease).not.toHaveBeenCalled();
  expect(fixture.journal.record).not.toHaveBeenCalled();
});
it('does not claim after cancellation while waiting for the target lock', async () => {
  const plan = await fixture.prepare(),
    abort = new AbortController();
  fixture.targetLeaseSpy.mockImplementationOnce(async (_op, work) => {
    abort.abort();
    return work({ apply: fixture.apply, observe: fixture.observe });
  });
  await expect(
    fixture.service.confirm(id, plan.confirmation, abort.signal),
  ).rejects.toHaveProperty('name', 'AbortError');
  expect(fixture.journal.claim).not.toHaveBeenCalled();
  expect(fixture.apply).not.toHaveBeenCalled();
});
it('preserves an expired request deadline before any source, Engine or SQL operation', async () => {
  const abort = new AbortController();
  abort.abort(new DOMException('Local request deadline', 'TimeoutError'));
  await expect(
    fixture.service.prepare({ ...selection, mode: 'publish' }, abort.signal),
  ).rejects.toHaveProperty('name', 'TimeoutError');
  expect(fixture.source).not.toHaveBeenCalled();
  expect(fixture.verify).not.toHaveBeenCalled();
  expect(fixture.journal.prepare).not.toHaveBeenCalled();
});
