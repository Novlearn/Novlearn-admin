import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { contentOverview, formatCount } from '@/lib/dashboard';
import { ContentOverview } from '@/components/content-overview';

vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  create: vi.fn(),
  rpc: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createPageClient: fake.create,
  asAuthGateway: () => ({
    getVerifiedUser: fake.user,
    getProfileRole: fake.role,
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw Error(`redirect:${path}`);
  },
}));
import AdminHome from '@/app/admin/page';
import { loadContentOverview } from '@/lib/dashboard-server';
const fixture = () => ({
  environment: 'staging',
  asOf: '2026-10-15T12:00:00+00:00',
  catalogue: {
    total: '7',
    draft: '2',
    in_review: '1',
    approved: '1',
    published: '1',
    legacy: '1',
    archived: '1',
  },
  tests: { failed: '1' },
  content: { chapters: '9', competences: '45', flashcards: '81' },
  activeVersions: '1',
  recentActiveVersions: [
    {
      exerciseId: '9007199254740993',
      versionId: 'a5900000-0000-4000-8000-000000000001',
      revision: 2,
      title: 'Titre <script>alert(1)</script>',
      publishedAt: '2026-10-14T10:00:00Z',
    },
  ],
});
const client = () => ({ rpc: fake.rpc }) as unknown as SupabaseClient;
beforeEach(() => {
  fake.create.mockResolvedValue(client());
  fake.user.mockResolvedValue({ id: 'fresh-admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.rpc.mockResolvedValue({ data: fixture(), error: null });
});
describe('Dashboard : intégrité et minimisation des agrégats', () => {
  it('preserves exact bigint counts and ids beyond JS precision', () => {
    const value = fixture();
    value.catalogue.total = '9007199254740998';
    value.catalogue.draft = '9007199254740993';
    const result = contentOverview(value);
    expect(result?.catalogue.draft).toBe('9007199254740993');
    expect(result?.recentActiveVersions[0].exerciseId).toBe('9007199254740993');
    expect(formatCount('9007199254740993').replace(/\s/g, '')).toBe(
      '9007199254740993',
    );
  });
  it.each([
    null,
    {},
    [],
    { ...fixture(), environment: 'production' },
    { ...fixture(), asOf: 'yesterday' },
  ])('rejects missing or wrong source/time %#', (value) =>
    expect(contentOverview(value)).toBeNull(),
  );
  it.each(['-1', '01', '1.2', '9223372036854775808', 2])(
    'rejects malformed or lossy count %s',
    (value) => {
      const data = fixture();
      Object.assign(data.catalogue, { draft: value });
      expect(contentOverview(data)).toBeNull();
    },
  );
  it('rejects inconsistent totals and failures beyond non-archived catalogue', () => {
    expect(
      contentOverview({
        ...fixture(),
        catalogue: { ...fixture().catalogue, total: '8' },
      }),
    ).toBeNull();
    expect(
      contentOverview({ ...fixture(), tests: { failed: '7' } }),
    ).toBeNull();
    expect(contentOverview({ ...fixture(), activeVersions: '7' })).toBeNull();
  });
  it('refuses incomplete or unbounded recent list', () => {
    expect(
      contentOverview({ ...fixture(), recentActiveVersions: [] }),
    ).toBeNull();
    expect(
      contentOverview({
        ...fixture(),
        recentActiveVersions: Array(6).fill(fixture().recentActiveVersions[0]),
      }),
    ).toBeNull();
  });
  it.each([
    { exerciseId: '../../users' },
    { versionId: 'bad' },
    { revision: 0 },
    { publishedAt: 'bad' },
    { title: 'x'.repeat(481) },
  ])('rejects invalid recent metadata %#', (change) => {
    const data = fixture();
    Object.assign(data.recentActiveVersions[0], change);
    expect(contentOverview(data)).toBeNull();
  });
  it('projects aggregate fields instead of forwarding accidental sensitive fields', () => {
    const data = fixture();
    Object.assign(data, {
      actor: 'PRIVATE_ACTOR',
      definition: { expected: 'PRIVATE_ANSWER' },
    });
    Object.assign(data.recentActiveVersions[0], { payload: 'PRIVATE_PAYLOAD' });
    const result = JSON.stringify(contentOverview(data));
    expect(result).not.toContain('PRIVATE');
  });
});
describe('Dashboard : refus serveur et données indisponibles', () => {
  it('refuses disabled configuration before querying data', async () => {
    fake.create.mockResolvedValue(null);
    await expect(AdminHome()).rejects.toThrow('redirect:/login?error=disabled');
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([null, { id: 'guest', isAnonymous: true }])(
    'refuses missing or guest session %#',
    async (user) => {
      fake.user.mockResolvedValue(user);
      await expect(AdminHome()).rejects.toThrow('redirect:');
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(['user', 'editor', null])(
    'refuses non-admin role %s',
    async (role) => {
      fake.role.mockResolvedValue(role);
      await expect(AdminHome()).rejects.toThrow('redirect:/access-denied');
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it('checks revocation freshly between requests', async () => {
    await AdminHome();
    fake.role.mockResolvedValue('user');
    await expect(AdminHome()).rejects.toThrow('redirect:/access-denied');
    expect(fake.user).toHaveBeenCalledTimes(2);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it('refuses unavailable verified identity without querying counts', async () => {
    fake.user.mockRejectedValue(Error('private auth error'));
    await expect(AdminHome()).rejects.toThrow(
      'redirect:/login?error=unavailable',
    );
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('uses one argument-free read RPC and no privileged client', async () => {
    await AdminHome();
    expect(fake.rpc).toHaveBeenCalledExactlyOnceWith('admin_content_overview');
  });
  it.each([
    { data: null, error: { message: 'private sql error' } },
    { data: fixture(), error: { message: 'private' } },
    { data: {}, error: null },
  ])('keeps unavailable distinct from zero %#', async (response) => {
    fake.rpc.mockResolvedValue(response);
    expect(await loadContentOverview(client())).toBeNull();
  });
  it('masks transport exceptions', async () => {
    fake.rpc.mockRejectedValue(Error('private transport'));
    expect(await loadContentOverview(client())).toBeNull();
  });
});
describe('Dashboard : rendu serveur', () => {
  it('escapes titles, links exact filters and labels Staging separately from Production', () => {
    const html = renderToStaticMarkup(
      createElement(ContentOverview, { data: contentOverview(fixture()) }),
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('/admin/exercises?status=in_review');
    expect(html).toContain('/admin/exercises/9007199254740993');
    expect(html).toContain('Production · accès non activé');
    expect(html).toContain('nouvelle révision brouillon');
  });
  it('shows real empty state without implying missing data or confirmed Production publication', () => {
    const empty = fixture();
    for (const key of Object.keys(empty.catalogue))
      Object.assign(empty.catalogue, { [key]: '0' });
    empty.tests.failed = '0';
    empty.activeVersions = '0';
    empty.recentActiveVersions = [];
    const html = renderToStaticMarkup(
      createElement(ContentOverview, { data: contentOverview(empty) }),
    );
    expect(html).toContain('Aucune version publiée active dans Staging.');
    expect(html).not.toContain('Indicateurs Staging indisponibles');
  });
  it('does not manufacture zeros when aggregation fails', () => {
    const html = renderToStaticMarkup(
      createElement(ContentOverview, { data: null }),
    );
    expect(html).toContain('Indicateurs Staging indisponibles');
    expect(html).not.toContain('tabular-nums');
  });
});
