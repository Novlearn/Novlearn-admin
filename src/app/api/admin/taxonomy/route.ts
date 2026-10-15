import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import {
  isTaxonomyKind,
  taxonomyFilter,
  taxonomyMutation,
} from '@/lib/taxonomy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function handle(request: NextRequest, mutation: boolean) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config) return json({ error: 'Accès Staging non activé.' }, 503);
  if (mutation && !isTrustedMutation(request, config))
    return json({ error: 'Origine refusée.' }, 403);
  const { gateway, response, client } = createRouteAuth(request, config);
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
  try {
    let name: string, args: Record<string, unknown>;
    if (!mutation) {
      const kind = request.nextUrl.searchParams.get('kind');
      if (!isTaxonomyKind(kind))
        return finish({ error: 'Référentiel inconnu.' }, 400);
      const filter = taxonomyFilter(request.nextUrl.searchParams);
      name = 'admin_list_taxonomy';
      args = {
        p_kind: kind,
        p_query: filter.query,
        p_chapter: filter.chapter,
        p_offset: (filter.page - 1) * 25,
      };
    } else {
      if (
        request.headers.get('content-type')?.split(';')[0].trim() !==
        'application/json'
      )
        return finish({ error: 'Format JSON requis.' }, 415);
      let body: unknown;
      try {
        body = await readBoundedJson(request, 16384);
      } catch {
        return finish({ error: 'Requête invalide ou trop volumineuse.' }, 400);
      }
      const value = taxonomyMutation(body);
      if (!value)
        return finish({ error: 'Champs du référentiel invalides.' }, 400);
      name = 'admin_mutate_taxonomy';
      args = {
        p_kind: value.kind,
        p_action: value.action,
        p_id: value.id,
        p_expected: value.fingerprint,
        p_value: value.value,
      };
    }
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const status =
        error.code === '40001'
          ? 409
          : error.code === 'P0002'
            ? 404
            : error.code === '42501'
              ? 403
              : ['23503', '23505'].includes(error.code)
                ? 409
                : ['22023', '22P02', '22003'].includes(error.code)
                  ? 400
                  : 503;
      const message =
        error.code === '23503'
          ? 'Cette référence est utilisée ou son chapitre est absent. Consultez ses associations avant de modifier ou supprimer.'
          : error.code === '23505'
            ? 'Ce nom, alias ou identifiant est déjà utilisé.'
            : error.code === '40001'
              ? 'Cette fiche a changé. Rechargez avant de réessayer.'
              : status === 404
                ? 'Fiche introuvable.'
                : status === 400
                  ? 'Champs du référentiel invalides.'
                  : 'Référentiel indisponible.';
      return finish({ error: message }, status);
    }
    return finish({ environment: 'staging', result: data });
  } catch {
    return finish({ error: 'Référentiel indisponible.' }, 503);
  }
}
export async function GET(request: NextRequest) {
  return handle(request, false);
}
export async function POST(request: NextRequest) {
  return handle(request, true);
}
