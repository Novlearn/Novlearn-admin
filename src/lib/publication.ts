import {
  draftEnvelope,
  isExerciseId,
  isFingerprint,
  isUuid,
  revisionDiff,
} from './catalogue';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
export type PublicationMode = 'publish' | 'rollback';
export type PublicationPayload = {
  schemaVersion: 1;
  catalogId: string;
  revision: number;
  definitionJson: string;
  engineArchiveSha256: string;
  engineContract: string;
  generationVersion: string;
  canonicalizationVersion: string;
  businessDigest: string;
};
export type PublicationHeader = {
  title: string;
  chapter: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  competences: string[];
  app_title: string;
  Is_Flash: boolean;
  Need_Calculator: boolean;
};
export type PublishedRevision = {
  id: string;
  revision: number;
  status: 'draft' | 'in_review' | 'approved' | 'published';
  businessDigest: string;
  definitionJson: string;
};
export type PublicationInspection = {
  desiredHeader: PublicationHeader;
  state: {
    catalogId: string;
    requestedRevision: number;
    latestRevision: number;
    stateToken: string;
    runtime: Pick<
      PublicationPayload,
      | 'engineArchiveSha256'
      | 'engineContract'
      | 'generationVersion'
      | 'canonicalizationVersion'
    >;
    parent:
      | (PublicationHeader & {
          id: string;
          catalog_id: string;
          publication_epoch: number;
          admin_archived_at: string | null;
          activeVersionId: string | null;
        })
      | null;
    candidate: PublishedRevision | null;
    active: PublishedRevision | null;
  };
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, list: string[]) =>
  Object.keys(v).sort().join(',') === [...list].sort().join(',');
const shortText = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 4096;
const revision = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) > 0 && Number(v) <= 999999999;
const contractKeys = [
  'engineArchiveSha256',
  'engineContract',
  'generationVersion',
  'canonicalizationVersion',
];
const headerKeys = [
  'title',
  'chapter',
  'difficulty',
  'competences',
  'app_title',
  'Is_Flash',
  'Need_Calculator',
];
const header = (v: unknown): v is PublicationHeader =>
  object(v) &&
  shortText(v.title) &&
  shortText(v.chapter) &&
  shortText(v.app_title) &&
  (v.difficulty === null ||
    ['easy', 'medium', 'hard'].includes(String(v.difficulty))) &&
  Array.isArray(v.competences) &&
  v.competences.length <= 64 &&
  v.competences.every(
    (s) => typeof s === 'string' && s.length > 0 && s.length <= 128,
  ) &&
  new Set(v.competences).size === v.competences.length &&
  typeof v.Is_Flash === 'boolean' &&
  typeof v.Need_Calculator === 'boolean';
/** Codec only; official mathematical validation and tests must run on the server Engine. */
export function publicationDefinition(raw: unknown): ExerciseDefinition | null {
  if (typeof raw !== 'string' || raw.length > 262144) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return draftEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
export function parsePublicationPayload(
  value: unknown,
): PublicationPayload | null {
  if (
    !object(value) ||
    !keys(value, [
      'schemaVersion',
      'catalogId',
      'revision',
      'definitionJson',
      'businessDigest',
      ...contractKeys,
    ]) ||
    value.schemaVersion !== 1 ||
    !isUuid(value.catalogId) ||
    !revision(value.revision) ||
    !isFingerprint(value.businessDigest) ||
    !isFingerprint(value.engineArchiveSha256) ||
    contractKeys
      .slice(1)
      .some(
        (k) =>
          typeof value[k] !== 'string' ||
          !value[k] ||
          String(value[k]).length > 128,
      )
  )
    return null;
  const definition = publicationDefinition(value.definitionJson);
  if (
    !definition ||
    definition.id !== value.catalogId ||
    definition.revision !== String(value.revision)
  )
    return null;
  // Keep the exact JSON text from PostgreSQL; never regenerate the transfer bytes.
  return value as PublicationPayload;
}
function parsedRevision(value: unknown): value is PublishedRevision {
  return (
    object(value) &&
    keys(value, [
      'id',
      'revision',
      'status',
      'businessDigest',
      'definitionJson',
    ]) &&
    isUuid(value.id) &&
    revision(value.revision) &&
    ['draft', 'in_review', 'approved', 'published'].includes(
      String(value.status),
    ) &&
    isFingerprint(value.businessDigest) &&
    !!publicationDefinition(value.definitionJson)
  );
}
export function parsePublicationInspection(
  value: unknown,
): PublicationInspection | null {
  if (
    !object(value) ||
    !keys(value, ['desiredHeader', 'state']) ||
    !header(value.desiredHeader) ||
    !keys(value.desiredHeader, headerKeys) ||
    !object(value.state)
  )
    return null;
  const s = value.state;
  if (
    !keys(s, [
      'catalogId',
      'requestedRevision',
      'latestRevision',
      'stateToken',
      'runtime',
      'parent',
      'candidate',
      'active',
    ]) ||
    !isUuid(s.catalogId) ||
    !revision(s.requestedRevision) ||
    !Number.isSafeInteger(s.latestRevision) ||
    Number(s.latestRevision) < 0 ||
    !isFingerprint(s.stateToken) ||
    !object(s.runtime) ||
    !keys(s.runtime, contractKeys) ||
    !isFingerprint(s.runtime.engineArchiveSha256) ||
    contractKeys
      .slice(1)
      .some(
        (k) =>
          typeof (s.runtime as Record<string, unknown>)[k] !== 'string' ||
          !String((s.runtime as Record<string, unknown>)[k]).length ||
          String((s.runtime as Record<string, unknown>)[k]).length > 128,
      )
  )
    return null;
  if (s.parent !== null) {
    if (!object(s.parent)) return null;
    const fields: Record<string, unknown> = s.parent;
    if (
      !header(s.parent) ||
      !object(s.parent) ||
      !keys(s.parent, [
        ...headerKeys,
        'id',
        'catalog_id',
        'publication_epoch',
        'admin_archived_at',
        'activeVersionId',
      ]) ||
      !isExerciseId(fields.id) ||
      fields.catalog_id !== s.catalogId ||
      !Number.isSafeInteger(fields.publication_epoch) ||
      Number(fields.publication_epoch) < 0 ||
      (fields.admin_archived_at !== null &&
        (typeof fields.admin_archived_at !== 'string' ||
          !Number.isFinite(Date.parse(fields.admin_archived_at)))) ||
      (fields.activeVersionId !== null && !isUuid(fields.activeVersionId))
    )
      return null;
  }
  if (
    (s.candidate !== null && !parsedRevision(s.candidate)) ||
    (s.active !== null && !parsedRevision(s.active))
  )
    return null;
  const candidate = s.candidate as PublishedRevision | null,
    active = s.active as PublishedRevision | null;
  const parent = s.parent as PublicationInspection['state']['parent'];
  if (
    (candidate && candidate.revision !== s.requestedRevision) ||
    (active && active.status !== 'published') ||
    (s.parent === null &&
      (candidate !== null || active !== null || s.latestRevision !== 0)) ||
    (parent !== null && parent.activeVersionId !== (active?.id ?? null)) ||
    Number(s.latestRevision) <
      Math.max(candidate?.revision ?? 0, active?.revision ?? 0)
  )
    return null;
  for (const row of [candidate, active]) {
    if (!row) continue;
    const d = publicationDefinition(row.definitionJson);
    if (!d || d.id !== s.catalogId || d.revision !== String(row.revision))
      return null;
  }
  return value as PublicationInspection;
}
export class PublicationConflict extends Error {
  constructor(
    public readonly code:
      | 'protocol'
      | 'runtime'
      | 'archived'
      | 'revision_conflict'
      | 'rollback_required'
      | 'rollback_unavailable',
  ) {
    super(code);
  }
}
export type PublicationPlan = {
  action:
    | 'create_exercise'
    | 'append_revision'
    | 'activate_revision'
    | 'rollback'
    | 'unchanged';
  mode: PublicationMode;
  catalogId: string;
  revision: number;
  businessDigest: string;
  stateToken: string;
  targetExerciseId: string | null;
  previousRevision: number | null;
  definitionChanges: ReturnType<typeof revisionDiff>;
  headerChanges: ReturnType<typeof revisionDiff>;
};
export function planPublication(
  input: unknown,
  target: unknown,
  mode: PublicationMode,
): PublicationPlan {
  const payload = parsePublicationPayload(input),
    inspection = parsePublicationInspection(target);
  if (!payload || !inspection || !['publish', 'rollback'].includes(mode))
    throw new PublicationConflict('protocol');
  const { state, desiredHeader } = inspection,
    { parent, candidate, active } = state;
  if (
    payload.catalogId !== state.catalogId ||
    payload.revision !== state.requestedRevision
  )
    throw new PublicationConflict('protocol');
  if (
    contractKeys.some(
      (k) =>
        payload[k as keyof PublicationPayload] !==
        state.runtime[k as keyof typeof state.runtime],
    )
  )
    throw new PublicationConflict('runtime');
  if (parent?.admin_archived_at) throw new PublicationConflict('archived');
  if (
    candidate &&
    (candidate.status !== 'published' ||
      candidate.businessDigest !== payload.businessDigest)
  )
    throw new PublicationConflict('revision_conflict');
  const beforeHeader =
    parent &&
    Object.fromEntries(
      headerKeys.map((k) => [k, parent[k as keyof typeof parent]]),
    );
  const headerChanges = revisionDiff(beforeHeader, desiredHeader);
  const identical =
    !!candidate && active?.id === candidate.id && !headerChanges.length;
  let action: PublicationPlan['action'];
  if (identical) action = 'unchanged';
  else if (mode === 'rollback') {
    if (!candidate || !active || candidate.revision >= active.revision)
      throw new PublicationConflict('rollback_unavailable');
    action = 'rollback';
  } else {
    if (
      payload.revision < state.latestRevision ||
      (active && payload.revision < active.revision)
    )
      throw new PublicationConflict('rollback_required');
    action = !parent
      ? 'create_exercise'
      : candidate
        ? 'activate_revision'
        : 'append_revision';
  }
  return {
    action,
    mode,
    catalogId: payload.catalogId,
    revision: payload.revision,
    businessDigest: payload.businessDigest,
    stateToken: state.stateToken,
    targetExerciseId: parent?.id ?? null,
    previousRevision: active?.revision ?? null,
    headerChanges,
    definitionChanges: revisionDiff(
      active ? publicationDefinition(active.definitionJson) : null,
      publicationDefinition(payload.definitionJson),
    ),
  };
}
