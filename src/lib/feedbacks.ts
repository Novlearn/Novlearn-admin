export const FEEDBACK_CATEGORIES = {
  difficulty: 'Difficulté',
  content_error: 'Erreur de contenu',
  suggestion: 'Suggestion',
  other: 'Autre',
} as const;

export type FeedbackStatus = 'pending' | 'approved' | 'rejected';
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;
export type FeedbackItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: FeedbackStatus | null;
  difficultyRating: number | null;
  exerciseId: number | null;
};
export type FeedbackQuery = {
  categories: string[];
  status: 'all' | FeedbackStatus;
  sort: 'newest' | 'oldest' | 'category';
  exerciseId: number | null;
  page: number;
};
export type FeedbackSummary = Record<FeedbackStatus, number> & {
  total: number;
};
export type FeedbackPage = {
  items: FeedbackItem[];
  summary: FeedbackSummary;
  query: FeedbackQuery;
  pageSize: number;
  total: number;
  environment: 'production';
};

export const FEEDBACK_PAGE_SIZE = 25;
export const FEEDBACK_MAX_OFFSET = 10000;

export function readFeedbackQuery(
  params: URLSearchParams,
): FeedbackQuery | null {
  const categories = [...new Set(params.getAll('category').filter(Boolean))];
  const status = params.get('status') ?? 'all';
  const sort = params.get('sort') ?? 'newest';
  const rawExerciseId = params.get('exerciseId') ?? '';
  const rawPage = params.get('page') ?? '1';
  if (
    categories.length > Object.keys(FEEDBACK_CATEGORIES).length ||
    categories.some((category) => category.length > 80) ||
    !['all', 'pending', 'approved', 'rejected'].includes(status) ||
    !['newest', 'oldest', 'category'].includes(sort) ||
    (rawExerciseId !== '' && !/^[1-9]\d{0,9}$/.test(rawExerciseId)) ||
    !/^[1-9]\d{0,5}$/.test(rawPage)
  )
    return null;
  const page = Number(rawPage);
  if ((page - 1) * FEEDBACK_PAGE_SIZE > FEEDBACK_MAX_OFFSET) return null;
  return {
    categories,
    status: status as FeedbackQuery['status'],
    sort: sort as FeedbackQuery['sort'],
    exerciseId: rawExerciseId === '' ? null : Number(rawExerciseId),
    page,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function decodeFeedbackPage(
  value: unknown,
  query: FeedbackQuery,
): FeedbackPage | null {
  const data = object(value);
  if (
    !data ||
    !hasOnlyKeys(data, [
      'items',
      'summary',
      'total',
      'pageSize',
      'environment',
    ]) ||
    !Array.isArray(data.items) ||
    data.items.length > FEEDBACK_PAGE_SIZE ||
    !Number.isSafeInteger(data.total) ||
    (data.total as number) < 0 ||
    !Number.isSafeInteger(data.pageSize) ||
    data.pageSize !== FEEDBACK_PAGE_SIZE ||
    data.environment !== 'production'
  )
    return null;
  const summary = object(data.summary);
  if (
    !summary ||
    !hasOnlyKeys(summary, ['total', 'pending', 'approved', 'rejected']) ||
    !['total', 'pending', 'approved', 'rejected'].every(
      (key) =>
        Number.isSafeInteger(summary[key]) && (summary[key] as number) >= 0,
    )
  )
    return null;
  const items: FeedbackItem[] = [];
  for (const raw of data.items) {
    const row = object(raw);
    if (
      !row ||
      !hasOnlyKeys(row, [
        'id',
        'createdAt',
        'category',
        'message',
        'status',
        'difficultyRating',
        'exerciseId',
      ]) ||
      typeof row.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        row.id,
      ) ||
      typeof row.createdAt !== 'string' ||
      Number.isNaN(Date.parse(row.createdAt)) ||
      typeof row.category !== 'string' ||
      !row.category ||
      typeof row.message !== 'string' ||
      !['pending', 'approved', 'rejected', null].includes(
        row.status as string | null,
      ) ||
      (row.difficultyRating !== null &&
        (!Number.isSafeInteger(row.difficultyRating) ||
          (row.difficultyRating as number) < 0)) ||
      (row.exerciseId !== null &&
        (!Number.isSafeInteger(row.exerciseId) ||
          (row.exerciseId as number) < 0))
    )
      return null;
    items.push({
      id: row.id,
      createdAt: row.createdAt,
      category: row.category,
      message: row.message,
      status: row.status as FeedbackStatus | null,
      difficultyRating: row.difficultyRating as number | null,
      exerciseId: row.exerciseId as number | null,
    });
  }
  return {
    items,
    summary: summary as FeedbackSummary,
    query,
    pageSize: FEEDBACK_PAGE_SIZE,
    total: data.total as number,
    environment: 'production',
  };
}
