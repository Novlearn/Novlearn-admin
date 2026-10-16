import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import {
  catalogueFilter,
  draftEnvelope,
  isExerciseId,
  isFingerprint,
  isUuid,
  PAGE_SIZE,
} from '@/lib/catalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, mutation: boolean) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config) return json({ error: 'Accès Staging non activé.' }, 503);
  if (mutation && !isTrustedMutation(request, config))
    return json({ error: 'Origine refusée.' }, 403);
  const { gateway, response, client } = createRouteAuth(request, config);
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
  try {
    if (!mutation) {
      const filter = catalogueFilter(request.nextUrl.searchParams);
      const { data, error } = await client.rpc('admin_list_exercises', {
        p_query: filter.query,
        p_status: filter.status,
        p_sort: filter.sort,
        p_offset: (filter.page - 1) * PAGE_SIZE,
        p_limit: PAGE_SIZE,
      });
      if (error) return finish({ error: 'Catalogue indisponible.' }, 503);
      return finish({ environment: 'staging', ...data });
    }
    if (
      request.headers.get('content-type')?.split(';')[0].trim() !==
      'application/json'
    )
      return finish({ error: 'Format JSON requis.' }, 415);
    let payload: unknown;
    try {
      payload = await readBoundedJson(request);
    } catch {
      return finish({ error: 'Requête invalide ou trop volumineuse.' }, 400);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return finish({ error: 'Requête invalide.' }, 400);
    const body = payload as Record<string, unknown>;
    let name: string;
    let args: Record<string, unknown>;
    if (body.action === 'save') {
      if (
        !draftEnvelope(body.definition) ||
        (body.exerciseId !== null && !isExerciseId(body.exerciseId)) ||
        (body.versionId !== null && !isUuid(body.versionId)) ||
        (body.fingerprint !== null && !isFingerprint(body.fingerprint)) ||
        Object.keys(body).some(
          (key) =>
            ![
              'action',
              'exerciseId',
              'versionId',
              'fingerprint',
              'definition',
            ].includes(key),
        )
      )
        return finish({ error: 'Brouillon invalide.' }, 400);
      name = 'admin_save_exercise_draft';
      args = {
        p_exercise_id: body.exerciseId,
        p_version_id: body.versionId,
        p_expected_fingerprint: body.fingerprint,
        p_definition: body.definition,
      };
    } else if (
      body.action === 'duplicate' &&
      isUuid(body.versionId) &&
      Object.keys(body).every((key) => ['action', 'versionId'].includes(key))
    ) {
      name = 'admin_duplicate_exercise';
      args = { p_version_id: body.versionId };
    } else if (
      body.action === 'archive' &&
      isExerciseId(body.exerciseId) &&
      typeof body.archived === 'boolean' &&
      typeof body.expectedArchived === 'boolean' &&
      Object.keys(body).every((key) =>
        ['action', 'exerciseId', 'archived', 'expectedArchived'].includes(key),
      )
    ) {
      name = 'admin_archive_exercise';
      args = {
        p_exercise_id: body.exerciseId,
        p_expected_archived: body.expectedArchived,
        p_archived: body.archived,
      };
    } else return finish({ error: 'Action invalide.' }, 400);
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const status =
        error.code === '40001' || error.code === 'PT409'
          ? 409
          : error.code === 'P0002'
            ? 404
            : error.code === '42501'
              ? 403
              : error.code === '22023'
                ? 400
                : 503;
      return finish(
        {
          error:
            status === 409
              ? 'Le contenu a changé. Rechargez avant de réessayer.'
              : status === 404
                ? 'Exercice ou version introuvable.'
                : status === 400
                  ? 'Brouillon incompatible ou action impossible.'
                  : 'Opération indisponible.',
        },
        status,
      );
    }
    return finish({ environment: 'staging', result: data });
  } catch {
    return finish({ error: 'Opération indisponible.' }, 503);
  }
}
export async function GET(request: NextRequest) {
  return handle(request, false);
}
export async function POST(request: NextRequest) {
  return handle(request, true);
}
