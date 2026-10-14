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
  generate: vi.fn(),
  inspect: vi.fn(),
  grade: vi.fn(),
  test: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
vi.mock('@/lib/preview-server', () => ({
  generatePreview: fake.generate,
  inspectPreview: fake.inspect,
  gradePreview: fake.grade,
  testPreview: fake.test,
  acquirePreviewJob: fake.acquire,
  PreviewError: class extends Error {
    status = 410;
  },
}));
import { POST } from '@/app/api/admin/preview/route';
const reference = '90000000-0000-4000-8000-000000000001';
function request(
  body: unknown = {
    action: 'generate',
    definition: newDraft('Test'),
    seed: 42,
  },
  origin = 'http://localhost:3000',
  mime = 'application/json',
) {
  return new NextRequest('http://localhost:3000/api/admin/preview', {
    method: 'POST',
    headers: { origin, 'content-type': mime },
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
    id: 'alice',
    isAnonymous: false,
  });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
  });
  fake.acquire.mockReturnValue(fake.release);
  fake.generate.mockResolvedValue({ previewId: reference });
  fake.inspect.mockReturnValue({ values: {} });
  fake.grade.mockResolvedValue({ state: 'correct' });
  fake.test.mockResolvedValue({ passed: false });
});
describe('aperçu serveur protégé', () => {
  it.each(['ADMIN_STAGING_AUTH_ENABLED', 'ADMIN_ENGINE_ENABLED'])(
    'reste fermé sans %s avant tout calcul',
    async (flag) => {
      vi.stubEnv(flag, 'false');
      expect((await POST(request())).status).toBe(503);
      expect(fake.create).not.toHaveBeenCalled();
      expect(fake.acquire).not.toHaveBeenCalled();
    },
  );
  it.each([null, { id: 'guest', isAnonymous: true }])(
    'refuse une identité absente ou invitée',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      expect([401, 403]).toContain((await POST(request())).status);
      expect(fake.acquire).not.toHaveBeenCalled();
    },
  );
  it.each([null, 'user', 'editor'])(
    'refuse le rôle %s et les données privées',
    async (role) => {
      fake.auth.getProfileRole.mockResolvedValue(role);
      expect(
        (await POST(request({ action: 'inspect', previewId: reference })))
          .status,
      ).toBe(403);
      expect(fake.inspect).not.toHaveBeenCalled();
    },
  );
  it('refuse une origine étrangère avant Auth', async () => {
    expect((await POST(request(undefined, 'https://evil.test'))).status).toBe(
      403,
    );
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('refuse du texte, JSON malformé et corps réellement trop volumineux', async () => {
    expect((await POST(request('{}', undefined, 'text/plain'))).status).toBe(
      415,
    );
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request(' '.repeat(262145)))).status).toBe(400);
    expect(fake.acquire).not.toHaveBeenCalled();
  });
  it.each(['gradeAnswer', '__proto__', 'constructor', 'toString'])(
    'refuse une opération non déclarée %s',
    async (action) => {
      expect(
        (
          await POST(
            request({ action, definition: newDraft('Test'), seed: 42 }),
          )
        ).status,
      ).toBe(400);
      expect(fake.acquire).not.toHaveBeenCalled();
    },
  );
  it('ne permet jamais de fournir une instance officielle ou une destination distante', async () => {
    for (const extra of [
      { official: { expected: 'forged' } },
      { environment: 'production' },
      { instanceId: 'forged' },
    ])
      expect(
        (
          await POST(
            request({
              action: 'generate',
              definition: newDraft('Test'),
              seed: 42,
              ...extra,
            }),
          )
        ).status,
      ).toBe(400);
    expect(fake.generate).not.toHaveBeenCalled();
  });
  it.each([-1, 4294967296, 1.5, '42', null])(
    'refuse la seed %j',
    async (seed) => {
      expect(
        (
          await POST(
            request({ action: 'generate', definition: newDraft('Test'), seed }),
          )
        ).status,
      ).toBe(400);
    },
  );
  it('borne les tests et refuse seeds dupliquées, cas indéterminés ou champs inconnus', async () => {
    for (const [seeds, cases] of [
      [[1, 1], []],
      [Array.from({ length: 6 }, (_, i) => i), []],
      [
        [1],
        Array.from({ length: 17 }, () => ({
          questionId: 'q',
          answer: { format: 'latex', source: '1' },
          expectedState: 'incorrect',
        })),
      ],
      [
        [1],
        [
          {
            questionId: 'q',
            answer: { format: 'latex', source: '1' },
            expectedState: 'indeterminate',
          },
        ],
      ],
      [
        [1],
        [
          {
            questionId: 'q',
            answer: { format: 'latex', source: '1' },
            expectedState: 'correct',
            official: {},
          },
        ],
      ],
    ])
      expect(
        (
          await POST(
            request({
              action: 'test',
              definition: newDraft('Test'),
              seeds,
              cases,
            }),
          )
        ).status,
      ).toBe(400);
    expect(fake.test).not.toHaveBeenCalled();
  });
  it('rattache génération, inspection et correction au propriétaire Auth frais, sans choisir le snapshot', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(fake.generate).toHaveBeenCalledWith(
      'alice',
      newDraft('Test'),
      42,
      expect.any(AbortSignal),
    );
    const response = await POST(
      request({ action: 'inspect', previewId: reference }),
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fake.inspect).toHaveBeenCalledWith('alice', reference);
    const answer = { format: 'latex', source: '4' };
    await POST(
      request({
        action: 'grade',
        previewId: reference,
        questionId: 'q',
        answer,
      }),
    );
    expect(fake.grade).toHaveBeenCalledWith(
      'alice',
      reference,
      'q',
      answer,
      expect.any(AbortSignal),
    );
    expect(fake.release).toHaveBeenCalledTimes(3);
  });
  it('relit le rôle à chaque opération, y compris après génération', async () => {
    await POST(request());
    fake.auth.getProfileRole.mockResolvedValue('user');
    expect(
      (await POST(request({ action: 'inspect', previewId: reference }))).status,
    ).toBe(403);
    expect(fake.inspect).not.toHaveBeenCalled();
  });
  it('masque les erreurs techniques et libère la place après un échec', async () => {
    fake.generate.mockRejectedValue(new Error('secret runtime path'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret runtime path');
    expect(fake.release).toHaveBeenCalledOnce();
  });
});
