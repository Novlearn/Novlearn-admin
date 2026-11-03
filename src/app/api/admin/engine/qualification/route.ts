import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { qualifyEngine } from '@/lib/engine-qualification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config) return json({ error: 'Configuration indisponible.' }, 503);
  if (!isTrustedMutation(request, config))
    return json({ error: 'Origine refusée.' }, 403);
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
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return finish({ error: 'Format JSON requis.' }, 415);
  try {
    const body = await readBoundedJson(request, 512);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length
    )
      return finish(
        { error: 'Le banc accepte uniquement un objet vide.' },
        400,
      );
  } catch {
    return finish({ error: 'Requête invalide.' }, 400);
  }
  try {
    const result = await qualifyEngine(
      AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    );
    if ('busy' in result)
      return finish({ error: 'Qualification déjà en cours.' }, 429);
    return finish({ environment: 'staging', result });
  } catch {
    return finish({ error: 'Qualification interrompue ou indisponible.' }, 503);
  }
}
