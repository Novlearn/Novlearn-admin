import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { readUsersConfiguration } from '@/lib/users-config';
import { readUsersQuery } from '@/lib/users';
import { loadUsersByName } from '@/lib/users-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const auth = readAuthConfiguration(process.env);
  if (!auth) return json({ error: 'Accès Staging non activé.' }, 503);
  const { gateway, response } = createRouteAuth(request, auth);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { error: 'Accès refusé.' },
      access.reason === 'unauthenticated'
        ? 401
        : access.reason === 'forbidden'
          ? 403
          : 503,
    );
  if (!readUsersConfiguration(process.env))
    return finish(
      { error: 'Consultation des utilisateurs non configurée.' },
      503,
    );
  const filter = readUsersQuery(request.nextUrl.searchParams);
  if (!filter.ok) return finish({ error: filter.error }, 400);
  try {
    return finish(await loadUsersByName(filter.value));
  } catch {
    return finish({ error: 'Utilisateurs indisponibles' }, 503);
  }
}
