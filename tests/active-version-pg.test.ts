import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  make: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  audit: vi.fn(),
  stream: { encrypted: true, authorized: true },
}));
vi.mock('pg', () => ({
  Pool: vi.fn(function (config: unknown) {
    fake.make(config);
    return {
      connect: async () => ({
        query: fake.query,
        release: fake.release,
        on: fake.on,
        removeListener: fake.off,
        connection: { stream: fake.stream },
      }),
      on: fake.on,
      end: fake.end,
    };
  }),
}));
import { createLocalActiveVersionReader } from '@/lib/active-version-pg';
import { readLocalActiveVersionConfiguration } from '@/lib/active-version-config';
import { localActiveVersionEnvironment } from './fixtures/local-active-version-env';
const config = () =>
  readLocalActiveVersionConfiguration(localActiveVersionEnvironment())!;
const catalogId = 'ad100000-0000-4000-8000-000000000001';
const columns = [
  'public.exercises.id',
  'public.exercises.catalog_id',
  'public.exercises.active_version_id',
  'public.exercises.admin_archived_at',
  'public.exercises.publication_epoch',
  'public.exercise_versions.id',
  'public.exercise_versions.exercise_id',
  'public.exercise_versions.revision',
  'public.exercise_versions.editorial_status',
  'public.exercise_versions.published_at',
  'public.exercise_versions.definition_sha256',
  'public.exercise_versions.engine_contract',
  'public.exercise_versions.generation_version',
  'public.exercise_versions.canonicalization_version',
];
const raw = () => ({
  schemaVersion: 1,
  asOf: '2026-10-19T18:00:00.000001Z',
  catalogId,
  parent: null,
  active: null,
});
function audit(assumed: boolean): Record<string, unknown> {
  return {
    login: 'novlearn_admin_active_version_service',
    role: assumed
      ? 'novlearn_active_version_reader'
      : 'novlearn_admin_active_version_service',
    database: 'admin_local',
    flags: {
      login: !assumed,
      inherit: false,
      super: false,
      createdb: false,
      createrole: false,
      replication: false,
      bypassrls: false,
    },
    memberships: assumed
      ? []
      : [
          {
            role: 'novlearn_active_version_reader',
            admin: false,
            inherit: false,
            set: true,
          },
        ],
    columns: assumed ? [...columns] : [],
    databaseCreate: false,
    temporary: false,
    schemaCreate: false,
    ownedObjects: false,
    tableWrite: false,
    sequenceAccess: false,
    unexpectedDefinerAccess: false,
    largeObjectCreate: false,
    rlsTables: 2,
    policyScopeVerified: true,
  };
}
beforeEach(() => {
  fake.stream.encrypted = true;
  fake.stream.authorized = true;
  fake.audit.mockImplementation(audit);
  let assumed = false;
  fake.query.mockImplementation(async (sql: string) => {
    if (sql === 'DISCARD ALL') assumed = false;
    if (sql === 'SET LOCAL ROLE novlearn_active_version_reader') assumed = true;
    if (sql.includes('AS audit FROM me'))
      return { rows: [{ audit: fake.audit(assumed) }] };
    if (sql.includes('AS active_version'))
      return { rows: [{ active_version: raw() }] };
    return { rows: [] };
  });
});
it('uses verified TLS, bounded pool and timeouts without eager connection', async () => {
  const r = createLocalActiveVersionReader(config());
  expect(fake.query).not.toHaveBeenCalled();
  expect(fake.make).toHaveBeenCalledWith(
    expect.objectContaining({
      max: 2,
      connectionTimeoutMillis: 3000,
      query_timeout: 12000,
      enableChannelBinding: true,
      ssl: { rejectUnauthorized: true, ca: config().ca, minVersion: 'TLSv1.2' },
    }),
  );
  await r.close();
});
it('checks both physical identities, uses a read-only transaction and binds a stable catalogue UUID', async () => {
  const r = createLocalActiveVersionReader(config());
  expect(await r.read(catalogId)).toEqual({
    ...raw(),
    environment: 'local-copy',
    targetKey: 'local-http-fixture',
  });
  expect(fake.audit.mock.calls.map((c) => c[0])).toEqual([false, true]);
  expect(fake.query).toHaveBeenCalledWith('BEGIN READ ONLY');
  expect(fake.query).toHaveBeenCalledWith(
    expect.stringContaining('AS active_version'),
    [catalogId],
  );
  expect(fake.query).toHaveBeenCalledWith('COMMIT');
  expect(fake.release).toHaveBeenCalledWith(false);
  await r.close();
});
it.each([
  'temporary',
  'databaseCreate',
  'schemaCreate',
  'ownedObjects',
  'tableWrite',
  'sequenceAccess',
  'unexpectedDefinerAccess',
  'largeObjectCreate',
])(
  'rejects unexpected effective privilege %s in either identity',
  async (key) => {
    for (const target of [false, true]) {
      fake.audit.mockImplementation((assumed: boolean) => ({
        ...audit(assumed),
        ...(assumed === target ? { [key]: true } : {}),
      }));
      const r = createLocalActiveVersionReader(config());
      await expect(r.read(catalogId)).rejects.toThrow(
        'Version publiée indisponible',
      );
      expect(fake.release).toHaveBeenLastCalledWith(true);
      await r.close();
    }
  },
);
it.each([
  (a: Record<string, unknown>) => {
    a.policyScopeVerified = false;
  },
  (a: Record<string, unknown>) => {
    a.rlsTables = 1;
  },
  (a: Record<string, unknown>) => {
    a.database = 'postgres';
  },
  (a: Record<string, unknown>) => {
    a.login = 'postgres';
  },
  (a: Record<string, unknown>) => {
    a.columns = [
      ...(a.columns as string[]),
      'public.exercise_versions.definition',
    ];
  },
  (a: Record<string, unknown>) => {
    (a.flags as Record<string, unknown>).inherit = true;
  },
  (a: Record<string, unknown>) => {
    a.memberships = [...(a.memberships as unknown[]), { role: 'postgres' }];
  },
])('rejects identity, RLS, policy or column drift %#', async (change) => {
  for (const target of [false, true]) {
    fake.audit.mockImplementation((assumed: boolean) => {
      const a = audit(assumed);
      if (assumed === target) change(a);
      return a;
    });
    const r = createLocalActiveVersionReader(config());
    await expect(r.read(catalogId)).rejects.toThrow();
    expect(fake.release).toHaveBeenLastCalledWith(true);
    await r.close();
  }
});
it.each(['encrypted', 'authorized'] as const)(
  'refuses unverified TLS %s',
  async (key) => {
    fake.stream[key] = false;
    const r = createLocalActiveVersionReader(config());
    await expect(r.read(catalogId)).rejects.toThrow();
    expect(fake.release).toHaveBeenCalledWith(true);
    await r.close();
  },
);
it.each(['environment', 'targetKey', 'definition', 'email'])(
  'refuses SQL-provided labels or unsolicited %s',
  async (key) => {
    const base = fake.query.getMockImplementation()!;
    fake.query.mockImplementation(async (sql: string) =>
      sql.includes('AS active_version')
        ? { rows: [{ active_version: { ...raw(), [key]: 'untrusted' } }] }
        : base(sql),
    );
    const r = createLocalActiveVersionReader(config());
    await expect(r.read(catalogId)).rejects.toThrow();
    expect(fake.release).toHaveBeenCalledWith(true);
    await r.close();
  },
);
it('refuses invalid UUIDs without opening a lease', async () => {
  const r = createLocalActiveVersionReader(config());
  await expect(r.read("' OR true --")).rejects.toThrow();
  expect(fake.query).not.toHaveBeenCalled();
  await r.close();
});
it('destroys a connection on a failed commit without reporting an observation', async () => {
  const base = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string) => {
    if (sql === 'COMMIT') throw Error('private driver detail');
    return base(sql);
  });
  const r = createLocalActiveVersionReader(config());
  await expect(r.read(catalogId)).rejects.toThrow(
    'Version publiée indisponible',
  );
  expect(fake.release).toHaveBeenCalledWith(true);
  await r.close();
});
