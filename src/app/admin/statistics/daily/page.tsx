import { ActivityStatisticsDetails } from '@/components/activity-statistics-details';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { loadActivityStatistics } from '@/lib/activity-server';
import { readActivityConfiguration } from '@/lib/activity-config';
import {
  decodeActivityStatistics,
  recordedSuccessRate,
  readStatisticsPeriod,
  type ActivityStatistics,
} from '@/lib/activity-statistics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DailyStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const config = readActivityConfiguration(process.env);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  const filter = readStatisticsPeriod(params);
  const fallback = readStatisticsPeriod(new URLSearchParams());
  if (!fallback.ok) throw Error('Période indisponible');
  const period = filter.ok ? filter.period : fallback.period;
  let error = filter.ok ? undefined : filter.error;
  let data: ActivityStatistics | null = null;
  if (filter.ok) {
    if (!config) error = 'Lecture statistique non configurée.';
    else {
      try {
        data = await loadActivityStatistics(period);
      } catch {
        error = 'Le relevé n’a pas pu être chargé. Réessayez dans un instant.';
      }
    }
  }
  const current = config
    ? decodeActivityStatistics(data, {
        environment: config.environment,
        period,
      })
    : null;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <span className="badge">
          {!config
            ? 'Non configuré'
            : config.environment === 'production'
              ? 'Production'
              : config.environment === 'local-copy'
                ? 'Copie locale'
                : 'Démo locale'}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          Détail quotidien
        </h1>
      </header>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {current ? (
        <ActivityStatisticsDetails
          daily={current.daily}
          period={period}
          totals={current.totals}
          registeredAccounts={current.accounts.total}
          successRate={recordedSuccessRate(
            current.totals.correct,
            current.totals.incorrect,
          )}
        />
      ) : (
        <section className="card" role="status">
          <p>Aucune donnée n’est disponible pour cette période.</p>
        </section>
      )}
    </div>
  );
}
