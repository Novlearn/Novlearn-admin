/** Current pointer metadata only; never a publication receipt or exercise definition. */
export type ActiveVersionEnvironment = 'local-copy' | 'production';
export type ActiveVersionSnapshot = {
  schemaVersion: 1;
  environment: ActiveVersionEnvironment;
  targetKey: string;
  asOf: string;
  catalogId: string;
  parent: null | {
    exerciseId: string;
    catalogId: string;
    activeVersionId: string | null;
    publicationEpoch: string;
    archivedAt: string | null;
  };
  active: null | {
    versionId: string;
    exerciseId: string;
    revision: number;
    status: 'draft' | 'in_review' | 'approved' | 'published';
    publishedAt: string | null;
    definitionSha256: string;
    engineContract: string;
    generationVersion: string;
    canonicalizationVersion: string;
  };
};
export type ActiveVersionIssue =
  | 'future-archive'
  | 'missing-version'
  | 'pointer-mismatch'
  | 'wrong-parent'
  | 'not-published'
  | 'missing-publication-time'
  | 'future-publication-time';
export type ActiveVersionState =
  | { state: 'absent' | 'unpublished' | 'active'; issue: null }
  | { state: 'inconsistent'; issue: ActiveVersionIssue };
export type ComparableVersion = {
  revision: number;
  definitionSha256: string;
  engineContract: string;
  generationVersion: string;
  canonicalizationVersion: string;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export const activeCatalogId = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const fingerprint = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' &&
  [...v].length > 0 &&
  [...v].length <= 256 &&
  !/[\p{Cc}\p{Cs}]/u.test(v);
const integer = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^-?(0|[1-9]\d{0,18})$/.test(v) &&
  v !== '-0' &&
  BigInt(v) >= BigInt('-9223372036854775808') &&
  BigInt(v) <= BigInt('9223372036854775807');
const revision = (v: unknown): v is number =>
  Number.isInteger(v) && Number(v) > 0 && Number(v) <= 2147483647;
/** Canonical UTC timestamps, with exact PostgreSQL microsecond comparison. */
function micros(v: unknown): bigint | null {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v)
  )
    return null;
  const seconds = v.slice(0, 19),
    ms = Date.parse(seconds + 'Z');
  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 19) !== seconds
  )
    return null;
  return (
    BigInt(ms) * BigInt(1000) +
    BigInt((v.match(/\.(\d+)Z$/)?.[1] ?? '').padEnd(6, '0'))
  );
}
const nullableTime = (v: unknown) => v === null || micros(v) !== null;
export function comparableVersion(v: unknown): ComparableVersion | null {
  if (
    !object(v) ||
    !exact(v, [
      'revision',
      'definitionSha256',
      'engineContract',
      'generationVersion',
      'canonicalizationVersion',
    ]) ||
    !revision(v.revision) ||
    !fingerprint(v.definitionSha256) ||
    !text(v.engineContract) ||
    !text(v.generationVersion) ||
    !text(v.canonicalizationVersion)
  )
    return null;
  return { ...v } as ComparableVersion;
}
export function decodeActiveVersionSnapshot(
  value: unknown,
  expected: {
    environment: ActiveVersionEnvironment;
    targetKey: string;
    catalogId: string;
  },
): ActiveVersionSnapshot | null {
  if (
    !activeCatalogId(expected.catalogId) ||
    !(expected.environment === 'local-copy'
      ? expected.targetKey === 'local-http-fixture'
      : expected.environment === 'production' &&
        /^production-[a-z]{20}$/.test(expected.targetKey)) ||
    !object(value) ||
    !exact(value, [
      'schemaVersion',
      'environment',
      'targetKey',
      'asOf',
      'catalogId',
      'parent',
      'active',
    ]) ||
    value.schemaVersion !== 1 ||
    value.environment !== expected.environment ||
    value.targetKey !== expected.targetKey ||
    value.catalogId !== expected.catalogId ||
    micros(value.asOf) === null
  )
    return null;
  const p = value.parent,
    v = value.active;
  if (p === null)
    return v === null
      ? (structuredClone(value) as ActiveVersionSnapshot)
      : null;
  if (
    !object(p) ||
    !exact(p, [
      'exerciseId',
      'catalogId',
      'activeVersionId',
      'publicationEpoch',
      'archivedAt',
    ]) ||
    !integer(p.exerciseId) ||
    p.catalogId !== expected.catalogId ||
    (p.activeVersionId !== null && !activeCatalogId(p.activeVersionId)) ||
    !integer(p.publicationEpoch) ||
    BigInt(p.publicationEpoch) < BigInt(0) ||
    !nullableTime(p.archivedAt)
  )
    return null;
  if (v !== null) {
    if (
      p.activeVersionId === null ||
      !object(v) ||
      !exact(v, [
        'versionId',
        'exerciseId',
        'revision',
        'status',
        'publishedAt',
        'definitionSha256',
        'engineContract',
        'generationVersion',
        'canonicalizationVersion',
      ]) ||
      !activeCatalogId(v.versionId) ||
      !integer(v.exerciseId) ||
      typeof v.status !== 'string' ||
      !['draft', 'in_review', 'approved', 'published'].includes(v.status) ||
      !nullableTime(v.publishedAt) ||
      !comparableVersion({
        revision: v.revision,
        definitionSha256: v.definitionSha256,
        engineContract: v.engineContract,
        generationVersion: v.generationVersion,
        canonicalizationVersion: v.canonicalizationVersion,
      })
    )
      return null;
  }
  return structuredClone(value) as ActiveVersionSnapshot;
}
export function activeVersionState(
  snapshot: ActiveVersionSnapshot,
): ActiveVersionState {
  const p = snapshot.parent,
    v = snapshot.active;
  if (!p) return { state: 'absent', issue: null };
  const bad = (issue: ActiveVersionIssue): ActiveVersionState => ({
    state: 'inconsistent',
    issue,
  });
  if (p.archivedAt !== null && micros(p.archivedAt)! > micros(snapshot.asOf)!)
    return bad('future-archive');
  if (!p.activeVersionId) return { state: 'unpublished', issue: null };
  if (!v) return bad('missing-version');
  if (v.versionId !== p.activeVersionId) return bad('pointer-mismatch');
  if (v.exerciseId !== p.exerciseId) return bad('wrong-parent');
  if (v.status !== 'published') return bad('not-published');
  if (v.publishedAt === null) return bad('missing-publication-time');
  if (micros(v.publishedAt)! > micros(snapshot.asOf)!)
    return bad('future-publication-time');
  return { state: 'active', issue: null };
}
export function compareActiveVersion(
  snapshot: ActiveVersionSnapshot,
  selected: ComparableVersion | null,
):
  | 'same-version'
  | 'different-revision'
  | 'different-content'
  | 'not-comparable' {
  if (
    activeVersionState(snapshot).state !== 'active' ||
    !selected ||
    !comparableVersion(selected)
  )
    return 'not-comparable';
  const v = snapshot.active!;
  if (v.revision !== selected.revision) return 'different-revision';
  return (
    [
      'definitionSha256',
      'engineContract',
      'generationVersion',
      'canonicalizationVersion',
    ] as const
  ).every((k) => v[k] === selected[k])
    ? 'same-version'
    : 'different-content';
}
