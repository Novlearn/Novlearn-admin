import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { newDraft } from '@/lib/catalogue';
vi.mock('server-only', () => ({}));
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
vi.mock('@/lib/engine-runtime', () => ({
  runEngine: fake.run,
  engineFailure: (error: unknown) => {
    const reason = (error as { reason?: string })?.reason;
    if (reason === 'authentication')
      return {
        status: 502,
        code: 'engine_authentication',
        message: 'Engine auth refused.',
      };
    if (reason === 'archive-mismatch')
      return {
        status: 502,
        code: 'engine_archive_mismatch',
        message: 'Archive mismatch.',
      };
    if (reason === 'contract-mismatch')
      return {
        status: 502,
        code: 'engine_contract_mismatch',
        message: 'Contract mismatch.',
      };
    if (reason === 'network')
      return {
        status: 503,
        code: 'engine_network',
        message: 'Network unavailable.',
      };
    if (reason === 'timeout')
      return { status: 504, code: 'engine_timeout', message: 'Timeout.' };
    return {
      status: 503,
      code: 'engine_unavailable',
      message: 'Engine unavailable.',
    };
  },
}));
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
describe('validation Engine prot�g�e', () => {
  it('refuse Vercel m�me en cas de drapeau Engine actif', async () => {
    vi.stubEnv('VERCEL', '1');
    try {
      expect((await POST(request())).status).toBe(503);
      expect(fake.run).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each(['NEXT_PUBLIC_SUPABASE_URL', 'ADMIN_ENGINE_ENABLED'])(
    'reste ferm�e sans %s, sans initialiser de worker',
    async (flag) => {
      vi.stubEnv(flag, 'false');
      expect((await POST(request())).status).toBe(503);
      expect(fake.create).not.toHaveBeenCalled();
      expect(fake.run).not.toHaveBeenCalled();
    },
  );
  it.each([null, { id: 'guest', isAnonymous: true }])(
    'refuse une identit� absente ou invit�e avant le calcul',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      expect([401, 403]).toContain((await POST(request())).status);
      expect(fake.run).not.toHaveBeenCalled();
    },
  );
  it.each([null, 'user', 'editor'])('refuse le r�le %s', async (role) => {
    fake.auth.getProfileRole.mockResolvedValue(role);
    expect((await POST(request())).status).toBe(403);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it('refuse l'origine �trang�re avant Auth', async () => {
    expect((await POST(request(undefined, 'https://evil.test'))).status).toBe(
      403,
    );
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('ne permet aucune op�ration native ni instance officielle fournie par le navigateur', async () => {
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
  it('borne les octets r�ellement re�us et refuse un JSON invalide', async () => {
    expect((await POST(request(' '.repeat(262145)))).status).toBe(400);
    expect((await POST(request('{'))).status).toBe(400);
    expect(fake.run).not.toHaveBeenCalled();
  });
  it('n'�choe pas la d�finition priv�e m�me si l'Engine la retourne en validation', async () => {
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
  it('pr�sente les vrais diagnostics de sch�ma sans les traduire en approbation', async () => {
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
  it('ne transforme pas un timeout/worker indisponible en r�sultat positif et masque les d�tails', async () => {
    fake.run.mockRejectedValue(new Error('private runtime path'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private runtime path');
  });
  it.each([
    ['authentication', 502, 'engine_authentication'],
    ['archive-mismatch', 502, 'engine_archive_mismatch'],
    ['contract-mismatch', 502, 'engine_contract_mismatch'],
    ['network', 503, 'engine_network'],
    ['timeout', 504, 'engine_timeout'],
  ] as const)('distingue la panne Engine %s', async (reason, status, code) => {
    fake.run.mockRejectedValueOnce(
      Object.assign(new Error('private'), { reason }),
    );
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  });
  it.each([
    null,
    { ok: false },
    { ok: false, diagnostics: [] },
    { ok: false, diagnostics: [{ path: '/elements' }] },
  ])('refuse un r�sultat de protocole invalide : %j', async (value) => {
    fake.run.mockResolvedValue(value);
    expect((await POST(request())).status).toBe(503);
  });
});

