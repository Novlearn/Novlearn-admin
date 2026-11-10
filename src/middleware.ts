import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { productionAuthConfiguration } from '@/lib/production-api-config';

export async function middleware(request: NextRequest) {
  const config = readAuthConfiguration(process.env);
  if (!config) return NextResponse.next({ headers: privateHeaders() });
  let response = NextResponse.next({ headers: privateHeaders() });
  // API handlers refresh their primary session themselves. Page components
  // need refreshed cookies forwarded by middleware for both project namespaces.
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    const primary = createRouteAuth(request, config);
    try {
      await primary.gateway.getVerifiedUser();
    } catch {
      /* Denied by the page. */
    }
    response = transferAuthCookies(primary.response, response);
  }
  const productionConfig = productionAuthConfiguration(process.env);
  if (productionConfig) {
    const production = createRouteAuth(request, productionConfig);
    try {
      await production.gateway.getVerifiedUser();
    } catch {
      /* Denied by the data service. */
    }
    response = transferAuthCookies(production.response, response);
  }
  // Forward the request after refresh so Server Components see the new cookies.
  return transferAuthCookies(response, NextResponse.next({ request }));
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/login', '/access-denied'],
};
