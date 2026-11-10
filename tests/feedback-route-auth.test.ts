import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const fake = vi.hoisted(() => ({
  create: vi.fn(),
  staging: { user: vi.fn(), role: vi.fn() },
  production: { user: vi.fn(), role: vi.fn() },
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_source: unknown, target: unknown) => target,
}));
import { authorizeFeedbackRoute } from '@/lib/feedback-route-auth';
import { productionReadEnvironment } from './fixtures/production-read-env';

const request = new NextRequest('https://admin.example.com/api/admin/feedback');

beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries(productionReadEnvironment()))
    vi.stubEnv(key, value);
  fake.staging.user.mockResolvedValue({
    id: 'staging-admin',
    isAnonymous: false,
  });
  fake.staging.role.mockResolvedValue('admin');
  fake.production.user.mockResolvedValue({
    id: 'production-admin',
    isAnonymous: false,
  });
  fake.production.role.mockResolvedValue('admin');
  fake.create.mockImplementation(
    (_request: unknown, config: { supabaseUrl: string }) => ({
      gateway: config.supabaseUrl.includes('abwipnppcrghdhwriyjp')
        ? {
            getVerifiedUser: fake.production.user,
            getProfileRole: fake.production.role,
          }
        : {
            getVerifiedUser: fake.staging.user,
            getProfileRole: fake.staging.role,
          },
      response: NextResponse.next(),
      client: {},
    }),
  );
});

it('requires an Admin session in both distinct projects', async () => {
  expect((await authorizeFeedbackRoute(request)).ok).toBe(true);
  expect(fake.create).toHaveBeenCalledTimes(2);
  expect(fake.staging.role).toHaveBeenCalledWith('staging-admin');
  expect(fake.production.role).toHaveBeenCalledWith('production-admin');
  fake.production.role.mockResolvedValue('user');
  expect((await authorizeFeedbackRoute(request)).ok).toBe(false);
});

it.each([
  ['Staging', 'unauthenticated'],
  ['Staging', 'forbidden'],
  ['Production', 'unauthenticated'],
  ['Production', 'forbidden'],
] as const)(
  'denies a missing or non-admin %s identity (%s)',
  async (project, condition) => {
    const gateway = project === 'Staging' ? fake.staging : fake.production;
    if (condition === 'unauthenticated') gateway.user.mockResolvedValue(null);
    else gateway.role.mockResolvedValue('user');
    expect((await authorizeFeedbackRoute(request)).ok).toBe(false);
  },
);
