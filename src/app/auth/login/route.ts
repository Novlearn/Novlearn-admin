import { NextResponse, type NextRequest } from 'next/server';
import { loginAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import {
  isTrustedMutation,
  privateHeaders,
  readBoundedForm,
} from '@/lib/auth/http';
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
  if (
    !request.headers
      .get('content-type')
      ?.startsWith('application/x-www-form-urlencoded')
  ) {
    return NextResponse.json(
      { error: 'Format refusé.' },
      { status: 415, headers: privateHeaders() },
    );
  }
  const form = await readBoundedForm(request);
  if (!form)
    return NextResponse.json(
      { error: 'Formulaire invalide ou trop volumineux.' },
      { status: 413, headers: privateHeaders() },
    );
  const { gateway, response } = createRouteAuth(request, config);
  const result = await loginAdmin(
    gateway,
    form.get('email'),
    form.get('password'),
  );
  const destination = result.ok ? '/admin' : `/login?error=${result.reason}`;
  return transferAuthCookies(
    response,
    NextResponse.redirect(new URL(destination, config.appOrigin), 303),
  );
}
