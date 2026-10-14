import type { ExerciseDefinition } from 'novlearn-exercise-engine';

export const editorialLabels = {
  draft: 'Brouillon',
  in_review: 'À relire',
  approved: 'Approuvé',
  published: 'Publié',
  legacy: 'Historique',
  archived: 'Archivé',
} as const;
export type EditorialStatus = keyof typeof editorialLabels;
export type CatalogueItem = {
  id: string;
  catalogId: string | null;
  title: string;
  appTitle: string;
  chapter: string;
  difficulty: string;
  skills: string[];
  exerciseType: string;
  needsCalculator: boolean;
  status: EditorialStatus;
  revision: number | null;
  versionId: string | null;
  activeVersionId: string | null;
  archived: boolean;
  updatedAt: string | null;
};
export type CataloguePage = { items: CatalogueItem[]; total: number };
export type CatalogueFilter = {
  query: string;
  status: EditorialStatus | 'all';
  sort: 'recent' | 'title';
  page: number;
};
export const PAGE_SIZE = 25;

export function catalogueFilter(params: URLSearchParams): CatalogueFilter {
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? '1');
  return {
    query: (params.get('q') ?? '').trim().slice(0, 120),
    status: Object.hasOwn(editorialLabels, status)
      ? (status as EditorialStatus)
      : 'all',
    sort: params.get('sort') === 'title' ? 'title' : 'recent',
    page: Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1,
  };
}
export function isExerciseId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= BigInt('9223372036854775807')
  );
}
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** Drafts may be incomplete; official mathematical validation remains Engine-only. */
export function draftEnvelope(value: unknown): value is ExerciseDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const generation = draft.generation as Record<string, unknown> | undefined;
  if (
    !generation ||
    generation.schemaVersion !== 5 ||
    !Array.isArray(generation.definitions) ||
    !Array.isArray(generation.constraints)
  )
    return false;
  const records = (list: unknown) =>
    Array.isArray(list) &&
    list.every(
      (item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    );
  if (
    !records(generation.definitions) ||
    !records(generation.constraints) ||
    !records(draft.elements) ||
    !records(draft.variables)
  )
    return false;
  if (draft.catalogue !== undefined) {
    if (
      !draft.catalogue ||
      typeof draft.catalogue !== 'object' ||
      Array.isArray(draft.catalogue)
    )
      return false;
    const metadata = draft.catalogue as Record<string, unknown>;
    if (
      Object.keys(metadata).some(
        (key) =>
          ![
            'chapter',
            'appTitle',
            'difficulty',
            'skills',
            'exerciseType',
            'needsCalculator',
          ].includes(key),
      )
    )
      return false;
    for (const key of ['chapter', 'appTitle'])
      if (
        metadata[key] !== undefined &&
        (typeof metadata[key] !== 'string' || metadata[key].length > 4096)
      )
        return false;
    if (
      metadata.difficulty !== undefined &&
      (!Number.isSafeInteger(metadata.difficulty) ||
        Number(metadata.difficulty) < 1)
    )
      return false;
    if (
      metadata.skills !== undefined &&
      (!Array.isArray(metadata.skills) ||
        metadata.skills.length > 64 ||
        metadata.skills.some(
          (skill) =>
            typeof skill !== 'string' ||
            skill.length === 0 ||
            skill.length > 128,
        ) ||
        new Set(metadata.skills).size !== metadata.skills.length)
    )
      return false;
    if (
      metadata.exerciseType !== undefined &&
      !['classic', 'flash'].includes(String(metadata.exerciseType))
    )
      return false;
    if (
      metadata.needsCalculator !== undefined &&
      typeof metadata.needsCalculator !== 'boolean'
    )
      return false;
  }
  if (
    Object.keys(draft).some(
      (key) =>
        ![
          'schemaVersion',
          'kind',
          'id',
          'revision',
          'title',
          'catalogue',
          'generation',
          'variables',
          'elements',
          'extensions',
        ].includes(key),
    )
  )
    return false;
  return (
    draft.schemaVersion === 5 &&
    draft.kind === 'composed' &&
    typeof draft.title === 'string' &&
    draft.title.trim().length > 0 &&
    draft.title.length <= 160 &&
    typeof draft.id === 'string' &&
    typeof draft.revision === 'string' &&
    Array.isArray(draft.elements) &&
    draft.elements.length <= 100 &&
    Array.isArray(draft.variables) &&
    draft.variables.length <= 100 &&
    !!draft.generation &&
    typeof draft.generation === 'object' &&
    !Array.isArray(draft.generation)
  );
}
export function newDraft(title: string): ExerciseDefinition {
  return {
    schemaVersion: 5,
    kind: 'composed',
    id: 'assigned-on-save',
    revision: '1',
    title,
    catalogue: { exerciseType: 'classic', needsCalculator: false },
    generation: {
      schemaVersion: 5,
      definitions: [],
      constraints: [],
      maxAttempts: 100,
      maxDraws: 1000,
    },
    variables: [],
    elements: [],
  };
}

/** Structural revision diff, never evaluates or normalizes mathematical content. */
export function revisionDiff(
  before: unknown,
  after: unknown,
): { path: string; before: unknown; after: unknown }[] {
  const changes: { path: string; before: unknown; after: unknown }[] = [];
  function visit(a: unknown, b: unknown, path: string, depth: number) {
    if (Object.is(a, b)) return;
    if (
      depth < 20 &&
      a &&
      b &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      for (const key of [
        ...new Set([...Object.keys(left), ...Object.keys(right)]),
      ].sort()) {
        visit(
          left[key],
          right[key],
          `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
          depth + 1,
        );
      }
    } else if (JSON.stringify(a) !== JSON.stringify(b))
      changes.push({ path: path || '/', before: a, after: b });
  }
  visit(before, after, '', 0);
  return changes;
}
