import { formatCount, overviewDate } from '@/lib/dashboard';
import {
  recordedSuccessRate,
  dailyBarHeight,
  decodeActivityStatistics,
  type ActivityStatistics,
  type StatisticsPeriod,
  type StatisticsEnvironment,
} from '@/lib/activity-statistics';

export function ActivityStatisticsView({
  data,
  period,
  environment,
  action = '/admin/statistics',
  error,
}: {
  data: ActivityStatistics | null;
  period: StatisticsPeriod;
  environment: StatisticsEnvironment;
  action?: string;
  error?: string;
}) {
  // A caller cannot accidentally label a local response as Production.
  const current = decodeActivityStatistics(data, { environment, period });
  const rate = current
    ? recordedSuccessRate(current.totals.correct, current.totals.incorrect)
    : null;
  const max =
    current?.daily.reduce(
      (largest, row) =>
        BigInt(row.exerciseAttempts) > BigInt(largest)
          ? row.exerciseAttempts
          : largest,
      '0',
    ) ?? '0';
  return (
    <div className="space-y-7">
      <header>
        <span className="badge">
          {environment === 'local-fixture'
            ? 'Démonstration locale · chiffres fictifs'
            : 'Production · consultation en lecture seule'}
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Activité de la plateforme
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Les dates utilisent UTC. La fin choisie est incluse ; les chiffres du
          jour restent partiels jusqu’à minuit UTC.
        </p>
        {environment === 'local-fixture' && (
          <p className="notice mt-4">
            Cet exemple ne lit aucune base et ne décrit pas l’activité réelle
            des utilisateurs. Le lecteur Production n’est pas activé.
          </p>
        )}
      </header>
      <form
        action={action}
        method="get"
        className="card flex flex-wrap items-end gap-4"
      >
        <label className="label">
          Début (UTC)
          <input
            type="date"
            name="from"
            className="field"
            required
            defaultValue={period.from}
          />
        </label>
        <label className="label">
          Fin incluse (UTC)
          <input
            type="date"
            name="to"
            className="field"
            required
            defaultValue={period.to}
          />
        </label>
        <button type="submit" className="button">
          Afficher la période
        </button>
        <p className="text-sm text-slate-500">90 jours au maximum.</p>
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!current ? (
        <section className="card" role="status">
          <h2 className="text-lg font-semibold">Statistiques indisponibles</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Aucun chiffre ne peut être confirmé pour cette période. La connexion
            de lecture et ses permissions doivent être qualifiées avant
            utilisation de données réelles.
          </p>
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Relevé du {overviewDate(current.asOf)} (heure de Paris) ·{' '}
            {period.days} jour
            {period.days > 1 ? 's' : ''} UTC.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['Comptes Auth présents', current.accounts.total],
              ['Dont comptes anonymes', current.accounts.anonymous],
              [
                'Nouveaux comptes sur la période',
                current.totals.accountsCreated,
              ],
              ['Comptes actifs sur la période', current.totals.activeAccounts],
              [
                'Tentatives d’exercices enregistrées',
                current.totals.exerciseAttempts,
              ],
              ['Tentatives de duel enregistrées', current.totals.duelAttempts],
              ['Duels terminés sur la période', current.totals.completedDuels],
            ].map(([label, value]) => (
              <section className="card" key={label}>
                <h2 className="text-sm font-medium text-slate-600">{label}</h2>
                <p className="mt-3 break-all text-3xl font-semibold tabular-nums">
                  {formatCount(value)}
                </p>
              </section>
            ))}
            <section className="card">
              <h2 className="text-sm font-medium text-slate-600">
                Réussite déclarée des tentatives d’exercice
              </h2>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {rate ?? 'Non calculable'}
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                {rate === null
                  ? 'Aucune tentative avec verdict classé.'
                  : 'Calculée sur les verdicts vrai/faux enregistrés, hors abandons et cas non classés.'}
              </p>
            </section>
          </div>
          <section className="card space-y-5">
            <h2 className="text-xl font-semibold">Tentatives par jour UTC</h2>
            <div
              className="flex h-36 items-end gap-px border-b border-slate-200"
              aria-hidden="true"
            >
              {current.daily.map((row) => (
                <div
                  key={row.date}
                  className="min-w-0 flex-1 rounded-t bg-blue-600"
                  style={{
                    height: dailyBarHeight(row.exerciseAttempts, max) + '%',
                  }}
                />
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-4 text-left leading-6 text-slate-500">
                  Valeurs exactes du graphique et de l’activité quotidienne. Un
                  compte actif plusieurs jours compte une fois par jour et une
                  seule fois dans le total de la période.
                </caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    {[
                      'Date UTC',
                      'Comptes actifs',
                      'Nouveaux comptes',
                      'Tentatives exercices',
                      'Tentatives duel',
                      'Duels terminés',
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 font-semibold"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.daily.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100">
                      <th
                        scope="row"
                        className="whitespace-nowrap px-3 py-3 font-medium"
                      >
                        {row.date}
                      </th>
                      {[
                        'activeAccounts',
                        'accountsCreated',
                        'exerciseAttempts',
                        'duelAttempts',
                        'completedDuels',
                      ].map((key) => (
                        <td className="px-3 py-3 tabular-nums" key={key}>
                          {formatCount(row[key as keyof typeof row])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card space-y-3 text-sm leading-7 text-slate-600">
            <h2 className="text-lg font-semibold text-slate-900">
              Comment lire ces indicateurs
            </h2>
            <p>
              Le stock de comptes provient d’Auth au moment du relevé, pas du
              nombre de profils. Il est distinct des nouveaux comptes et des
              comptes actifs de la période.
            </p>
            <p>
              Un compte actif possède au moins une tentative d’exercice ou de
              duel dans la période et figure encore dans Auth au moment du
              relevé. Les comptes anonymes sont inclus. Les tentatives sans
              compte connu restent dans les volumes, sans créer un compte actif.
            </p>
            <p>
              Le taux décrit les verdicts enregistrés ; il ne certifie pas
              rétroactivement la correction mathématique des données
              historiques. Les états indéterminés du moteur ne doivent pas être
              convertis en échecs.
            </p>
            <p>
              Exercices : {formatCount(current.totals.correct)} verdicts
              positifs, {formatCount(current.totals.incorrect)} négatifs,{' '}
              {formatCount(current.totals.abandoned)} abandons,{' '}
              {formatCount(current.totals.unclassified)} non classés. Ces quatre
              catégories couvrent les tentatives enregistrées.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
