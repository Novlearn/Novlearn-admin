import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';

export async function middleware(request: NextRequest) {
  const config = readAuthConfiguration(process.env);
  if (!config) return NextResponse.next({ headers: privateHeaders() });
  const { gateway, response } = createRouteAuth(request, config);
  try {
    await gateway.getVerifiedUser();
  } catch {
    /* Routes/pages still deny unavailable Auth. */
  }
  // Forward the request after refresh so Server Components see the new cookies.
  return transferAuthCookies(response, NextResponse.next({ request }));
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/access-denied'],
};
