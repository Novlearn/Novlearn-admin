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
import { createLocalUserDetailReader } from '@/lib/user-detail-pg';
import { statisticsPeriod } from '@/lib/activity-statistics';
import sqlFixture from './fixtures/user-detail-sql.json';
const fixture = { ...sqlFixture.history, environment: 'local-copy' };
const config = () => ({
  url: 'postgresql://novlearn_admin_user_detail_service:synthetic-fixture-password@127.0.0.1:55435/activity_copy',
  ca: '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
  environment: 'local-copy' as const,
});
const period = {
  userId: 'a8100000-0000-4000-8000-000000000001',
  view: 'history' as const,
  period: statisticsPeriod('2026-10-15', '2026-10-17')!,
  after: null,
  before: null,
};
const columns = [
  'auth.users.email',
  'auth.users.id',
  'auth.users.is_anonymous',
  'public.chapters.id',
  'public.chapters.name',
  'public.competences.chapter_id',
  'public.competences.id',
  'public.competences.max_points',
  'public.competences.name',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.id',
  'public.duel_attempts.is_correct',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duels.exercise_id',
  'public.duels.id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.exercise_id',
  'public.exercise_attempts.exercise_version_id',
  'public.exercise_attempts.id',
  'public.exercise_attempts.is_abandoned',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.user_id',
  'public.exercises.app_title',
  'public.exercises.id',
  'public.exercises.title',
  'public.profiles.first_name',
  'public.profiles.id',
  'public.profiles.last_name',
  'public.user_competence_scores.competence_id',
  'public.user_competence_scores.points',
  'public.user_competence_scores.updated_at',
  'public.user_competence_scores.user_id',
  'public.user_progress.chapter',
  'public.user_progress.exercises_completed',
  'public.user_progress.id',
  'public.user_progress.last_activity',
  'public.user_progress.level',
  'public.user_progress.user_id',
];
function audit(assumed: boolean): Record<string, unknown> {
  return {
    login: 'novlearn_admin_user_detail_service',
    role: assumed
      ? 'novlearn_user_detail_reader'
      : 'novlearn_admin_user_detail_service',
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
            role: 'novlearn_user_detail_reader',
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
    rlsTables: 10,
  };
}
beforeEach(() => {
  fake.stream.encrypted = true;
  fake.stream.authorized = true;
  fake.audit.mockImplementation(audit);
  let assumed = false;
  fake.query.mockImplementation(async (sql: string) => {
    if (sql === 'DISCARD ALL') assumed = false;
    if (sql === 'SET LOCAL ROLE novlearn_user_detail_reader') assumed = true;
    if (sql.includes('AS audit FROM me'))
      return { rows: [{ audit: fake.audit(assumed) }] };
    if (sql.includes('AS detail\nFROM envelope')) {
      const row: Record<string, unknown> = structuredClone(fixture);
      delete row.environment;
      return { rows: [{ detail: row }] };
    }
    return { rows: [] };
  });
});
it('constructs a lazy pool with verified TLS and bounded timeouts', () => {
  const reader = createLocalUserDetailReader(config());
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
      createLocalUserDetailReader({ ...config(), url: config().url + suffix }),
    ).toThrow('Fiche utilisateur indisponible');
    expect(fake.make).not.toHaveBeenCalled();
  },
);
it.each([
  ['127.0.0.1', 'remote.invalid'],
  ['55435', '5432'],
  ['activity_copy', 'postgres'],
  ['novlearn_admin_user_detail_service', 'postgres'],
  ['synthetic-fixture-password', 'short'],
])('rejects endpoints outside the isolated copy %s', (a, b) => {
  expect(() =>
    createLocalUserDetailReader({
      ...config(),
      url: config().url.replace(a, b),
    }),
  ).toThrow();
});
it('does not accept an operational source label or missing certificate', () => {
  expect(() =>
    createLocalUserDetailReader({
      ...config(),
      environment: 'production' as 'local-copy',
    }),
  ).toThrow();
  expect(() => createLocalUserDetailReader({ ...config(), ca: '' })).toThrow();
});
it('audits both identities and returns aggregates with a trusted source label', async () => {
  const reader = createLocalUserDetailReader(config());
  const result = await reader.read(period);
  if (!result) throw Error('Expected an existing user fixture');
  expect(result.environment).toBe('local-copy');
  expect(result.items).toEqual(fixture.items);
  expect(fake.audit.mock.calls.map((c) => c[0])).toEqual([false, true]);
  expect(fake.query).toHaveBeenCalledWith(
    expect.stringContaining('AS detail\nFROM envelope'),
    [
      period.userId,
      period.period.from,
      period.period.until,
      period.view,
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
      const reader = createLocalUserDetailReader(config());
      await expect(reader.read(period)).rejects.toThrow(
        'Fiche utilisateur indisponible',
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
    a.rlsTables = 9;
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
  const reader = createLocalUserDetailReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(
    fake.query.mock.calls.some((c) =>
      String(c[0]).includes('AS detail\nFROM envelope'),
    ),
  ).toBe(false);
  await reader.close();
});
it('refuses a modified aggregate without returning partial values or raw SQL errors', async () => {
  const original = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string, ...rest: unknown[]) =>
    sql.includes('AS detail\nFROM envelope')
      ? { rows: [{ detail: { ...fixture, environment: 'production' } }] }
      : original(sql, ...rest),
  );
  const reader = createLocalUserDetailReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
it('refuses invalid period metadata before obtaining a connection', async () => {
  const reader = createLocalUserDetailReader(config());
  await expect(
    reader.read({ ...period, period: { ...period.period, days: 4 } }),
  ).rejects.toThrow();
  expect(fake.query).not.toHaveBeenCalled();
  await reader.close();
});
it('refuses an unverified physical transport even if the query mock would pass', async () => {
  fake.stream.authorized = false;
  const reader = createLocalUserDetailReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(fake.query).not.toHaveBeenCalled();
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
it('commits a verified absence response and distinguishes it from a broken lease', async () => {
  const original = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string, ...rest: unknown[]) =>
    sql.includes('AS detail\nFROM envelope')
      ? { rows: [{ detail: structuredClone(sqlFixture.missing) }] }
      : original(sql, ...rest),
  );
  const reader = createLocalUserDetailReader(config());
  await expect(
    reader.read({ ...period, userId: sqlFixture.missing.userId }),
  ).resolves.toBeNull();
  expect(fake.query).toHaveBeenCalledWith('COMMIT');
  expect(fake.release).toHaveBeenCalledWith(false);
  await reader.close();
});
it('does not accept an absence envelope for another requested identity', async () => {
  const original = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string, ...rest: unknown[]) =>
    sql.includes('AS detail\nFROM envelope')
      ? { rows: [{ detail: structuredClone(sqlFixture.missing) }] }
      : original(sql, ...rest),
  );
  const reader = createLocalUserDetailReader(config());
  await expect(reader.read(period)).rejects.toThrow(
    'Fiche utilisateur indisponible',
  );
  expect(fake.release).toHaveBeenCalledWith(true);
  expect(fake.query).not.toHaveBeenCalledWith('COMMIT');
  await reader.close();
});
it('copies the validated query before awaiting the connection or files', async () => {
  const reader = createLocalUserDetailReader(config()),
    input = structuredClone(period);
  const pending = reader.read(input);
  input.period.from = '2026-10-16';
  const result = await pending;
  expect(result?.period.from).toBe('2026-10-15');
  await reader.close();
});
