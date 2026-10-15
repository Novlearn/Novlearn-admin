import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { PublicationServiceError } from '@/lib/publication-service';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  auth: {
    getVerifiedUser: vi.fn(),
    getProfileRole: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  create: vi.fn(),
  pools: vi.fn(),
  close: vi.fn(),
  construct: vi.fn(),
  prepare: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  recover: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (source: NextResponse, target: NextResponse) => {
    for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
    return target;
  },
}));
vi.mock('@/lib/publication-pg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/publication-pg')>()),
  createPublicationPgPools: fake.pools,
}));
vi.mock('@/lib/publication-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/publication-service')>()),
  PublicationService: class {
    constructor(deps: unknown) {
      fake.construct(deps);
    }
    prepare = fake.prepare;
    confirm = fake.confirm;
    cancel = fake.cancel;
    recover = fake.recover;
  },
}));
import { POST } from '@/app/api/admin/publication/route';
const id = '98500000-0000-4000-8000-000000000001';
const prepare = () => ({
  action: 'prepare',
  versionId: id,
  fingerprint: 'a'.repeat(64),
  epoch: '0',
  mode: 'publish',
  batchId: id,
});
function request(
  body: unknown = prepare(),
  origin = 'http://localhost:3000',
  mime = 'application/json',
  signal?: AbortSignal,
) {
  return new NextRequest('http://localhost:3000/api/admin/publication', {
    method: 'POST',
    headers: { origin, 'content-type': mime },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  const env = {
    ADMIN_STAGING_AUTH_ENABLED: 'true',
    ADMIN_STAGING_SECURITY_REVIEW: 'synthetic-only',
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    APP_BASE_URL: 'http://localhost:3000',
    ADMIN_ENGINE_ENABLED: 'true',
    ADMIN_PUBLICATION_ENABLED: 'true',
    ADMIN_PUBLICATION_SECURITY_REVIEW: 'synthetic-only',
    ADMIN_PUBLICATION_TARGET_PROJECT_REF: 'abcdefghijklmnopqrst',
    ADMIN_PUBLICATION_SOURCE_PG_URL: `postgresql://novlearn_admin_journal_service:source-password-fixture@db.${STAGING_PROJECT_REF}.supabase.co/postgres`,
    ADMIN_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:target-password-fixture@db.abcdefghijklmnopqrst.supabase.co/postgres',
    ADMIN_PUBLICATION_CONFIRMATION_KEY: 'ab'.repeat(32),
  };
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  fake.auth.getVerifiedUser.mockResolvedValue({ id, isAnonymous: false });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  const response = NextResponse.next();
  response.cookies.set('refreshed-session', 'fixture');
  fake.create.mockReturnValue({ gateway: fake.auth, client: {}, response });
  fake.close.mockResolvedValue(undefined);
  fake.pools.mockReturnValue({
    source: vi.fn(),
    target: vi.fn(),
    close: fake.close,
  });
  fake.prepare.mockResolvedValue({
    operation: { id, state: 'planned' },
    plan: { action: 'create_exercise' },
    confirmation: 'signed',
  });
  fake.confirm.mockResolvedValue({ id, state: 'committed' });
  fake.cancel.mockResolvedValue({ id, state: 'cancelled' });
  fake.recover.mockResolvedValue({ id, state: 'committed' });
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  'ADMIN_STAGING_AUTH_ENABLED',
  'ADMIN_ENGINE_ENABLED',
  'ADMIN_PUBLICATION_ENABLED',
  'ADMIN_PUBLICATION_SECURITY_REVIEW',
  'ADMIN_PUBLICATION_CONFIRMATION_KEY',
])('stays closed before Auth or pool construction without %s', async (key) => {
  vi.stubEnv(key, '');
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.pools).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('refuses an untrusted origin before allocation or Auth', async () => {
  expect((await POST(request(prepare(), 'https://other.invalid'))).status).toBe(
    403,
  );
  expect(fake.create).not.toHaveBeenCalled();
  expect(fake.pools).not.toHaveBeenCalled();
});
it.each(['missing', 'guest', 'user', 'unavailable'])(
  'refuses %s identity before privileged allocation',
  async (kind) => {
    if (kind === 'missing') fake.auth.getVerifiedUser.mockResolvedValue(null);
    if (kind === 'guest')
      fake.auth.getVerifiedUser.mockResolvedValue({ id, isAnonymous: true });
    if (kind === 'user') fake.auth.getProfileRole.mockResolvedValue('user');
    if (kind === 'unavailable')
      fake.auth.getVerifiedUser.mockRejectedValue(
        Error('PRIVATE AUTH FAILURE'),
      );
    const response = await POST(request());
    expect(response.status).toBe(
      kind === 'missing' ? 401 : kind === 'unavailable' ? 503 : 403,
    );
    expect(fake.pools).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('PRIVATE');
  },
);
it('requires bounded JSON and exact fields; never accepts source content, target or report from the browser', async () => {
  expect((await POST(request(prepare(), undefined, 'text/plain'))).status).toBe(
    415,
  );
  for (const body of [
    '{',
    ' '.repeat(9000),
    { ...prepare(), definition: {} },
    { ...prepare(), target: 'other' },
    { ...prepare(), report: { passed: true } },
    { ...prepare(), epoch: 0 },
    { ...prepare(), mode: ['publish'] },
    { action: ['recover'], operationId: id },
    { action: 'recover_page' },
    { action: 'confirm', operationId: id, confirmation: 'x', extra: 1 },
  ])
    expect((await POST(request(body))).status).toBe(400);
  expect(fake.pools).not.toHaveBeenCalled();
});
it('wires trusted server dependencies only after authorization and preserves refreshed cookies', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.cookies.get('refreshed-session')?.value).toBe('fixture');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(fake.prepare).toHaveBeenCalledWith(
    {
      versionId: id,
      fingerprint: 'a'.repeat(64),
      epoch: '0',
      mode: 'publish',
      batchId: id,
    },
    expect.any(AbortSignal),
  );
  expect(fake.construct).toHaveBeenCalledWith(
    expect.objectContaining({
      targetKey: 'production-abcdefghijklmnopqrst',
      confirmationKey: Buffer.alloc(32, 0xab),
      source: expect.any(Function),
      verify: expect.any(Function),
    }),
  );
  expect(fake.close).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(await response.json())).not.toMatch(
    /password|confirmationKey|PG_URL/,
  );
});
it.each(['confirm', 'cancel', 'recover'])(
  'dispatches only a single owned %s operation',
  async (action) => {
    const response = await POST(
      request({
        action,
        operationId: id,
        ...(action === 'confirm' ? { confirmation: 'signed' } : {}),
      }),
    );
    expect(response.status).toBe(200);
    if (action === 'confirm')
      expect(fake.confirm).toHaveBeenCalledWith(
        id,
        'signed',
        expect.any(AbortSignal),
      );
    else
      expect(fake[action as 'cancel' | 'recover']).toHaveBeenCalledWith(
        id,
        expect.any(AbortSignal),
      );
    expect(fake.close).toHaveBeenCalledTimes(1);
  },
);
it('returns 202 for an uncertain result without claiming publication success', async () => {
  fake.confirm.mockResolvedValue({ id, state: 'uncertain', outcome: null });
  const response = await POST(
    request({ action: 'confirm', operationId: id, confirmation: 'signed' }),
  );
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({
    result: { state: 'uncertain', outcome: null },
  });
});
it.each([
  ['invalid', 400],
  ['forbidden', 403],
  ['conflict', 409],
  ['missing', 404],
  ['busy', 429],
  ['verification', 422],
  ['recovery_required', 409],
  ['unavailable', 503],
] as const)('maps %s honestly and closes all pools', async (code, status) => {
  fake.prepare.mockRejectedValue(new PublicationServiceError(code));
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toHaveProperty('code', code);
  expect(fake.close).toHaveBeenCalledTimes(1);
});
it('masks unexpected failures and does not erase a recorded fact when pool cleanup fails', async () => {
  fake.prepare.mockRejectedValueOnce(Error('PRIVATE CONNECTION SECRET'));
  const failed = await POST(request());
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('PRIVATE');
  fake.close.mockRejectedValueOnce(Error('PRIVATE CLEANUP FAILURE'));
  const completed = await POST(
    request({ action: 'confirm', operationId: id, confirmation: 'signed' }),
  );
  expect(completed.status).toBe(200);
  expect(await completed.json()).toMatchObject({
    result: { state: 'committed' },
  });
});
it('performs no private allocation for a request already cancelled', async () => {
  const abort = new AbortController();
  abort.abort();
  const response = await POST(
    request(prepare(), undefined, undefined, abort.signal),
  );
  expect(response.status).toBe(499);
  expect(fake.pools).not.toHaveBeenCalled();
});
