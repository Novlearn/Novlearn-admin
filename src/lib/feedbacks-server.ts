import 'server-only';
import { authorizeAdmin } from './auth/authorization';
import { asAuthGateway, createPageClient } from './auth/supabase';
import { productionAuthConfiguration } from './production-api-config';
import {
  decodeFeedbackPage,
  FEEDBACK_PAGE_SIZE,
  readFeedbackQuery,
  type FeedbackQuery,
} from './feedbacks';

export class FeedbacksUnavailableError extends Error {
  constructor() {
    super('Feedbacks Production indisponibles');
  }
}

export async function loadProductionFeedbacks(query: FeedbackQuery) {
  const params = new URLSearchParams();
  for (const category of query.categories) params.append('category', category);
  params.set('status', query.status);
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  const validated = readFeedbackQuery(params);
  if (
    !validated ||
    query.categories.join('\0') !== validated.categories.join('\0') ||
    query.status !== validated.status ||
    query.sort !== validated.sort ||
    query.page !== validated.page
  )
    throw new FeedbacksUnavailableError();
  try {
    const config = productionAuthConfiguration(process.env);
    if (!config) throw new FeedbacksUnavailableError();
    const client = await createPageClient(config);
    if (!client || !(await authorizeAdmin(asAuthGateway(client))).allowed)
      throw new FeedbacksUnavailableError();

    const statusQuery = (status: string) => {
      const q = client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true });
      return status === 'pending'
        ? q.or('status.eq.pending,status.is.null')
        : q.eq('status', status);
    };
    const [
      rowsResult,
      pendingResult,
      approvedResult,
      rejectedResult,
      totalResult,
    ] = await Promise.all([
      (async () => {
        let q = client
          .from('feedbacks')
          .select(
            'id,created_at,category,message,status,difficulty_rating,exercise_id',
            { count: 'exact' },
          );
        if (validated.categories.length)
          q = q.in('category', validated.categories);
        if (validated.status === 'pending')
          q = q.or('status.eq.pending,status.is.null');
        else if (validated.status !== 'all')
          q = q.eq('status', validated.status);
        if (validated.sort === 'category')
          q = q
            .order('category')
            .order('created_at', { ascending: false })
            .order('id');
        else
          q = q
            .order('created_at', { ascending: validated.sort === 'oldest' })
            .order('id');
        const offset = (validated.page - 1) * FEEDBACK_PAGE_SIZE;
        const { data, count, error } = await q
          .range(offset, offset + FEEDBACK_PAGE_SIZE - 1)
          .abortSignal(AbortSignal.timeout(12000));
        if (error || !data || count === null)
          throw new FeedbacksUnavailableError();
        return { data, count };
      })(),
      statusQuery('pending').abortSignal(AbortSignal.timeout(12000)),
      statusQuery('approved').abortSignal(AbortSignal.timeout(12000)),
      statusQuery('rejected').abortSignal(AbortSignal.timeout(12000)),
      client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .abortSignal(AbortSignal.timeout(12000)),
    ]);
    if (
      pendingResult.error ||
      approvedResult.error ||
      rejectedResult.error ||
      totalResult.error ||
      pendingResult.count === null ||
      approvedResult.count === null ||
      rejectedResult.count === null ||
      totalResult.count === null
    )
      throw new FeedbacksUnavailableError();
    const value = {
      environment: 'production',
      pageSize: FEEDBACK_PAGE_SIZE,
      total: rowsResult.count,
      summary: {
        total: totalResult.count,
        pending: pendingResult.count,
        approved: approvedResult.count,
        rejected: rejectedResult.count,
      },
      items: rowsResult.data.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        category: row.category,
        message: row.message,
        status: row.status ?? null,
        difficultyRating: row.difficulty_rating ?? null,
        exerciseId: row.exercise_id ?? null,
      })),
    };
    const result = decodeFeedbackPage(value, validated);
    if (!result) throw new FeedbacksUnavailableError();
    return result;
  } catch {
    throw new FeedbacksUnavailableError();
  }
}
