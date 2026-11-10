import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { productionAuthConfiguration } from '@/lib/production-api-config';

export async function POST(request: NextRequest) {
  const config = readAuthConfiguration(process.env);
  if (!config)
    return NextResponse.json(
      { error: 'Connexion Staging non activée.' },
      { status: 503, headers: privateHeaders() },
    );
  if (!isTrustedMutation(request, config))
    return NextResponse.json(
      { error: 'Origine refusée.' },
      { status: 403, headers: privateHeaders() },
    );
  const { gateway, response } = createRouteAuth(request, config);
  const productionConfig = productionAuthConfiguration(process.env);
  const production = productionConfig
    ? createRouteAuth(request, productionConfig)
    : null;
  const finish = (target: NextResponse) =>
    production
      ? transferAuthCookies(
          production.response,
          transferAuthCookies(response, target),
        )
      : transferAuthCookies(response, target);
  try {
    const results = await Promise.allSettled([
      gateway.signOut(),
      ...(production ? [production.gateway.signOut()] : []),
    ]);
    if (results.some((r) => r.status !== 'fulfilled' || !r.value))
      throw new Error('Logout unavailable');
    return finish(
      NextResponse.redirect(new URL('/login', config.appOrigin), 303),
    );
  } catch {
    return finish(
      NextResponse.json(
        { error: 'Déconnexion indisponible. Réessayez.' },
        { status: 503, headers: privateHeaders() },
      ),
    );
  }
}
