import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { readLocalPedagogyConfiguration } from '@/lib/pedagogy-config';
import { readPedagogyReferenceQuery } from '@/lib/pedagogy-references';
import { loadLocalPedagogyReferences } from '@/lib/pedagogy-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config) return json({ error: 'Accès Staging non activé.' }, 503);
  const { gateway, response } = createRouteAuth(request, config);
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
  if (!readLocalPedagogyConfiguration(process.env))
    return finish({ error: 'Lecture pédagogique locale non activée.' }, 503);
  const parsed = readPedagogyReferenceQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return finish({ error: parsed.error }, 400);
  try {
    return finish(await loadLocalPedagogyReferences(parsed.query));
  } catch {
    return finish({ error: 'Recherche de référence indisponible.' }, 503);
  }
}
