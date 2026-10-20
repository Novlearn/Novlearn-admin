import {
  readStatisticsPeriod,
  statisticsDate,
  statisticsPeriod,
  type StatisticsEnvironment,
  type StatisticsPeriod,
} from './activity-statistics';

export type PedagogyQuery = {
  period: StatisticsPeriod;
  chapter: string | null;
  competence: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown' | null;
  exerciseType: 'classic' | 'flash' | 'unknown' | null;
  mode: 'all' | 'exercise' | 'duel';
  groupBy: 'chapter' | 'competence' | 'exercise';
  sort: 'attempts' | 'success';
  page: string;
};
export type PedagogyCounts = {
  exerciseAttempts: string;
  duelAttempts: string;
  completedDuels: string;
  activeAccounts: string;
  correct: string;
  incorrect: string;
  abandoned: string;
  unclassified: string;
};
export type PedagogyLabel = {
  id: string;
  label: string;
  truncated: boolean;
};
export type PedagogyStatistics = {
  schemaVersion: 2;
  environment: StatisticsEnvironment;
  asOf: string;
  period: { from: string; until: string };
  filters: Omit<PedagogyQuery, 'period' | 'page'>;
  totals: PedagogyCounts;
  completedWork: { distinctExercises: string; completedResponses: string };
  quality: {
    missingExerciseAttempts: string;
    unresolvedChapterAttempts: string;
    noCompetenceAttempts: string;
    unknownCompetenceLinks: string;
  };
  references: {
    chapters: PedagogyLabel[];
    competences: PedagogyLabel[];
    moreChapters: boolean;
    moreCompetences: boolean;
  };
  groups: {
    page: string;
    size: 25;
    total: string;
    hasMore: boolean;
    rows: (Omit<PedagogyLabel, 'id'> & {
      id: string | null;
      counts: PedagogyCounts;
    })[];
  };
};
const keys = [
  'exerciseAttempts',
  'duelAttempts',
  'completedDuels',
  'activeAccounts',
  'correct',
  'incorrect',
  'abandoned',
  'unclassified',
] as const;
const qualityKeys = [
  'missingExerciseAttempts',
  'unresolvedChapterAttempts',
  'noCompetenceAttempts',
  'unknownCompetenceLinks',
] as const;
const fields = [
  'from',
  'to',
  'chapter',
  'competence',
  'difficulty',
  'exerciseType',
  'mode',
  'groupBy',
  'sort',
  'page',
];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, fields: readonly string[]) =>
  Object.keys(v).sort().join(',') === [...fields].sort().join(',');
const count = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(v) &&
  BigInt(v) <= BigInt('9223372036854775807');
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' &&
  [...v].length >= 1 &&
  [...v].length <= 200 &&
  !/[\p{Cc}\p{Cs}]/u.test(v);
const pageValue = (v: unknown): v is string =>
  count(v) && v !== '0' && BigInt(v) <= BigInt('368934881474191032');

export function readPedagogyQuery(
  params: URLSearchParams,
  now = new Date(),
): { ok: true; query: PedagogyQuery } | { ok: false; error: string } {
  const invalid = {
    ok: false as const,
    error: 'Filtres pédagogiques invalides.',
  };
  if (
    [...params.keys()].some((key) => !fields.includes(key)) ||
    fields.some((key) => params.getAll(key).length > 1)
  )
    return invalid;
  const dates = new URLSearchParams();
  for (const key of ['from', 'to'])
    if (params.has(key)) dates.set(key, params.get(key)!);
  const period = readStatisticsPeriod(dates, now);
  if (!period.ok) return period;
  const chapter = params.get('chapter') || null;
  const competence = params.get('competence') || null;
  const difficulty = params.get('difficulty') || null;
  const exerciseType = params.get('exerciseType') || null;
  const mode = params.get('mode') ?? 'all';
  const groupBy = params.get('groupBy') ?? 'chapter';
  const sort = params.get('sort') ?? 'attempts';
  const page = params.get('page') ?? '1';
  if (
    (chapter !== null && !uuid(chapter)) ||
    (competence !== null && !text(competence)) ||
    (difficulty !== null &&
      !['easy', 'medium', 'hard', 'unknown'].includes(difficulty)) ||
    (exerciseType !== null &&
      !['classic', 'flash', 'unknown'].includes(exerciseType)) ||
    !['all', 'exercise', 'duel'].includes(mode) ||
    !['chapter', 'competence', 'exercise'].includes(groupBy) ||
    !['attempts', 'success'].includes(sort) ||
    !pageValue(page)
  )
    return invalid;
  return {
    ok: true,
    query: {
      period: period.period,
      chapter,
      competence,
      difficulty: difficulty as PedagogyQuery['difficulty'],
      exerciseType: exerciseType as PedagogyQuery['exerciseType'],
      mode: mode as PedagogyQuery['mode'],
      groupBy: groupBy as PedagogyQuery['groupBy'],
      sort: sort as PedagogyQuery['sort'],
      page,
    },
  };
}
export function pedagogyQueryParams(query: PedagogyQuery) {
  const params = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
    mode: query.mode,
    groupBy: query.groupBy,
    sort: query.sort,
    page: query.page,
  });
  for (const key of [
    'chapter',
    'competence',
    'difficulty',
    'exerciseType',
  ] as const)
    if (query[key] !== null) params.set(key, query[key]);
  return params;
}
const metrics = (v: unknown): v is PedagogyCounts =>
  object(v) &&
  exact(v, keys) &&
  keys.every((key) => count(v[key])) &&
  BigInt(v.exerciseAttempts as string) + BigInt(v.duelAttempts as string) ===
    BigInt(v.correct as string) +
      BigInt(v.incorrect as string) +
      BigInt(v.abandoned as string) +
      BigInt(v.unclassified as string) &&
  BigInt(v.activeAccounts as string) <=
    BigInt(v.exerciseAttempts as string) + BigInt(v.duelAttempts as string) &&
  BigInt(v.abandoned as string) <= BigInt(v.exerciseAttempts as string);
const labelled = (v: unknown): v is PedagogyLabel =>
  object(v) &&
  exact(v, ['id', 'label', 'truncated']) &&
  text(v.id) &&
  typeof v.label === 'string' &&
  [...v.label].length >= 1 &&
  [...v.label].length <= 200 &&
  !/\p{Cs}|\u0000/u.test(v.label) &&
  typeof v.truncated === 'boolean';
function compareId(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const left = [...a],
    right = [...b];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const delta = left[i].codePointAt(0)! - right[i].codePointAt(0)!;
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
  return left.length < right.length ? -1 : 1;
}
function compareGroup(
  a: { id: string | null; counts: PedagogyCounts },
  b: { id: string | null; counts: PedagogyCounts },
  sort: PedagogyQuery['sort'],
) {
  if (sort === 'success') {
    const da = BigInt(a.counts.correct) + BigInt(a.counts.incorrect);
    const db = BigInt(b.counts.correct) + BigInt(b.counts.incorrect);
    if (da === BigInt(0) && db !== BigInt(0)) return 1;
    if (db === BigInt(0) && da !== BigInt(0)) return -1;
    const left = BigInt(a.counts.correct) * db,
      right = BigInt(b.counts.correct) * da;
    if (left !== right) return left < right ? -1 : 1;
  }
  const ca = BigInt(a.counts.exerciseAttempts) + BigInt(a.counts.duelAttempts);
  const cb = BigInt(b.counts.exerciseAttempts) + BigInt(b.counts.duelAttempts);
  return ca !== cb ? (ca > cb ? -1 : 1) : compareId(a.id, b.id);
}

/** Strict aggregate projection. No user identities, raw attempts, answers or definitions. */
export function decodePedagogyStatistics(
  value: unknown,
  expected: { environment: StatisticsEnvironment; query: PedagogyQuery },
): PedagogyStatistics | null {
  const query = expected.query;
  const parsed = readPedagogyQuery(pedagogyQueryParams(query));
  const period = statisticsPeriod(query.period.from, query.period.to);
  const filters = {
    chapter: query.chapter,
    competence: query.competence,
    difficulty: query.difficulty,
    exerciseType: query.exerciseType,
    mode: query.mode,
    groupBy: query.groupBy,
    sort: query.sort,
  };
  const actualFilters =
    object(value) && object(value.filters) ? value.filters : null;
  const quality = object(value) && object(value.quality) ? value.quality : null;
  const total = object(value) && metrics(value.totals) ? value.totals : null;
  const completedWork =
    object(value) && object(value.completedWork) ? value.completedWork : null;
  if (
    !parsed.ok ||
    !period ||
    period.until !== query.period.until ||
    period.days !== query.period.days ||
    !['local-copy', 'local-fixture', 'production'].includes(
      expected.environment,
    ) ||
    !object(value) ||
    !exact(value, [
      'schemaVersion',
      'environment',
      'asOf',
      'period',
      'filters',
      'totals',
      'completedWork',
      'quality',
      'references',
      'groups',
    ]) ||
    value.schemaVersion !== 2 ||
    value.environment !== expected.environment ||
    typeof value.asOf !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(
      value.asOf,
    ) ||
    statisticsDate(value.asOf.slice(0, 10)) === null ||
    !Number.isFinite(Date.parse(value.asOf)) ||
    Date.parse(value.asOf) < Date.parse(query.period.from + 'T00:00:00Z') ||
    !object(value.period) ||
    !exact(value.period, ['from', 'until']) ||
    value.period.from !== period.from ||
    value.period.until !== period.until ||
    !actualFilters ||
    !exact(actualFilters, Object.keys(filters)) ||
    Object.entries(filters).some(([key, v]) => actualFilters[key] !== v) ||
    !total ||
    !completedWork ||
    !exact(completedWork, ['distinctExercises', 'completedResponses']) ||
    !count(completedWork.distinctExercises) ||
    !count(completedWork.completedResponses) ||
    BigInt(completedWork.completedResponses) !==
      BigInt(total.correct) + BigInt(total.incorrect) ||
    BigInt(completedWork.distinctExercises) >
      BigInt(completedWork.completedResponses) ||
    !quality ||
    !exact(quality, qualityKeys) ||
    qualityKeys.some((key) => !count(quality[key])) ||
    !object(value.references) ||
    !exact(value.references, [
      'chapters',
      'competences',
      'moreChapters',
      'moreCompetences',
    ]) ||
    typeof value.references.moreChapters !== 'boolean' ||
    typeof value.references.moreCompetences !== 'boolean' ||
    !object(value.groups) ||
    !exact(value.groups, ['page', 'size', 'total', 'hasMore', 'rows']) ||
    value.groups.page !== query.page ||
    value.groups.size !== 25 ||
    !count(value.groups.total) ||
    value.groups.hasMore !==
      BigInt(query.page) * BigInt(25) < BigInt(value.groups.total) ||
    !Array.isArray(value.groups.rows)
  )
    return null;
  for (const key of ['chapters', 'competences'] as const) {
    const items = value.references[key];
    if (
      !Array.isArray(items) ||
      items.length > 200 ||
      items.some((v) => !labelled(v) || (key === 'chapters' && !uuid(v.id))) ||
      new Set(items.map((v) => v.id)).size !== items.length
    )
      return null;
    if (
      value.references[
        key === 'chapters' ? 'moreChapters' : 'moreCompetences'
      ] &&
      items.length !== 200
    )
      return null;
  }
  const remaining =
    BigInt(value.groups.total) - (BigInt(query.page) - BigInt(1)) * BigInt(25);
  const length =
    remaining <= BigInt(0)
      ? 0
      : remaining > BigInt(25)
        ? 25
        : Number(remaining);
  if (value.groups.rows.length !== length) return null;
  const ids = new Set();
  let previous: { id: string | null; counts: PedagogyCounts } | null = null;
  for (const row of value.groups.rows) {
    const rowCounts = object(row) && metrics(row.counts) ? row.counts : null;
    if (
      !object(row) ||
      !exact(row, ['id', 'label', 'truncated', 'counts']) ||
      !rowCounts ||
      !labelled({
        id: row.id ?? '~unresolved',
        label: row.label,
        truncated: row.truncated,
      }) ||
      (row.id !== null &&
        (query.groupBy === 'chapter'
          ? !uuid(row.id)
          : query.groupBy === 'exercise'
            ? !(
                typeof row.id === 'string' &&
                /^-?(0|[1-9]\d{0,18})$/.test(row.id) &&
                BigInt(row.id) >= BigInt('-9223372036854775808') &&
                BigInt(row.id) <= BigInt('9223372036854775807')
              )
            : !text(row.id))) ||
      ids.has(row.id) ||
      keys.some((key) => BigInt(rowCounts[key]) > BigInt(total[key]))
    )
      return null;
    const compared = { id: row.id as string | null, counts: rowCounts };
    if (previous && compareGroup(previous, compared, query.sort) > 0)
      return null;
    previous = compared;
    ids.add(row.id);
  }
  if (
    (query.mode === 'exercise' &&
      (total.duelAttempts !== '0' || total.completedDuels !== '0')) ||
    (query.mode === 'duel' &&
      (total.exerciseAttempts !== '0' || total.abandoned !== '0'))
  )
    return null;
  if (value.groups.total === '0' && keys.some((key) => total[key] !== '0'))
    return null;
  if (query.page === '1' && !value.groups.hasMore) {
    const rows = value.groups.rows as { counts: PedagogyCounts }[];
    for (const key of keys) {
      const sum = rows.reduce(
        (n, row) => n + BigInt(row.counts[key]),
        BigInt(0),
      );
      if (
        sum < BigInt(total[key]) ||
        (key !== 'activeAccounts' &&
          query.groupBy !== 'competence' &&
          sum !== BigInt(total[key]))
      )
        return null;
    }
  }
  const attempts = BigInt(total.exerciseAttempts) + BigInt(total.duelAttempts);
  if (
    [
      'missingExerciseAttempts',
      'unresolvedChapterAttempts',
      'noCompetenceAttempts',
    ].some((key) => BigInt(quality[key] as string) > attempts)
  )
    return null;
  // Multi-skill attribution overlaps; totals are always computed before expansion.
  return structuredClone(value) as PedagogyStatistics;
}
