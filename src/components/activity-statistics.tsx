import Link from 'next/link';
import { formatCount, overviewDate } from '@/lib/dashboard';
import {
  cohortRetentionRate,
  decodeActivityStatistics,
  recordedSuccessRate,
  type ActivityStatistics,
  type CohortRetention,
  type StatisticsEnvironment,
  type StatisticsPeriod,
} from '@/lib/activity-statistics';
import type { ProductionOverviewMetrics } from '@/lib/production-api';
import { ActivityStatisticsCharts } from './activity-statistics-charts';

const periodOptions = [
  { days: 7, label: '7 jours' },
  { days: 14, label: '14 jours' },
  { days: 30, label: '1 mois' },
  { days: 60, label: '2 mois' },
] as const;

export function ActivityStatisticsView({
  data,
  period,
  environment,
  error,
  exerciseAnalysisEnabled = false,
  overviewMetrics = null,
  overviewMetricsError = false,
  retention = null,
  retentionUnavailable = false,
}: {
  data: ActivityStatistics | null;
  period: StatisticsPeriod;
  environment: StatisticsEnvironment | null;
  error?: string;
  exerciseAnalysisEnabled?: boolean;
  overviewMetrics?: ProductionOverviewMetrics | null;
  overviewMetricsError?: boolean;
  retention?: CohortRetention | null;
  retentionUnavailable?: boolean;
}) {
  const current = environment
    ? decodeActivityStatistics(data, { environment, period })
    : null;
  const rate = current
    ? recordedSuccessRate(current.totals.correct, current.totals.incorrect)
    : null;
  const sourceLabel = !environment
    ? 'Non configuré'
    : environment === 'production'
      ? 'Production'
      : environment === 'local-fixture'
        ? 'Démo locale'
        : 'Copie locale';

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge">{sourceLabel}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Statistiques
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {exerciseAnalysisEnabled && (
            <Link
              href="/admin/statistics/pedagogy"
              prefetch={false}
              className="text-sm font-medium text-blue-700 hover:text-blue-900"
            >
              Comparer par chapitre, compétence ou exercice →
            </Link>
          )}
          {current && (
            <p className="text-sm text-slate-500">
              Actualisé le {overviewDate(current.asOf)}
            </p>
          )}
        </div>
      </header>

      <nav
        aria-label="Période des statistiques"
        className="flex flex-wrap gap-2"
      >
        {periodOptions.map(({ days, label }) => {
          const to = period.to;
          const end = Date.parse(`${to}T00:00:00.000Z`);
          const from = new Date(
            Math.max(
              Date.parse('2000-01-01T00:00:00.000Z'),
              end - (days - 1) * 86400000,
            ),
          )
            .toISOString()
            .slice(0, 10);
          return (
            <Link
              key={days}
              href={`/admin/statistics?from=${from}&to=${to}`}
              aria-current={period.days === days ? 'page' : undefined}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${period.days === days ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!current ? (
        <section className="card" role="status">
          <h2 className="text-lg font-semibold">Statistiques indisponibles</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Aucun chiffre confirmé ne peut être affiché pour cette période.
          </p>
        </section>
      ) : (
        <>
          {environment === 'local-fixture' && (
            <p className="notice">Les chiffres affichés sont fictifs.</p>
          )}
          {environment === 'local-copy' && (
            <p className="notice">
              Les chiffres affichés viennent d’une copie locale.
            </p>
          )}

          <section className="space-y-4" aria-label="Indicateurs de la période">
            <h2 className="text-xl font-semibold">Sur la période</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Comptes actifs"
                value={current.totals.activeAccounts}
                accent
              />
              <MetricCard
                label="Tentatives réalisées"
                value={sum(
                  current.totals.exerciseAttempts,
                  current.totals.duelAttempts,
                )}
              />
              <MetricCard label="Réussite aux exercices" value={rate ?? '—'} />
              <MetricCard
                label="Duels terminés"
                value={current.totals.completedDuels}
              />
              <MetricCard
                label="Nouveaux comptes"
                value={current.totals.accountsCreated}
              />
              {overviewMetrics && (
                <MetricCard
                  label="Exercices créés"
                  value={overviewMetrics.exercisesCreated}
                />
              )}
              {overviewMetrics && (
                <MetricCard
                  label="Feedbacks reçus"
                  value={overviewMetrics.feedbacks.total}
                  detail={`${formatCount(overviewMetrics.feedbacks.pending)} à traiter · ${formatCount(overviewMetrics.feedbacks.approved)} validés · ${formatCount(overviewMetrics.feedbacks.rejected)} refusés`}
                />
              )}
            </div>
          </section>
          <section className="space-y-4" aria-label="Totaux actuels">
            <h2 className="text-xl font-semibold">Repères actuels</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Comptes inscrits actuellement"
                value={current.accounts.total}
              />
              {overviewMetrics && (
                <MetricCard
                  label="Exercices actuellement au catalogue"
                  value={overviewMetrics.exerciseCatalogCount}
                />
              )}
            </div>
          </section>
          {overviewMetricsError && (
            <p role="status" className="notice">
              Les compteurs du catalogue, des créations et des feedbacks sont
              indisponibles.
            </p>
          )}
          {retention && <RetentionCard retention={retention} />}
          {retentionUnavailable && (
            <p role="status" className="notice">
              La mesure de rétention n’est pas encore activée en Production.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Activité sur la période</h2>
            <Link
              href={`/admin/statistics/daily?from=${period.from}&to=${period.to}`}
              prefetch={false}
              className="button"
            >
              Voir le détail quotidien
            </Link>
          </div>
          <ActivityStatisticsCharts daily={current.daily} />
        </>
      )}
    </div>
  );
}

function sum(a: string, b: string) {
  return (BigInt(a) + BigInt(b)).toString();
}

function MetricCard({
  label,
  value,
  accent = false,
  detail,
}: {
  label: string;
  value: string;
  accent?: boolean;
  detail?: string;
}) {
  return (
    <section
      className={`card ${accent ? 'border-blue-200 bg-blue-50/70' : ''}`}
    >
      <h2 className="text-sm font-medium text-slate-600">{label}</h2>
      <p className="mt-3 break-all text-3xl font-semibold tabular-nums tracking-tight">
        {label === 'Réussite aux exercices' ? value : formatCount(value)}
      </p>
      {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
    </section>
  );
}

function RetentionCard({ retention }: { retention: CohortRetention }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Rétention des nouveaux comptes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Retours le 7ᵉ et le 30ᵉ jour après l’inscription · même cohorte,
          inscrite du {retention.cohortPeriod.from} au{' '}
          {retention.cohortPeriod.until} exclu.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RetentionValue label="J+7" bucket={retention.d7} />
        <RetentionValue label="J+30" bucket={retention.d30} />
      </div>
    </section>
  );
}

function RetentionValue({
  label,
  bucket,
}: {
  label: string;
  bucket: CohortRetention['d7'];
}) {
  const rate = cohortRetentionRate(bucket);
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-600">Rétention {label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{rate ?? '—'}</p>
      <p className="mt-1 text-xs text-slate-500">
        {rate === null
          ? `Aucune cohorte arrivée à ${label}`
          : `${formatCount(bucket.returnedAccounts)} retours sur ${formatCount(bucket.eligibleAccounts)} comptes éligibles`}
      </p>
    </div>
  );
}
