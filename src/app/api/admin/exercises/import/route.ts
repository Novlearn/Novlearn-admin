import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { JsonObject } from 'novlearn-exercise-engine';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { draftEnvelope, isExerciseId, isUuid } from '@/lib/catalogue';
import { isEngineEnabled } from '@/lib/engine-identity';
import { engineFailure, runEngine } from '@/lib/engine-runtime';
import { prepareExerciseReferences } from '@/lib/exercise-references';

export const runtime = 'nodejs';
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config || config.local || !isEngineEnabled(process.env))
    return json({ error: 'Import Staging ou Engine indisponible.' }, 503);
  if (!isTrustedMutation(request, config))
    return json({ error: 'Origine refusée.' }, 403);

  const { gateway, response, client } = createRouteAuth(request, config);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { error: 'Accès Admin Staging requis.' },
      access.reason === 'unavailable'
        ? 503
        : access.reason === 'forbidden'
          ? 403
          : 401,
    );

  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return finish({ error: 'Format JSON requis.' }, 415);

  let input: unknown;
  try {
    input = await readBoundedJson(request);
  } catch {
    return finish({ error: 'JSON invalide ou trop volumineux.' }, 400);
  }
  const item = input as Record<string, unknown> | null;
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item) ||
    Object.keys(item).length !== 3 ||
    !isUuid(item.batchId) ||
    typeof item.sourceKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(item.sourceKey) ||
    !draftEnvelope(item.definition) ||
    !item.definition.catalogue?.chapter
  )
    return finish(
      {
        error: 'Définition canonique, chapitre et identifiants de lot requis.',
      },
      400,
    );

  try {
    const { issue, definition } = await prepareExerciseReferences(
      client,
      item.definition,
    );
    if (issue) return finish({ error: issue }, 422);
    const payload = { definition: definition as unknown as JsonObject };
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(32_000),
    ]);
    const checks = [
      ['validateDefinition', {}],
      ...[0, 1, 42].map(
        (seed) =>
          ['instantiateExercise', { seed, instanceId: randomUUID() }] as const,
      ),
    ] as const;
    for (const [operation, parameters] of checks) {
      const result = await runEngine(
        operation,
        { ...payload, ...parameters },
        signal,
      );
      if (
        result === null ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        typeof result.ok !== 'boolean'
      )
        throw new Error('Engine protocol');
      if (!result.ok)
        return finish(
          {
            error: 'Définition refusée par Engine.',
            operation,
            seed: 'seed' in parameters ? parameters.seed : undefined,
            diagnostics: Array.isArray(result.diagnostics)
              ? result.diagnostics.slice(0, 8)
              : [],
          },
          422,
        );
    }

    const { data, error } = await client.rpc('admin_import_exercise_draft', {
      p_batch_id: item.batchId,
      p_source_key: item.sourceKey,
      p_definition: definition,
    });
    if (error?.code === 'PT409')
      return finish(
        {
          error:
            'Cet élément a déjà été importé avec un autre contenu. Ouvre le brouillon pour le modifier.',
        },
        409,
      );
    if (error?.code === '42501') return finish({ error: 'Accès refusé.' }, 403);
    if (error?.code === '22023')
      return finish(
        { error: 'Brouillon incompatible avec le catalogue Staging.' },
        422,
      );
    if (error?.code === 'PGRST202')
      return finish({ error: 'Contrat d’import absent de Staging.' }, 503);
    if (
      error ||
      !data ||
      !isExerciseId(data.exerciseId) ||
      typeof data.reused !== 'boolean'
    )
      return finish(
        { error: 'Sauvegarde non confirmée. Relance le même lot.' },
        503,
      );
    return finish({
      environment: 'staging',
      exerciseId: data.exerciseId,
      reused: data.reused,
    });
  } catch (error) {
    const failure = engineFailure(error);
    return finish(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}
