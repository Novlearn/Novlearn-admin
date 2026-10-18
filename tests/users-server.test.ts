import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  config: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@/lib/users-config', () => ({
  readLocalUsersConfiguration: fake.config,
}));
vi.mock('@/lib/users-pg', () => ({
  createLocalUsersReader: fake.create,
  UsersPgError: class extends Error {
    constructor() {
      super('Utilisateurs indisponibles');
    }
  },
}));
import { usersQueryFixture as period } from './fixtures/users-page';
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
  const { loadLocalUsers } = await import('@/lib/users-server');
  expect(fake.create).not.toHaveBeenCalled();
  await expect(loadLocalUsers(period)).rejects.toThrow(
    'Utilisateurs indisponibles',
  );
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it('reuses the bounded pool but never caches aggregate results', async () => {
  const { loadLocalUsers } = await import('@/lib/users-server');
  await Promise.all([loadLocalUsers(period), loadLocalUsers(period)]);
  expect(fake.create).toHaveBeenCalledTimes(1);
  expect(fake.read).toHaveBeenCalledTimes(2);
});
it('replaces changed operator credentials and closes the preceding pool', async () => {
  const { loadLocalUsers } = await import('@/lib/users-server');
  await loadLocalUsers(period);
  fake.config.mockReturnValue({
    url: 'rotated-url',
    ca: 'rotated-ca',
    environment: 'local-copy',
  });
  await loadLocalUsers(period);
  expect(fake.create).toHaveBeenCalledTimes(2);
  expect(fake.close).toHaveBeenCalledTimes(1);
});
it('does not read from a retained pool after activation is withdrawn', async () => {
  const { loadLocalUsers } = await import('@/lib/users-server');
  await loadLocalUsers(period);
  fake.config.mockReturnValue(null);
  await expect(loadLocalUsers(period)).rejects.toThrow(
    'Utilisateurs indisponibles',
  );
  expect(fake.read).toHaveBeenCalledTimes(1);
});
