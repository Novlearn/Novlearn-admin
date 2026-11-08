import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  create: vi.fn(),
  stage: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    getVerifiedUser: vi.fn(),
    getProfileRole: vi.fn(),
  },
  prod: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    getVerifiedUser: vi.fn(),
    getProfileRole: vi.fn(),
  },
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const c of source.cookies.getAll()) target.cookies.set(c);
    return target;
  },
}));
import { POST as login } from '@/app/auth/login/route';
import { POST as logout } from '@/app/auth/logout/route';
import { productionReadEnvironment } from './fixtures/production-read-env';
const request = (path = 'login') =>
  new NextRequest('https://admin.example.com/auth/' + path, {
    method: 'POST',
    headers: {
      origin: 'https://admin.example.com',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'email=admin%40example.test&password=synthetic-password',
  });
beforeEach(() => {
  vi.resetAllMocks();
  for (const [k, v] of Object.entries(productionReadEnvironment()))
    vi.stubEnv(k, v);
  for (const [g, id] of [
    [fake.stage, 'stage-id'],
    [fake.prod, 'different-production-id'],
  ] as const) {
    g.signIn.mockResolvedValue(true);
    g.signOut.mockResolvedValue(true);
    g.getVerifiedUser.mockResolvedValue({ id, isAnonymous: false });
    g.getProfileRole.mockResolvedValue('admin');
  }
  fake.create.mockImplementation(
    (_request: NextRequest, config: { supabaseUrl: string }) => {
      const prod = config.supabaseUrl.includes('abwipnppcrghdhwriyjp');
      const response = NextResponse.next();
      response.cookies.set(prod ? 'prod-cookie' : 'stage-cookie', 'session');
      return { gateway: prod ? fake.prod : fake.stage, response };
    },
  );
});
afterEach(() => vi.unstubAllEnvs());
it('signs into both projects from one form and retains independent identities/cookies', async () => {
  const response = await login(request());
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(
    'https://admin.example.com/admin',
  );
  for (const gateway of [fake.stage, fake.prod]) {
    expect(gateway.signIn).toHaveBeenCalledWith(
      'admin@example.test',
      'synthetic-password',
    );
    expect(gateway.getProfileRole).toHaveBeenCalledOnce();
  }
  expect(response.cookies.get('stage-cookie')).toBeDefined();
  expect(response.cookies.get('prod-cookie')).toBeDefined();
});
it('does not admit an ordinary Production user or keep a previous privileged session', async () => {
  fake.prod.getProfileRole.mockResolvedValue('user');
  const response = await login(request());
  expect(response.headers.get('location')).toContain('production-forbidden');
  expect(fake.stage.signOut).toHaveBeenCalled();
  expect(fake.prod.signOut).toHaveBeenCalled();
});
it('does not send the password to Production when the primary account is not an Admin', async () => {
  fake.stage.getProfileRole.mockResolvedValue('user');
  await login(request());
  expect(fake.prod.signIn).not.toHaveBeenCalled();
  expect(fake.prod.signOut).toHaveBeenCalled();
});
it('signs out both sessions even if one server is unavailable', async () => {
  fake.stage.signOut.mockRejectedValue(Error('unavailable'));
  const response = await logout(request('logout'));
  expect(response.status).toBe(503);
  expect(fake.prod.signOut).toHaveBeenCalledOnce();
});
it('rejects an untrusted login origin before either project receives credentials', async () => {
  const rq = request();
  rq.headers.set('origin', 'https://evil.invalid');
  expect((await login(rq)).status).toBe(403);
  expect(fake.create).not.toHaveBeenCalled();
});
