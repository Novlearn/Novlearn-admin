import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';
import { newDraft } from '@/lib/catalogue';
import { createHmac } from 'node:crypto';
vi.mock('server-only', () => ({}));
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
  from: vi.fn(),
  load: vi.fn(),
  rpc: vi.fn(),
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
  vi.stubEnv('ADMIN_TEST_SIGNING_KEY_ID', '');
  vi.stubEnv('ADMIN_TEST_SIGNING_KEY', '');
  fake.auth.getVerifiedUser.mockResolvedValue({
    id: 'alice',
    isAnonymous: false,
  });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
    client: { from: fake.from, rpc: fake.rpc },
  });
  fake.acquire.mockReturnValue(fake.release);
  fake.generate.mockResolvedValue({ previewId: reference });
  fake.inspect.mockReturnValue({ values: {} });
  fake.grade.mockResolvedValue({ state: 'correct' });
  fake.test.mockResolvedValue({
    definitionDigest: 'b'.repeat(64),
    engineVersion: '0.1.0',
    passed: false,
    complete: true,
    seeds: [0, 42].map((seed) => ({
      seed,
      passed: false,
      reproducible: false,
      publicProjectionSafe: false,
      diagnostics: [
        { path: '/elements', code: 'value', message: 'Incomplete fixture' },
      ],
      checks: [],
    })),
  });
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: fake.load };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  fake.from.mockReturnValue(chain);
  fake.load.mockResolvedValue({
    data: {
      id: reference,
      definition: newDraft('Stored authoritative'),
      approval_fingerprint_sha256: 'a'.repeat(64),
      test_epoch: 2,
    },
    error: null,
  });
  fake.rpc.mockImplementation(async (_name, args) => ({
    data: {
      receiptId: JSON.parse(args.p_payload).receiptId,
      recorded: true,
      passed: JSON.parse(args.p_payload).report.passed,
    },
    error: null,
  }));
});
describe('aperçu serveur protégé', () => {
  const savedRequest = () =>
    request({
      action: 'test_saved',
      versionId: reference,
      fingerprint: 'a'.repeat(64),
      epoch: 2,
      seeds: [0, 42],
      cases: [],
    });
  const signer = () => {
    vi.stubEnv(
      'ADMIN_TEST_SIGNING_KEY_ID',
      '10000000-0000-4000-8000-000000000001',
    );
    vi.stubEnv('ADMIN_TEST_SIGNING_KEY', '42'.repeat(32));
    fake.auth.getVerifiedUser.mockResolvedValue({
      id: '20000000-0000-4000-8000-000000000001',
      isAnonymous: false,
    });
  };
  it('ne consigne rien sans signature serveur configurée', async () => {
    expect((await POST(savedRequest())).status).toBe(503);
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('relit la définition DB et signe un vrai résultat serveur plutôt qu’un résultat du navigateur', async () => {
    signer();
    const response = await POST(savedRequest());
    expect(response.status).toBe(200);
    expect(fake.test).toHaveBeenCalledWith(
      newDraft('Stored authoritative'),
      [0, 42],
      [],
      expect.any(AbortSignal),
    );
    const [name, args] = fake.rpc.mock.calls[0];
    expect(name).toBe('admin_record_exercise_test');
    const body = JSON.parse(args.p_payload);
    expect(body.actorId).toBe('20000000-0000-4000-8000-000000000001');
    expect(body.epoch).toBe(2);
    expect(body.fingerprint).toBe('a'.repeat(64));
    expect(args.p_signature).toBe(
      createHmac('sha256', Buffer.from('42'.repeat(32), 'hex'))
        .update(args.p_payload, 'utf8')
        .digest('hex'),
    );
    const output = await response.text();
    expect(output).not.toContain('signature');
    expect(output).not.toContain('42'.repeat(32));
    expect(fake.auth.getProfileRole).toHaveBeenCalledTimes(2);
  });
  it('refuse une révision modifiée avant le calcul', async () => {
    signer();
    fake.load.mockResolvedValue({
      data: {
        id: reference,
        definition: newDraft('Changed'),
        approval_fingerprint_sha256: 'b'.repeat(64),
        test_epoch: 3,
      },
      error: null,
    });
    expect((await POST(savedRequest())).status).toBe(409);
    expect(fake.test).not.toHaveBeenCalled();
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('ne signe pas après une révocation survenue pendant les calculs', async () => {
    signer();
    fake.auth.getProfileRole
      .mockResolvedValueOnce('admin')
      .mockResolvedValueOnce('user');
    expect((await POST(savedRequest())).status).toBe(403);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(['40001', 'PT409'])(
    'ne déclare aucun enregistrement après conflit SQL %s ou résultat non confirmé',
    async (code) => {
      signer();
      fake.rpc.mockResolvedValueOnce({ data: null, error: { code } });
      expect((await POST(savedRequest())).status).toBe(409);
      fake.rpc.mockResolvedValueOnce({
        data: { recorded: false },
        error: null,
      });
      expect((await POST(savedRequest())).status).toBe(503);
    },
  );
  it('refuse définition, acteur et verdict client dans la requête de révision', async () => {
    signer();
    for (const extra of [
      { definition: newDraft('Forged') },
      { actorId: 'bob' },
      { report: { passed: true } },
    ])
      expect(
        (
          await POST(
            request({
              action: 'test_saved',
              versionId: reference,
              fingerprint: 'a'.repeat(64),
              epoch: 2,
              seeds: [0],
              cases: [],
              ...extra,
            }),
          )
        ).status,
      ).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
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
