import { authorizeAdmin } from './auth/authorization';
import { readAuthConfiguration } from './auth/config';
import { createRouteAuth, transferAuthCookies } from './auth/supabase';
import { productionAuthConfiguration } from './production-api-config';
import { privateHeaders } from './auth/http';
import { NextResponse, type NextRequest } from 'next/server';

export async function authorizeFeedbackRoute(request: NextRequest) {
  const json = (body: unknown, status: number) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const stagingConfig = readAuthConfiguration(process.env);
  const productionConfig = productionAuthConfiguration(process.env);
  if (!stagingConfig || !productionConfig)
    return {
      ok: false as const,
      response: json({ error: 'Accès aux feedbacks indisponible.' }, 503),
    };

  const staging = createRouteAuth(request, stagingConfig);
  const production = createRouteAuth(request, productionConfig);
  const stagingAccess = await authorizeAdmin(staging.gateway);
  if (!stagingAccess.allowed) {
    const status =
      stagingAccess.reason === 'unauthenticated'
        ? 401
        : stagingAccess.reason === 'forbidden'
          ? 403
          : 503;
    return {
      ok: false as const,
      response: transferAuthCookies(
        staging.response,
        json({ error: 'Accès refusé.' }, status),
      ),
    };
  }
  const productionAccess = await authorizeAdmin(production.gateway);
  if (!productionAccess.allowed) {
    const status =
      productionAccess.reason === 'unauthenticated'
        ? 401
        : productionAccess.reason === 'forbidden'
          ? 403
          : 503;
    return {
      ok: false as const,
      response: transferAuthCookies(
        staging.response,
        transferAuthCookies(
          production.response,
          json({ error: 'Accès Production refusé.' }, status),
        ),
      ),
    };
  }
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(
      staging.response,
      transferAuthCookies(production.response, json(body, status)),
    );
  return {
    ok: true as const,
    client: production.client,
    stagingConfig,
    finish,
  };
}
