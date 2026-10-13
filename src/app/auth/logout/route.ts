import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';

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
  try {
    if (!(await gateway.signOut())) throw new Error('Logout unavailable');
    return transferAuthCookies(
      response,
      NextResponse.redirect(new URL('/login', config.appOrigin), 303),
    );
  } catch {
    return transferAuthCookies(
      response,
      NextResponse.json(
        { error: 'Déconnexion indisponible. Réessayez.' },
        { status: 503, headers: privateHeaders() },
      ),
    );
  }
}
