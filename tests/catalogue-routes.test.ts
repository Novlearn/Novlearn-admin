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
  rpc: vi.fn(),
}));
vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_a: unknown, b: unknown) => b,
}));
import { GET, POST } from '@/app/api/admin/exercises/route';
const uuid = '90000000-0000-0000-0000-000000000001';
const save = {
  action: 'save',
  exerciseId: null,
  versionId: null,
  fingerprint: null,
  definition: newDraft('Un brouillon'),
};
function post(
  body: unknown = save,
  origin = 'http://localhost:3000',
  type = 'application/json',
) {
  return new NextRequest('http://localhost:3000/api/admin/exercises', {
    method: 'POST',
    headers: { origin, 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'test-only');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.auth.getVerifiedUser.mockResolvedValue({ id: uuid, isAnonymous: false });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.rpc.mockResolvedValue({
    data: { exerciseId: '9007199254740993', versionId: uuid },
    error: null,
  });
  fake.create.mockReturnValue({
    gateway: fake.auth,
    response: NextResponse.next(),
    client: { rpc: fake.rpc },
  });
});
describe('API catalogue : permission avant toute opération', () => {
  it.each(['save', 'duplicate', 'archive'])(
    'refuse %s sans activation',
    async (action) => {
      vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'false');
      expect((await POST(post({ ...save, action }))).status).toBe(503);
      expect(fake.create).not.toHaveBeenCalled();
    },
  );
  it('refuse GET sans activation', async () => {
    vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'false');
    expect(
      (await GET(new NextRequest('http://localhost:3000/api/admin/exercises')))
        .status,
    ).toBe(503);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each([null, { id: uuid, isAnonymous: true }])(
    'refuse une identité absente ou invitée',
    async (user) => {
      fake.auth.getVerifiedUser.mockResolvedValue(user);
      for (const result of [
        await POST(post()),
        await GET(new NextRequest('http://localhost:3000/api/admin/exercises')),
      ])
        expect([401, 403]).toContain(result.status);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(['user', null, 'editor'])(
    'refuse un rôle %s et les en-têtes fabriqués',
    async (role) => {
      fake.auth.getProfileRole.mockResolvedValue(role);
      const request = post();
      request.headers.set('x-role', 'admin');
      expect((await POST(request)).status).toBe(403);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it('refuse après révocation du rôle entre deux requêtes', async () => {
    expect((await POST(post())).status).toBe(200);
    fake.auth.getProfileRole.mockResolvedValue('user');
    expect((await POST(post())).status).toBe(403);
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it('refuse les pannes Auth sans exposer leur détail', async () => {
    fake.auth.getProfileRole.mockRejectedValue(
      new Error('secret connection string'),
    );
    const response = await POST(post());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(['https://evil.test', 'http://localhost:3000.evil.test', ''])(
    'refuse l’origine %s avant Auth',
    async (origin) => {
      expect((await POST(post(save, origin))).status).toBe(403);
      expect(fake.create).not.toHaveBeenCalled();
    },
  );
  it('n’autorise ni une destination Production ni des métadonnées d’approbation ajoutées au corps', async () => {
    expect(
      (await POST(post({ ...save, environment: 'production' }))).status,
    ).toBe(400);
    expect((await POST(post({ ...save, approved_by: uuid }))).status).toBe(400);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it.each(['published', 'delete', 'approve'])(
    'ne propose pas d’action %s dans ce lot',
    async (action) => {
      expect((await POST(post({ action, exerciseId: '1' }))).status).toBe(400);
      expect(fake.rpc).not.toHaveBeenCalled();
    },
  );
  it('refuse les corps invalides, trop grands et le mauvais type MIME', async () => {
    expect((await POST(post('{'))).status).toBe(400);
    expect((await POST(post(' '.repeat(262145)))).status).toBe(400);
    expect((await POST(post(save, undefined, 'text/plain'))).status).toBe(415);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it('enregistre uniquement la définition et les préconditions dans la RPC dédiée', async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fake.rpc).toHaveBeenCalledWith('admin_save_exercise_draft', {
      p_exercise_id: null,
      p_version_id: null,
      p_expected_fingerprint: null,
      p_definition: save.definition,
    });
    expect(await response.json()).toMatchObject({
      environment: 'staging',
      result: { exerciseId: '9007199254740993' },
    });
  });
  it('conserve le bigint et l’empreinte de concurrence à la sauvegarde', async () => {
    const body = {
      ...save,
      exerciseId: '9007199254740993',
      versionId: uuid,
      fingerprint: 'a'.repeat(64),
    };
    expect((await POST(post(body))).status).toBe(200);
    expect(fake.rpc.mock.calls[0][1]).toMatchObject({
      p_exercise_id: body.exerciseId,
      p_expected_fingerprint: body.fingerprint,
    });
  });
  it('duplique une révision précise et archive sans delete', async () => {
    expect(
      (await POST(post({ action: 'duplicate', versionId: uuid }))).status,
    ).toBe(200);
    expect(
      (
        await POST(
          post({
            action: 'archive',
            exerciseId: '1',
            expectedArchived: false,
            archived: true,
          }),
        )
      ).status,
    ).toBe(200);
    expect(fake.rpc.mock.calls.map((call) => call[0])).toEqual([
      'admin_duplicate_exercise',
      'admin_archive_exercise',
    ]);
  });
  it.each([
    ['40001', 409],
    ['PT409', 409],
    ['P0002', 404],
    ['42501', 403],
    ['22023', 400],
    ['XX000', 503],
  ])('traduit SQLSTATE %s et masque les détails SQL', async (code, status) => {
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code, message: 'secret database query' },
    });
    const response = await POST(post());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('secret');
  });
  it('borne et projette la consultation du catalogue', async () => {
    fake.rpc.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/admin/exercises?status=draft&page=2&q=abc&sort=title',
      ),
    );
    expect(response.status).toBe(200);
    expect(fake.rpc).toHaveBeenCalledWith('admin_list_exercises', {
      p_query: 'abc',
      p_status: 'draft',
      p_sort: 'title',
      p_offset: 25,
      p_limit: 25,
    });
    expect(await response.json()).toEqual({
      environment: 'staging',
      items: [],
      total: 0,
    });
  });
});
