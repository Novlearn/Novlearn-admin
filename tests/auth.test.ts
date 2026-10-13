import { describe, expect, it, vi } from 'vitest';
import {
  authorizeAdmin,
  loginAdmin,
  type AuthGateway,
} from '@/lib/auth/authorization';
import { readAuthConfiguration, STAGING_PROJECT_REF } from '@/lib/auth/config';
import {
  isTrustedMutation,
  privateHeaders,
  readBoundedForm,
} from '@/lib/auth/http';

export const configuredEnvironment = {
  ADMIN_STAGING_AUTH_ENABLED: 'true',
  ADMIN_STAGING_SECURITY_REVIEW: 'local-test-only',
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_value',
  APP_BASE_URL: 'http://localhost:3000',
};

function gateway(): AuthGateway {
  return {
    getVerifiedUser: vi
      .fn()
      .mockResolvedValue({ id: 'synthetic-admin', isAnonymous: false }),
    getProfileRole: vi.fn().mockResolvedValue('admin'),
    signIn: vi.fn().mockResolvedValue(true),
    signOut: vi.fn().mockResolvedValue(true),
  };
}

describe('activation Staging', () => {
  it('refuse par défaut et exige une revue explicite', () => {
    expect(readAuthConfiguration({})).toBeNull();
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        ADMIN_STAGING_AUTH_ENABLED: 'false',
      }),
    ).toBeNull();
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        ADMIN_STAGING_SECURITY_REVIEW: '',
      }),
    ).toBeNull();
  });
  it.each([
    'https://abwipnppcrghdhwriyjp.supabase.co',
    `https://${STAGING_PROJECT_REF}.supabase.co.evil.test`,
    `http://${STAGING_PROJECT_REF}.supabase.co`,
    `https://user:password@${STAGING_PROJECT_REF}.supabase.co`,
    `https://${STAGING_PROJECT_REF}.supabase.co/?redirect=evil`,
  ])('rejette les URLs non Staging : %s', (url) => {
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: url,
      }),
    ).toBeNull();
  });
  it.each([
    'sb_secret_test',
    'eyJhbGciOiJIUzI1NiJ9.service_role',
    'sb_publishable_replace_me',
  ])('rejette les clés non publishable : %s', (key) => {
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBeNull();
  });
  it('configure les cookies Secure uniquement en HTTPS', () => {
    expect(readAuthConfiguration(configuredEnvironment)?.secureCookies).toBe(
      false,
    );
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        APP_BASE_URL: 'https://admin.example.test',
      })?.secureCookies,
    ).toBe(true);
    expect(
      readAuthConfiguration({
        ...configuredEnvironment,
        APP_BASE_URL: 'http://admin.example.test',
      }),
    ).toBeNull();
  });
});

describe('autorisation serveur', () => {
  it('refuse une session absente ou expirée avant de lire un rôle', async () => {
    const auth = gateway();
    vi.mocked(auth.getVerifiedUser).mockResolvedValue(null);
    expect(await authorizeAdmin(auth)).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
    expect(auth.getProfileRole).not.toHaveBeenCalled();
  });
  it.each([null, 'user', 'reviewer', 'Admin', ''])(
    'refuse un rôle %s',
    async (role) => {
      const auth = gateway();
      vi.mocked(auth.getProfileRole).mockResolvedValue(role);
      expect(await authorizeAdmin(auth)).toEqual({
        allowed: false,
        reason: 'forbidden',
      });
    },
  );
  it('refuse un invité même avec un rôle admin', async () => {
    const auth = gateway();
    vi.mocked(auth.getVerifiedUser).mockResolvedValue({
      id: 'guest',
      isAnonymous: true,
    });
    expect(await authorizeAdmin(auth)).toEqual({
      allowed: false,
      reason: 'forbidden',
    });
    expect(auth.getProfileRole).not.toHaveBeenCalled();
  });
  it('accorde seulement le rôle relu de la session vérifiée', async () => {
    const auth = gateway();
    expect(await authorizeAdmin(auth)).toEqual({
      allowed: true,
      userId: 'synthetic-admin',
    });
    expect(auth.getProfileRole).toHaveBeenCalledWith('synthetic-admin');
  });
  it('applique la révocation au prochain appel', async () => {
    const auth = gateway();
    expect((await authorizeAdmin(auth)).allowed).toBe(true);
    vi.mocked(auth.getProfileRole).mockResolvedValue('user');
    expect((await authorizeAdmin(auth)).allowed).toBe(false);
    expect(auth.getVerifiedUser).toHaveBeenCalledTimes(2);
  });
  it.each(['getVerifiedUser', 'getProfileRole'] as const)(
    'refuse une panne de %s',
    async (method) => {
      const auth = gateway();
      vi.mocked(auth[method]).mockRejectedValue(
        new Error('private diagnostics'),
      );
      expect(await authorizeAdmin(auth)).toEqual({
        allowed: false,
        reason: 'unavailable',
      });
    },
  );
});

describe('connexion', () => {
  it('connecte un administrateur vérifié', async () => {
    const auth = gateway();
    expect(await loginAdmin(auth, ' admin@example.test ', ' secret ')).toEqual({
      ok: true,
    });
    expect(auth.signIn).toHaveBeenCalledWith('admin@example.test', ' secret ');
  });
  it('ferme la session du compte non administrateur', async () => {
    const auth = gateway();
    vi.mocked(auth.getProfileRole).mockResolvedValue('user');
    expect(await loginAdmin(auth, 'user@example.test', 'secret')).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
  it('ne déclare pas une déconnexion réussie en cas de panne', async () => {
    const auth = gateway();
    vi.mocked(auth.getProfileRole).mockResolvedValue('user');
    vi.mocked(auth.signOut).mockResolvedValue(false);
    expect(await loginAdmin(auth, 'user@example.test', 'secret')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
  it('ne lit aucun profil après des identifiants refusés', async () => {
    const auth = gateway();
    vi.mocked(auth.signIn).mockResolvedValue(false);
    expect(await loginAdmin(auth, 'user@example.test', 'secret')).toEqual({
      ok: false,
      reason: 'credentials',
    });
    expect(auth.getProfileRole).not.toHaveBeenCalled();
  });
  it.each([
    [null, 'secret'],
    ['invalid', 'secret'],
    ['a@b.test', ''],
    ['a@b.test', 'a'.repeat(1025)],
  ])('rejette le formulaire %s', async (email, password) => {
    const auth = gateway();
    expect(await loginAdmin(auth, email, password)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});

describe('frontière HTTP', () => {
  it.each([null, 'https://evil.test', 'http://localhost:3000.evil.test'])(
    'refuse Origin %s',
    (origin) => {
      const headers = origin ? { origin } : undefined;
      const request = new Request('http://localhost:3000/auth/login', {
        method: 'POST',
        headers,
      });
      expect(
        isTrustedMutation(
          request,
          readAuthConfiguration(configuredEnvironment)!,
        ),
      ).toBe(false);
    },
  );
  it('accepte une mutation de même origine, refuse GET', () => {
    const config = readAuthConfiguration(configuredEnvironment)!;
    expect(
      isTrustedMutation(
        new Request(`${config.appOrigin}/auth/login`, {
          method: 'POST',
          headers: { origin: config.appOrigin },
        }),
        config,
      ),
    ).toBe(true);
    expect(
      isTrustedMutation(
        new Request(`${config.appOrigin}/auth/login`, {
          headers: { origin: config.appOrigin },
        }),
        config,
      ),
    ).toBe(false);
    expect(privateHeaders().get('cache-control')).toContain('no-store');
  });
  it('plafonne le corps même sans Content-Length', async () => {
    expect(
      await readBoundedForm(
        new Request('https://admin.test', {
          method: 'POST',
          body: 'a'.repeat(8193),
        }),
      ),
    ).toBeNull();
    expect(
      (
        await readBoundedForm(
          new Request('https://admin.test', {
            method: 'POST',
            body: 'password=a%2Bb',
          }),
        )
      )?.get('password'),
    ).toBe('a+b');
  });
});
