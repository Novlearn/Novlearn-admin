import { expect, it } from 'vitest';
import { parseReviewRequest, reviewChecklistLabels } from '@/lib/review';
const request = {
  versionId: '10000000-0000-4000-8000-000000000001',
  fingerprint: 'a'.repeat(64),
  epoch: 0,
  expectedStatus: 'in_review',
  action: 'approve',
  receiptId: '20000000-0000-4000-8000-000000000001',
  checklist: Object.fromEntries(
    Object.keys(reviewChecklistLabels).map((k) => [k, true]),
  ),
  comment: 'Relecture locale',
};
it('exige une attestation complète et exacte pour cette révision', () => {
  expect(parseReviewRequest(request)).toEqual(request);
  expect(parseReviewRequest({ ...request, checklist: {} })).toBeNull();
  expect(
    parseReviewRequest({
      ...request,
      checklist: { ...request.checklist, statementClear: false },
    }),
  ).toBeNull();
  expect(parseReviewRequest({ ...request, actorId: 'forged' })).toBeNull();
  expect(
    parseReviewRequest({ ...request, environment: 'production' }),
  ).toBeNull();
});
it('ne confond pas demande de relecture, approbation et retour à corriger', () => {
  expect(
    parseReviewRequest({
      ...request,
      action: 'request_review',
      expectedStatus: 'draft',
      checklist: {},
    }),
  ).not.toBeNull();
  expect(
    parseReviewRequest({
      ...request,
      action: 'request_review',
      expectedStatus: 'approved',
      checklist: {},
    }),
  ).toBeNull();
  expect(
    parseReviewRequest({
      ...request,
      action: 'return_to_draft',
      receiptId: null,
      checklist: {},
      comment: 'Correction requise',
    }),
  ).not.toBeNull();
  expect(
    parseReviewRequest({
      ...request,
      action: 'return_to_draft',
      receiptId: null,
      checklist: {},
      comment: ' ',
    }),
  ).toBeNull();
});
it('refuse états publiés, préconditions invalides et commentaire hors limites', () => {
  for (const extra of [
    { epoch: -1 },
    { epoch: 0.5 },
    { fingerprint: 'bad' },
    { expectedStatus: 'published' },
    { receiptId: null },
    { comment: 'x'.repeat(2001) },
  ])
    expect(parseReviewRequest({ ...request, ...extra })).toBeNull();
});
