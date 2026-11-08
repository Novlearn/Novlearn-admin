import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  config: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@/lib/activity-config', () => ({
  readActivityConfiguration: fake.config,
}));
vi.mock('@/lib/activity-pg', () => ({
  createActivityReader: fake.create,
  ActivityPgError: class extends Error {
    constructor() {
      super('Statistiques indisponibles');
    }
  },
}));
import { statisticsPeriod } from '@/lib/activity-statistics';
const period = statisticsPeriod('2026-10-15', '2026-10-17')!;
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
  const { loadActivityStatistics } = await import('@/lib/activity-server');
  expect(fake.create).not.toHaveBeenCalled();
  await expect(loadActivityStatistics(period)).rejects.toThrow(
    'Statistiques indisponibles',
  );
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.read).not.toHaveBeenCalled();
});
it('reuses the bounded pool but never caches aggregate results', async () => {
  const { loadActivityStatistics } = await import('@/lib/activity-server');
  await Promise.all([
    loadActivityStatistics(period),
    loadActivityStatistics(period),
  ]);
  expect(fake.create).toHaveBeenCalledTimes(1);
  expect(fake.read).toHaveBeenCalledTimes(2);
});
it('replaces changed operator credentials and closes the preceding pool', async () => {
  const { loadActivityStatistics } = await import('@/lib/activity-server');
  await loadActivityStatistics(period);
  fake.config.mockReturnValue({
    url: 'rotated-url',
    ca: 'rotated-ca',
    environment: 'local-copy',
  });
  await loadActivityStatistics(period);
  expect(fake.create).toHaveBeenCalledTimes(2);
  expect(fake.close).toHaveBeenCalledTimes(1);
});
it('does not read from a retained pool after activation is withdrawn', async () => {
  const { loadActivityStatistics } = await import('@/lib/activity-server');
  await loadActivityStatistics(period);
  fake.config.mockReturnValue(null);
  await expect(loadActivityStatistics(period)).rejects.toThrow(
    'Statistiques indisponibles',
  );
  expect(fake.read).toHaveBeenCalledTimes(1);
});
