import { requireAdminPage } from '@/lib/auth/require-admin';
import { readPedagogyConfiguration } from '@/lib/pedagogy-config';
import { readActivityConfiguration } from '@/lib/activity-config';
import {
  readStatisticsPeriod,
  type ActivityStatistics,
  type CohortRetention,
} from '@/lib/activity-statistics';
import { loadActivityStatistics } from '@/lib/activity-server';
import {
  loadProductionCohortRetention,
  loadProductionOverviewMetrics,
  type ProductionOverviewMetrics,
} from '@/lib/production-api';
import { ActivityStatisticsView } from '@/components/activity-statistics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const config = readActivityConfiguration(process.env);
  const exerciseAnalysisEnabled = !!readPedagogyConfiguration(process.env);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, item);
  const filter = readStatisticsPeriod(query);
  const fallback = readStatisticsPeriod(new URLSearchParams());
  if (!fallback.ok) throw Error('Période indisponible');
  const period = filter.ok ? filter.period : fallback.period;
  let error = filter.ok ? undefined : filter.error;
  let data: ActivityStatistics | null = null;
  let overviewMetrics: ProductionOverviewMetrics | null = null;
  let overviewMetricsError = false;
  let retention: CohortRetention | null = null;
  let retentionUnavailable = false;
  if (filter.ok) {
    if (!config) error = 'Lecture statistique non configurée.';
    else
      try {
        data = await loadActivityStatistics(period);
      } catch {
        error = 'Le relevé n’a pas pu être chargé. Réessayez dans un instant.';
      }
    if (config?.environment === 'production') {
      const [metricsResult, retentionResult] = await Promise.allSettled([
        loadProductionOverviewMetrics(period),
        loadProductionCohortRetention(),
      ]);
      if (metricsResult.status === 'fulfilled')
        overviewMetrics = metricsResult.value;
      else overviewMetricsError = true;
      if (retentionResult.status === 'fulfilled')
        retention = retentionResult.value;
      else retentionUnavailable = true;
    }
  }
  return (
    <div className="space-y-5">
      <ActivityStatisticsView
        data={data}
        period={period}
        environment={config?.environment ?? null}
        error={error}
        exerciseAnalysisEnabled={exerciseAnalysisEnabled}
        overviewMetrics={overviewMetrics}
        overviewMetricsError={overviewMetricsError}
        retention={retention}
        retentionUnavailable={retentionUnavailable}
      />
    </div>
  );
}
