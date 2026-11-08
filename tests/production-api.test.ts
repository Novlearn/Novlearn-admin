import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  client: vi.fn(),
  user: vi.fn(),
  role: vi.fn(),
  rpc: vi.fn(),
  data: new Map<string, unknown>(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createPageClient: fake.client,
  asAuthGateway: () => ({
    getVerifiedUser: fake.user,
    getProfileRole: fake.role,
  }),
}));
import {
  loadProductionActivity,
  loadProductionUsers,
  loadProductionUserDetail,
  loadProductionPedagogy,
  loadProductionReferences,
} from '@/lib/production-api';
import { statisticsPeriod } from '@/lib/activity-statistics';
import { readPedagogyQuery } from '@/lib/pedagogy-statistics';
import { productionReadEnvironment } from './fixtures/production-read-env';
import activity from './fixtures/activity-statistics.json';
import { usersPageFixture } from './fixtures/users-page';
import detail from './fixtures/user-detail-sql.json';
import pedagogy from './fixtures/pedagogy-statistics.json';
const period = statisticsPeriod('2026-10-15', '2026-10-17')!;
const usersQuery = { period, query: '', after: null, before: null };
beforeEach(() => {
  vi.resetAllMocks();
  fake.data.clear();
  for (const [k, v] of Object.entries(productionReadEnvironment()))
    vi.stubEnv(k, v);
  fake.user.mockResolvedValue({
    id: 'production-admin-id',
    isAnonymous: false,
  });
  fake.role.mockResolvedValue('admin');
  fake.client.mockResolvedValue({ rpc: fake.rpc });
  for (const [name, data] of [
    ['admin_read_activity', activity],
    ['admin_read_users', usersPageFixture],
    ['admin_read_user_detail', detail.history],
    ['admin_read_pedagogy', pedagogy],
  ] as const) {
    const row = { ...(data as object) } as Record<string, unknown>;
    delete row.environment;
    fake.data.set(name, row);
  }
  fake.data.set('admin_read_pedagogy_references', {
    schemaVersion: 1,
    kind: 'chapter',
    q: '',
    more: false,
    items: [],
  });
  fake.rpc.mockImplementation((name: string) => ({
    abortSignal: () =>
      Promise.resolve({ data: fake.data.get(name), error: null }),
  }));
});
afterEach(() => vi.unstubAllEnvs());
it('executes all five read RPCs with a verified Production Admin and strictly decoded source', async () => {
  expect((await loadProductionActivity(period)).environment).toBe('production');
  expect((await loadProductionUsers(usersQuery)).environment).toBe(
    'production',
  );
  expect(
    (
      await loadProductionUserDetail({
        period,
        userId: detail.history.userId,
        view: 'history',
        after: null,
        before: null,
      })
    )?.environment,
  ).toBe('production');
  const q = readPedagogyQuery(
    new URLSearchParams('from=2026-10-15&to=2026-10-17'),
  );
  expect(q.ok).toBe(true);
  if (!q.ok) throw Error('fixture');
  expect((await loadProductionPedagogy(q.query)).environment).toBe(
    'production',
  );
  expect(
    (await loadProductionReferences({ kind: 'chapter', q: '' })).environment,
  ).toBe('production');
  expect(fake.role).toHaveBeenCalledTimes(5);
  expect(fake.client).toHaveBeenCalledWith(
    expect.objectContaining({
      supabaseUrl: 'https://abwipnppcrghdhwriyjp.supabase.co',
      publishableKey: 'sb_publishable_synthetic_production_key',
    }),
  );
  expect(fake.rpc).toHaveBeenCalledWith('admin_read_users', {
    p_from: period.from,
    p_until: period.until,
    p_query: '',
    p_after: null,
    p_before: null,
    p_limit: 25,
  });
});
it.each([
  [null, 'admin'],
  [{ id: 'guest', isAnonymous: true }, 'admin'],
  [{ id: 'student', isAnonymous: false }, 'user'],
])(
  'refuses a missing, anonymous or ordinary Production identity %#',
  async (user, role) => {
    fake.user.mockResolvedValue(user);
    fake.role.mockResolvedValue(role);
    await expect(loadProductionActivity(period)).rejects.toThrow(
      'Lecture Production indisponible',
    );
    expect(fake.rpc).not.toHaveBeenCalled();
  },
);
it('rechecks a revoked role before every RPC', async () => {
  await loadProductionActivity(period);
  fake.role.mockResolvedValue('user');
  await expect(loadProductionActivity(period)).rejects.toThrow();
  expect(fake.rpc).toHaveBeenCalledTimes(1);
});
it('refuses a stale aggregate or user list that still includes guest accounts', async () => {
  const aggregate = fake.data.get('admin_read_activity') as Record<
    string,
    unknown
  >;
  fake.data.set('admin_read_activity', {
    ...aggregate,
    accounts: { total: '10', anonymous: '1' },
  });
  await expect(loadProductionActivity(period)).rejects.toThrow(
    'Lecture Production indisponible',
  );
  const page = fake.data.get('admin_read_users') as typeof usersPageFixture;
  fake.data.set('admin_read_users', {
    ...page,
    items: [
      {
        ...page.items[0],
        anonymous: true,
        email: null,
        name: 'Compte invité',
        nameTruncated: false,
      },
    ],
  });
  await expect(loadProductionUsers(usersQuery)).rejects.toThrow(
    'Lecture Production indisponible',
  );
});
it('never trusts a source supplied by an RPC and never leaks its raw error', async () => {
  fake.data.set('admin_read_activity', {
    ...activity,
    environment: 'production',
  });
  await expect(loadProductionActivity(period)).rejects.toThrow(
    'Lecture Production indisponible',
  );
  fake.client.mockRejectedValue(Error('private-session-token'));
  await expect(loadProductionActivity(period)).rejects.toThrow(
    /^Lecture Production indisponible$/,
  );
});
it('rejects an invalid period before any connection or session lookup', async () => {
  await expect(
    loadProductionActivity({ ...period, days: 99 }),
  ).rejects.toThrow();
  expect(fake.client).not.toHaveBeenCalled();
});
