import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { readUserDetailConfiguration } from '@/lib/user-detail-config';
import { readUserDetailQuery } from '@/lib/user-detail';
import { loadUserDetail } from '@/lib/user-detail-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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
  if (!readUserDetailConfiguration(process.env))
    return finish({ error: 'Consultation détaillée non configurée.' }, 503);
  const { userId } = await params;
  const filter = readUserDetailQuery(userId, request.nextUrl.searchParams);
  if (!filter.ok) return finish({ error: filter.error }, 400);
  try {
    const data = await loadUserDetail(filter.value);
    return data === null
      ? finish({ error: 'Utilisateur introuvable.' }, 404)
      : finish(data);
  } catch {
    return finish({ error: 'Fiche utilisateur indisponible' }, 503);
  }
}
