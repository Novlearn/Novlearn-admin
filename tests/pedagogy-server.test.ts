import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  config: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  references: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@/lib/pedagogy-config', () => ({
  readLocalPedagogyConfiguration: fake.config,
}));
vi.mock('@/lib/pedagogy-pg', () => ({
  createLocalPedagogyReader: fake.create,
  PedagogyPgError: class extends Error {
    constructor() {
      super('Analyse pédagogique indisponible');
    }
  },
}));
import { readPedagogyQuery } from '@/lib/pedagogy-statistics';
const parsed = readPedagogyQuery(
  new URLSearchParams('from=2026-10-15&to=2026-10-17'),
);
if (!parsed.ok) throw Error('fixture');
const query = parsed.query;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  fake.config.mockReturnValue({
    url: 'local-fixture-url',
    ca: 'local-fixture-ca',
    environment: 'local-copy',
  });
  fake.create.mockImplementation(() => ({
    read: fake.read,
    references: fake.references,
    close: fake.close,
  }));
  fake.close.mockResolvedValue(undefined);
});
it('does not create a pool on import or read after activation is withdrawn', async () => {
  const server = await import('@/lib/pedagogy-server');
  expect(fake.create).not.toHaveBeenCalled();
  await server.loadLocalPedagogyStatistics(query);
  fake.config.mockReturnValue(null);
  expect(() => server.loadLocalPedagogyStatistics(query)).toThrow(
    'indisponible',
  );
  expect(() =>
    server.loadLocalPedagogyReferences({ kind: 'chapter', q: '' }),
  ).toThrow('indisponible');
  expect(fake.read).toHaveBeenCalledTimes(1);
  expect(fake.references).not.toHaveBeenCalled();
});
it('reuses only the pool while executing every report and reference read', async () => {
  const server = await import('@/lib/pedagogy-server');
  for (let i = 0; i < 2; i++) {
    await server.loadLocalPedagogyStatistics(query);
    await server.loadLocalPedagogyReferences({ kind: 'chapter', q: 'Analyse' });
  }
  expect(fake.create).toHaveBeenCalledTimes(1);
  expect(fake.read).toHaveBeenCalledTimes(2);
  expect(fake.references).toHaveBeenCalledTimes(2);
  expect(fake.config).toHaveBeenCalledTimes(4);
});
it('replaces and closes the old pool on certificate or credential rotation', async () => {
  const server = await import('@/lib/pedagogy-server');
  await server.loadLocalPedagogyStatistics(query);
  fake.config.mockReturnValue({
    url: 'new-local-url',
    ca: 'new-local-ca',
    environment: 'local-copy',
  });
  await server.loadLocalPedagogyReferences({ kind: 'chapter', q: '' });
  expect(fake.create).toHaveBeenCalledTimes(2);
  expect(fake.close).toHaveBeenCalledTimes(1);
});
