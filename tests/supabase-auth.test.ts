import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readAuthConfiguration,
  STAGING_PROJECT_REF,
  LOCAL_AUTH_COOKIE,
  LOCAL_PUBLICATION_AUTH_COOKIE,
} from '@/lib/auth/config';

vi.mock('server-only', () => ({}));
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: sdk.create }));

import {
  asAuthGateway,
  createRouteAuth,
  transferAuthCookies,
} from '@/lib/auth/supabase';

function client() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { role: 'admin' }, error: null }),
  };
  const raw = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'verified-user',
            is_anonymous: false,
            user_metadata: { role: 'admin' },
          },
        },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue(query),
  };
  return {
    raw,
    query,
    gateway: asAuthGateway(raw as unknown as SupabaseClient),
  };
}

beforeEach(() => sdk.create.mockReset());

describe('adaptateur Auth Supabase', () => {
  it('uses a distinct cookie namespace for the dedicated publication fixture', () => {
    sdk.create.mockReturnValue(client().raw);
    createRouteAuth(new NextRequest('http://127.0.0.1:3152/login'), {
      supabaseUrl: 'http://127.0.0.1:55432',
      publishableKey: 'fixture',
      appOrigin: 'http://127.0.0.1:3152',
      secureCookies: false,
      local: true,
      localPublicationFixture: true,
    });
    expect(sdk.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        cookieOptions: expect.objectContaining({
          name: LOCAL_PUBLICATION_AUTH_COOKIE,
          httpOnly: true,
        }),
      }),
    );
    expect(LOCAL_PUBLICATION_AUTH_COOKIE).not.toBe(LOCAL_AUTH_COOKIE);
  });
  it('isolates local session cookies without changing the verified-user adapter', () => {
    sdk.create.mockReturnValue(client().raw);
    createRouteAuth(new NextRequest('http://127.0.0.1:3150/login'), {
      supabaseUrl: 'http://127.0.0.1:55431',
      publishableKey: 'local-fixture-key',
      appOrigin: 'http://127.0.0.1:3150',
      secureCookies: false,
      local: true,
    });
    expect(sdk.create).toHaveBeenCalledWith(
      'http://127.0.0.1:55431',
      'local-fixture-key',
      expect.objectContaining({
        cookieOptions: expect.objectContaining({
          name: LOCAL_AUTH_COOKIE,
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
        }),
      }),
    );
  });
  it('vérifie la session auprès du serveur Auth puis lit uniquement le rôle propre', async () => {
    const { gateway, raw, query } = client();
    const user = await gateway.getVerifiedUser();
    expect(user).toEqual({ id: 'verified-user', isAnonymous: false });
    expect(raw.auth.getUser).toHaveBeenCalledTimes(1);
    expect(await gateway.getProfileRole(user!.id)).toBe('admin');
    expect(raw.from).toHaveBeenCalledWith('profiles');
    expect(query.select).toHaveBeenCalledWith('role');
    expect(query.eq).toHaveBeenCalledWith('id', 'verified-user');
  });
  it('distingue session absente et panne réseau', async () => {
    const { gateway, raw } = client();
    raw.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', status: 400 },
    } as never);
    expect(await gateway.getVerifiedUser()).toBeNull();
    raw.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'FetchError', status: 500 },
    } as never);
    await expect(gateway.getVerifiedUser()).rejects.toThrow('Auth unavailable');
  });
  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
  ])(
    'refuse une session terminée (%s) sans consulter les profils',
    async (code) => {
      const { gateway, raw } = client();
      raw.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthApiError', status: 400, code },
      } as never);
      expect(await gateway.getVerifiedUser()).toBeNull();
      expect(raw.from).not.toHaveBeenCalled();
    },
  );
  it.each([
    { name: 'AuthApiError', status: 400, code: 'unexpected_failure' },
    { name: 'AuthApiError', status: 400 },
    { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
    { name: 'AuthApiError', status: 500, code: 'session_expired' },
    { name: 'FetchError', status: 400, code: 'session_expired' },
  ])('conserve les pannes et erreurs inconnues : %j', async (error) => {
    const { gateway, raw } = client();
    raw.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error,
    } as never);
    await expect(gateway.getVerifiedUser()).rejects.toThrow('Auth unavailable');
    expect(raw.from).not.toHaveBeenCalled();
  });
  it('ne remplace pas une erreur RLS par un rôle de JWT', async () => {
    const { gateway, query } = client();
    query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '42501' },
    });
    await expect(gateway.getProfileRole('verified-user')).rejects.toThrow(
      'Role unavailable',
    );
  });
  it('utilise les appels Auth serveur sans privilège général', async () => {
    const { gateway, raw } = client();
    expect(await gateway.signIn('admin@example.test', 'password')).toBe(true);
    expect(raw.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.test',
      password: 'password',
    });
    expect(await gateway.signOut()).toBe(true);
    expect(raw.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it.each([
    { name: 'AuthRetryableFetchError', status: 0 },
    { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
    { name: 'AuthApiError', status: 500 },
  ])('signale une indisponibilité Auth au lieu de faux identifiants : %j', async (error) => {
    const { gateway, raw } = client();
    raw.auth.signInWithPassword.mockResolvedValueOnce({ error } as never);
    await expect(gateway.signIn('admin@example.test', 'password')).rejects.toThrow('Auth unavailable');
  });
  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_not_found',
    'session_expired',
  ])(
    'termine la déconnexion locale après session terminée (%s)',
    async (code) => {
      const { gateway, raw } = client();
      raw.auth.signOut.mockResolvedValueOnce({
        error: { name: 'AuthApiError', status: 400, code },
      } as never);
      expect(await gateway.signOut()).toBe(true);
      expect(raw.auth.signOut.mock.calls).toEqual([
        [{ scope: 'local' }],
        [{ scope: 'local' }],
      ]);
    },
  );
  it('ne déclare pas la déconnexion réussie si sa finalisation échoue', async () => {
    const { gateway, raw } = client();
    raw.auth.signOut
      .mockResolvedValueOnce({
        error: { name: 'AuthApiError', status: 400, code: 'session_expired' },
      } as never)
      .mockResolvedValueOnce({ error: { status: 500 } } as never);
    expect(await gateway.signOut()).toBe(false);
    expect(raw.auth.signOut).toHaveBeenCalledTimes(2);
  });
  it.each([
    { name: 'AuthApiError', status: 400, code: 'unexpected_failure' },
    { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
    { name: 'AuthApiError', status: 500, code: 'session_expired' },
    { name: 'FetchError', status: 400, code: 'session_expired' },
  ])('ne relance pas une panne de déconnexion : %j', async (error) => {
    const { gateway, raw } = client();
    raw.auth.signOut.mockResolvedValueOnce({ error } as never);
    expect(await gateway.signOut()).toBe(false);
    expect(raw.auth.signOut).toHaveBeenCalledExactlyOnceWith({
      scope: 'local',
    });
  });
  it('renouvelle les cookies sur la requête et la réponse finale avec no-store', () => {
    const fake = client();
    sdk.create.mockReturnValue(fake.raw);
    const config = readAuthConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        'sb_publishable_synthetic_test_value',
      APP_BASE_URL: 'https://admin.example.test',
    })!;
    const request = new NextRequest(
      'https://admin.example.test/api/admin/session',
    );
    const { response } = createRouteAuth(request, config);
    const options = sdk.create.mock.calls[0][2];
    expect(options.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
    options.cookies.setAll(
      [
        {
          name: 'sb-synthetic',
          value: 'synthetic-token',
          options: { httpOnly: true, secure: true, path: '/', sameSite: 'lax' },
        },
      ],
      { 'Cache-Control': 'private, no-store' },
    );
    expect(request.cookies.get('sb-synthetic')?.value).toBe('synthetic-token');
    const final = transferAuthCookies(
      response,
      NextResponse.redirect('https://admin.example.test/admin', 303),
    );
    expect(final.headers.get('set-cookie')).toContain('HttpOnly');
    expect(final.headers.get('set-cookie')).toContain('Secure');
    expect(final.headers.get('cache-control')).toContain('no-store');
    expect(final.cookies.get('sb-synthetic')?.value).toBe('synthetic-token');
  });
});
