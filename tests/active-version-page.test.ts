import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  require: vi.fn(),
  read: vi.fn(),
  from: vi.fn(),
  parent: vi.fn(),
}));
vi.mock('@/lib/catalogue-server', () => ({
  requireCatalogueClient: fake.require,
  versionColumns: 'id,revision',
}));
vi.mock('@/lib/active-version-server', () => ({
  loadLocalActiveVersion: fake.read,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
import Page from '@/app/admin/exercises/[id]/page';
import { localActiveVersionEnvironment } from './fixtures/local-active-version-env';
const catalogId = 'ad100000-0000-4000-8000-000000000001';
const page = () =>
  Page({
    params: Promise.resolve({ id: '123' }),
    searchParams: Promise.resolve({}),
  });
beforeEach(() => {
  vi.resetAllMocks();
  for (const [k, v] of Object.entries(localActiveVersionEnvironment()))
    vi.stubEnv(k, v);
  fake.require.mockResolvedValue({ from: fake.from });
  fake.parent.mockResolvedValue({
    data: {
      id: 123,
      catalog_id: catalogId,
      title: 'Exercice synthétique',
      active_version_id: null,
      admin_archived_at: null,
    },
    error: null,
  });
  fake.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: () => fake.parent(),
      range: async () => ({ data: [], error: null, count: 0 }),
    };
    expect(['exercises', 'exercise_versions']).toContain(table);
    return chain;
  });
  fake.read.mockResolvedValue({
    schemaVersion: 1,
    environment: 'local-copy',
    targetKey: 'local-http-fixture',
    asOf: '2026-10-20T11:00:00Z',
    catalogId,
    parent: null,
    active: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
it('authorizes the page before source or target reads', async () => {
  fake.require.mockRejectedValue(Error('redirect:/login'));
  await expect(page()).rejects.toThrow('redirect:/login');
  expect(fake.from).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it('uses the source parent identity even without any canonical source version', async () => {
  const html = renderToStaticMarkup(await page());
  expect(fake.read).toHaveBeenCalledWith(catalogId);
  expect(html).toContain('absent de la cible locale');
  expect(html).toContain('Historique des versions');
});
it('does not read the target for a legacy source without a stable identity', async () => {
  fake.parent.mockResolvedValue({
    data: {
      id: 123,
      catalog_id: null,
      title: 'Historique',
      active_version_id: null,
      admin_archived_at: null,
    },
    error: null,
  });
  const html = renderToStaticMarkup(await page());
  expect(fake.read).not.toHaveBeenCalled();
  expect(html).toContain('ne permet pas encore de retrouver');
  expect(html).not.toContain('absent de la cible');
});
it('renders unavailable without blocking source consultation or exposing connection errors', async () => {
  fake.read.mockRejectedValue(Error('private PostgreSQL password'));
  const html = renderToStaticMarkup(await page());
  expect(html).toContain('La cible est indisponible');
  expect(html).toContain('Exercice synthétique');
  expect(html).not.toContain('private PostgreSQL');
  expect(html).not.toContain('absent de la cible');
});
it('does not activate a target reader implicitly', async () => {
  vi.stubEnv('ADMIN_LOCAL_ACTIVE_VERSION_ENABLED', 'false');
  const html = renderToStaticMarkup(await page());
  expect(fake.read).not.toHaveBeenCalled();
  expect(html).toContain('pas encore activée');
});
