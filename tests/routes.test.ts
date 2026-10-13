import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { AuthGateway } from '@/lib/auth/authorization';
import { STAGING_PROJECT_REF } from '@/lib/auth/config';

const fake = vi.hoisted(() => ({
  auth: {
    getVerifiedUser: vi.fn(),
    getProfileRole: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  } satisfies AuthGateway,
  create: vi.fn(),
}));

vi.mock('@/lib/auth/supabase', () => ({
  createRouteAuth: fake.create,
  transferAuthCookies: (_source: unknown, target: unknown) => target,
}));

import { GET } from '@/app/api/admin/session/route';
import { POST as login } from '@/app/auth/login/route';
import { POST as logout } from '@/app/auth/logout/route';

beforeEach(() => {
  vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'true');
  vi.stubEnv('ADMIN_STAGING_SECURITY_REVIEW', 'synthetic-review');
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    `https://${STAGING_PROJECT_REF}.supabase.co`,
  );
  vi.stubEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_synthetic_test_value',
  );
  vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
  fake.auth.getVerifiedUser.mockResolvedValue({
    id: 'synthetic-user',
    isAnonymous: false,
  });
  fake.auth.getProfileRole.mockResolvedValue('admin');
  fake.auth.signIn.mockResolvedValue(true);
  fake.auth.signOut.mockResolvedValue(true);
  fake.create.mockImplementation(() => ({
    gateway: fake.auth,
    response: NextResponse.next(),
  }));
});

function post(
  path: string,
  origin = 'http://localhost:3000',
  body = 'email=admin%40example.test&password=secret',
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('appels directs aux Route Handlers', () => {
  it('refuse toute route sans activation, sans initialiser Supabase', async () => {
    vi.stubEnv('ADMIN_STAGING_AUTH_ENABLED', 'false');
    for (const response of [
      await GET(new NextRequest('http://localhost:3000/api/admin/session')),
      await login(post('/auth/login')),
      await logout(post('/auth/logout')),
    ]) {
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('retourne 401 sans session, sans charger de profil', async () => {
    fake.auth.getVerifiedUser.mockResolvedValue(null);
    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/session'),
    );
    expect(response.status).toBe(401);
    expect(fake.auth.getProfileRole).not.toHaveBeenCalled();
  });
  it('ignore un rôle fabriqué dans le header ou le cookie', async () => {
    fake.auth.getProfileRole.mockResolvedValue('user');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/session', {
        headers: { 'x-role': 'admin', cookie: 'role=admin' },
      }),
    );
    expect(response.status).toBe(403);
  });
  it('projette uniquement environnement et rôle pour un admin', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/session'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      environment: 'staging',
      role: 'admin',
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('refuse une session expirée après un accès réussi', async () => {
    expect(
      (await GET(new NextRequest('http://localhost:3000/api/admin/session')))
        .status,
    ).toBe(200);
    fake.auth.getVerifiedUser.mockResolvedValue(null);
    expect(
      (await GET(new NextRequest('http://localhost:3000/api/admin/session')))
        .status,
    ).toBe(401);
  });
  it('ne divulgue pas une erreur privée', async () => {
    fake.auth.getProfileRole.mockRejectedValueOnce(
      new Error('postgres password=private'),
    );
    const response = await GET(
      new NextRequest('http://localhost:3000/api/admin/session'),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
  it.each([login, logout])(
    'refuse les mutations depuis une autre origine',
    async (handler) => {
      expect(
        (await handler(post('/auth/login', 'https://evil.test'))).status,
      ).toBe(403);
      expect(fake.create).not.toHaveBeenCalled();
    },
  );
  it('refuse un JSON et les corps volumineux avant Auth', async () => {
    const json = new NextRequest('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect((await login(json)).status).toBe(415);
    expect(
      (await login(post('/auth/login', undefined, 'a'.repeat(8193)))).status,
    ).toBe(413);
    expect(fake.create).not.toHaveBeenCalled();
  });
  it('redirige vers une destination fixe après connexion', async () => {
    const response = await login(
      post(
        '/auth/login',
        undefined,
        'email=admin%40example.test&password=secret&next=https://evil.test',
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/admin',
    );
  });
  it('refuse et déconnecte un non-admin via POST direct', async () => {
    fake.auth.getProfileRole.mockResolvedValue('user');
    const response = await login(post('/auth/login'));
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=forbidden',
    );
    expect(fake.auth.signOut).toHaveBeenCalled();
  });
  it('permet la déconnexion même après expiration de session', async () => {
    fake.auth.getVerifiedUser.mockResolvedValue(null);
    const response = await logout(post('/auth/logout'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login',
    );
    expect(fake.auth.signOut).toHaveBeenCalled();
  });
  it('renvoie une erreur explicite si la déconnexion échoue', async () => {
    fake.auth.signOut.mockResolvedValue(false);
    const response = await logout(post('/auth/logout'));
    expect(response.status).toBe(503);
  });
});
