import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { AuthGateway } from './authorization';
import {
  readAuthConfiguration,
  LOCAL_AUTH_COOKIE,
  type AuthConfiguration,
} from './config';
import { privateHeaders } from './http';

export function asAuthGateway(client: SupabaseClient): AuthGateway {
  return {
    async getVerifiedUser() {
      const { data, error } = await client.auth.getUser();
      if (error) {
        if (
          error.status === 401 ||
          error.status === 403 ||
          error.name === 'AuthSessionMissingError'
        )
          return null;
        throw new Error('Auth unavailable');
      }
      return data.user
        ? { id: data.user.id, isAnonymous: data.user.is_anonymous === true }
        : null;
    },
    async getProfileRole(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error('Role unavailable');
      return data?.role ?? null;
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error && (error.status === undefined || error.status >= 500))
        throw new Error('Auth unavailable');
      return !error;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      return !error;
    },
  };
}

/** Each request owns its client and cookies. No service role or browser SDK. */
export function createRouteAuth(
  request: NextRequest,
  config: AuthConfiguration,
) {
  const response = NextResponse.next({ request, headers: privateHeaders() });
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookieOptions: {
      ...(config.local ? { name: LOCAL_AUTH_COOKIE } : {}),
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/',
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        for (const { name, value, options } of values) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers ?? {}))
          response.headers.set(name, value);
      },
    },
  });
  return { gateway: asAuthGateway(client), response, client };
}

export async function createPageClient() {
  const config = readAuthConfiguration(process.env);
  if (!config) return null;
  const store = await cookies();
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookieOptions: {
      ...(config.local ? { name: LOCAL_AUTH_COOKIE } : {}),
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/',
    },
    cookies: {
      getAll: () => store.getAll(),
      // Middleware refreshes cookies; Server Components cannot write them.
      setAll() {},
    },
  });
  return client;
}

export async function createPageAuth() {
  const client = await createPageClient();
  return client ? asAuthGateway(client) : null;
}

export function transferAuthCookies(
  source: NextResponse,
  target: NextResponse,
) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  for (const [name, value] of privateHeaders()) target.headers.set(name, value);
  return target;
}
