import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { reviewChecklistLabels } from '@/lib/review';
const fake = vi.hoisted(() => ({
  auth: { getVerifiedUser: vi.fn(), getProfileRole: vi.fn() },
  create: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
import { POST } from '@/app/api/admin/review/route';
const body = {
  versionId: '10000000-0000-4000-8000-000000000001',
  fingerprint: 'a'.repeat(64),
  epoch: 2,
  expectedStatus: 'in_review',
  action: 'approve',
  receiptId: '20000000-0000-4000-8000-000000000001',
  checklist: Object.fromEntries(
    Object.keys(reviewChecklistLabels).map((k) => [k, true]),
  ),
  comment: 'Relecture',
};
const request = (value: unknown = body, origin = 'http://localhost:3000') =>
  new NextRequest('http://localhost:3000/api/admin/review', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'synthetic-only');
  vi.stubEnv('ADMIN_EDITORIAL_REVIEW_ENABLED', 'true');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_test_only',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.auth.getVerifiedUser.mockResolvedValue({
    id: 'fixture-admin',
    isAnonymous: false,
  });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
    client: { rpc: fake.rpc },
  });
  fake.rpc.mockResolvedValue({
    data: {
      reviewId: '21000000-0000-4000-8000-000000000001',
      versionId: body.versionId,
      status: 'approved',
      fingerprint: body.fingerprint,
      epoch: body.epoch,
    },
    error: null,
  });
});
it.each(['ADMIN_STAGING_AUTH_ENABLED', 'ADMIN_EDITORIAL_REVIEW_ENABLED'])(
  'reste fermé sans %s',
  async (flag) => {
    vi.stubEnv(flag, 'false');
    expect((await POST(request())).status).toBe(503);
    expect(fake.create).not.toHaveBeenCalled();
  },
);
it.each([null, { id: 'guest', isAnonymous: true }])(
  'refuse une identité absente/invitée avant le RPC',
  async (user) => {
    fake.auth.getVerifiedUser.mockResolvedValue(user);
    expect([401, 403]).toContain((await POST(request())).status);
    expect(fake.rpc).not.toHaveBeenCalled();
  },
);
it.each([null, 'user', 'editor'])('refuse le rôle %s', async (role) => {
  fake.auth.getProfileRole.mockResolvedValue(role);
  expect((await POST(request())).status).toBe(403);
  expect(fake.rpc).not.toHaveBeenCalled();
});
it('refuse origine étrangère, corps trop grand et attestation fabriquée/incomplète', async () => {
  expect((await POST(request(body, 'https://evil.test'))).status).toBe(403);
  expect((await POST(request(' '.repeat(262145)))).status).toBe(400);
  for (const extra of [
    { checklist: {} },
    { actorId: 'forged' },
    { status: 'published' },
    { environment: 'production' },
  ])
    expect((await POST(request({ ...body, ...extra }))).status).toBe(400);
  expect(fake.rpc).not.toHaveBeenCalled();
});
it('transmet les seules préconditions et attestations, avec contrôle serveur frais et no-store', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(fake.rpc).toHaveBeenCalledWith('admin_review_exercise_version', {
    p_version_id: body.versionId,
    p_expected_fingerprint: body.fingerprint,
    p_expected_epoch: 2,
    p_expected_status: 'in_review',
    p_action: 'approve',
    p_receipt_id: body.receiptId,
    p_checklist: body.checklist,
    p_comment: body.comment,
  });
});
it.each([
  ['40001', 409],
  ['PT409', 409],
  ['22023', 400],
  ['42501', 403],
  ['XX000', 503],
])('présente le refus SQL %s sans détails privés', async (code, status) => {
  fake.rpc.mockResolvedValue({
    data: null,
    error: { code, message: 'SECRET_SQL' },
  });
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain('SECRET_SQL');
});
it('ne confirme pas un RPC retournant un autre état ou une autre révision', async () => {
  fake.rpc.mockResolvedValue({
    data: {
      versionId: body.versionId,
      status: 'published',
      fingerprint: body.fingerprint,
      epoch: 2,
    },
    error: null,
  });
  expect((await POST(request())).status).toBe(503);
});
it('projette les seules métadonnées de confirmation et refuse un événement mal formé', async () => {
  const confirmed = {
    reviewId: '21000000-0000-4000-8000-000000000001',
    versionId: body.versionId,
    status: 'approved',
    fingerprint: body.fingerprint,
    epoch: body.epoch,
  };
  fake.rpc.mockResolvedValueOnce({
    data: { ...confirmed, source_snapshot: 'SECRET' },
    error: null,
  });
  expect(await (await POST(request())).json()).toEqual({
    environment: 'staging',
    result: confirmed,
  });
  fake.rpc.mockResolvedValueOnce({
    data: { ...confirmed, reviewId: 'not-an-event' },
    error: null,
  });
  expect((await POST(request())).status).toBe(503);
});
