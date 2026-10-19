import { requireAdminPage } from '@/lib/auth/require-admin';
import Link from 'next/link';
import { readLocalPedagogyConfiguration } from '@/lib/pedagogy-config';
import { readLocalActivityConfiguration } from '@/lib/activity-config';
import {
  readStatisticsPeriod,
  type ActivityStatistics,
} from '@/lib/activity-statistics';
import { loadLocalActivityStatistics } from '@/lib/activity-server';
import { ActivityStatisticsView } from '@/components/activity-statistics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
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
    if (!readLocalActivityConfiguration(process.env))
      error = 'Lecture statistique locale non activée.';
    else
      try {
        data = await loadLocalActivityStatistics(period);
      } catch {
        error = 'Le relevé n’a pas pu être chargé. Réessayez dans un instant.';
      }
  }
  return (
    <div className="space-y-5">
      {readLocalPedagogyConfiguration(process.env) && (
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
        environment="local-copy"
        error={error}
      />
    </div>
  );
}
