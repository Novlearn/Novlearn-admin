import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  read: vi.fn(),
  pageAuth: vi.fn(),
  create: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
}));
vi.mock('@/lib/user-detail-server', () => ({
  loadLocalUserDetail: fake.read,
}));
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdminPage: fake.pageAuth,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
    return target;
  },
}));
import { readLocalUserDetailConfiguration } from '@/lib/user-detail-config';
import { GET } from '@/app/api/admin/users/[userId]/route';
import UserPage from '@/app/admin/users/[userId]/page';
import { localUserDetailEnvironment } from './fixtures/local-user-detail-env';
import { localPublicationEnvironment } from './fixtures/local-publication-env';
import sqlFixture from './fixtures/user-detail-sql.json';
const data = sqlFixture.history;
const uid = 'a8100000-0000-4000-8000-000000000001';
const query = 'from=2026-10-15&to=2026-10-17';
const request = (q = query) =>
  new NextRequest('http://127.0.0.1:3150/api/admin/users/' + uid + '?' + q);
const run = (rq = request(), userId = uid) =>
  GET(rq, { params: Promise.resolve({ userId }) });
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(localUserDetailEnvironment()))
    vi.stubEnv(key, value);
  fake.user.mockResolvedValue({ id: 'a'.repeat(36), isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  const response = NextResponse.next();
  response.cookies.set('refreshed-session', 'synthetic');
  fake.create.mockReturnValue({
    gateway: { getVerifiedUser: fake.user, getProfileRole: fake.role },
    response,
  });
  fake.pageAuth.mockResolvedValue({ allowed: true, userId: 'synthetic' });
  fake.read.mockResolvedValue({ ...data, environment: 'local-copy' });
});
afterEach(() => vi.unstubAllEnvs());
it('accepts only the explicitly enabled main local Auth profile', () => {
  expect(
    readLocalUserDetailConfiguration(localUserDetailEnvironment())?.environment,
  ).toBe('local-copy');
});
it('refuses a valid independent publication Auth profile even with users credentials', () => {
  const env = {
    ...localUserDetailEnvironment(),
    ...localPublicationEnvironment(),
  };
  expect(readLocalUserDetailConfiguration(env)).toBeNull();
});
it.each([
  { NODE_ENV: 'production' },
  { ADMIN_LOCAL_USER_DETAIL_ENABLED: 'false' },
  { ADMIN_LOCAL_USER_DETAIL_REVIEW: '' },
  { ADMIN_LOCAL_WORKSPACE_ENABLED: 'false' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://mixed-project.supabase.co' },
  { ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED: 'true' },
  { ADMIN_USER_DETAIL_ENABLED: 'true' },
  {
    ADMIN_LOCAL_USER_DETAIL_PG_URL:
      'postgresql://postgres:synthetic-password@127.0.0.1:55435/users_copy',
  },
  { ADMIN_LOCAL_USER_DETAIL_PG_CA: '' },
  {
    ADMIN_LOCAL_USER_DETAIL_PG_URL:
      localUserDetailEnvironment().ADMIN_LOCAL_USER_DETAIL_PG_URL +
      '?sslmode=disable',
  },
])('refuses mixed, operational or incomplete configuration %#', (change) => {
  expect(
    readLocalUserDetailConfiguration({
      ...localUserDetailEnvironment(),
      ...change,
    }),
  ).toBeNull();
});
it.each([
  [null, 'admin', 401],
  [{ id: 'x', isAnonymous: true }, 'admin', 403],
  [{ id: 'x', isAnonymous: false }, 'user', 403],
  [{ id: 'x', isAnonymous: false }, null, 403],
])(
  'authorizes the fresh identity and role before SQL %#',
  async (user, role, status) => {
    fake.user.mockResolvedValue(user);
    fake.role.mockResolvedValue(role);
    const response = await run(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
    expect(fake.read).not.toHaveBeenCalled();
  },
);
it('refuses an unavailable role check without SQL or raw error details', async () => {
  fake.role.mockRejectedValue(new Error('private operator value'));
  const response = await run(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private operator');
  expect(fake.read).not.toHaveBeenCalled();
});
it('refuses disabled statistics even with a valid Admin session', async () => {
  vi.stubEnv('ADMIN_LOCAL_USER_DETAIL_ENABLED', 'false');
  expect((await run(request())).status).toBe(503);
  expect(fake.read).not.toHaveBeenCalled();
});
it.each([
  'from=2026-10-15',
  query + '&from=2026-10-14',
  query + '&environment=production',
  query + '&target=remote',
  'from=2026-10-17&to=2026-10-15',
  'from=2026-07-01&to=2026-10-17',
  query + '&after=invalid',
  query + '&view=history&view=chapters',
  query + '&limit=1000',
  query + '&view=competences&after=' + 'a'.repeat(1001),
])('rejects invalid or ambiguous filters before SQL %#', async (q) => {
  expect((await run(request(q))).status).toBe(400);
  expect(fake.read).not.toHaveBeenCalled();
});
it('returns only the decoded aggregate DTO, cookies and private response headers', async () => {
  const response = await run(request());
  expect(response.status).toBe(200);
  expect((await response.json()).environment).toBe('local-copy');
  expect(fake.read).toHaveBeenCalledWith({
    period: {
      from: '2026-10-15',
      to: '2026-10-17',
      until: '2026-10-18',
      days: 3,
    },
    userId: uid,
    view: 'history',
    after: null,
    before: null,
  });
  expect(response.headers.get('cache-control')).toContain('private, no-store');
  expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
});
it('rechecks permissions on every request instead of caching the Admin role', async () => {
  expect((await run(request())).status).toBe(200);
  fake.role.mockResolvedValue('user');
  expect((await run(request())).status).toBe(403);
  expect(fake.read).toHaveBeenCalledTimes(1);
});
it('returns an unavailable response on SQL failure without leaking its cause', async () => {
  fake.read.mockRejectedValue(
    new Error(localUserDetailEnvironment().ADMIN_LOCAL_USER_DETAIL_PG_URL),
  );
  const response = await run(request());
  expect(response.status).toBe(503);
  expect(await response.text()).toBe(
    '{"error":"Fiche utilisateur indisponible"}',
  );
});
it('requires page authorization before loading even if the enclosing layout exists', async () => {
  fake.pageAuth.mockRejectedValue(new Error('redirect'));
  await expect(
    UserPage({
      params: Promise.resolve({ userId: uid }),
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  ).rejects.toThrow('redirect');
  expect(fake.read).not.toHaveBeenCalled();
});
it('renders the real page with a truthful source label and accessible table', async () => {
  const html = renderToStaticMarkup(
    await UserPage({
      params: Promise.resolve({ userId: uid }),
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  );
  expect(html).toContain('Base locale synthétique');
  expect(html).toContain('<caption');
  expect(html).not.toContain('ne lit aucune base');
  expect(html).toContain('action="/admin/users/' + uid + '"');
});
it('retains duplicate filters on the page and shows their error without querying', async () => {
  const html = renderToStaticMarkup(
    await UserPage({
      params: Promise.resolve({ userId: uid }),
      searchParams: Promise.resolve({
        from: ['2026-10-15', '2026-10-16'],
        to: '2026-10-17',
      }),
    }),
  );
  expect(html).toContain('Choisissez une vue, une période UTC');
  expect(fake.read).not.toHaveBeenCalled();
});
it('shows SQL unavailability without fabricated counts', async () => {
  fake.read.mockRejectedValue(new Error('private connection details'));
  const html = renderToStaticMarkup(
    await UserPage({
      params: Promise.resolve({ userId: uid }),
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  );
  expect(html).toContain('Fiche utilisateur indisponible');
  expect(html).not.toContain('LOCAL ACTIVITY A');
  expect(html).not.toContain('private connection');
});

it('returns an explicit 404 for a missing user, with private headers and refreshed cookies', async () => {
  fake.read.mockResolvedValue(null);
  const response = await run();
  expect(response.status).toBe(404);
  expect(await response.text()).toBe('{"error":"Utilisateur introuvable."}');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
});
it('does not hide a missing page behind an unavailability error', async () => {
  fake.read.mockResolvedValue(null);
  await expect(
    UserPage({
      params: Promise.resolve({ userId: uid }),
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  ).rejects.toThrow('NEXT_NOT_FOUND');
});
it('refuses invalid UUIDs before loading nominal data', async () => {
  expect((await run(request(), 'invalid')).status).toBe(400);
  expect(fake.read).not.toHaveBeenCalled();
});
