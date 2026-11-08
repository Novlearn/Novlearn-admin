import { NextResponse, type NextRequest } from 'next/server';
import { authorizeFeedbackRoute } from '@/lib/feedback-route-auth';
import { isTrustedMutation, privateHeaders } from '@/lib/auth/http';
import { readBoundedJson } from '@/lib/auth/json';
import { readAuthConfiguration } from '@/lib/auth/config';
import { readFeedbackQuery, type FeedbackStatus } from '@/lib/feedbacks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await authorizeFeedbackRoute(request);
  if (!access.ok) return access.response;
  const query = readFeedbackQuery(request.nextUrl.searchParams);
  if (!query) return access.finish({ error: 'Filtres invalides.' }, 400);
  try {
    let rows = access.client
      .from('feedbacks')
      .select(
        'id,created_at,category,message,status,difficulty_rating,exercise_id',
        { count: 'exact' },
      );
    if (query.categories.length) rows = rows.in('category', query.categories);
    if (query.status === 'pending')
      rows = rows.or('status.eq.pending,status.is.null');
    else if (query.status !== 'all') rows = rows.eq('status', query.status);
    if (query.sort === 'category')
      rows = rows
        .order('category')
        .order('created_at', { ascending: false })
        .order('id');
    else
      rows = rows
        .order('created_at', { ascending: query.sort === 'oldest' })
        .order('id');
    const offset = (query.page - 1) * 25;
    const [page, pending, approved, rejected, total] = await Promise.all([
      rows.range(offset, offset + 24).abortSignal(AbortSignal.timeout(12000)),
      access.client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.pending,status.is.null')
        .abortSignal(AbortSignal.timeout(12000)),
      access.client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .abortSignal(AbortSignal.timeout(12000)),
      access.client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .abortSignal(AbortSignal.timeout(12000)),
      access.client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .abortSignal(AbortSignal.timeout(12000)),
    ]);
    const results = [page, pending, approved, rejected, total];
    if (
      results.some((result) => result.error) ||
      page.count === null ||
      pending.count === null ||
      approved.count === null ||
      rejected.count === null ||
      total.count === null
    )
      return access.finish(
        { error: 'Feedbacks Production indisponibles.' },
        503,
      );
    return access.finish({
      environment: 'production',
      summary: {
        total: total.count,
        pending: pending.count,
        approved: approved.count,
        rejected: rejected.count,
      },
      total: page.count,
      page: query.page,
      pageSize: 25,
      items: page.data.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        category: row.category,
        message: row.message,
        status: row.status ?? null,
        difficultyRating: row.difficulty_rating ?? null,
        exerciseId: row.exercise_id ?? null,
      })),
    });
  } catch {
    return access.finish({ error: 'Feedbacks Production indisponibles.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  const json = (body: unknown, status: number) =>
    NextResponse.json(body, { status, headers: privateHeaders() });
  if (process.env.ADMIN_FEEDBACK_REVIEW_ENABLED !== 'true')
    return json(
      { error: 'La validation des feedbacks n’est pas activée.' },
      503,
    );
  const stagingConfig = readAuthConfiguration(process.env);
  if (!stagingConfig || !isTrustedMutation(request, stagingConfig))
    return json({ error: 'Origine refusée.' }, 403);
  const access = await authorizeFeedbackRoute(request);
  if (!access.ok) return access.response;
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return access.finish({ error: 'Format JSON requis.' }, 415);
  let body: unknown;
  try {
    body = await readBoundedJson(request, 4096);
  } catch {
    return access.finish({ error: 'Requête invalide.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return access.finish({ error: 'Requête invalide.' }, 400);
  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).sort().join(',') !== 'action,feedbackId' ||
    typeof input.feedbackId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.feedbackId,
    ) ||
    !['approve', 'reject'].includes(String(input.action))
  )
    return access.finish({ error: 'Action invalide.' }, 400);
  try {
    const { data, error } = await access.client.rpc('admin_review_feedback', {
      p_feedback_id: input.feedbackId,
      p_action: input.action,
    });
    if (error)
      return access.finish(
        {
          error:
            error.code === '40001' || error.code === 'PT409'
              ? 'Ce feedback a déjà été traité.'
              : error.code === '42501'
                ? 'Action refusée.'
                : 'Validation indisponible.',
        },
        error.code === '40001' || error.code === 'PT409'
          ? 409
          : error.code === '42501'
            ? 403
            : 503,
      );
    if (
      !data ||
      data.feedbackId !== input.feedbackId ||
      data.status !== (input.action === 'approve' ? 'approved' : 'rejected')
    )
      return access.finish({ error: 'Décision non confirmée.' }, 503);
    return access.finish({
      environment: 'production',
      result: {
        feedbackId: data.feedbackId,
        status: data.status as FeedbackStatus,
      },
    });
  } catch {
    return access.finish({ error: 'Validation indisponible.' }, 503);
  }
}
