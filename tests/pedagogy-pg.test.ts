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
import { createLocalPedagogyReader } from '@/lib/pedagogy-pg';
import { readPedagogyQuery } from '@/lib/pedagogy-statistics';
import fixture from './fixtures/pedagogy-statistics.json';
const config = () => ({
  url: 'postgresql://novlearn_admin_pedagogy_service:synthetic-fixture-password@127.0.0.1:55436/activity_copy',
  ca: '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
  environment: 'local-copy' as const,
});
const parsed = readPedagogyQuery(
  new URLSearchParams('from=2026-10-15&to=2026-10-17'),
);
if (!parsed.ok) throw Error('Invalid fixture query');
const query = parsed.query;
const columns = [
  'auth.users.id',
  'public.exercise_attempts.id',
  'public.exercise_attempts.exercise_id',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.is_abandoned',
  'public.duel_attempts.id',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duel_attempts.is_correct',
  'public.duels.id',
  'public.duels.exercise_id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.duels.status',
  'public.duels.finished_at',
  'public.exercises.id',
  'public.exercises.title',
  'public.exercises.app_title',
  'public.exercises.chapter',
  'public.exercises.difficulty',
  'public.exercises.competences',
  'public.exercises.competence_id',
  'public.exercises.Is_Flash',
  'public.chapters.id',
  'public.chapters.name',
  'public.chapters.aliases',
  'public.competences.id',
  'public.competences.name',
  'public.competences.chapter_id',
].sort();
function audit(assumed: boolean): Record<string, unknown> {
  return {
    login: 'novlearn_admin_pedagogy_service',
    role: assumed
      ? 'novlearn_pedagogy_reader'
      : 'novlearn_admin_pedagogy_service',
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
            role: 'novlearn_pedagogy_reader',
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
    rlsTables: 7,
  };
}
beforeEach(() => {
  fake.stream.encrypted = true;
  fake.stream.authorized = true;
  fake.audit.mockImplementation(audit);
  let assumed = false;
  fake.query.mockImplementation(async (sql: string) => {
    if (sql === 'DISCARD ALL') assumed = false;
    if (sql === 'SET LOCAL ROLE novlearn_pedagogy_reader') assumed = true;
    if (sql.includes('AS audit FROM me'))
      return { rows: [{ audit: fake.audit(assumed) }] };
    if (sql.includes('AS statistics FROM bounds')) {
      const row: Record<string, unknown> = structuredClone(fixture);
      delete row.environment;
      return { rows: [{ statistics: row }] };
    }
    if (sql.includes('AS reference_choices FROM bounds'))
      return {
        rows: [
          {
            reference_choices: {
              schemaVersion: 1,
              kind: 'competence',
              q: '%_\\',
              more: false,
              items: [
                { id: 'literal', label: 'Valeur %_\\', truncated: false },
              ],
            },
          },
        ],
      };
    return { rows: [] };
  });
});
it('constructs a lazy pool with verified TLS and bounded timeouts', () => {
  const reader = createLocalPedagogyReader(config());
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
      createLocalPedagogyReader({ ...config(), url: config().url + suffix }),
    ).toThrow('Analyse pédagogique indisponible');
    expect(fake.make).not.toHaveBeenCalled();
  },
);
it.each([
  ['127.0.0.1', 'remote.invalid'],
  ['55436', '5432'],
  ['activity_copy', 'postgres'],
  ['novlearn_admin_pedagogy_service', 'postgres'],
  ['synthetic-fixture-password', 'short'],
])('rejects endpoints outside the isolated copy %s', (a, b) => {
  expect(() =>
    createLocalPedagogyReader({ ...config(), url: config().url.replace(a, b) }),
  ).toThrow();
});
it('does not accept an operational source label or missing certificate', () => {
  expect(() =>
    createLocalPedagogyReader({
      ...config(),
      environment: 'production' as 'local-copy',
    }),
  ).toThrow();
  expect(() => createLocalPedagogyReader({ ...config(), ca: '' })).toThrow();
});
it('audits both identities and returns aggregates with a trusted source label', async () => {
  const reader = createLocalPedagogyReader(config());
  const result = await reader.read(query);
  expect(result.environment).toBe('local-copy');
  expect(result.totals).toEqual(fixture.totals);
  expect(fake.audit.mock.calls.map((c) => c[0])).toEqual([false, true]);
  expect(fake.query).toHaveBeenCalledWith(
    expect.stringContaining('AS statistics FROM bounds'),
    [
      query.period.from,
      query.period.until,
      null,
      null,
      null,
      null,
      'all',
      'chapter',
      'attempts',
      '1',
    ],
  );
  expect(fake.query).toHaveBeenCalledWith('BEGIN READ ONLY');
  expect(fake.query).toHaveBeenCalledWith('COMMIT');
  expect(fake.release).toHaveBeenCalledWith(false);
  await reader.close();
});
it('audits reference reads and binds literal search terms separately from SQL', async () => {
  const reader = createLocalPedagogyReader(config());
  const value = await reader.references({ kind: 'competence', q: '%_\\' });
  expect(value.environment).toBe('local-copy');
  expect(value.items[0].id).toBe('literal');
  expect(fake.audit.mock.calls.map((c) => c[0])).toEqual([false, true]);
  expect(fake.query).toHaveBeenCalledWith(
    expect.stringContaining('AS reference_choices FROM bounds'),
    ['competence', '%_\\'],
  );
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
      const reader = createLocalPedagogyReader(config());
      await expect(reader.read(query)).rejects.toThrow(
        'Analyse pédagogique indisponible',
      );
      expect(fake.release).toHaveBeenLastCalledWith(true);
      await reader.close();
    }
  },
);
it.each([
  (a: Record<string, unknown>) => {
    a.columns = [...(a.columns as string[]), 'auth.users.email'];
  },
  (a: Record<string, unknown>) => {
    (a.flags as Record<string, unknown>).bypassrls = true;
  },
  (a: Record<string, unknown>) => {
    a.rlsTables = 3;
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
  const reader = createLocalPedagogyReader(config());
  await expect(reader.read(query)).rejects.toThrow(
    'Analyse pédagogique indisponible',
  );
  expect(
    fake.query.mock.calls.some((c) =>
      String(c[0]).includes('AS statistics FROM bounds'),
    ),
  ).toBe(false);
  await reader.close();
});
it('refuses a modified aggregate without returning partial values or raw SQL errors', async () => {
  const original = fake.query.getMockImplementation()!;
  fake.query.mockImplementation(async (sql: string, ...rest: unknown[]) =>
    sql.includes('AS statistics FROM bounds')
      ? { rows: [{ statistics: { ...fixture, environment: 'production' } }] }
      : original(sql, ...rest),
  );
  const reader = createLocalPedagogyReader(config());
  await expect(reader.read(query)).rejects.toThrow(
    'Analyse pédagogique indisponible',
  );
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
it('refuses invalid period metadata before obtaining a connection', async () => {
  const reader = createLocalPedagogyReader(config());
  await expect(
    reader.read({ ...query, period: { ...query.period, days: 4 } }),
  ).rejects.toThrow();
  expect(fake.query).not.toHaveBeenCalled();
  await reader.close();
});
it('refuses an unverified physical transport even if the query mock would pass', async () => {
  fake.stream.authorized = false;
  const reader = createLocalPedagogyReader(config());
  await expect(reader.read(query)).rejects.toThrow(
    'Analyse pédagogique indisponible',
  );
  expect(fake.query).not.toHaveBeenCalled();
  expect(fake.release).toHaveBeenCalledWith(true);
  await reader.close();
});
