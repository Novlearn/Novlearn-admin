import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { newDraft } from '@/lib/catalogue';
const fake = vi.hoisted(() => ({
  auth: {
    getVerifiedUser: vi.fn(),
    getProfileRole: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  create: vi.fn(),
  run: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
vi.mock('@/lib/engine-runtime', () => ({ runEngine: fake.run }));
import { POST } from '@/app/api/admin/engine/route';
function request(
  body: unknown = { definition: newDraft('Exercice') },
  origin = 'http://localhost:3000',
) {
  return new NextRequest('http://localhost:3000/api/admin/engine', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'synthetic-only');
  vi.stubEnv('ADMIN_ENGINE_ENABLED', 'true');
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
  });
  fake.run.mockResolvedValue({
    ok: true,
    value: { expectedLatex: 'private', title: 'private definition' },
  });
});
describe('validation Engine protégée', () => {
  it.each(['ADMIN_STAGING_AUTH_ENABLED', 'ADMIN_ENGINE_ENABLED'])(
    'reste fermée sans %s, sans initialiser de worker',
    async (flag) => {
      vi.stubEnv(flag, 'false');
      expect((await POST(request())).status).toBe(503);
      expect(fake.create).not.toHaveBeenCalled();
      expect(fake.run).not.toHaveBeenCalled();
    },
  );
  it.each([null, { id: 'guest', isAnonymous: true }])(
    'refuse une identité absente ou invitée avant le calcul',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      expect([401, 403]).toContain((await POST(request())).status);
      expect(fake.run).not.toHaveBeenCalled();
    },
  );
  it.each([null, 'user', 'editor'])('refuse le rôle %s', async (role) => {
    fake.auth.getProfileRole.mockResolvedValue(role);
    expect((await POST(request())).status).toBe(403);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it('refuse l’origine étrangère avant Auth', async () => {
    expect((await POST(request(undefined, 'https://evil.test'))).status).toBe(
      403,
    );
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('ne permet aucune opération native ni instance officielle fournie par le navigateur', async () => {
    for (const extra of [
      { operation: 'gradeAnswer' },
      { official: { expected: 'forged' } },
      { environment: 'production' },
    ])
      expect(
        (await POST(request({ definition: newDraft('Test'), ...extra })))
          .status,
      ).toBe(400);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it('borne les octets réellement reçus et refuse un JSON invalide', async () => {
    expect((await POST(request(' '.repeat(262145)))).status).toBe(400);
    expect((await POST(request('{'))).status).toBe(400);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it('n’échoe pas la définition privée même si l’Engine la retourne en validation', async () => {
    const incoming = request();
    const response = await POST(incoming);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      environment: 'staging',
      valid: true,
      diagnostics: [],
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fake.run).toHaveBeenCalledWith(
      'validateDefinition',
      { definition: newDraft('Exercice') },
      incoming.signal,
    );
  });
  it('présente les vrais diagnostics de schéma sans les traduire en approbation', async () => {
    fake.run.mockResolvedValue({
      ok: false,
      diagnostics: [
        {
          path: '/elements',
          code: 'value',
          message: 'At least one element is required.',
        },
      ],
    });
    expect(await (await POST(request())).json()).toEqual({
      environment: 'staging',
      valid: false,
      diagnostics: [
        {
          path: '/elements',
          code: 'value',
          message: 'At least one element is required.',
        },
      ],
    });
  });
  it('ne transforme pas un timeout/worker indisponible en résultat positif et masque les détails', async () => {
    fake.run.mockRejectedValue(new Error('private runtime path'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private runtime path');
  });
  it.each([
    null,
    { ok: false },
    { ok: false, diagnostics: [] },
    { ok: false, diagnostics: [{ path: '/elements' }] },
  ])('refuse un résultat de protocole invalide : %j', async (value) => {
    fake.run.mockResolvedValue(value);
    expect((await POST(request())).status).toBe(503);
  });
});
