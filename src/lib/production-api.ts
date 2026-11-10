import 'server-only';
import { authorizeAdmin } from './auth/authorization';
import { asAuthGateway, createPageClient } from './auth/supabase';
import { productionAuthConfiguration } from './production-api-config';
import {
  decodeCohortRetention,
  decodeActivityStatistics,
  readStatisticsPeriod,
  type CohortRetention,
  type StatisticsPeriod,
} from './activity-statistics';
import {
  decodeUsersPage,
  readUsersQuery,
  USERS_PAGE_SIZE,
  type UsersQuery,
} from './users';
import {
  decodeUserDetail,
  readUserDetailQuery,
  USER_DETAIL_PAGE_SIZE,
  type UserDetailQuery,
} from './user-detail';
import {
  decodePedagogyStatistics,
  readPedagogyQuery,
  pedagogyQueryParams,
  type PedagogyQuery,
} from './pedagogy-statistics';
import {
  decodePedagogyReferences,
  readPedagogyReferenceQuery,
  type PedagogyReferenceQuery,
} from './pedagogy-references';

export class ProductionApiError extends Error {
  constructor() {
    super('Lecture Production indisponible');
  }
}
/** A fresh Production session and database role check precede every RPC.
 * The enclosing page/route also authorizes the primary Staging Admin.
 * No privileged key, cached identity, uploaded SQL or source selector is accepted. */
async function rpc(name: string, parameters: Record<string, unknown>) {
  try {
    const config = productionAuthConfiguration(process.env);
    if (!config) throw new ProductionApiError();
    const client = await createPageClient(config);
    if (!client || !(await authorizeAdmin(asAuthGateway(client))).allowed)
      throw new ProductionApiError();
    const { data, error } = await client
      .rpc(name, parameters)
      .abortSignal(AbortSignal.timeout(12000));
    if (
      error ||
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      Object.hasOwn(data, 'environment')
    )
      throw new ProductionApiError();
    return { ...data, environment: 'production' as const };
  } catch {
    throw new ProductionApiError();
  }
}
export async function loadProductionActivity(period: StatisticsPeriod) {
  const p = readStatisticsPeriod(
    new URLSearchParams({ from: period.from, to: period.to }),
  );
  if (!p.ok || p.period.until !== period.until || p.period.days !== period.days)
    throw new ProductionApiError();
  const row = await rpc('admin_read_activity', {
    p_from: period.from,
    p_until: period.until,
  });
  const result = decodeActivityStatistics(row, {
    environment: 'production',
    period,
  });
  if (!result || result.accounts.anonymous !== '0')
    throw new ProductionApiError();
  return result;
}

export async function loadProductionCohortRetention(): Promise<CohortRetention> {
  const row = await rpc('admin_read_cohort_retention', {});
  const result = decodeCohortRetention(row, { environment: 'production' });
  if (!result) throw new ProductionApiError();
  return result;
}

export type ProductionOverviewMetrics = {
  exerciseCatalogCount: string;
  exercisesCreated: string;
  feedbacks: {
    total: string;
    pending: string;
    approved: string;
    rejected: string;
  };
};

/** Count-only Production reads; no exercise or feedback rows reach the browser. */
export async function loadProductionOverviewMetrics(
  periodInput: StatisticsPeriod,
): Promise<ProductionOverviewMetrics> {
  try {
    const periodQuery = new URLSearchParams({
      from: periodInput.from,
      to: periodInput.to,
    });
    const validatedPeriod = readStatisticsPeriod(periodQuery);
    if (
      !validatedPeriod.ok ||
      validatedPeriod.period.until !== periodInput.until ||
      validatedPeriod.period.days !== periodInput.days
    )
      throw new ProductionApiError();
    const config = productionAuthConfiguration(process.env);
    if (!config) throw new ProductionApiError();
    const client = await createPageClient(config);
    if (!client || !(await authorizeAdmin(asAuthGateway(client))).allowed)
      throw new ProductionApiError();

    const [
      exerciseCatalog,
      exercisesCreated,
      pending,
      approved,
      rejected,
      total,
    ] = await Promise.all([
      client
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .abortSignal(AbortSignal.timeout(12000)),
      client
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${periodInput.from}T00:00:00.000Z`)
        .lt('created_at', `${periodInput.until}T00:00:00.000Z`)
        .abortSignal(AbortSignal.timeout(12000)),
      client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.pending,status.is.null')
        .gte('created_at', `${periodInput.from}T00:00:00.000Z`)
        .lt('created_at', `${periodInput.until}T00:00:00.000Z`)
        .abortSignal(AbortSignal.timeout(12000)),
      client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('created_at', `${periodInput.from}T00:00:00.000Z`)
        .lt('created_at', `${periodInput.until}T00:00:00.000Z`)
        .abortSignal(AbortSignal.timeout(12000)),
      client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('created_at', `${periodInput.from}T00:00:00.000Z`)
        .lt('created_at', `${periodInput.until}T00:00:00.000Z`)
        .abortSignal(AbortSignal.timeout(12000)),
      client
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${periodInput.from}T00:00:00.000Z`)
        .lt('created_at', `${periodInput.until}T00:00:00.000Z`)
        .abortSignal(AbortSignal.timeout(12000)),
    ]);
    const results = [
      exerciseCatalog,
      exercisesCreated,
      pending,
      approved,
      rejected,
      total,
    ];
    const counts = results.map((result) => result.count);
    if (
      results.some((result) => result.error) ||
      counts.some(
        (value) => value === null || !Number.isSafeInteger(value) || value < 0,
      )
    )
      throw new ProductionApiError();
    const [
      exerciseCatalogCount,
      exercisesCreatedCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount,
    ] = counts as number[];
    return {
      exerciseCatalogCount: String(exerciseCatalogCount),
      exercisesCreated: String(exercisesCreatedCount),
      feedbacks: {
        total: String(totalCount),
        pending: String(pendingCount),
        approved: String(approvedCount),
        rejected: String(rejectedCount),
      },
    };
  } catch {
    throw new ProductionApiError();
  }
}

export async function loadProductionUsers(query: UsersQuery) {
  const params = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
    q: query.query,
  });
  if (query.after !== null) params.set('after', query.after);
  if (query.before !== null) params.set('before', query.before);
  const p = readUsersQuery(params);
  if (
    !p.ok ||
    p.value.period.until !== query.period.until ||
    p.value.period.days !== query.period.days ||
    p.value.query !== query.query
  )
    throw new ProductionApiError();
  const q = p.value;
  const row = await rpc('admin_read_users', {
    p_from: q.period.from,
    p_until: q.period.until,
    p_query: q.query,
    p_after: q.after,
    p_before: q.before,
    p_limit: USERS_PAGE_SIZE,
  });
  const result = decodeUsersPage(row, q, undefined, 'production');
  if (!result || result.items.some((user) => user.anonymous))
    throw new ProductionApiError();
  return result;
}
export async function loadProductionUserDetail(query: UserDetailQuery) {
  const params = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
    view: query.view,
  });
  if (query.after !== null) params.set('after', query.after);
  if (query.before !== null) params.set('before', query.before);
  const p = readUserDetailQuery(query.userId, params);
  if (
    !p.ok ||
    p.value.period.until !== query.period.until ||
    p.value.period.days !== query.period.days
  )
    throw new ProductionApiError();
  const q = p.value;
  const row = await rpc('admin_read_user_detail', {
    p_user_id: q.userId,
    p_from: q.period.from,
    p_until: q.period.until,
    p_view: q.view,
    p_after: q.after,
    p_before: q.before,
    p_limit: USER_DETAIL_PAGE_SIZE,
  });
  const result = decodeUserDetail(row, q, undefined, 'production');
  if (result === null) throw new ProductionApiError();
  return result === 'not-found' ? null : result;
}
export async function loadProductionPedagogy(query: PedagogyQuery) {
  const p = readPedagogyQuery(pedagogyQueryParams(query));
  if (
    !p.ok ||
    p.query.period.until !== query.period.until ||
    p.query.period.days !== query.period.days ||
    Object.entries(p.query).some(
      ([k, v]) => k !== 'period' && query[k as keyof PedagogyQuery] !== v,
    )
  )
    throw new ProductionApiError();
  const q = p.query;
  const row = await rpc('admin_read_pedagogy', {
    p_from: q.period.from,
    p_until: q.period.until,
    p_chapter: q.chapter,
    p_competence: q.competence,
    p_difficulty: q.difficulty,
    p_exercise_type: q.exerciseType,
    p_mode: q.mode,
    p_group_by: q.groupBy,
    p_sort: q.sort,
    p_page: q.page,
  });
  const result = decodePedagogyStatistics(row, {
    environment: 'production',
    query: q,
  });
  if (!result) throw new ProductionApiError();
  return result;
}
export async function loadProductionReferences(query: PedagogyReferenceQuery) {
  const p = readPedagogyReferenceQuery(new URLSearchParams(query));
  if (!p.ok) throw new ProductionApiError();
  const q = p.query;
  const row = await rpc('admin_read_pedagogy_references', {
    p_kind: q.kind,
    p_query: q.q,
  });
  const result = decodePedagogyReferences(row, {
    environment: 'production',
    query: q,
  });
  if (!result) throw new ProductionApiError();
  return result;
}
