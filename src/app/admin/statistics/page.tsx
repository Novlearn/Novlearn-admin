import { requireAdminPage } from '@/lib/auth/require-admin';
import Link from 'next/link';
import { readPedagogyConfiguration } from '@/lib/pedagogy-config';
import { readActivityConfiguration } from '@/lib/activity-config';
import {
  readStatisticsPeriod,
  type ActivityStatistics,
} from '@/lib/activity-statistics';
import { loadActivityStatistics } from '@/lib/activity-server';
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
  if (filter.ok) {
    if (!config) error = 'Lecture statistique non configurée.';
    else
      try {
        data = await loadActivityStatistics(period);
      } catch {
        error = 'Le relevé n’a pas pu être chargé. Réessayez dans un instant.';
      }
  }
  return (
    <div className="space-y-5">
      {readPedagogyConfiguration(process.env) && (
        <Link
          href="/admin/statistics/pedagogy"
          prefetch={false}
          className="button"
        >
          Explorer les résultats pédagogiques
        </Link>
      )}
      <ActivityStatisticsView
        data={data}
        period={period}
        environment={config?.environment ?? 'production'}
        error={error}
      />
    </div>
  );
}
