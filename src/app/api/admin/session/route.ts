import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';

export async function GET(request: NextRequest) {
  const config = readAuthConfiguration(process.env);
  if (!config)
    return NextResponse.json(
      { error: 'Accès Staging non activé.' },
      { status: 503, headers: privateHeaders() },
    );
  const { gateway, response } = createRouteAuth(request, config);
  const access = await authorizeAdmin(gateway);
  const result = access.allowed
    ? NextResponse.json(
        { environment: 'staging', role: 'admin' },
        { headers: privateHeaders() },
      )
    : NextResponse.json(
        { error: 'Accès refusé.' },
        {
          status:
            access.reason === 'unauthenticated'
              ? 401
              : access.reason === 'forbidden'
                ? 403
                : 503,
          headers: privateHeaders(),
        },
      );
  return transferAuthCookies(response, result);
}
