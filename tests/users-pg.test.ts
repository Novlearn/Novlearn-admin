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
import { createUsersReader } from '@/lib/users-pg';
import { statisticsPeriod } from '@/lib/activity-statistics';
import { usersPageFixture as fixture } from './fixtures/users-page';
const config = () => ({
  url: 'postgresql://novlearn_admin_users_service:synthetic-fixture-password@127.0.0.1:55435/activity_copy',
  ca: '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
  environment: 'local-copy' as const,
});
const period = {
  period: statisticsPeriod('2026-10-15', '2026-10-17')!,
  query: '',
  after: null,
  before: null,
};
const columns = [
  'auth.users.id',
  'auth.users.email',
  'public.profiles.id',
  'public.profiles.first_name',
  'public.profiles.last_name',
  'auth.users.is_anonymous',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duels.id',
  'public.duels.player1_id',
  'public.duels.player2_id',
];
function audit(assumed: boolean): Record<string, unknown> {
  return {
    login: 'novlearn_admin_users_service',
    role: assumed ? 'novlearn_users_reader' : 'novlearn_admin_users_service',
    database: 'activity_copy',
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
            role: 'novlearn_users_reader',
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
    rlsTables: 5,
  };
}
beforeEach(() => {
  fake.stream.encrypted = true;
  fake.stream.authorized = true;
  fake.audit.mockImplementation(audit);
  let assumed = false;
  fake.query.mockImplementation(async (sql: string) => {
    if (sql === 'DISCARD ALL') assumed = false;
    if (sql === 'SET LOCAL ROLE novlearn_users_reader') assumed = true;
    if (sql.includes('AS audit FROM me'))
      return { rows: [{ audit: fake.audit(assumed) }] };
    if (sql.includes('AS users FROM bounds')) {
      const row: Record<string, unknown> = structuredClone(fixture);
      delete row.environment;
      return { rows: [{ users: row }] };
    }
    return { rows: [] };
  });
});
it('constructs a lazy pool with verified TLS and bounded timeouts', () => {
  const reader = createUsersReader(config());
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
  return reader.close();
});
it.each(['?sslmode=disable', '?options=-c%20role%3Dpostgres', '#override'])(
  'rejects URL overrides %s before constructing a pool',
  (suffix) => {
    expect(() =>
      createUsersReader({ ...config(), url: config().url + suffix }),
    ).toThrow('Utilisateurs indisponibles');
    expect(fake.make).not.toHaveBeenCalled();
  },
);
it.each([
  ['127.0.0.1', 'remote.invalid'],
  ['55435', '5432'],
  ['activity_copy', 'postgres'],
  ['novlearn_admin_users_service', 'postgres'],
  ['synthetic-fixture-password', 'short'],
])('rejects endpoints outside the isolated copy %s', (a, b) => {
  expect(() =>
    createUsersReader({ ...config(), url: config().url.replace(a, b) }),
  ).toThrow();
});
it('does not accept an operational source label or missing certificate', () => {
  expect(() =>
    createUsersReader({
      ...config(),
      environment: 'production' as 'local-copy',
    }),
  ).toThrow();
  expect(() => createUsersReader({ ...config(), ca: '' })).toThrow();
});
it('audits both identities and returns aggregates with a trusted source label', async () => {
  const reader = createUsersReader(config());
  const result = await reader.read(period);
  expect(result.environment).toBe('local-copy');
  expect(result.items).toEqual(fixture.items);
  expect(fake.audit.mock.calls.map((c) => c[0])).toEqual([false, true]);
  expect(fake.query).toHaveBeenCalledWith(
    expect.stringContaining('AS users FROM bounds'),
    [
      period.period.from,
      period.period.until,
      period.query,
      period.after,
      period.before,
      25,
    ],
  );
  expect(fake.query).toHaveBeenCalledWith('BEGIN READ ONLY');
  expect(fake.query).toHaveBeenCalledWith('COMMIT');
  expect(fake.release).toHaveBeenCalledWith(false);
  await reader.close();
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
  'destroys the lease on unexpected effective privilege %s in either identity',
  async (key) => {
    for (const target of [false, true]) {
      fake.audit.mockImplementation((assumed: boolean) => ({
        ...audit(assumed),
        ...(assumed === target ? { [key]: true } : {}),
      }));
      const reader = createUsersReader(config());
      await expect(reader.read(period)).rejects.toThrow(
        'Utilisateurs indisponibles',
      );
      expect(fake.release).toHaveBeenLastCalledWith(true);
      await reader.close();
    }
  },
);
it.each([
  (a: Record<string, unknown>) => {
    a.columns = [...(a.columns as string[]), 'public.profiles.birth_date'];
  },
  (a: Record<string, unknown>) => {
    (a.flags as Record<string, unknown>).bypassrls = true;
  },
  (a: Record<string, unknown>) => {
    a.rlsTables = 4;
  },
  (a: Record<string, unknown>) => {
    a.database = 'postgres';
  },
  (a: Record<string, unknown>) => {
    a.login = 'postgres';
  },
  (a: Record<string, unknown>) => {
    a.memberships = [
      {
        role: 'novlearn_publication_executor',
        set: true,
        inherit: false,
        admin: false,
      },
    ];
  },
])('refuses identity, membership or column drift %#', async (mutate) => {
  fake.audit.mockImplementation((assumed: boolean) => {
    const a = audit(assumed);
    mutate(a);
    return a;
  });
  const reader = createUsersReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Utilisateurs indisponibles',
  );
  expect(
    fake.query.mock.calls.some((c) =>
      String(c[0]).includes('AS users FROM bounds'),
    ),
  ).toBe(false);
  await reader.close();
});
it('refuses a modified aggregate without returning partial values or raw SQL errors', async () => {
  const original = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string, ...rest: unknown[]) =>
    sql.includes('AS users FROM bounds')
      ? { rows: [{ users: { ...fixture, environment: 'production' } }] }
      : original(sql, ...rest),
  );
  const reader = createUsersReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Utilisateurs indisponibles',
  );
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
it('refuses invalid period metadata before obtaining a connection', async () => {
  const reader = createUsersReader(config());
  await expect(
    reader.read({ ...period, period: { ...period.period, days: 4 } }),
  ).rejects.toThrow();
  expect(fake.query).not.toHaveBeenCalled();
  await reader.close();
});
it('refuses an unverified physical transport even if the query mock would pass', async () => {
  fake.stream.authorized = false;
  const reader = createUsersReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Utilisateurs indisponibles',
  );
  expect(fake.query).not.toHaveBeenCalled();
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
