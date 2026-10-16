import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  user: vi.fn(),
  role: vi.fn(),
  create: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  inside: vi.fn(),
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
    throw Error('redirect:' + path);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
import Page from '@/app/admin/publication/batch/page';
import { loadBatchCandidates } from '@/lib/publication-batch-server';
const id = 'a7100000-0000-4000-8000-000000000001';
const client = { from: fake.from };
const version = () => ({
  id,
  exercise_id: '9007199254740993',
  revision: 1,
  editorial_status: 'approved',
  approval_fingerprint_sha256: 'a'.repeat(64),
  test_epoch: '9007199254740993',
  title: 'Lot test',
});
const parent = () => ({
  id: '9007199254740993',
  catalog_id: 'a7100000-0000-4000-8000-000000000002',
  admin_archived_at: null,
});
const page = (
  query: Record<string, string | string[] | undefined> = { version: id },
) => Page({ searchParams: Promise.resolve(query) });
beforeEach(() => {
  vi.resetAllMocks();
  fake.create.mockResolvedValue(client);
  fake.user.mockResolvedValue({ id: 'admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.from.mockReturnValue({ select: fake.select });
  fake.select.mockReturnValue({ in: fake.inside });
  fake.inside
    .mockResolvedValueOnce({ data: [version()], error: null })
    .mockResolvedValueOnce({ data: [parent()], error: null });
});
it.each(['missing', 'guest', 'user', 'unavailable'])(
  'refuses %s before reading any batch metadata',
  async (access) => {
    if (access === 'missing') fake.user.mockResolvedValue(null);
    if (access === 'guest')
      fake.user.mockResolvedValue({ id: 'admin', isAnonymous: true });
    if (access === 'user') fake.role.mockResolvedValue('user');
    if (access === 'unavailable') fake.role.mockRejectedValue(Error('PRIVATE'));
    await expect(page()).rejects.toThrow('redirect:');
    expect(fake.from).not.toHaveBeenCalled();
  },
);
it('reads only selected metadata with SQL text casts and keeps publication closed', async () => {
  const html = renderToStaticMarkup(await page());
  expect(fake.role).toHaveBeenCalledWith('admin');
  expect(fake.select.mock.calls.map(([columns]) => columns)).toEqual([
    'id,exercise_id::text,revision,editorial_status,approval_fingerprint_sha256,test_epoch::text,title:definition->>title',
    'id::text,catalog_id,admin_archived_at',
  ]);
  expect(fake.inside).toHaveBeenNthCalledWith(1, 'id', [id]);
  expect(html).toContain('9007199254740993');
  expect(html).toContain('Lot test');
  expect(html).toContain('Aucun transfert n’est disponible');
  expect(html).toContain('disabled=""');
});
it.each([
  { version: [id, id] },
  { version: id, confirmation: 'PRIVATE' },
  { version: 'wrong' },
])('does not read data for invalid URL %#', async (query) => {
  const html = renderToStaticMarkup(await page(query));
  expect(html).toContain('révisions distinctes');
  expect(fake.from).not.toHaveBeenCalled();
  expect(html).not.toContain('PRIVATE');
});
it('does not invent an empty selection or expose an internal error when reads fail', async () => {
  fake.inside.mockReset().mockResolvedValueOnce({
    data: null,
    error: { message: 'PRIVATE CONNECTION DETAIL' },
  });
  const html = renderToStaticMarkup(await page());
  expect(html).toContain('La sélection est indisponible');
  expect(html).not.toContain('PRIVATE');
});
it.each([
  { ...version(), exercise_id: 9007199254740992 },
  { ...version(), test_epoch: 9007199254740992 },
])('rejects already-rounded database values %#', async (value) => {
  fake.inside
    .mockReset()
    .mockResolvedValueOnce({ data: [value], error: null })
    .mockResolvedValueOnce({ data: [parent()], error: null });
  expect(
    await loadBatchCandidates(client as never, [
      { versionId: id, operationId: null },
    ]),
  ).toBeNull();
});
it('does not fabricate missing revisions or treat archived sources as eligible', async () => {
  fake.inside.mockReset().mockResolvedValueOnce({ data: [], error: null });
  expect(
    await loadBatchCandidates(client as never, [
      { versionId: id, operationId: null },
    ]),
  ).toEqual([null]);
  fake.inside
    .mockResolvedValueOnce({ data: [version()], error: null })
    .mockResolvedValueOnce({
      data: [{ ...parent(), admin_archived_at: '2026-10-16T12:00:00Z' }],
      error: null,
    });
  const html = renderToStaticMarkup(await page());
  expect(html).toContain('Cet exercice est archivé');
  expect(html).toContain('Préparer 0 exercice');
});
