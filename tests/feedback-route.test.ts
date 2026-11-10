import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const fake = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/feedback-route-auth', () => ({
  authorizeFeedbackRoute: fake.access,
}));
import { POST } from '@/app/api/admin/feedback/route';

const id = 'a8100000-0000-4000-8000-000000000001';
const makeRequest = (body: unknown, origin = 'http://localhost:3000') =>
  new NextRequest('http://localhost:3000/api/admin/feedback', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv('ADMIN_FEEDBACK_REVIEW_ENABLED', 'true');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'https://tksvbkvfusrnxulpahky.supabase.co',
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.rpc.mockResolvedValue({
    data: { feedbackId: id, status: 'approved' },
    error: null,
  });
  fake.access.mockResolvedValue({
    ok: true,
    client: { rpc: fake.rpc },
    stagingConfig: {
      appOrigin: 'http://localhost:3000',
      supabaseUrl: 'https://tksvbkvfusrnxulpahky.supabase.co',
      publishableKey: 'sb_publishable_synthetic_test',
      secureCookies: false,
    },
    finish: (body: unknown, status = 200) =>
      NextResponse.json(body, {
        status,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }),
  });
});

it('refuse les mutations désactivées ou de provenance étrangère', async () => {
  vi.stubEnv('ADMIN_FEEDBACK_REVIEW_ENABLED', 'false');
  expect(
    (await POST(makeRequest({ feedbackId: id, action: 'approve' }))).status,
  ).toBe(503);
  vi.stubEnv('ADMIN_FEEDBACK_REVIEW_ENABLED', 'true');
  expect(
    (
      await POST(
        makeRequest(
          { feedbackId: id, action: 'approve' },
          'https://evil.example',
        ),
      )
    ).status,
  ).toBe(403);
  expect(fake.access).not.toHaveBeenCalled();
  expect(fake.rpc).not.toHaveBeenCalled();
});

it('valide strictement l’action, ne passe que l’identifiant et l’action au RPC Production', async () => {
  const response = await POST(
    makeRequest({ feedbackId: id, action: 'approve' }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(fake.rpc).toHaveBeenCalledWith('admin_review_feedback', {
    p_feedback_id: id,
    p_action: 'approve',
  });
  expect(await response.json()).toEqual({
    environment: 'production',
    result: { feedbackId: id, status: 'approved' },
  });
});

it('refuse les actions fabriquées, les décisions concurrentes et les confirmations mal formées', async () => {
  expect(
    (
      await POST(
        makeRequest({ feedbackId: id, action: 'approve', status: 'approved' }),
      )
    ).status,
  ).toBe(400);
  expect(fake.rpc).not.toHaveBeenCalled();
  fake.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
  expect(
    (await POST(makeRequest({ feedbackId: id, action: 'reject' }))).status,
  ).toBe(409);
  fake.rpc.mockResolvedValueOnce({
    data: { feedbackId: id, status: 'rejected' },
    error: null,
  });
  expect(
    (await POST(makeRequest({ feedbackId: id, action: 'approve' }))).status,
  ).toBe(503);
});
