import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { newDraft } from '@/lib/catalogue';
import { POST } from '@/app/api/admin/exercises/import/route';

vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({
  role: vi.fn(),
  user: vi.fn(),
  rpc: vi.fn(),
  engine: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: () => ({
    gateway: {
      getVerifiedUser: fake.user,
      getProfileRole: fake.role,
    },
    response: {},
    client: { rpc: fake.rpc },
  }),
  transferAuthCookies: (_response: unknown, target: unknown) => target,
}));
vi.mock('@/lib/exercise-references', () => ({
  prepareExerciseReferences: async (_client: unknown, definition: unknown) => ({
    issue: null,
    definition,
  }),
}));
vi.mock('@/lib/engine-runtime', () => ({ runEngine: fake.engine }));

function request(options: { origin?: string } = {}) {
  const definition = {
    ...newDraft('Suites'),
    catalogue: { chapter: 'Suites' },
  };
  return new NextRequest('http://localhost:3000/api/admin/exercises/import', {
    method: 'POST',
    headers: {
      origin: options.origin ?? 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      batchId: '985bdae2-3e73-462d-8d2e-e145498f6735',
      sourceKey: 'item-001',
      definition,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  vi.stubEnv('ADMIN_ENGINE_ENABLED', 'true');
  vi.stubEnv('VERCEL', '');
  fake.user.mockResolvedValue({ id: 'admin', isAnonymous: false });
  fake.role.mockResolvedValue('admin');
  fake.engine.mockResolvedValue({ ok: true });
  fake.rpc.mockResolvedValue({
    data: { exerciseId: '42', reused: false },
    error: null,
  });
});

it('vérifie la session, le rôle Admin et l’origine avant Engine ou Staging', async () => {
  fake.user.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(401);
  fake.role.mockResolvedValueOnce('user');
  expect((await POST(request())).status).toBe(403);
  expect(
    (await POST(request({ origin: 'https://attacker.example' }))).status,
  ).toBe(403);
  expect(fake.engine).not.toHaveBeenCalled();
  expect(fake.rpc).not.toHaveBeenCalled();
});

it('bloque les écritures lorsque Engine refuse une instanciation', async () => {
  fake.engine
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: false });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect((await response.json()).seed).toBe(0);
  expect(fake.rpc).not.toHaveBeenCalled();
});

it('utilise la session navigateur et la RPC Staging avec les identifiants stables', async () => {
  const response = await POST(request());
  expect(await response.json()).toEqual({
    environment: 'staging',
    exerciseId: '42',
    reused: false,
  });
  expect(fake.engine.mock.calls.map(([operation]) => operation)).toEqual([
    'validateDefinition',
    'instantiateExercise',
    'instantiateExercise',
    'instantiateExercise',
  ]);
  expect(fake.rpc).toHaveBeenCalledWith(
    'admin_import_exercise_draft',
    expect.objectContaining({
      p_batch_id: '985bdae2-3e73-462d-8d2e-e145498f6735',
      p_source_key: 'item-001',
    }),
  );
});
