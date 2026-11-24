import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  require: vi.fn(),
  load: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/lib/catalogue-server', () => ({
  requireCatalogueClient: fake.require,
  loadCatalogue: fake.load,
}));
import Page from '@/app/admin/exercises/page';
const item = () => ({
  id: '9007199254740993',
  catalogId: 'a7400000-0000-4000-8000-000000000001',
  title: 'Titre',
  appTitle: 'Application',
  chapter: 'Chapitre',
  difficulty: '2',
  skills: ['Compétence'],
  exerciseType: 'classic',
  needsCalculator: false,
  status: 'approved',
  revision: 1,
  versionId: 'a7400000-0000-4000-8000-000000000002',
  activeVersionId: null,
  archived: false,
  updatedAt: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  fake.require.mockResolvedValue({ session: 'verified', rpc: fake.rpc });
  fake.rpc.mockResolvedValue({ data: { chapters: [] }, error: null });
  fake.load.mockResolvedValue({ total: 1, items: [item()] });
});
it('projects only explicit catalogue metadata across the new client selection boundary', async () => {
  fake.load.mockResolvedValue({
    total: 1,
    secret: 'PRIVATE',
    items: [
      {
        ...item(),
        definition: { expectedLatex: 'PRIVATE' },
        actor_id: 'PRIVATE',
      },
    ],
  });
  const result = await Page({ searchParams: Promise.resolve({}) });
  expect(result.props.data).toEqual({ total: 1, items: [item()] });
  expect(JSON.stringify(result.props.data)).not.toContain('PRIVATE');
});
it.each([
  { ...item(), skills: [{ secret: 'PRIVATE' }] },
  { ...item(), title: { secret: 'PRIVATE' } },
  { ...item(), id: 9007199254740992 },
  { ...item(), status: 'unknown' },
])('rejects unexpected nested or rounded metadata %#', async (value) => {
  fake.load.mockResolvedValue({ total: 1, items: [value] });
  expect(
    (await Page({ searchParams: Promise.resolve({}) })).props.data,
  ).toBeNull();
});
it('requires server access before loading any catalogue data', async () => {
  fake.require.mockRejectedValue(Error('redirect:/login'));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    'redirect:/login',
  );
  expect(fake.load).not.toHaveBeenCalled();
});

it('shows the readable title and keeps the Staging status distinct from confirmed publication', async () => {
  const exercise = {
    ...item(),
    title: 'nom_interne_exercice',
    appTitle: 'Calcul_dérivé',
    status: 'published',
    activeVersionId: item().versionId,
  };
  fake.load.mockResolvedValue({ total: 1, items: [exercise] });
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain('Calcul dérivé');
  expect(html).toContain(`/admin/exercises/${exercise.id}`);
  expect(html).toContain('Publication à vérifier');
  expect(html).not.toContain('nom_interne_exercice');
  expect(html).not.toContain('Publié en préproduction');
  expect(html).not.toContain('Version active en préproduction');
});

it('shows a readable fallback title, a draft in review and an archived exercise', async () => {
  fake.load.mockResolvedValue({
    total: 3,
    items: [
      {
        ...item(),
        title: 'Équations__du_second_degré',
        appTitle: ' ',
        status: 'in_review',
      },
      { ...item(), id: '2', archived: true },
      { ...item(), id: '3', status: 'ready' },
    ],
  });
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain('Équations du second degré');
  expect(html).toContain('>Brouillon</span>');
  expect(html).toContain('>Archivé</span>');
  expect(html).toContain('>Approuvé</span>');
  expect(html).toContain('href="/admin/catalogue-sync"');
});

it('does not send the unsupported ready filter to the Staging RPC', async () => {
  await Page({ searchParams: Promise.resolve({ status: 'ready' }) });
  expect(fake.load).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ status: 'all' }),
  );
});
