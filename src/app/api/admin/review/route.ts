import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/authorization';
import { readAuthConfiguration } from '@/lib/auth/config';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { createRouteAuth, transferAuthCookies } from '@/lib/auth/supabase';
import { parseReviewRequest, reviewResult } from '@/lib/review';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  const config = readAuthConfiguration(process.env);
  if (!config || process.env.ADMIN_EDITORIAL_REVIEW_ENABLED !== 'true')
    return json({ error: 'Relecture non activée.' }, 503);
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
  const body = parseReviewRequest(input);
  if (!body)
    return finish({ error: 'Attestation ou transition invalide.' }, 400);
  try {
    const { data, error } = await client.rpc('admin_review_exercise_version', {
      p_version_id: body.versionId,
      p_expected_fingerprint: body.fingerprint,
      p_expected_epoch: body.epoch,
      p_expected_status: body.expectedStatus,
      p_action: body.action,
      p_receipt_id: body.receiptId,
      p_checklist: body.checklist,
      p_comment: body.comment,
    });
    if (error)
      return finish(
        {
          error:
            error.code === '40001' || error.code === 'PT409'
              ? 'La révision ou son état a changé. Rechargez avant de réessayer.'
              : error.code === '22023'
                ? 'La relecture est bloquée : vérifiez les tests multi-seeds, la couverture, les références et l’attestation.'
                : 'Relecture indisponible.',
        },
        error.code === '40001' || error.code === 'PT409'
          ? 409
          : error.code === '22023'
            ? 400
            : error.code === '42501'
              ? 403
              : 503,
      );
    const result =
      data &&
      reviewResult(
        {
          reviewId: data.reviewId,
          versionId: data.versionId,
          status: data.status,
          fingerprint: data.fingerprint,
          epoch: data.epoch,
        },
        body,
      );
    if (!result)
      return finish({ error: 'Résultat de relecture non confirmé.' }, 503);
    return finish({ environment: 'staging', result });
  } catch {
    return finish({ error: 'Relecture indisponible.' }, 503);
  }
}
