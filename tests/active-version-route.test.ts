import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  read: vi.fn(),
  create: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  from: vi.fn(),
  parent: vi.fn(),
  version: vi.fn(),
  filters: [] as [string, string, unknown][],
}));
vi.mock('@/lib/active-version-server', () => ({
  loadLocalActiveVersion: fake.read,
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const c of source.cookies.getAll()) target.cookies.set(c);
    return target;
  },
}));
import { GET } from '@/app/api/admin/exercises/[id]/target-version/route';
import { localActiveVersionEnvironment } from './fixtures/local-active-version-env';
const catalogId = 'ad100000-0000-4000-8000-000000000001',
  versionId = 'ad200000-0000-4000-8000-000000000001';
const request = (q = '') =>
  new NextRequest(
    'http://127.0.0.1:3150/api/admin/exercises/123/target-version' +
      (q ? '?' + q : ''),
  );
const get = (q = '', id = '123') =>
  GET(request(q), { params: Promise.resolve({ id }) });
const snapshot = () => ({
  schemaVersion: 1 as const,
  environment: 'local-copy' as const,
  targetKey: 'local-http-fixture',
  asOf: '2026-10-19T18:00:00Z',
  catalogId,
  parent: null,
  active: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  fake.filters = [];
  for (const [k, v] of Object.entries(localActiveVersionEnvironment()))
    vi.stubEnv(k, v);
  fake.user.mockResolvedValue({ id: 'synthetic-admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.parent.mockResolvedValue({
    data: { catalog_id: catalogId },
    error: null,
  });
  fake.version.mockResolvedValue({
    data: {
      revision: 1,
      definition_sha256: 'a'.repeat(64),
      engine_contract: 'schema-5;engine-0.1.0',
      generation_version: 'mulberry32-rejection-v1',
      canonicalization_version: 'pg-jsonb-text-v1',
    },
    error: null,
  });
  fake.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: (key: string, value: unknown) => {
        fake.filters.push([table, key, value]);
        return chain;
      },
      maybeSingle: () =>
        table === 'exercises' ? fake.parent() : fake.version(),
    };
    return chain;
  });
  const response = NextResponse.next();
  response.cookies.set('refreshed-session', 'synthetic');
  fake.create.mockReturnValue({
    gateway: { getVerifiedUser: fake.user, getProfileRole: fake.role },
    response,
    client: { from: fake.from },
  });
  fake.read.mockResolvedValue(snapshot());
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  [null, 'admin', 401],
  [{ id: 'x', isAnonymous: true }, 'admin', 403],
  [{ id: 'x', isAnonymous: false }, 'user', 403],
  [{ id: 'x', isAnonymous: false }, null, 403],
])(
  'freshly authorizes before any source or target read %#',
  async (user, role, status) => {
    fake.user.mockResolvedValue(user);
    fake.role.mockResolvedValue(role);
    const r = await get();
    expect(r.status).toBe(status);
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.read).not.toHaveBeenCalled();
    expect(r.headers.get('cache-control')).toContain('private, no-store');
    expect(r.cookies.get('refreshed-session')?.value).toBe('synthetic');
  },
);
it('does not reuse an earlier admin decision', async () => {
  expect((await get()).status).toBe(200);
  fake.role.mockResolvedValue('user');
  expect((await get()).status).toBe(403);
  expect(fake.read).toHaveBeenCalledTimes(1);
});
it('fails closed on identity lookup failure and hides private errors', async () => {
  fake.role.mockRejectedValue(Error('private password'));
  const r = await get();
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain('password');
  expect(fake.from).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it.each([
  'ADMIN_LOCAL_ACTIVE_VERSION_ENABLED',
  'ADMIN_LOCAL_WORKSPACE_ENABLED',
])('remains closed without %s', async (key) => {
  vi.stubEnv(key, 'false');
  expect((await get()).status).toBe(503);
  expect(fake.read).not.toHaveBeenCalled();
});
it.each([
  'catalogId=' + catalogId,
  'target=production',
  'version=' + versionId + '&version=' + versionId,
  'version=bad',
  'version=',
])('rejects injected or invalid target selection %s', async (q) => {
  expect((await get(q)).status).toBe(400);
  expect(fake.from).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it('resolves a target identity only from the authorized source parent', async () => {
  const r = await get();
  expect(r.status).toBe(200);
  expect(fake.filters).toEqual([['exercises', 'id', '123']]);
  expect(fake.read).toHaveBeenCalledWith(catalogId);
  expect((await r.json()).state).toEqual({ state: 'absent', issue: null });
  expect(r.cookies.get('refreshed-session')?.value).toBe('synthetic');
});
it('requires the selected source version to belong to the requested parent', async () => {
  expect((await get('version=' + versionId)).status).toBe(200);
  expect(fake.filters).toContainEqual(['exercise_versions', 'id', versionId]);
  expect(fake.filters).toContainEqual([
    'exercise_versions',
    'exercise_id',
    '123',
  ]);
  fake.version.mockResolvedValue({ data: null, error: null });
  expect((await get('version=' + versionId)).status).toBe(404);
  expect(fake.read).toHaveBeenCalledTimes(1);
});
it.each([
  [{ data: null, error: null }, 404],
  [{ data: { catalog_id: null }, error: null }, 409],
  [{ data: null, error: { message: 'private source failure' } }, 503],
])(
  'does not infer target absence from a missing or invalid source %#',
  async (result, status) => {
    fake.parent.mockResolvedValue(result);
    const r = await get();
    expect(r.status).toBe(status);
    expect(await r.text()).not.toContain('private source');
    expect(fake.read).not.toHaveBeenCalled();
  },
);
it('distinguishes target failure from an absent target', async () => {
  fake.read.mockRejectedValue(Error('postgresql://private-password'));
  const r = await get();
  expect(r.status).toBe(503);
  const text = await r.text();
  expect(text).not.toContain('postgresql');
  expect(text).not.toContain('absent');
});
it('reports stored inconsistency explicitly without claiming an active publication', async () => {
  fake.read.mockResolvedValue({
    ...snapshot(),
    parent: {
      exerciseId: '123',
      catalogId,
      publicationEpoch: '2',
      archivedAt: null,
      activeVersionId: versionId,
    },
  });
  const r = await get();
  expect(r.status).toBe(200);
  expect((await r.json()).state).toEqual({
    state: 'inconsistent',
    issue: 'missing-version',
  });
});
