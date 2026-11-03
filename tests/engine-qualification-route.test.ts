import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const fake = vi.hoisted(() => ({
  user: vi.fn(),
  role: vi.fn(),
  create: vi.fn(),
  probe: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
vi.mock('@/lib/engine-qualification', () => ({ qualifyEngine: fake.probe }));
import { POST } from '@/app/api/admin/engine/qualification/route';
const request = (body: unknown = {}, origin = 'http://localhost:3000') =>
  new NextRequest('http://localhost:3000/api/admin/engine/qualification', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'https://tksvbkvfusrnxulpahky.supabase.co',
  );
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  vi.stubEnv('VERCEL', '1');
  fake.user.mockResolvedValue({ id: 'admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.create.mockReturnValue({
    gateway: { getVerifiedUser: fake.user, getProfileRole: fake.role },
    response: NextResponse.next(),
  });
  fake.probe.mockResolvedValue({
    received: false,
    results: [{ error: 'unavailable' }],
  });
});
it('autorise seulement le diagnostic synthétique privé sur Vercel sans activer les opérations auteur', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toMatchObject({
    environment: 'staging',
    result: { received: false },
  });
});
it('refuse une origine étrangère avant Auth', async () => {
  expect((await POST(request({}, 'https://evil.test'))).status).toBe(403);
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.probe).not.toHaveBeenCalled();
});
it.each([null, { id: 'guest', isAnonymous: true }])(
  'refuse une identité non autorisée : %j',
  async (user) => {
    fake.user.mockResolvedValue(user);
    expect([401, 403]).toContain((await POST(request())).status);
    expect(fake.probe).not.toHaveBeenCalled();
  },
);
it.each(['user', null])('refuse le rôle %j', async (role) => {
  fake.role.mockResolvedValue(role);
  expect((await POST(request())).status).toBe(403);
  expect(fake.probe).not.toHaveBeenCalled();
});
it.each([
  { definition: {} },
  { official: {} },
  { operation: 'gradeAnswer' },
  [],
  'x'.repeat(513),
])('ne lance pas un payload fourni par le navigateur : %j', async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(fake.probe).not.toHaveBeenCalled();
});
it('masque les détails privés d’un échec et refuse une seconde qualification concurrente', async () => {
  fake.probe.mockRejectedValueOnce(Error('private path and token'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('token');
  fake.probe.mockResolvedValue({ busy: true });
  expect((await POST(request())).status).toBe(429);
});
