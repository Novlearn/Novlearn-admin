import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  read: vi.fn(),
  references: vi.fn(),
  create: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  pageAuth: vi.fn(),
}));
vi.mock('@/lib/pedagogy-server', () => ({
  loadLocalPedagogyStatistics: fake.read,
  loadLocalPedagogyReferences: fake.references,
}));
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdminPage: fake.pageAuth,
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
    return target;
  },
}));
import { GET } from '@/app/api/admin/statistics/pedagogy/route';
import { GET as REFERENCES } from '@/app/api/admin/statistics/pedagogy/references/route';
import PedagogyPage from '@/app/admin/statistics/pedagogy/page';
import { localPedagogyEnvironment } from './fixtures/local-pedagogy-env';
import fixture from './fixtures/pedagogy-statistics.json';
const period = 'from=2026-10-15&to=2026-10-17';
const pageParams = { from: '2026-10-15', to: '2026-10-17' };
const request = (q = period) =>
  new NextRequest('http://127.0.0.1:3150/api/admin/statistics/pedagogy?' + q);
const refsRequest = (q = 'kind=chapter&q=Analyse') =>
  new NextRequest(
    'http://127.0.0.1:3150/api/admin/statistics/pedagogy/references?' + q,
  );
beforeEach(() => {
  vi.resetAllMocks();
  for (const [k, v] of Object.entries(localPedagogyEnvironment()))
    vi.stubEnv(k, v);
  fake.user.mockResolvedValue({ id: 'synthetic-admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.pageAuth.mockResolvedValue({ allowed: true });
  const response = NextResponse.next();
  response.cookies.set('refreshed-session', 'synthetic');
  fake.create.mockReturnValue({
    gateway: { getVerifiedUser: fake.user, getProfileRole: fake.role },
    response,
  });
  fake.read.mockResolvedValue({
    ...structuredClone(fixture),
    environment: 'local-copy',
  });
  fake.references.mockImplementation(async ({ kind, q }) => ({
    schemaVersion: 1,
    environment: 'local-copy',
    kind,
    q,
    more: false,
    items: [],
  }));
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  [null, 'admin', 401],
  [{ id: 'x', isAnonymous: true }, 'admin', 403],
  [{ id: 'x', isAnonymous: false }, 'user', 403],
  [{ id: 'x', isAnonymous: false }, null, 403],
])(
  'checks fresh identity and role before both SQL operations %#',
  async (user, role, status) => {
    fake.user.mockResolvedValue(user);
    fake.role.mockResolvedValue(role);
    for (const response of [
      await GET(request()),
      await REFERENCES(refsRequest()),
    ]) {
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toContain(
        'private, no-store',
      );
      expect(response.cookies.get('refreshed-session')?.value).toBe(
        'synthetic',
      );
    }
    expect(fake.read).not.toHaveBeenCalled();
    expect(fake.references).not.toHaveBeenCalled();
  },
);
it('rejects a failed role lookup without leaking its cause', async () => {
  fake.role.mockRejectedValue(Error('private database password'));
  for (const response of [
    await GET(request()),
    await REFERENCES(refsRequest()),
  ]) {
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('password');
  }
  expect(fake.read).not.toHaveBeenCalled();
  expect(fake.references).not.toHaveBeenCalled();
});
it('does not trust cached Admin authorization across either endpoint', async () => {
  expect((await GET(request())).status).toBe(200);
  expect((await REFERENCES(refsRequest())).status).toBe(200);
  fake.role.mockResolvedValue('user');
  expect((await GET(request())).status).toBe(403);
  expect((await REFERENCES(refsRequest())).status).toBe(403);
  expect(fake.read).toHaveBeenCalledTimes(1);
  expect(fake.references).toHaveBeenCalledTimes(1);
});
it.each(['ADMIN_LOCAL_PEDAGOGY_ENABLED', 'ADMIN_LOCAL_WORKSPACE_ENABLED'])(
  'keeps both endpoints closed when %s is disabled',
  async (key) => {
    vi.stubEnv(key, 'false');
    expect((await GET(request())).status).toBe(503);
    expect((await REFERENCES(refsRequest())).status).toBe(503);
    expect(fake.read).not.toHaveBeenCalled();
    expect(fake.references).not.toHaveBeenCalled();
  },
);
it.each([
  period + '&source=production',
  period + '&email=x',
  period + '&page=1&page=2',
  period + '&chapterSearch=Analyse',
  period + '&mode=remote',
  'from=2026-10-15',
])('rejects invalid aggregate parameters before SQL %s', async (q) => {
  expect((await GET(request(q))).status).toBe(400);
  expect(fake.read).not.toHaveBeenCalled();
});
it.each([
  'kind=user',
  'kind=chapter&source=production',
  'kind=chapter&q=a&q=b',
  'kind=chapter&q=%00',
])('rejects invalid reference parameters before SQL %s', async (q) => {
  expect((await REFERENCES(refsRequest(q))).status).toBe(400);
  expect(fake.references).not.toHaveBeenCalled();
});
it('passes literal reference searches and transfers refreshed cookies', async () => {
  const q = '%_\\';
  const response = await REFERENCES(
    refsRequest(new URLSearchParams({ kind: 'competence', q }).toString()),
  );
  expect(response.status).toBe(200);
  expect(fake.references).toHaveBeenCalledWith({ kind: 'competence', q });
  expect((await response.json()).environment).toBe('local-copy');
  expect(response.cookies.get('refreshed-session')?.value).toBe('synthetic');
});
it('reports unavailable readers without raw connection details or fabricated counts', async () => {
  fake.read.mockRejectedValue(
    Error(localPedagogyEnvironment().ADMIN_LOCAL_PEDAGOGY_PG_URL),
  );
  fake.references.mockRejectedValue(Error('private cause'));
  for (const response of [
    await GET(request()),
    await REFERENCES(refsRequest()),
  ]) {
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('postgresql');
    expect(text).not.toContain('private cause');
    expect(text).not.toContain('totals');
  }
});
it('authorizes the page before all report and metadata reads', async () => {
  fake.pageAuth.mockRejectedValue(Error('redirect'));
  await expect(
    PedagogyPage({
      searchParams: Promise.resolve({
        ...pageParams,
        chapterSearch: 'Analyse',
      }),
    }),
  ).rejects.toThrow('redirect');
  expect(fake.read).not.toHaveBeenCalled();
  expect(fake.references).not.toHaveBeenCalled();
});
it('renders the protected page with actual report DTO and source limitations', async () => {
  const html = renderToStaticMarkup(
    await PedagogyPage({ searchParams: Promise.resolve(pageParams) }),
  );
  expect(html).toContain('données synthétiques');
  expect(html).toContain('<caption');
  expect(html).toContain('Tentatives en pratique');
  expect(html).toContain('action="/admin/statistics/pedagogy"');
  expect(html).toContain('pas une certification');
});
it('keeps duplicate page filters invalid and does not query', async () => {
  const html = renderToStaticMarkup(
    await PedagogyPage({
      searchParams: Promise.resolve({ ...pageParams, mode: ['all', 'duel'] }),
    }),
  );
  expect(html).toContain('role="alert"');
  expect(fake.read).not.toHaveBeenCalled();
  expect(fake.references).not.toHaveBeenCalled();
});
it('never renders zeros on a page reader failure', async () => {
  fake.read.mockRejectedValue(Error('private cause'));
  const html = renderToStaticMarkup(
    await PedagogyPage({ searchParams: Promise.resolve(pageParams) }),
  );
  expect(html).toContain('Statistiques pédagogiques indisponibles');
  expect(html).not.toContain('Tentatives en pratique');
  expect(html).not.toContain('private cause');
});
it('looks up a selected reference outside the bounded search results', async () => {
  const id = 'out-of-first-200';
  const data = { ...structuredClone(fixture), environment: 'local-copy' };
  Object.assign(data.filters, { competence: id });
  fake.read.mockResolvedValue(data);
  fake.references.mockImplementation(async ({ kind, q }) => ({
    schemaVersion: 1,
    environment: 'local-copy',
    kind,
    q,
    more: false,
    items:
      q === id ? [{ id, label: 'Référence retrouvée', truncated: false }] : [],
  }));
  const html = renderToStaticMarkup(
    await PedagogyPage({
      searchParams: Promise.resolve({
        ...pageParams,
        competence: id,
        competenceSearch: 'other',
      }),
    }),
  );
  expect(fake.references).toHaveBeenCalledWith({ kind: 'competence', q: id });
  expect(html).toContain('Référence retrouvée');
  expect(html).toContain('value="out-of-first-200" selected');
});
