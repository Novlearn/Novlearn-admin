import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  create: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  rpc: vi.fn(),
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
import PublicationPage from '@/app/admin/publication/page';
const history = () => ({
  total: 1,
  items: [
    {
      id: '97000000-0000-4000-8000-000000000001',
      batchId: '97000000-0000-4000-8000-000000000002',
      versionId: '97000000-0000-4000-8000-000000000003',
      catalogId: '97000000-0000-4000-8000-000000000004',
      targetKey: 'local-fixture',
      mode: 'publish',
      state: 'uncertain',
      createdAt: '2026-10-15T18:00:00Z',
      updatedAt: '2026-10-15T18:00:00Z',
      errorCode: null,
    },
  ],
});
const page = (query: Record<string, string | string[] | undefined> = {}) =>
  PublicationPage({ searchParams: Promise.resolve(query) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_PUBLICATION_ENABLED', 'false');
  fake.create.mockResolvedValue({ rpc: fake.rpc });
  fake.user.mockResolvedValue({ id: 'admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.rpc.mockResolvedValue({ data: history(), error: null });
});
afterEach(() => vi.unstubAllEnvs());
it.each(['disabled', 'missing', 'guest', 'user', 'unavailable'])(
  'does not read history with %s access',
  async (access) => {
    if (access === 'disabled') fake.create.mockResolvedValue(null);
    if (access === 'missing') fake.user.mockResolvedValue(null);
    if (access === 'guest')
      fake.user.mockResolvedValue({ id: 'admin', isAnonymous: true });
    if (access === 'user') fake.role.mockResolvedValue('user');
    if (access === 'unavailable')
      fake.user.mockRejectedValue(Error('PRIVATE AUTH DETAIL'));
    await expect(page()).rejects.toThrow('redirect:');
    expect(fake.rpc).not.toHaveBeenCalled();
  },
);
it('rereads the actual session role before the owned fixed history RPC and keeps actions closed', async () => {
  const html = renderToStaticMarkup(await page());
  expect(fake.user).toHaveBeenCalledTimes(1);
  expect(fake.role).toHaveBeenCalledWith('admin');
  expect(fake.rpc).toHaveBeenCalledWith('admin_list_publication_operations', {
    p_offset: 0,
  });
  expect(html).toContain('Mes opérations de publication');
  expect(html).toContain('Résultat incertain');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('Transfert confirmé');
});
it('bounds pagination to the SQL contract and only links to adjacent pages', async () => {
  fake.rpc.mockResolvedValue({
    data: { ...history(), total: 70 },
    error: null,
  });
  const html = renderToStaticMarkup(await page({ page: '2' }));
  expect(fake.rpc).toHaveBeenLastCalledWith(
    'admin_list_publication_operations',
    { p_offset: 25 },
  );
  expect(html).toContain('/admin/publication?page=1');
  expect(html).toContain('/admin/publication?page=3');
  await page({ page: '4001' });
  expect(fake.rpc).toHaveBeenLastCalledWith(
    'admin_list_publication_operations',
    { p_offset: 100000 },
  );
  await page({ page: '4002' });
  expect(fake.rpc).toHaveBeenLastCalledWith(
    'admin_list_publication_operations',
    { p_offset: 0 },
  );
});
it('shows an explicit unavailable state rather than an empty or successful history for RPC errors or private data', async () => {
  for (const value of [
    { data: null, error: { message: 'PRIVATE CONNECTION DETAIL' } },
    {
      data: {
        ...history(),
        items: [{ ...history().items[0], payload: { secret: 'PRIVATE' } }],
      },
      error: null,
    },
  ]) {
    fake.rpc.mockResolvedValueOnce(value);
    const html = renderToStaticMarkup(await page());
    expect(html).toContain('Historique de publication indisponible');
    expect(html).not.toContain('PRIVATE');
    expect(html).not.toContain('Aucune opération sur cette page');
  }
});
