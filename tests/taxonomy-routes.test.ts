import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
const fake = vi.hoisted(() => ({
  auth: { getVerifiedUser: vi.fn(), getProfileRole: vi.fn() },
  create: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
import { GET, POST } from '@/app/api/admin/taxonomy/route';
const save = {
  kind: 'chapter',
  action: 'save',
  id: null,
  fingerprint: null,
  value: { name: 'Analyse', aliases: [], emoji: '', order_index: 1 },
};
const post = (
  body: unknown = save,
  origin = 'http://localhost:3000',
  type = 'application/json',
) =>
  new NextRequest('http://localhost:3000/api/admin/taxonomy', {
    method: 'POST',
    headers: { origin, 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'synthetic-test');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.auth.getVerifiedUser.mockResolvedValue({
    id: 'a5700000-0000-4000-8000-000000000001',
    isAnonymous: false,
  });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.rpc.mockResolvedValue({
    data: { items: [], total: 0, chapters: [] },
    error: null,
  });
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
    client: { rpc: fake.rpc },
  });
});
describe('Référentiel : routes protégées', () => {
  it('refuses all reads and writes when activation is closed', async () => {
    vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'false');
    expect(
      (
        await GET(
          new NextRequest(
            'http://localhost:3000/api/admin/taxonomy?kind=chapter',
          ),
        )
      ).status,
    ).toBe(503);
    expect((await POST(post())).status).toBe(503);
    expect(fake.create).not.toHaveBeenCalled();
  });
  it.each([null, { id: 'test', isAnonymous: true }])(
    'refuses missing or guest identity %#',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      expect([401, 403]).toContain((await POST(post())).status);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(['user', null, 'editor'])('refuses role %s', async (role) => {
    fake.auth.getProfileRole.mockResolvedValue(role);
    expect((await POST(post())).status).toBe(403);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('rechecks fresh role after revocation', async () => {
    expect((await POST(post())).status).toBe(200);
    fake.auth.getProfileRole.mockResolvedValue('user');
    expect((await POST(post())).status).toBe(403);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it('refuses untrusted origin before creating any client', async () => {
    expect((await POST(post(save, 'https://evil.test'))).status).toBe(403);
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('rejects wrong MIME, malformed and oversized bodies', async () => {
    expect(
      (await POST(post(save, 'http://localhost:3000', 'text/plain'))).status,
    ).toBe(415);
    expect((await POST(post('{'))).status).toBe(400);
    expect((await POST(post(' '.repeat(16385)))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('does not accept production destinations or forged actors', async () => {
    for (const body of [
      { ...save, environment: 'production' },
      { ...save, actor_id: 'spoofed' },
    ])
      expect((await POST(post(body))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('passes only validated fields to the single staging capability', async () => {
    const result = await POST(post());
    expect(result.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_mutate_taxonomy', {
      p_kind: 'chapter',
      p_action: 'save',
      p_id: null,
      p_expected: null,
      p_value: save.value,
    });
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect((await result.json()).environment).toBe('staging');
  });
  it('paginates reads and refuses unknown kinds', async () => {
    expect(
      (
        await GET(
          new NextRequest(
            'http://localhost:3000/api/admin/taxonomy?kind=chapter&page=2&q=analyse',
          ),
        )
      ).status,
    ).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_list_taxonomy', {
      p_kind: 'chapter',
      p_query: 'analyse',
      p_chapter: null,
      p_offset: 25,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'http://localhost:3000/api/admin/taxonomy?kind=profiles',
          ),
        )
      ).status,
    ).toBe(400);
  });
  it.each([
    ['40001', 409],
    ['PT409', 409],
    ['23503', 409],
    ['23505', 409],
    ['42501', 403],
    ['P0002', 404],
    ['22023', 400],
    ['XX000', 503],
  ])('maps SQL %s to HTTP %s without details', async (code, status) => {
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'SECRET SQL DETAILS' },
    });
    const result = await POST(post());
    expect(result.status).toBe(status);
    expect(await result.text()).not.toContain('SECRET');
  });
});
