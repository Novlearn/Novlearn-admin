import { isExerciseId, isUuid } from './catalogue';

export const dashboardStatuses = [
  'draft',
  'in_review',
  'approved',
  'published',
  'legacy',
  'archived',
] as const;
type Status = (typeof dashboardStatuses)[number];
export type ContentOverview = {
  environment: 'staging';
  asOf: string;
  catalogue: Record<Status | 'total', string>;
  tests: { failed: string };
  content: { chapters: string; competences: string; flashcards: string };
  activeVersions: string;
  recentActiveVersions: {
    exerciseId: string;
    versionId: string;
    revision: number;
    title: string;
    publishedAt: string;
  }[];
};
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const count = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(x) &&
  BigInt(x) <= BigInt('9223372036854775807');
const timestamp = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(x) &&
  Number.isFinite(Date.parse(x));

/** Project only the documented aggregate fields; malformed/unavailable is never zero. */
export function contentOverview(value: unknown): ContentOverview | null {
  if (
    !record(value) ||
    value.environment !== 'staging' ||
    !timestamp(value.asOf) ||
    !record(value.catalogue) ||
    !record(value.tests) ||
    !record(value.content) ||
    !count(value.activeVersions) ||
    !count(value.tests.failed) ||
    !Array.isArray(value.recentActiveVersions) ||
    value.recentActiveVersions.length > 5
  )
    return null;
  const catalogue = value.catalogue;
  if (
    !count(catalogue.total) ||
    dashboardStatuses.some((s) => !count(catalogue[s]))
  )
    return null;
  if (
    dashboardStatuses.reduce(
      (sum, s) => sum + BigInt(catalogue[s] as string),
      BigInt(0),
    ) !== BigInt(catalogue.total)
  )
    return null;
  const available =
    BigInt(catalogue.total) - BigInt(catalogue.archived as string);
  if (
    BigInt(value.tests.failed) > available ||
    BigInt(value.activeVersions) > available
  )
    return null;
  if (
    !count(value.content.chapters) ||
    !count(value.content.competences) ||
    !count(value.content.flashcards)
  )
    return null;
  const recent: ContentOverview['recentActiveVersions'] = [];
  for (const item of value.recentActiveVersions) {
    if (
      !record(item) ||
      !isExerciseId(item.exerciseId) ||
      !isUuid(item.versionId) ||
      !Number.isSafeInteger(item.revision) ||
      Number(item.revision) < 1 ||
      Number(item.revision) > 2147483647 ||
      typeof item.title !== 'string' ||
      item.title.length > 480 ||
      !timestamp(item.publishedAt) ||
      recent.some(
        (r) =>
          r.exerciseId === item.exerciseId || r.versionId === item.versionId,
      )
    )
      return null;
    recent.push({
      exerciseId: item.exerciseId,
      versionId: item.versionId,
      revision: Number(item.revision),
      title: item.title,
      publishedAt: item.publishedAt,
    });
  }
  if (
    BigInt(recent.length) !==
    (BigInt(value.activeVersions) < BigInt(5)
      ? BigInt(value.activeVersions)
      : BigInt(5))
  )
    return null;
  return {
    environment: 'staging',
    asOf: value.asOf,
    catalogue: Object.fromEntries(
      ['total', ...dashboardStatuses].map((s) => [s, catalogue[s]]),
    ) as ContentOverview['catalogue'],
    tests: { failed: value.tests.failed },
    content: {
      chapters: value.content.chapters,
      competences: value.content.competences,
      flashcards: value.content.flashcards,
    },
    activeVersions: value.activeVersions,
    recentActiveVersions: recent,
  };
}
export const formatCount = (value: string) =>
  new Intl.NumberFormat('fr-FR').format(BigInt(value));
export const overviewDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value));
