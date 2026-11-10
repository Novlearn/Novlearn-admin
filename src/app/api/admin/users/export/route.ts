import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfiguration } from '@/lib/auth/config';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { privateHeaders } from '@/lib/auth/http';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { readUsersConfiguration } from '@/lib/users-config';
import { readUsersQuery } from '@/lib/users';
import { loadAllUsersByName } from '@/lib/users-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const csvCell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export async function GET(request: NextRequest) {
  const headers = {
    ...privateHeaders(),
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="novlearn-utilisateurs.csv"',
    'cache-control': 'private, no-store',
  };
  const response = (body: string, status = 200) =>
    new NextResponse(body, { status, headers });
  const auth = readAuthConfiguration(process.env);
  if (!auth) return response('Accès Staging non activé.', 503);
  const { gateway, response: authResponse } = createRouteAuth(request, auth);
  const finish = (body: string, status = 200) =>
    transferAuthCookies(authResponse, response(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      'Accès refusé.',
      access.reason === 'unauthenticated'
        ? 401
        : access.reason === 'forbidden'
          ? 403
          : 503,
    );
  if (!readUsersConfiguration(process.env))
    return finish('Consultation des utilisateurs non configurée.', 503);
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (params.has('after') || params.has('before'))
    return finish('Export indisponible.', 400);
  const parsed = readUsersQuery(params);
  if (!parsed.ok) return finish(parsed.error, 400);
  try {
    const { users } = await loadAllUsersByName(parsed.value);
    const rows = [
      [
        'Nom',
        'E-mail',
        `Dernière activité (${parsed.value.period.from} au ${parsed.value.period.to} UTC)`,
      ],
      ...users.map((user) => [
        user.name,
        user.email ?? '',
        user.lastActivity ?? '',
      ]),
    ];
    const csv =
      '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    return transferAuthCookies(
      authResponse,
      new NextResponse(csv, {
        headers: {
          ...headers,
        },
      }),
    );
  } catch {
    return finish('Export des utilisateurs indisponible.', 503);
  }
}
