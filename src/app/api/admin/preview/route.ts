import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import {
  acquirePreviewJob,
  generatePreview,
  gradePreview,
  inspectPreview,
  testPreview,
  PreviewError,
} from '@/lib/preview-server';
import type { JsonValue } from 'novlearn-exercise-engine';
import type { PreviewCase } from '@/lib/preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const seed = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 0xffffffff;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config || process.env.ADMIN_ENGINE_ENABLED !== 'true')
    return json({ error: 'Aperçu Engine non activé.' }, 503);
  if (!isTrustedMutation(request, config))
    return json({ error: 'Origine refusée.' }, 403);
  const { gateway, response } = createRouteAuth(request, config);
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
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return finish({ error: 'Format JSON requis.' }, 415);
  let input: unknown;
  try {
    input = await readBoundedJson(request);
  } catch {
    return finish({ error: 'Requête invalide ou trop volumineuse.' }, 400);
  }
  if (!object(input) || typeof input.action !== 'string')
    return finish({ error: 'Requête invalide.' }, 400);
  const fields: Record<string, string[]> = {
    generate: ['action', 'definition', 'seed'],
    inspect: ['action', 'previewId'],
    grade: ['action', 'previewId', 'questionId', 'answer'],
    test: ['action', 'definition', 'seeds', 'cases'],
  };
  const allowed = Object.hasOwn(fields, input.action)
    ? fields[input.action]
    : null;
  if (
    !allowed ||
    Object.keys(input).sort().join(',') !== [...allowed].sort().join(',')
  )
    return finish({ error: 'Requête invalide.' }, 400);
  if (
    input.action === 'generate' &&
    (!object(input.definition) || !seed(input.seed))
  )
    return finish({ error: 'Définition ou seed invalide.' }, 400);
  if (
    ['grade', 'inspect'].includes(input.action) &&
    (typeof input.previewId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(input.previewId))
  )
    return finish({ error: 'Référence d’aperçu invalide.' }, 400);
  if (
    input.action === 'grade' &&
    (typeof input.questionId !== 'string' ||
      input.questionId.length > 160 ||
      !object(input.answer))
  )
    return finish({ error: 'Réponse invalide.' }, 400);
  if (
    input.action === 'test' &&
    (!object(input.definition) ||
      !Array.isArray(input.seeds) ||
      !input.seeds.length ||
      input.seeds.length > 5 ||
      !input.seeds.every(seed) ||
      new Set(input.seeds).size !== input.seeds.length ||
      !Array.isArray(input.cases) ||
      input.cases.length > 16 ||
      input.cases.some(
        (c) =>
          !object(c) ||
          Object.keys(c).sort().join(',') !==
            'answer,expectedState,questionId' ||
          typeof c.questionId !== 'string' ||
          c.questionId.length > 160 ||
          !object(c.answer) ||
          !['correct', 'incorrect', 'invalid'].includes(
            String(c.expectedState),
          ),
      ))
  )
    return finish(
      {
        error:
          'Seeds ou cas de test invalides (cinq seeds, seize cas maximum).',
      },
      400,
    );
  let release: (() => void) | undefined;
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(input.action === 'test' ? 120000 : 20000),
    ]);
    release = acquirePreviewJob(access.userId);
    let result: unknown;
    if (input.action === 'generate')
      result = await generatePreview(
        access.userId,
        input.definition,
        input.seed as number,
        signal,
      );
    else if (input.action === 'inspect')
      result = inspectPreview(access.userId, input.previewId as string);
    else if (input.action === 'grade')
      result = await gradePreview(
        access.userId,
        input.previewId as string,
        input.questionId as string,
        input.answer as JsonValue,
        signal,
      );
    else
      result = await testPreview(
        input.definition,
        input.seeds as number[],
        input.cases as PreviewCase[],
        signal,
      );
    return finish({ environment: 'staging', result });
  } catch (error) {
    if (error instanceof PreviewError)
      return finish(
        {
          error: error.message,
          ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
        },
        error.status,
      );
    return finish(
      {
        error:
          'Calcul interrompu ou indisponible. Aucun test positif n’est enregistré.',
      },
      503,
    );
  } finally {
    release?.();
  }
}
