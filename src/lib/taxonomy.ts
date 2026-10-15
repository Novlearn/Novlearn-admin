import { isFingerprint, isUuid } from './catalogue';
export type TaxonomyKind = 'chapter' | 'competence';
export type ChapterValue = {
  name: string;
  order_index: number;
  aliases: string[];
  emoji: string;
};
export type CompetenceValue = {
  id: string;
  name: string;
  chapter_id: string;
  max_points: number;
};
export type TaxonomyUsage = {
  exercises: number;
  revisions: number;
  competences: number;
  flashcards: number;
  scores: number;
  exerciseIds: string[];
};
export type TaxonomyItem = {
  id: string;
  fingerprint: string;
  value: ChapterValue | CompetenceValue;
  usage: TaxonomyUsage;
};
export type TaxonomyData = {
  items: TaxonomyItem[];
  total: number;
  chapters: { id: string; name: string }[];
};
export function isTaxonomyKind(value: unknown): value is TaxonomyKind {
  return value === 'chapter' || value === 'competence';
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 120): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const isCompetenceId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(v);
export function taxonomyValue(
  kind: TaxonomyKind,
  value: unknown,
): value is ChapterValue | CompetenceValue {
  if (!record(value) || !text(value.name)) return false;
  if (kind === 'chapter')
    return (
      Object.keys(value).length === 4 &&
      Object.keys(value).every((k) =>
        ['name', 'order_index', 'aliases', 'emoji'].includes(k),
      ) &&
      Number.isInteger(value.order_index) &&
      Number(value.order_index) >= -2147483648 &&
      Number(value.order_index) <= 2147483647 &&
      Array.isArray(value.aliases) &&
      value.aliases.length <= 32 &&
      value.aliases.every((v) => text(v)) &&
      typeof value.emoji === 'string' &&
      [...value.emoji].length <= 16
    );
  return (
    Object.keys(value).length === 4 &&
    Object.keys(value).every((k) =>
      ['id', 'name', 'chapter_id', 'max_points'].includes(k),
    ) &&
    isCompetenceId(value.id) &&
    isUuid(value.chapter_id) &&
    Number.isInteger(value.max_points) &&
    Number(value.max_points) >= 1 &&
    Number(value.max_points) <= 1000000
  );
}
export function taxonomyMutation(value: unknown): {
  kind: TaxonomyKind;
  action: 'save' | 'delete';
  id: string | null;
  fingerprint: string | null;
  value: ChapterValue | CompetenceValue | null;
} | null {
  if (
    !record(value) ||
    !isTaxonomyKind(value.kind) ||
    !['save', 'delete'].includes(String(value.action)) ||
    Object.keys(value).length !== 5 ||
    Object.keys(value).some(
      (k) => !['kind', 'action', 'id', 'fingerprint', 'value'].includes(k),
    )
  )
    return null;
  if (
    value.id !== null &&
    !(value.kind === 'chapter' ? isUuid(value.id) : isCompetenceId(value.id))
  )
    return null;
  if (
    value.id === null
      ? value.fingerprint !== null || value.action === 'delete'
      : !isFingerprint(value.fingerprint)
  )
    return null;
  if (
    value.action === 'delete'
      ? value.value !== null
      : !taxonomyValue(value.kind, value.value)
  )
    return null;
  if (
    value.kind === 'competence' &&
    value.id !== null &&
    value.action === 'save' &&
    (value.value as CompetenceValue).id !== value.id
  )
    return null;
  return value as ReturnType<typeof taxonomyMutation>;
}
export function taxonomyFilter(params: URLSearchParams) {
  const n = Number(params.get('page') ?? '1');
  return {
    query: (params.get('q') ?? '').trim().slice(0, 120),
    chapter: isUuid(params.get('chapter')) ? params.get('chapter') : null,
    page: Number.isSafeInteger(n) && n > 0 ? Math.min(n, 4001) : 1,
  };
}
export function canDeleteTaxonomy(usage: TaxonomyUsage) {
  return [
    'exercises',
    'revisions',
    'competences',
    'flashcards',
    'scores',
  ].every((key) => usage[key as keyof TaxonomyUsage] === 0);
}
