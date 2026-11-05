import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { isEngineEnabled } from '@/lib/engine-identity';
import { engineFailure } from '@/lib/engine-runtime';
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
import { isUuid, isFingerprint } from '@/lib/catalogue';
import { DatabasePreviewStore } from '@/lib/preview-database-store';
import {
  readTestSigningConfiguration,
  signTestReceipt,
} from '@/lib/test-receipt';

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
  if (!config || !isEngineEnabled(process.env))
    return json({ error: 'Aperçu Engine non activé.' }, 503);
  if (!isTrustedMutation(request, config))
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
    test_saved: [
      'action',
      'versionId',
      'fingerprint',
      'epoch',
      'seeds',
      'cases',
    ],
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
    ['test', 'test_saved'].includes(input.action) &&
    ((input.action === 'test' && !object(input.definition)) ||
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
  if (
    input.action === 'test_saved' &&
    (!isUuid(input.versionId) ||
      !isFingerprint(input.fingerprint) ||
      typeof input.epoch !== 'number' ||
      !Number.isSafeInteger(input.epoch) ||
      input.epoch < 0)
  )
    return finish({ error: 'Révision ou état de test invalide.' }, 400);
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(
        ['test', 'test_saved'].includes(input.action) ? 120000 : 20000,
      ),
    ]);
    release = acquirePreviewJob(access.userId);
    const repository =
      process.env.VERCEL === '1'
        ? new DatabasePreviewStore(client, signal)
        : undefined;
    let result: unknown;
    if (input.action === 'generate')
      result = await generatePreview(
        access.userId,
        input.definition,
        input.seed as number,
        signal,
        repository,
      );
    else if (input.action === 'inspect')
      result = await inspectPreview(
        access.userId,
        input.previewId as string,
        repository,
      );
    else if (input.action === 'grade')
      result = await gradePreview(
        access.userId,
        input.previewId as string,
        input.questionId as string,
        input.answer as JsonValue,
        signal,
        repository,
      );
    else if (input.action === 'test_saved') {
      const signing = readTestSigningConfiguration(process.env);
      if (!signing)
        return finish(
          { error: 'La signature serveur des rapports n’est pas configurée.' },
          503,
        );
      const { data: version, error: loadError } = await client
        .from('exercise_versions')
        .select('id,definition,approval_fingerprint_sha256,test_epoch')
        .eq('id', input.versionId)
        .maybeSingle();
      if (loadError) return finish({ error: 'Révision indisponible.' }, 503);
      if (!version) return finish({ error: 'Révision introuvable.' }, 404);
      if (
        version.approval_fingerprint_sha256 !== input.fingerprint ||
        version.test_epoch !== input.epoch
      )
        return finish(
          { error: 'La révision a changé. Rechargez avant de tester.' },
          409,
        );
      if (Buffer.byteLength(JSON.stringify(version.definition)) > 262144)
        return finish(
          { error: 'Définition trop volumineuse pour ce banc.' },
          413,
        );
      const report = await testPreview(
        version.definition,
        input.seeds as number[],
        input.cases as PreviewCase[],
        signal,
      );
      signal.throwIfAborted();
      const fresh = await authorizeAdmin(gateway);
      if (!fresh.allowed || fresh.userId !== access.userId)
        return finish({ error: 'Accès révoqué pendant les tests.' }, 403);
      signal.throwIfAborted();
      const receipt = signTestReceipt(signing, {
        actorId: access.userId,
        versionId: version.id,
        fingerprint: input.fingerprint as string,
        epoch: input.epoch as number,
        report,
        cases: input.cases as PreviewCase[],
      });
      const { data: record, error: recordError } = await client.rpc(
        'admin_record_exercise_test',
        { p_payload: receipt.payload, p_signature: receipt.signature },
      );
      if (recordError)
        return finish(
          {
            error:
              recordError.code === '40001' || recordError.code === 'PT409'
                ? 'La révision a changé pendant les tests. Le rapport n’est pas enregistré.'
                : 'Rapport non enregistré. Vérifiez la configuration de signature.',
          },
          recordError.code === '40001' || recordError.code === 'PT409'
            ? 409
            : 503,
        );
      if (
        !record ||
        record.recorded !== true ||
        record.passed !== report.passed
      )
        return finish(
          { error: 'Enregistrement du rapport non confirmé.' },
          503,
        );
      result = { receiptId: record.receiptId, report };
    } else
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
    const failure = engineFailure(error);
    return finish(
      {
        code: failure.code,
        error: `${failure.message} Aucun test positif n'est enregistré.`,
      },
      failure.status,
    );
  } finally {
    release?.();
  }
}
