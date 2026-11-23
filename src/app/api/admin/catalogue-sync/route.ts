import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { isUuid, isFingerprint } from '@/lib/catalogue';
import {
  catalogueSyncCandidate,
  type CatalogueSyncCandidate,
} from '@/lib/catalogue-sync';
import { readCatalogueSyncConfiguration } from '@/lib/catalogue-sync-config';
import {
  CatalogueSyncError,
  CatalogueSyncService,
} from '@/lib/catalogue-sync-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type RequestBody =
  | { action: 'prepare'; batchId: string; items: CatalogueSyncCandidate[] }
  | { action: 'confirm' | 'recover'; batchId: string; payloadDigest: string };

function parse(value: unknown): RequestBody | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    v.action === 'prepare' &&
    Object.keys(v).sort().join(',') === 'action,batchId,items' &&
    isUuid(v.batchId) &&
    Array.isArray(v.items) &&
    v.items.length > 0 &&
    v.items.length <= 100 &&
    v.items.every(catalogueSyncCandidate)
  )
    return v as RequestBody;
  if (
    ['confirm', 'recover'].includes(String(v.action)) &&
    Object.keys(v).sort().join(',') === 'action,batchId,payloadDigest' &&
    isUuid(v.batchId) &&
    isFingerprint(v.payloadDigest)
  )
    return v as RequestBody;
  return null;
}

export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const authConfig = readAuthConfiguration(process.env),
    config = readCatalogueSyncConfiguration(process.env);
  if (!authConfig || !config)
    return json(
      {
        code: 'unavailable',
        error: 'Configuration serveur de synchronisation indisponible.',
      },
      503,
    );
  const { gateway, client, response } = createRouteAuth(request, authConfig);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { code: 'forbidden', error: 'Accès refusé.' },
      access.reason === 'unauthenticated' ? 401 : 403,
    );
  const after = request.nextUrl.searchParams.get('after') ?? '';
  const service = new CatalogueSyncService(gateway, client, config);
  try {
    if (!(await service.targetReady()))
      return finish(
        {
          code: 'disabled',
          error:
            'La capacité SQL de synchronisation n’est pas installée sur la cible.',
        },
        503,
      );
    return finish({ result: await service.list(after, 100) });
  } catch (failure) {
    const code =
      failure instanceof CatalogueSyncError ? failure.code : 'unavailable';
    return finish(
      {
        code,
        error:
          code === 'forbidden'
            ? 'Accès refusé.'
            : 'Lecture du catalogue indisponible.',
      },
      code === 'forbidden' ? 403 : 503,
    );
  } finally {
    await service.close().catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const authConfig = readAuthConfiguration(process.env),
    config = readCatalogueSyncConfiguration(process.env);
  if (!authConfig || !config)
    return json(
      {
        code: 'unavailable',
        error: 'Configuration serveur de synchronisation indisponible.',
      },
      503,
    );
  if (!isTrustedMutation(request, authConfig))
    return json({ code: 'forbidden', error: 'Origine refusée.' }, 403);
  const { gateway, client, response } = createRouteAuth(request, authConfig);
  const finish = (body: unknown, status = 200) =>
    transferAuthCookies(response, json(body, status));
  const access = await authorizeAdmin(gateway);
  if (!access.allowed)
    return finish(
      { code: 'forbidden', error: 'Accès refusé.' },
      access.reason === 'unauthenticated' ? 401 : 403,
    );
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return finish({ code: 'invalid', error: 'Format JSON requis.' }, 415);
  let input: RequestBody | null;
  try {
    input = parse(await readBoundedJson(request, 65536));
  } catch {
    return finish(
      { code: 'invalid', error: 'Requête invalide ou trop volumineuse.' },
      400,
    );
  }
  if (!input)
    return finish(
      { code: 'invalid', error: 'Requête de synchronisation invalide.' },
      400,
    );
  const service = new CatalogueSyncService(gateway, client, config);
  try {
    if (!(await service.targetReady()))
      return finish(
        {
          code: 'disabled',
          error:
            'La capacité SQL de synchronisation n’est pas installée sur la cible.',
        },
        503,
      );
    if (input.action === 'prepare') {
      const result = await service.prepare(input.batchId, input.items);
      return finish({
        sourceEnvironment: config.localFixture ? 'local-source' : 'staging',
        result,
      });
    }
    const result =
      input.action === 'confirm'
        ? await service.confirm(input.batchId, input.payloadDigest)
        : await service.recover(
            access.userId,
            input.batchId,
            input.payloadDigest,
          );
    return finish(
      {
        sourceEnvironment: config.localFixture ? 'local-source' : 'staging',
        result,
      },
      result.state === 'uncertain' ? 202 : 200,
    );
  } catch (failure) {
    if (failure instanceof CatalogueSyncError) {
      const errors: Record<CatalogueSyncError['code'], [number, string]> = {
        disabled: [
          503,
          'La capacité SQL de synchronisation n’est pas disponible.',
        ],
        forbidden: [403, 'Accès refusé.'],
        invalid: [400, 'Requête de synchronisation invalide.'],
        conflict: [
          409,
          failure.sqlState === '40001'
            ? 'État périmé (40001). Vérifiez le résultat, puis préparez un nouveau lot à partir du catalogue courant.'
            : 'Le lot a changé; rechargez la liste avant de le préparer.',
        ],
        blocked: [
          409,
          failure.sqlState === '23503'
            ? 'Renommage bloqué (23503). Le lot doit inclure chaque flashcard active concernée et chaque exercice concerné avec une nouvelle révision.'
            : 'Une dépendance du catalogue est absente, ambiguë ou non prête.',
        ],
        uncertain: [
          202,
          'Résultat incertain. Vérifiez le lot avant toute nouvelle tentative.',
        ],
        unavailable: [
          503,
          'Synchronisation indisponible. Aucun succès n’est déduit.',
        ],
      };
      const [status, message] = errors[failure.code];
      return finish({ code: failure.code, error: message }, status);
    }
    const code =
      failure &&
      typeof failure === 'object' &&
      'code' in failure &&
      typeof failure.code === 'string'
        ? failure.code
        : null;
    if (code === '23503')
      return finish(
        {
          code: 'blocked',
          error:
            'Renommage bloqué (23503). Le lot doit inclure chaque flashcard active concernée et chaque exercice concerné avec une nouvelle révision.',
        },
        409,
      );
    if (code === '40001')
      return finish(
        {
          code: 'conflict',
          error:
            'État périmé (40001). Vérifiez le résultat, puis préparez un nouveau lot à partir du catalogue courant.',
        },
        409,
      );
    return finish(
      {
        code: 'unavailable',
        error: 'Synchronisation indisponible. Aucun succès n’est déduit.',
      },
      503,
    );
  } finally {
    await service.close().catch(() => undefined);
  }
}
