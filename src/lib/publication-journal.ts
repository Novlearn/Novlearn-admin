import { isExerciseId, isFingerprint, isUuid } from './catalogue';
import {
  parsePublicationPayload,
  parsePublicationInspection,
  planPublication,
  type PublicationPayload,
  type PublicationInspection,
  type PublicationMode,
} from './publication';
export const publicationStates = [
  'planned',
  'executing',
  'uncertain',
  'committed',
  'failed',
  'cancelled',
] as const;
export type PublicationState = (typeof publicationStates)[number];
export type PublicationOutcome = {
  catalogId: string;
  revision: number;
  businessDigest: string;
  exerciseId: string;
  versionId: string;
  stateToken: string;
  result: 'published' | 'rolled_back' | 'unchanged';
};
export type PublicationOperation = {
  id: string;
  batch_id: string;
  actor_id: string;
  version_id: string;
  target_key: string;
  mode: PublicationMode;
  source_fingerprint: string;
  source_epoch: string;
  plan_digest: string;
  state: PublicationState;
  created_at: string;
  expires_at: string;
  updated_at: string;
  payload: PublicationPayload;
  inspection: PublicationInspection;
  source_snapshot: Record<string, unknown>;
  outcome: PublicationOutcome | null;
  error_code: 'validation' | 'target_rejected' | 'not_applied' | null;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 48 && Number.isFinite(Date.parse(v));
export const publicationEpoch = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(v) &&
  BigInt(v) <= BigInt('9223372036854775807');
export const publicationTargetKey = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(v);
export function publicationOutcome(
  value: unknown,
  payload: PublicationPayload,
  mode: PublicationMode,
): PublicationOutcome | null {
  if (
    !object(value) ||
    Object.keys(value).sort().join(',') !==
      [
        'catalogId',
        'revision',
        'businessDigest',
        'exerciseId',
        'versionId',
        'stateToken',
        'result',
      ]
        .sort()
        .join(',') ||
    value.catalogId !== payload.catalogId ||
    value.revision !== payload.revision ||
    value.businessDigest !== payload.businessDigest ||
    !isExerciseId(value.exerciseId) ||
    !isUuid(value.versionId) ||
    !isFingerprint(value.stateToken) ||
    !['unchanged', mode === 'rollback' ? 'rolled_back' : 'published'].includes(
      String(value.result),
    )
  )
    return null;
  return value as PublicationOutcome;
}
/** Private server record; never serialize the full record into a browser response. */
export function publicationOperation(
  value: unknown,
): PublicationOperation | null {
  if (
    !object(value) ||
    !isUuid(value.id) ||
    !isUuid(value.batch_id) ||
    !isUuid(value.actor_id) ||
    !isUuid(value.version_id) ||
    !publicationTargetKey(value.target_key) ||
    !['publish', 'rollback'].includes(String(value.mode)) ||
    !isFingerprint(value.source_fingerprint) ||
    !publicationEpoch(value.source_epoch) ||
    !isFingerprint(value.plan_digest) ||
    !publicationStates.includes(value.state as PublicationState) ||
    !date(value.created_at) ||
    !date(value.updated_at) ||
    !date(value.expires_at) ||
    !object(value.source_snapshot) ||
    value.source_snapshot.versionId !== value.version_id ||
    value.source_snapshot.fingerprint !== value.source_fingerprint ||
    !isUuid(value.source_snapshot.reviewId) ||
    !isUuid(value.source_snapshot.receiptId) ||
    String(value.source_snapshot.epoch) !== value.source_epoch
  )
    return null;
  const payload = parsePublicationPayload(value.payload),
    inspection = parsePublicationInspection(value.inspection);
  if (!payload || !inspection) return null;
  try {
    planPublication(payload, inspection, value.mode as PublicationMode);
  } catch {
    return null;
  }
  const outcome =
    value.outcome === null
      ? null
      : publicationOutcome(
          value.outcome,
          payload,
          value.mode as PublicationMode,
        );
  if (
    (value.state === 'committed') !== (outcome !== null) ||
    (value.outcome !== null && !outcome) ||
    (value.state === 'failed') !== (value.error_code !== null) ||
    (value.error_code !== null &&
      !['validation', 'target_rejected', 'not_applied'].includes(
        String(value.error_code),
      ))
  )
    return null;
  return { ...value, payload, inspection, outcome } as PublicationOperation;
}
