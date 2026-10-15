import { beforeEach, describe, expect, it, vi } from 'vitest';
import sql from './fixtures/publication-sql.json';
import journalSql from './fixtures/publication-journal-sql.json';
import {
  publicationOperation,
  publicationOutcome,
} from '@/lib/publication-journal';
import {
  PublicationJournal,
  type PublicationConnection,
} from '@/lib/publication-journal-server';
vi.mock('server-only', () => ({}));
const actor = 'a6000000-0000-4000-8000-000000000001';
const id = 'a6000000-0000-4000-8000-000000000002';
const version = 'a6000000-0000-4000-8000-000000000003';
const digest = 'a'.repeat(64),
  fp = 'b'.repeat(64);
const fixture = () => ({
  id,
  batch_id: id,
  actor_id: actor,
  version_id: version,
  target_key: 'local-target',
  mode: 'publish',
  source_fingerprint: fp,
  source_epoch: '0',
  plan_digest: digest,
  state: 'planned',
  created_at: '2026-10-15T12:00:00Z',
  expires_at: '2026-10-15T12:15:00Z',
  updated_at: '2026-10-15T12:00:00Z',
  payload: structuredClone(sql.payload),
  inspection: structuredClone(sql.inspection),
  source_snapshot: {
    versionId: version,
    fingerprint: fp,
    epoch: 0,
    receiptId: id,
    reviewId: id,
    report: {},
    cases: [],
  },
  outcome: null,
  error_code: null,
});
const outcome = () => ({
  catalogId: sql.payload.catalogId,
  revision: sql.payload.revision,
  businessDigest: sql.payload.businessDigest,
  exerciseId: '9007199254740993',
  versionId: version,
  stateToken: 'c'.repeat(64),
  result: 'unchanged' as const,
});
const auth = {
  getVerifiedUser: vi.fn(),
  getProfileRole: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
};
const query = vi.fn(),
  release = vi.fn(),
  connect = vi.fn();
beforeEach(() => {
  auth.getVerifiedUser.mockResolvedValue({ id: actor, isAnonymous: false });
  auth.getProfileRole.mockResolvedValue('admin');
  query.mockImplementation(async (text: string) => ({
    rows: text.includes('AS operation') ? [{ operation: fixture() }] : [],
  }));
  connect.mockResolvedValue({ query, release } as PublicationConnection);
});
const journal = () => new PublicationJournal(auth, connect);
const prepare = () => ({
  batchId: id,
  versionId: version,
  fingerprint: fp,
  epoch: '0',
  targetKey: 'local-target',
  mode: 'publish' as const,
  payload: sql.payload,
  inspection: sql.inspection,
});
describe('Journal : contrat privé et résultat certain', () => {
  it('accepts the operation actually returned by PostgreSQL after journal transitions', () => {
    expect(publicationOperation(journalSql)).toMatchObject({
      state: 'committed',
      target_key: 'local-target',
      source_epoch: '0',
      outcome: { exerciseId: '9007199254740993', result: 'published' },
    });
  });
  it('accepts the actual PostgreSQL publication protocol and preserves exact content', () =>
    expect(publicationOperation(fixture())?.payload.definitionJson).toBe(
      sql.payload.definitionJson,
    ));
  it.each([
    null,
    {},
    [],
    { ...fixture(), source_epoch: 0 },
    { ...fixture(), source_epoch: '9223372036854775808' },
    { ...fixture(), state: 'published' },
    { ...fixture(), target_key: 'https://example.com' },
  ])('rejects malformed operation %#', (value) =>
    expect(publicationOperation(value)).toBeNull(),
  );
  it('rejects mismatched source evidence and runtime snapshots', () => {
    expect(
      publicationOperation({
        ...fixture(),
        source_snapshot: { ...fixture().source_snapshot, fingerprint: digest },
      }),
    ).toBeNull();
    const data = fixture();
    data.inspection.state.runtime.engineArchiveSha256 = digest;
    expect(publicationOperation(data)).toBeNull();
  });
  it('keeps uncertain separate from a published outcome', () => {
    expect(
      publicationOperation({ ...fixture(), state: 'uncertain' })?.outcome,
    ).toBeNull();
    expect(
      publicationOperation({
        ...fixture(),
        state: 'uncertain',
        outcome: outcome(),
      }),
    ).toBeNull();
    expect(
      publicationOperation({
        ...fixture(),
        state: 'committed',
        outcome: outcome(),
      })?.state,
    ).toBe('committed');
    expect(
      publicationOperation({ ...fixture(), state: 'committed' }),
    ).toBeNull();
  });
  it.each([
    { actorId: actor },
    { businessDigest: digest },
    { revision: 0 },
    { exerciseId: 9007199254740992 },
    { versionId: 'bad' },
    { result: 'timeout' },
  ])('rejects unverified result fields %#', (change) =>
    expect(
      publicationOutcome(
        { ...outcome(), ...change },
        sql.payload as never,
        'publish',
      ),
    ).toBeNull(),
  );
  it('refuses rollback results in publish mode and accepts exact bigint text', () => {
    expect(
      publicationOutcome(
        { ...outcome(), result: 'rolled_back' },
        sql.payload as never,
        'publish',
      ),
    ).toBeNull();
    expect(
      publicationOutcome(outcome(), sql.payload as never, 'publish')
        ?.exerciseId,
    ).toBe('9007199254740993');
  });
});
describe('Journal : session fraîche et requêtes bornées', () => {
  it('reads pending machine records after revocation without granting publication access', async () => {
    auth.getProfileRole.mockResolvedValue('user');
    query.mockResolvedValue({
      rows: [
        { page: { items: [{ ...fixture(), state: 'uncertain' }], next: null } },
      ],
    });
    expect((await journal().pending()).items).toHaveLength(1);
    expect(auth.getVerifiedUser).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual([null]);
    await expect(journal().claim(id, digest, 'claim')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
  it.each([
    { items: [], next: id },
    { items: Array(11).fill({ ...fixture(), state: 'uncertain' }), next: null },
    { items: [fixture()], next: null },
    null,
  ])('rejects invalid or non-pending recovery page %#', async (page) => {
    query.mockResolvedValue({ rows: [{ page }] });
    await expect(journal().pending()).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(release).toHaveBeenCalledOnce();
  });
  it('rejects an invalid cursor before connecting', async () => {
    await expect(journal().pending('../other')).rejects.toMatchObject({
      code: 'invalid',
    });
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([null, { id: actor, isAnonymous: true }])(
    'refuses absent/guest identity %#',
    async (user) => {
      auth.getVerifiedUser.mockResolvedValue(user);
      await expect(journal().prepare(prepare())).rejects.toMatchObject({
        code: 'forbidden',
      });
      expect(connect).not.toHaveBeenCalled();
    },
  );
  it.each(['user', 'editor', null])(
    'refuses non-admin role %s',
    async (role) => {
      auth.getProfileRole.mockResolvedValue(role);
      await expect(journal().get(id)).rejects.toMatchObject({
        code: 'forbidden',
      });
      expect(connect).not.toHaveBeenCalled();
    },
  );
  it('refuses revoked role on the next request', async () => {
    const repo = journal();
    await repo.get(id);
    auth.getProfileRole.mockResolvedValue('user');
    await expect(repo.claim(id, digest, 'claim')).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('masks Auth outages without acquiring a database connection', async () => {
    auth.getVerifiedUser.mockRejectedValue(Error('private secret'));
    await expect(journal().get(id)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(connect).not.toHaveBeenCalled();
  });
  it('derives actor only from verified Auth and uses fixed placeholders', async () => {
    await journal().prepare(prepare());
    expect(query.mock.calls[0][0]).toContain('$9::jsonb');
    expect(query.mock.calls[0][1][0]).toBe(actor);
    expect(query.mock.calls[0][1][5]).toBe(sql.payload.definitionJson);
    expect(release).toHaveBeenCalledOnce();
  });
  it('refuses invalid target, confirmation or conflicting inspection before SQL', async () => {
    await expect(
      journal().prepare({ ...prepare(), targetKey: 'https://other.invalid' }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(journal().claim(id, 'wrong', 'claim')).rejects.toMatchObject({
      code: 'invalid',
    });
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([
    ['42501', 'forbidden'],
    ['40001', 'conflict'],
    ['P0002', 'missing'],
    ['22023', 'invalid'],
    ['XX000', 'unavailable'],
  ])('maps SQL %s without leaking diagnostics', async (code, expected) => {
    query.mockRejectedValue({ code, message: 'PRIVATE SQL VALUE' });
    await expect(journal().get(id)).rejects.toMatchObject({
      code: expected,
      message: expected,
    });
    expect(release).toHaveBeenCalledOnce();
  });
  it('releases the connection if returned data is malformed', async () => {
    query.mockResolvedValue({ rows: [{ operation: {} }] });
    await expect(journal().get(id)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(release).toHaveBeenCalledOnce();
  });
  it('records trusted machine observations after revocation without initiating new publication', async () => {
    auth.getProfileRole.mockResolvedValue('user');
    const value = publicationOperation({ ...fixture(), state: 'executing' })!;
    query.mockResolvedValue({
      rows: [{ operation: { ...fixture(), state: 'uncertain' } }],
    });
    await journal().record(value, 'executing', 'uncertain');
    expect(auth.getVerifiedUser).not.toHaveBeenCalled();
    expect(query.mock.calls[0][0]).toContain('record_publication_outcome');
    await expect(journal().claim(id, digest, 'claim')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
  it('never records transport ambiguity as a definite failure', async () => {
    const value = publicationOperation({ ...fixture(), state: 'executing' })!;
    await expect(
      journal().record(value, 'executing', 'failed', null, 'timeout' as never),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(connect).not.toHaveBeenCalled();
  });
});
describe('Source : transaction dédiée et protection pendant le travail', () => {
  beforeEach(() => {
    query.mockImplementation(async (text: string) => ({
      rows: text.includes('AS operation')
        ? [{ operation: { ...fixture(), state: 'executing' } }]
        : [],
    }));
  });
  it('keeps the source transaction open until work completes and rechecks live connection', async () => {
    const markers: string[] = [];
    query.mockImplementation(async (text: string) => {
      markers.push(text);
      return {
        rows: text.includes('AS operation')
          ? [{ operation: { ...fixture(), state: 'executing' } }]
          : [],
      };
    });
    const result = await journal().withSourceLease(
      id,
      digest,
      async (_operation, recheck) => {
        markers.push('target work');
        await recheck();
        markers.push('target verified');
        return 42;
      },
    );
    expect(result).toBe(42);
    expect(markers[0]).toBe('BEGIN');
    expect(markers.at(-1)).toBe('ROLLBACK');
    expect(markers.indexOf('target verified')).toBeLessThan(
      markers.indexOf('ROLLBACK'),
    );
    expect(markers.filter((v) => v === 'SELECT 1')).toHaveLength(2);
    expect(release).toHaveBeenCalledWith(false);
  });
  it('stops before target work if the role is revoked after locking', async () => {
    auth.getProfileRole
      .mockResolvedValueOnce('admin')
      .mockResolvedValue('user');
    const work = vi.fn();
    await expect(
      journal().withSourceLease(id, digest, work),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(work).not.toHaveBeenCalled();
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('rejects a changed verified identity before target work', async () => {
    auth.getVerifiedUser
      .mockResolvedValueOnce({ id: actor, isAnonymous: false })
      .mockResolvedValue({ id: version, isAnonymous: false });
    const work = vi.fn();
    await expect(
      journal().withSourceLease(id, digest, work),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(work).not.toHaveBeenCalled();
  });
  it('does not mask a callback error whose target commit may be uncertain', async () => {
    const uncertain = Error('TARGET COMMIT UNKNOWN');
    await expect(
      journal().withSourceLease(id, digest, async () => {
        throw uncertain;
      }),
    ).rejects.toBe(uncertain);
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
  it('destroys a dead source connection instead of returning it to a pool', async () => {
    query.mockImplementation(async (text: string) => {
      if (text === 'ROLLBACK') throw Error('connection lost');
      return {
        rows: text.includes('AS operation')
          ? [{ operation: { ...fixture(), state: 'executing' } }]
          : [],
      };
    });
    await journal().withSourceLease(id, digest, async () => 42);
    expect(release).toHaveBeenCalledWith(true);
  });
  it('does not run target work after source lease connection expires', async () => {
    query.mockImplementation(async (text: string) => {
      if (text === 'SELECT 1') throw Error('lease connection expired');
      return {
        rows: text.includes('AS operation')
          ? [{ operation: { ...fixture(), state: 'executing' } }]
          : [],
      };
    });
    const work = vi.fn();
    await expect(
      journal().withSourceLease(id, digest, work),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(work).not.toHaveBeenCalled();
  });
});
