import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  require: vi.fn(),
  read: vi.fn(),
  from: vi.fn(),
  parent: vi.fn(),
  requirePage: vi.fn(),
}));
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdminPage: fake.requirePage,
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
import { newDraft } from '@/lib/catalogue';
import { localActiveVersionEnvironment } from './fixtures/local-active-version-env';
const catalogId = 'ad100000-0000-4000-8000-000000000001';
const page = (searchParams: Record<string, string> = {}) =>
  Page({
    params: Promise.resolve({ id: '123' }),
    searchParams: Promise.resolve(searchParams),
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
it('renders the protected creation form if the dev router passes new as an id', async () => {
  const createPage = () =>
    Page({
      params: Promise.resolve({ id: 'new' }),
      searchParams: Promise.resolve({}),
    });
  fake.requirePage.mockRejectedValueOnce(Error('redirect:/login'));
  await expect(createPage()).rejects.toThrow('redirect:/login');
  const html = renderToStaticMarkup(await createPage());
  expect(html).toContain('Créer un exercice');
  expect(html).toContain('Enregistrer en brouillon');
  expect(fake.require).not.toHaveBeenCalled();
  expect(fake.from).not.toHaveBeenCalled();
});
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
it('hides the local target card when its reader is disabled', async () => {
  vi.stubEnv('ADMIN_LOCAL_ACTIVE_VERSION_ENABLED', 'false');
  const html = renderToStaticMarkup(await page());
  expect(fake.read).not.toHaveBeenCalled();
  expect(html).not.toContain('Version active sur la copie locale');
});

const versionId = 'ad100000-0000-4000-8000-000000000002';
function withRevision(status: string, archived = false) {
  const version = {
    id: versionId,
    revision: 26,
    editorial_status: status,
    definition: {
      ...newDraft('nom_interne_exercice'),
      catalogue: { appTitle: 'Calculer une dérivée' },
    },
    approval_fingerprint_sha256: 'a'.repeat(64),
  };
  const filtered = vi.fn().mockReturnThis();
  const latest = vi
    .fn()
    .mockResolvedValue({ data: { id: versionId }, error: null });
  fake.from.mockImplementation((table: string) => ({
    select: vi.fn().mockImplementation((columns: string) => ({
      eq: filtered,
      order: vi.fn().mockReturnThis(),
      maybeSingle: async () => ({
        data:
          table === 'exercises'
            ? {
                catalog_id: catalogId,
                admin_archived_at: archived ? '2026-11-24' : null,
              }
            : version,
        error: null,
      }),
      limit: (limit: number) =>
        table === 'exercise_versions' && columns === 'id' && limit === 1
          ? { maybeSingle: latest }
          : Promise.resolve({ data: [], error: null }),
      range: async (start: number) => ({
        data: start === 0 ? [version] : [],
        count: 26,
        error: null,
      }),
    })),
  }));
  return latest;
}

it.each(['ready', 'published'])(
  'opens a new draft from the selected %s version on a dedicated view',
  async (status) => {
    withRevision(status);
    const details = renderToStaticMarkup(await page({ version: versionId }));
    expect(details).toContain('Créer une nouvelle révision');
    expect(details).not.toContain('Enregistrer et approuver');
    expect(details).not.toContain('Consulter le format canonique');
    expect(details).not.toContain('Relecture humaine');
    const edit = renderToStaticMarkup(
      await page({ version: versionId, edit: 'revision' }),
    );
    expect(edit).toContain('Brouillon à partir de la version 26');
    expect(edit).toContain('value="Calculer une dérivée"');
    expect(edit).toContain('Enregistrer en brouillon');
    expect(edit).toContain('Enregistrer et approuver');
    expect(edit).not.toContain('Historique des versions');
  },
);

it('keeps the usual save action for a draft and blocks editing an archived exercise', async () => {
  withRevision('draft');
  const draft = renderToStaticMarkup(await page());
  expect(draft).toContain('Enregistrer en brouillon');
  expect(draft).toContain('Enregistrer et approuver');
  expect(draft).not.toContain('Créer une nouvelle révision');
  withRevision('ready', true);
  const archived = renderToStaticMarkup(
    await page({ version: versionId, edit: 'revision' }),
  );
  expect(archived).toContain('Restaurez l’exercice pour reprendre son édition');
  expect(archived).not.toContain('Enregistrer et approuver');
});

it('keeps the selected revision when browsing older pages of the history', async () => {
  const latest = withRevision('draft');
  const first = renderToStaticMarkup(await page());
  expect(first).toContain(`history=2&amp;version=${versionId}`);
  const second = renderToStaticMarkup(await page({ history: '2' }));
  expect(latest).toHaveBeenCalledOnce();
  expect(second).toContain('Calculer une dérivée');
  expect(second).toContain('version 26');
});
