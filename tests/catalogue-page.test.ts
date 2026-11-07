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
