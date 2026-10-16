import { isUuid, isFingerprint } from './catalogue';
export const reviewChecklistLabels = {
  mathematicsCorrect:
    'J’ai vérifié la validité mathématique de cette révision.',
  statementClear: 'J’ai relu son énoncé, ses indications et ses explications.',
  gradingChecked:
    'J’ai contrôlé ses attendus, politiques et résultats de correction.',
  referencesChecked: 'J’ai vérifié son chapitre et ses compétences.',
};
export type ReviewAction = 'request_review' | 'approve' | 'return_to_draft';
export type ReviewRequest = {
  versionId: string;
  fingerprint: string;
  epoch: number;
  expectedStatus: 'draft' | 'in_review' | 'approved';
  action: ReviewAction;
  receiptId: string | null;
  checklist: Partial<Record<keyof typeof reviewChecklistLabels, boolean>>;
  comment: string;
};
export function parseReviewRequest(value: unknown): ReviewRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (
    Object.keys(b).sort().join(',') !==
      'action,checklist,comment,epoch,expectedStatus,fingerprint,receiptId,versionId' ||
    !isUuid(b.versionId) ||
    !isFingerprint(b.fingerprint) ||
    typeof b.epoch !== 'number' ||
    !Number.isSafeInteger(b.epoch) ||
    b.epoch < 0 ||
    !['draft', 'in_review', 'approved'].includes(String(b.expectedStatus)) ||
    !['request_review', 'approve', 'return_to_draft'].includes(
      String(b.action),
    ) ||
    typeof b.comment !== 'string' ||
    b.comment.length > 2000 ||
    !b.checklist ||
    typeof b.checklist !== 'object' ||
    Array.isArray(b.checklist)
  )
    return null;
  const keys = Object.keys(b.checklist),
    list = b.checklist as Record<string, unknown>;
  if (b.action === 'approve') {
    if (
      !isUuid(b.receiptId) ||
      keys.sort().join(',') !==
        Object.keys(reviewChecklistLabels).sort().join(',') ||
      keys.some((k) => list[k] !== true)
    )
      return null;
  } else if (
    keys.length ||
    (b.action === 'return_to_draft'
      ? b.receiptId !== null || !b.comment.trim()
      : !isUuid(b.receiptId))
  )
    return null;
  if (
    (b.action === 'request_review' && b.expectedStatus !== 'draft') ||
    (b.action === 'approve' && b.expectedStatus !== 'in_review') ||
    (b.action === 'return_to_draft' &&
      !['in_review', 'approved'].includes(String(b.expectedStatus)))
  )
    return null;
  return b as ReviewRequest;
}

export type ReviewContext = {
  versionId: string;
  fingerprint: string;
  epoch: number;
  status: string;
  receiptId: string | null;
  enabled: boolean;
  archived?: boolean;
};
export const reviewContextKey = (value: ReviewContext) =>
  JSON.stringify([
    value.versionId,
    value.fingerprint,
    value.epoch,
    value.status,
    value.receiptId,
    value.enabled,
    value.archived === true,
  ]);
export function reviewIntent(
  action: ReviewAction,
  context: ReviewContext,
  checklist: Record<string, boolean>,
  comment: string,
): ReviewRequest | null {
  if (!context.enabled || context.archived) return null;
  return parseReviewRequest({
    versionId: context.versionId,
    fingerprint: context.fingerprint,
    epoch: context.epoch,
    expectedStatus: context.status,
    action,
    receiptId: action === 'return_to_draft' ? null : context.receiptId,
    checklist: action === 'approve' ? { ...checklist } : {},
    comment,
  });
}
export type ReviewResult = {
  reviewId: string;
  versionId: string;
  fingerprint: string;
  epoch: number;
  status: 'draft' | 'in_review' | 'approved';
};
export function reviewResult(
  value: unknown,
  input: ReviewRequest,
): ReviewResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const status =
    input.action === 'approve'
      ? 'approved'
      : input.action === 'request_review'
        ? 'in_review'
        : 'draft';
  if (
    Object.keys(r).sort().join(',') !==
      'epoch,fingerprint,reviewId,status,versionId' ||
    !isUuid(r.reviewId) ||
    r.versionId !== input.versionId ||
    r.fingerprint !== input.fingerprint ||
    r.epoch !== input.epoch ||
    r.status !== status
  )
    return null;
  return {
    reviewId: r.reviewId,
    versionId: input.versionId,
    fingerprint: input.fingerprint,
    epoch: input.epoch,
    status,
  };
}
export class ReviewRequestError extends Error {
  constructor(
    message: string,
    readonly needsReload = true,
  ) {
    super(message);
  }
}
/** One explicit confirmation, one POST; an unknown result is never retried. */
export async function requestReview(
  input: ReviewRequest,
  signal?: AbortSignal,
): Promise<ReviewResult> {
  if (!parseReviewRequest(input))
    throw new ReviewRequestError('Attestation ou transition invalide.', false);
  let response: Response;
  try {
    response = await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      body: JSON.stringify(input),
      signal,
    });
  } catch {
    throw new ReviewRequestError(
      'Réponse non reçue. Rechargez la fiche pour vérifier son état avant de réessayer.',
    );
  }
  let packet: unknown;
  try {
    packet = await response.json();
  } catch {
    throw new ReviewRequestError(
      'Résultat non reconnu. Rechargez la fiche avant de réessayer.',
    );
  }
  if (!response.ok) {
    const message =
      packet &&
      typeof packet === 'object' &&
      'error' in packet &&
      typeof packet.error === 'string'
        ? packet.error.slice(0, 500)
        : 'Relecture indisponible.';
    throw new ReviewRequestError(
      message,
      response.status !== 400 && response.status !== 415,
    );
  }
  if (
    !packet ||
    typeof packet !== 'object' ||
    Array.isArray(packet) ||
    Object.keys(packet).sort().join(',') !== 'environment,result' ||
    !('environment' in packet) ||
    packet.environment !== 'staging' ||
    !('result' in packet)
  )
    throw new ReviewRequestError(
      'Environnement ou résultat de relecture non confirmé.',
    );
  const result = reviewResult(packet.result, input);
  if (!result)
    throw new ReviewRequestError(
      'Le résultat ne correspond pas à la révision relue. Rechargez sa fiche.',
    );
  return result;
}
