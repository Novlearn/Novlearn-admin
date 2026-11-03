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
import { GET, POST } from '@/app/api/admin/flashcards/route';
const id = 'a5800000-0000-4000-8000-000000000001';
const value = { chapterId: id, question: 'Question $x^2$', answer: '$2x$' };
const save = { action: 'save', id: null, fingerprint: null, value };
const post = (
  body: unknown = save,
  origin = 'http://localhost:3000',
  mime = 'application/json',
) =>
  new NextRequest('http://localhost:3000/api/admin/flashcards', {
    method: 'POST',
    headers: { origin, 'content-type': mime },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.auth.getVerifiedUser.mockResolvedValue({ id, isAnonymous: false });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.rpc.mockResolvedValue({ data: { id, action: 'created' }, error: null });
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
    client: { rpc: fake.rpc },
  });
});
describe('Flashcards : permission fraîche et route Staging', () => {
  it('refuses all direct endpoints with activation closed', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect((await POST(post())).status).toBe(503);
    expect(
      (await GET(new NextRequest('http://localhost:3000/api/admin/flashcards')))
        .status,
    ).toBe(503);
    expect(fake.create).not.toHaveBeenCalled();
  });
  it.each([null, { id, isAnonymous: true }])(
    'refuses absent or guest identity %#',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      expect([401, 403]).toContain((await POST(post())).status);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(['user', null, 'editor'])(
    'refuses non-admin role %s',
    async (role) => {
      fake.auth.getProfileRole.mockResolvedValue(role);
      expect((await POST(post())).status).toBe(403);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it('rechecks role revocation between operations', async () => {
    expect((await POST(post())).status).toBe(200);
    fake.auth.getProfileRole.mockResolvedValue('user');
    expect((await POST(post())).status).toBe(403);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it('refuses untrusted origin before Auth', async () => {
    expect((await POST(post(save, 'https://evil.test'))).status).toBe(403);
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('validates actual request bytes, JSON and MIME', async () => {
    expect(
      (await POST(post(save, 'http://localhost:3000', 'text/plain'))).status,
    ).toBe(415);
    expect((await POST(post('{'))).status).toBe(400);
    const request = post(' '.repeat(65537));
    request.headers.set('Content-Length', '1');
    expect((await POST(request)).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { ...save, environment: 'production' },
    { ...save, actor_id: id },
    { ...save, action: 'publish' },
    { ...save, value: { ...value, question: '' } },
  ])(
    'refuses destination, forged metadata and invalid fields %#',
    async (body) => {
      expect((await POST(post(body))).status).toBe(400);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it('passes only bounded save data to the Staging RPC', async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_mutate_flashcard', {
      p_action: 'save',
      p_id: null,
      p_expected: null,
      p_value: value,
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect((await response.json()).environment).toBe('staging');
  });
  it('requires identity, current fingerprint and explicit null content for deletion', async () => {
    expect(
      (
        await POST(
          post({
            action: 'delete',
            id,
            fingerprint: 'a'.repeat(64),
            value: null,
          }),
        )
      ).status,
    ).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_mutate_flashcard', {
      p_action: 'delete',
      p_id: id,
      p_expected: 'a'.repeat(64),
      p_value: null,
    });
  });
  it('paginates and filters only from accepted query fields', async () => {
    expect(
      (
        await GET(
          new NextRequest(
            `http://localhost:3000/api/admin/flashcards?page=2&q=%25_&chapter=${id}`,
          ),
        )
      ).status,
    ).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_list_flashcards', {
      p_query: '%_',
      p_chapter: id,
      p_offset: 25,
    });
  });
  it('fails closed on unavailable fresh Auth without leaking details', async () => {
    fake.auth.getProfileRole.mockRejectedValue(
      new Error('PRIVATE CONNECTION DATA'),
    );
    const response = await POST(post());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('PRIVATE');
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['40001', 409],
    ['PT409', 409],
    ['23503', 409],
    ['23505', 409],
    ['P0002', 404],
    ['42501', 403],
    ['22023', 400],
    ['22P02', 400],
    ['XX000', 503],
  ])('maps SQL %s to %s and masks internal errors', async (code, status) => {
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'PRIVATE DATABASE ERROR' },
    });
    const response = await POST(post());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('PRIVATE');
  });
});
