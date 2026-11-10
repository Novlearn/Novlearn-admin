import { productionReadEnvironment } from './fixtures/production-read-env';
import { createElement } from 'react';
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
vi.mock('@/lib/users-server', () => ({
  loadUsers: fake.read,
}));
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdminPage: fake.pageAuth,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/users' }));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
    return target;
  },
}));
import { readUsersConfiguration } from '@/lib/users-config';
import { GET } from '@/app/api/admin/users/route';
import UsersPage from '@/app/admin/users/page';
import { AdminNavigation } from '@/components/admin-navigation';
import { localUsersEnvironment } from './fixtures/local-users-env';
import { localPublicationEnvironment } from './fixtures/local-publication-env';
import { usersPageFixture as data } from './fixtures/users-page';
const query = 'from=2026-10-15&to=2026-10-17';
const request = (q = query) =>
  new NextRequest('http://127.0.0.1:3150/api/admin/users?' + q);
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(localUsersEnvironment()))
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
  expect(readUsersConfiguration(localUsersEnvironment())?.environment).toBe(
    'local-copy',
  );
});
it('refuses a valid independent publication Auth profile even with users credentials', () => {
  const env = {
    ...localUsersEnvironment(),
    ...localPublicationEnvironment(),
  };
  expect(readUsersConfiguration(env)).toBeNull();
});
it.each([
  { NODE_ENV: 'production' },
  { ADMIN_LOCAL_USERS_ENABLED: 'false' },
  { ADMIN_LOCAL_USERS_REVIEW: '' },
  { ADMIN_LOCAL_WORKSPACE_ENABLED: 'false' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://mixed-project.supabase.co' },
  { ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED: 'true' },
  { ADMIN_USERS_ENABLED: 'true' },
  {
    ADMIN_LOCAL_USERS_PG_URL:
      'postgresql://postgres:synthetic-password@127.0.0.1:55435/users_copy',
  },
  { ADMIN_LOCAL_USERS_PG_CA: '' },
  {
    ADMIN_LOCAL_USERS_PG_URL:
      localUsersEnvironment().ADMIN_LOCAL_USERS_PG_URL + '?sslmode=disable',
  },
])('refuses mixed, operational or incomplete configuration %#', (change) => {
  expect(
    readUsersConfiguration({
      ...localUsersEnvironment(),
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
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
    expect(fake.read).not.toHaveBeenCalled();
  },
);
it('refuses an unavailable role check without SQL or raw error details', async () => {
  fake.role.mockRejectedValue(new Error('private operator value'));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private operator');
  expect(fake.read).not.toHaveBeenCalled();
});
it('refuses disabled statistics even with a valid Admin session', async () => {
  vi.stubEnv('ADMIN_LOCAL_USERS_ENABLED', 'false');
  expect((await GET(request())).status).toBe(503);
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
  query + '&q=a&q=b',
  query + '&limit=1000',
  query + '&q=' + 'a'.repeat(101),
])('rejects invalid or ambiguous filters before SQL %#', async (q) => {
  expect((await GET(request(q))).status).toBe(400);
  expect(fake.read).not.toHaveBeenCalled();
});
it('returns only the decoded aggregate DTO, cookies and private response headers', async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).environment).toBe('local-copy');
  expect(fake.read).toHaveBeenCalledWith({
    period: {
      from: '2026-10-15',
      to: '2026-10-17',
      until: '2026-10-18',
      days: 3,
    },
    query: '',
    after: null,
    before: null,
  });
  expect(response.headers.get('cache-control')).toContain('private, no-store');
  expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
});
it('rechecks permissions on every request instead of caching the Admin role', async () => {
  expect((await GET(request())).status).toBe(200);
  fake.role.mockResolvedValue('user');
  expect((await GET(request())).status).toBe(403);
  expect(fake.read).toHaveBeenCalledTimes(1);
});
it('returns an unavailable response on SQL failure without leaking its cause', async () => {
  fake.read.mockRejectedValue(
    new Error(localUsersEnvironment().ADMIN_LOCAL_USERS_PG_URL),
  );
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"error":"Utilisateurs indisponibles"}');
});
it('requires page authorization before loading even if the enclosing layout exists', async () => {
  fake.pageAuth.mockRejectedValue(new Error('redirect'));
  await expect(
    UsersPage({
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  ).rejects.toThrow('redirect');
  expect(fake.read).not.toHaveBeenCalled();
});
it('renders the real page with a truthful source label and accessible table', async () => {
  const html = renderToStaticMarkup(
    await UsersPage({
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  );
  expect(html).toContain('Base locale synthétique');
  expect(html).toContain('<caption');
  expect(html).not.toContain('ne lit aucune base');
  expect(html).toContain('action="/admin/users"');
});
it('retains duplicate filters on the page and shows their error without querying', async () => {
  const html = renderToStaticMarkup(
    await UsersPage({
      searchParams: Promise.resolve({
        from: ['2026-10-15', '2026-10-16'],
        to: '2026-10-17',
      }),
    }),
  );
  expect(html).toContain('Choisissez une période');
  expect(fake.read).not.toHaveBeenCalled();
});
it('shows SQL unavailability without fabricated counts', async () => {
  fake.read.mockRejectedValue(new Error('private connection details'));
  const html = renderToStaticMarkup(
    await UsersPage({
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  );
  expect(html).toContain('Utilisateurs indisponibles');
  expect(html).not.toContain('LOCAL ACTIVITY A');
  expect(html).not.toContain('private connection');
});
it('adds the statistics navigation only when the server enables it', () => {
  expect(renderToStaticMarkup(createElement(AdminNavigation))).not.toContain(
    '/admin/users',
  );
  const html = renderToStaticMarkup(
    createElement(AdminNavigation, { usersEnabled: true }),
  );
  expect(html).toContain('/admin/users');
  expect(html).toContain('aria-current="page"');
});

function enableProduction() {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(productionReadEnvironment()))
    vi.stubEnv(key, value);
  fake.read.mockResolvedValue({ ...data, environment: 'production' });
}
it('serves production only after a fresh Admin role check and labels the page truthfully', async () => {
  enableProduction();
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect((await response.json()).environment).toBe('production');
  expect(response.headers.get('cache-control')).toContain('no-store');
  const html = renderToStaticMarkup(
    await UsersPage({
      searchParams: Promise.resolve({ from: '2026-10-15', to: '2026-10-17' }),
    }),
  );
  expect(html).toContain('Production');
  expect(html).not.toContain('Base locale synthétique');
  fake.role.mockResolvedValue('user');
  const calls = fake.read.mock.calls.length;
  expect((await GET(request())).status).toBe(403);
  expect(fake.read).toHaveBeenCalledTimes(calls);
});
it('does not expose connection strings on production SQL failures', async () => {
  enableProduction();
  fake.read.mockRejectedValue(
    Error('postgresql://private-api-error-synthetic.invalid'),
  );
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('postgresql://');
});
