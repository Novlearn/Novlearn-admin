import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { readActivityConfiguration } from '@/lib/activity-config';
import { readStatisticsPeriod } from '@/lib/activity-statistics';
import { loadActivityStatistics } from '@/lib/activity-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const auth = readAuthConfiguration(process.env);
  if (!auth) return json({ error: 'Accès Staging non activé.' }, 503);
  const { gateway, response } = createRouteAuth(request, auth);
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
  if (!readActivityConfiguration(process.env))
    return finish({ error: 'Lecture statistique non configurée.' }, 503);
  const filter = readStatisticsPeriod(request.nextUrl.searchParams);
  if (!filter.ok) return finish({ error: filter.error }, 400);
  try {
    return finish(await loadActivityStatistics(filter.period));
  } catch {
    return finish({ error: 'Statistiques indisponibles' }, 503);
  }
}
