import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { isUuid } from '@/lib/catalogue';
import {
  createPublicationPgPools,
  readPublicationPgConfiguration,
} from '@/lib/publication-pg';
import { PublicationJournal } from '@/lib/publication-journal-server';
import {
  PublicationService,
  PublicationServiceError,
  readPublicationConfirmationKey,
} from '@/lib/publication-service';
import {
  isPublicationSelection,
  loadPublicationSource,
  type PublicationSelection,
} from '@/lib/publication-source';
import { PublicationTarget } from '@/lib/publication-target';
import { verifyPublicationEngine } from '@/lib/publication-verification';
import type { PublicationMode } from '@/lib/publication';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type PublicationRequest =
  | ({
      action: 'prepare';
      mode: PublicationMode;
      batchId: string;
    } & PublicationSelection)
  | { action: 'confirm'; operationId: string; confirmation: string }
  | { action: 'cancel' | 'recover'; operationId: string };
function parse(value: unknown): PublicationRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.action !== 'string') return null;
  if (input.action === 'prepare') {
    const { action, mode, batchId, ...selection } = input;
    return action === 'prepare' &&
      typeof mode === 'string' &&
      ['publish', 'rollback'].includes(mode) &&
      isUuid(batchId) &&
      isPublicationSelection(selection)
      ? (input as PublicationRequest)
      : null;
  }
  if (!isUuid(input.operationId)) return null;
  const keys = Object.keys(input).sort().join(',');
  if (
    input.action === 'confirm' &&
    keys === 'action,confirmation,operationId' &&
    typeof input.confirmation === 'string' &&
    input.confirmation.length > 0 &&
    input.confirmation.length <= 4096
  )
    return input as PublicationRequest;
  if (
    ['cancel', 'recover'].includes(input.action) &&
    keys === 'action,operationId'
  )
    return input as PublicationRequest;
  return null;
}
/** Closed by default. Only server-read source, configured target and an owned
 * persisted plan are accepted; never a definition, report or endpoint from UI. */
export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const authConfig = readAuthConfiguration(process.env),
    pgConfig = readPublicationPgConfiguration(process.env),
    key = readPublicationConfirmationKey(process.env, pgConfig?.localFixture);
  if (
    !authConfig ||
    !pgConfig ||
    !key ||
    process.env.ADMIN_ENGINE_ENABLED !== 'true'
  )
    return json({ error: 'Publication non activée.' }, 503);
  if (!isTrustedMutation(request, authConfig))
    return json({ error: 'Origine refusée.' }, 403);
  const { gateway, client, response } = createRouteAuth(request, authConfig);
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
  let input: PublicationRequest | null;
  try {
    input = parse(await readBoundedJson(request, 8192));
  } catch {
    return finish({ error: 'Requête invalide ou trop volumineuse.' }, 400);
  }
  if (!input) return finish({ error: 'Requête de publication invalide.' }, 400);
  let pools: ReturnType<typeof createPublicationPgPools> | undefined;
  try {
    request.signal.throwIfAborted();
    pools = createPublicationPgPools(pgConfig);
    const service = new PublicationService({
      auth: gateway,
      journal: new PublicationJournal(gateway, pools.source),
      target: new PublicationTarget(pools.target, pgConfig.targetKey),
      targetKey: pgConfig.targetKey,
      confirmationKey: key,
      source: (selection, signal) =>
        loadPublicationSource(client, selection, signal),
      verify: verifyPublicationEngine,
    });
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(120000),
    ]);
    const result =
      input.action === 'prepare'
        ? await service.prepare(
            {
              versionId: input.versionId,
              fingerprint: input.fingerprint,
              epoch: input.epoch,
              mode: input.mode,
              batchId: input.batchId,
            },
            signal,
          )
        : input.action === 'confirm'
          ? await service.confirm(input.operationId, input.confirmation, signal)
          : input.action === 'cancel'
            ? await service.cancel(input.operationId, signal)
            : await service.recover(input.operationId, signal);
    return finish(
      {
        sourceEnvironment: pgConfig.localFixture ? 'local-source' : 'staging',
        targetEnvironment: pgConfig.localFixture
          ? 'local-target'
          : 'production',
        result,
      },
      'state' in result && result.state === 'uncertain' ? 202 : 200,
    );
  } catch (error) {
    if (error instanceof PublicationServiceError) {
      const failures = {
        invalid: [400, 'Requête de publication invalide.'],
        forbidden: [403, 'Accès refusé.'],
        missing: [404, 'Opération ou révision introuvable.'],
        conflict: [
          409,
          'Ce transfert est incompatible avec la révision, le mode choisi ou l’état actuel des données. Vérifiez-les avant de préparer un nouveau diff.',
        ],
        busy: [429, 'Un calcul est déjà en cours. Réessayez après sa fin.'],
        verification: [
          422,
          'Les nouveaux tests Engine ne permettent pas la publication.',
        ],
        recovery_required: [
          409,
          'Le résultat doit être vérifié avant toute nouvelle tentative.',
        ],
        unavailable: [503, 'Publication indisponible.'],
      } as const;
      const [status, message] = failures[error.code];
      return finish({ code: error.code, error: message }, status);
    }
    if (
      error instanceof Error &&
      ['AbortError', 'TimeoutError'].includes(error.name)
    )
      return finish(
        {
          error:
            'Vérification interrompue. Consultez le résultat avant de réessayer.',
        },
        error.name === 'TimeoutError' ? 504 : 499,
      );
    return finish({ error: 'Publication indisponible.' }, 503);
  } finally {
    // Cleanup failure cannot erase an already verified, durably recorded fact.
    await pools?.close().catch(() => undefined);
  }
}
