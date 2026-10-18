import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  config: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@/lib/user-detail-config', () => ({
  readLocalUserDetailConfiguration: fake.config,
}));
vi.mock('@/lib/user-detail-pg', () => ({
  createLocalUserDetailReader: fake.create,
  UserDetailPgError: class extends Error {
    constructor() {
      super('Fiche utilisateur indisponible');
    }
  },
}));
import { readUserDetailQuery } from '@/lib/user-detail';
const parsed = readUserDetailQuery(
  'a8100000-0000-4000-8000-000000000001',
  new URLSearchParams('from=2026-10-15&to=2026-10-17'),
);
if (!parsed.ok) throw Error('fixture');
const period = parsed.value;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  fake.config.mockReturnValue({
    url: 'synthetic-url',
    ca: 'synthetic-ca',
    environment: 'local-copy',
  });
  fake.create.mockImplementation(() => ({
    read: fake.read,
    close: fake.close,
  }));
  fake.close.mockResolvedValue(undefined);
  fake.read.mockResolvedValue({ asOf: 'synthetic' });
});
afterEach(() => vi.resetModules());
it('does not create a connection pool while importing a disabled capability', async () => {
  fake.config.mockReturnValue(null);
  const { loadLocalUserDetail } = await import('@/lib/user-detail-server');
  expect(fake.create).not.toHaveBeenCalled();
  await expect(loadLocalUserDetail(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it('reuses the bounded pool but never caches aggregate results', async () => {
  const { loadLocalUserDetail } = await import('@/lib/user-detail-server');
  await Promise.all([loadLocalUserDetail(period), loadLocalUserDetail(period)]);
  expect(fake.create).toHaveBeenCalledTimes(1);
  expect(fake.read).toHaveBeenCalledTimes(2);
});
it('replaces changed operator credentials and closes the preceding pool', async () => {
  const { loadLocalUserDetail } = await import('@/lib/user-detail-server');
  await loadLocalUserDetail(period);
  fake.config.mockReturnValue({
    url: 'rotated-url',
    ca: 'rotated-ca',
    environment: 'local-copy',
  });
  await loadLocalUserDetail(period);
  expect(fake.create).toHaveBeenCalledTimes(2);
  expect(fake.close).toHaveBeenCalledTimes(1);
});
it('does not read from a retained pool after activation is withdrawn', async () => {
  const { loadLocalUserDetail } = await import('@/lib/user-detail-server');
  await loadLocalUserDetail(period);
  fake.config.mockReturnValue(null);
  await expect(loadLocalUserDetail(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(fake.read).toHaveBeenCalledTimes(1);
});
