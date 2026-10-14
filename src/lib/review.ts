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
