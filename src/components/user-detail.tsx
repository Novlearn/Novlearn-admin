import Link from 'next/link';
import { formatCount, overviewDate } from '@/lib/dashboard';
import type { ReadEnvironment } from '@/lib/production-read-config';
import {
  decodeUserDetail,
  userDetailHref,
  type UserDetailPage,
  type UserDetailQuery,
  type UserDetailView,
  type UserHistoryItem,
  type ChapterProgressItem,
  type CompetenceProgressItem,
} from '@/lib/user-detail';

const views: [UserDetailView, string][] = [
  ['history', 'Historique'],
  ['chapters', 'Chapitres'],
  ['competences', 'Compétences'],
];
const issueLabels: Record<string, string> = {
  'missing-level': 'Niveau non renseigné',
  'missing-count': 'Nombre d’exercices non renseigné',
  'invalid-count': 'Nombre d’exercices incohérent',
  'missing-date': 'Date non renseignée',
  'future-date': 'Date future signalée',
  'unknown-competence': 'Compétence absente du référentiel actuel',
  'points-above-current-maximum': 'Points supérieurs au barème actuel',
};
function Issues({ issues }: { issues: string[] }) {
  return issues.length > 0 ? (
    <ul className="mt-2 space-y-1 text-xs text-amber-800">
      {issues.map((issue) => (
        <li key={issue}>{issueLabels[issue]}</li>
      ))}
    </ul>
  ) : null;
}
const recordedDate = (value: string | null) =>
  value ? overviewDate(value) : 'Date inconnue';
const counted = (count: string, word: string) =>
  formatCount(count) + ' ' + word + (count === '1' ? '' : 's');
function HistoryRows({ items }: { items: UserHistoryItem[] }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-4 text-left font-semibold">
        Tentatives enregistrées sur la période UTC
      </caption>
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th scope="col" className="p-3">
            Date à Paris
          </th>
          <th scope="col" className="p-3">
            Activité
          </th>
          <th scope="col" className="p-3">
            Résultat historique
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr
            key={row.kind + ':' + row.id}
            className="border-b border-slate-100 last:border-0"
          >
            <td className="whitespace-nowrap p-3">
              <time dateTime={row.occurredAt}>
                {overviewDate(row.occurredAt)}
              </time>
            </td>
            <th scope="row" className="max-w-lg p-3 font-normal">
              <p className="font-semibold">
                {row.kind === 'duel'
                  ? 'Tentative en duel n° ' + row.duelId
                  : row.exerciseId
                    ? 'Exercice n° ' + row.exerciseId
                    : 'Exercice sans référence'}
              </p>
              {row.currentTitle && (
                <p className="mt-1 break-words text-slate-600">
                  Titre actuel : {row.currentTitle}
                  {row.titleTruncated && (
                    <span className="ml-1 text-xs">(abrégé)</span>
                  )}
                </p>
              )}
              <p className="mt-1 break-all text-xs text-slate-500">
                {row.kind === 'duel'
                  ? 'Version non consultée dans ce relevé.'
                  : row.versionId
                    ? 'Version référencée : ' + row.versionId
                    : 'Version historique non renseignée.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tentative n° {row.id}
              </p>
            </th>
            <td className="p-3">
              <span className="badge">
                {row.outcome === 'abandoned'
                  ? 'Abandon déclaré'
                  : row.outcome === 'correct'
                    ? 'Réussite déclarée'
                    : 'Échec déclaré'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function ChapterRows({ items }: { items: ChapterProgressItem[] }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-4 text-left font-semibold">
        Progression enregistrée par chapitre · état actuel
      </caption>
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th scope="col" className="p-3">
            Libellé enregistré
          </th>
          <th scope="col" className="p-3">
            Niveau enregistré
          </th>
          <th scope="col" className="p-3">
            Exercices terminés
          </th>
          <th scope="col" className="p-3">
            Dernière date enregistrée
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 last:border-0">
            <th scope="row" className="max-w-md break-words p-3 font-semibold">
              {row.label}
              {row.labelTruncated && (
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Libellé abrégé
                </span>
              )}
              <Issues issues={row.issues} />
            </th>
            <td className="p-3">
              {row.level === null ? 'Non renseigné' : row.level + ' / 100'}
            </td>
            <td className="p-3">
              {row.completed === null
                ? row.issues.includes('invalid-count')
                  ? 'Valeur incohérente'
                  : 'Non renseigné'
                : formatCount(row.completed)}
            </td>
            <td className="p-3">{recordedDate(row.recordedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function CompetenceRows({ items }: { items: CompetenceProgressItem[] }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="mb-4 text-left font-semibold">
        Points enregistrés par compétence · barème actuel
      </caption>
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th scope="col" className="p-3">
            Compétence
          </th>
          <th scope="col" className="p-3">
            Chapitre actuel
          </th>
          <th scope="col" className="p-3">
            Points enregistrés
          </th>
          <th scope="col" className="p-3">
            Dernière date enregistrée
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 last:border-0">
            <th scope="row" className="max-w-md break-words p-3 font-semibold">
              {row.label}
              {row.labelTruncated && (
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Libellé abrégé
                </span>
              )}
              <Issues issues={row.issues} />
            </th>
            <td className="max-w-sm break-words p-3">
              {row.chapterName ?? 'Chapitre non identifié'}
              {row.chapterNameTruncated && (
                <span className="block text-xs text-slate-500">
                  Libellé abrégé
                </span>
              )}
            </td>
            <td className="p-3">
              {formatCount(row.points)} points
              {row.maximum !== null
                ? ' / ' + formatCount(row.maximum)
                : ' · barème inconnu'}
            </td>
            <td className="p-3">{recordedDate(row.recordedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function UserDetailView({
  data,
  query,
  error,
  environment = 'local-copy',
}: {
  data: UserDetailPage | null;
  query: UserDetailQuery;
  error?: string;
  environment?: ReadEnvironment;
}) {
  const decoded = decodeUserDetail(data, query, undefined, environment);
  const current = decoded && decoded !== 'not-found' ? decoded : null;
  const back = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
  });
  return (
    <div className="space-y-7">
      <Link
        className="text-sm font-semibold text-blue-700"
        href={'/admin/users?' + back}
        prefetch={false}
      >
        ← Retour aux utilisateurs
      </Link>
      <header>
        <span className="badge">
          {environment === 'production'
            ? 'Production · fiche utilisateur · lecture seule'
            : 'Base locale synthétique · fiche utilisateur'}
        </span>
        <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight">
          {current ? current.user.name : 'Fiche utilisateur'}
        </h1>
        {current && (
          <p className="mt-2 break-all text-slate-600">
            {current.user.email?.trim()
              ? current.user.email
              : current.user.anonymous
                ? 'Compte invité · identité masquée'
                : 'E-mail non renseigné'}
            {current.user.nameTruncated && (
              <span className="ml-2 text-sm">Nom abrégé</span>
            )}
          </p>
        )}
        <p className="notice mt-4">
          {environment === 'production'
            ? 'Données réelles.'
            : 'Comptes de test.'}{' '}
          Les résultats et niveaux enregistrés ne constituent pas une
          certification par l’Engine. Aucune modification de compte n’est
          proposée.
        </p>
      </header>
      <form
        method="get"
        action={'/admin/users/' + query.userId}
        className="card flex flex-wrap items-end gap-4"
      >
        <input type="hidden" name="view" value={query.view} />
        <label className="label">
          Début (UTC)
          <input
            className="field"
            name="from"
            type="date"
            required
            defaultValue={query.period.from}
          />
        </label>
        <label className="label">
          Fin incluse (UTC)
          <input
            className="field"
            name="to"
            type="date"
            required
            defaultValue={query.period.to}
          />
        </label>
        <button type="submit" className="button">
          Actualiser la période
        </button>
        <p className="w-full text-sm leading-6 text-slate-500">
          90 jours au maximum. La période filtre les tentatives ; les chapitres
          et compétences montrent l’état enregistré actuel, hors filtre de
          période. Les dates sont affichées à Paris.
        </p>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!current ? (
        <section className="card" role="status">
          <h2 className="font-semibold">Fiche utilisateur indisponible</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aucune fiche vérifiée n’a pu être chargée.
          </p>
        </section>
      ) : (
        <>
          <section
            aria-label="Activité sur la période"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {[
              [
                'Tentatives d’exercice',
                formatCount(current.activity.exerciseAttempts),
              ],
              [
                'Tentatives en duel',
                formatCount(current.activity.duelAttempts),
              ],
              [
                'Abandons déclarés',
                formatCount(current.activity.exerciseAbandoned),
              ],
              [
                'Dernière tentative',
                current.activity.lastActivity
                  ? overviewDate(current.activity.lastActivity)
                  : 'Aucune sur la période',
              ],
            ].map(([title, value]) => (
              <div className="card" key={title}>
                <h2 className="text-sm text-slate-500">{title}</h2>
                <p className="mt-3 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </section>
          <p className="text-sm leading-7 text-slate-600">
            Déclarations dans la période : exercices,{' '}
            {counted(current.activity.exerciseCorrect, 'réussite')} et{' '}
            {counted(current.activity.exerciseIncorrect, 'échec')} ; duels,{' '}
            {counted(current.activity.duelCorrect, 'réussite')} et{' '}
            {counted(current.activity.duelIncorrect, 'échec')}. Les abandons
            restent comptés séparément.
          </p>
          {(current.activity.undatedExerciseAttempts !== '0' ||
            current.activity.undatedDuelAttempts !== '0') && (
            <p className="notice">
              {counted(current.activity.undatedExerciseAttempts, 'tentative')}{' '}
              d’exercice et{' '}
              {counted(current.activity.undatedDuelAttempts, 'tentative')} en
              duel sans date dans les données enregistrées : elles ne sont pas
              attribuées à la période ou à l’historique daté.
            </p>
          )}
          <nav aria-label="Vues du profil" className="flex flex-wrap gap-2">
            {views.map(([view, title]) => (
              <Link
                prefetch={false}
                key={view}
                href={userDetailHref(query, { view })}
                aria-current={query.view === view ? 'page' : undefined}
                className={
                  'rounded-lg border px-4 py-2 text-sm font-semibold ' +
                  (query.view === view
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600')
                }
              >
                {title}
              </Link>
            ))}
          </nav>
          <p className="text-sm leading-7 text-slate-600">
            {query.view === 'history'
              ? 'Une ligne représente une tentative d’exercice ou une réponse enregistrée en duel. Les titres consultés sont actuels ; une version historique absente n’est jamais déduite de la version active.'
              : query.view === 'chapters'
                ? 'Les libellés de chapitre sont ceux enregistrés dans la progression historique ; ils ne sont pas rattachés arbitrairement au référentiel actuel.'
                : 'Les points sont affichés tels qu’enregistrés, face au barème actuel lorsqu’il est connu. Un barème manquant ou dépassé reste signalé, sans recalcul ni plafonnement.'}
          </p>
          <div className="flex flex-wrap justify-between gap-3 text-sm text-slate-500">
            <p>{counted(current.page.total, 'ligne')} dans cette vue</p>
            <p>Relevé du {overviewDate(current.asOf)}</p>
          </div>
          {current.items.length === 0 ? (
            <section className="card" role="status">
              <h2 className="font-semibold">
                {current.page.total === '0'
                  ? query.view === 'history'
                    ? 'Aucune tentative datée sur cette période.'
                    : 'Aucune progression enregistrée dans cette vue.'
                  : 'Cette page ne contient plus de résultat.'}
              </h2>
              {current.page.total !== '0' && (
                <Link
                  className="mt-3 inline-block font-semibold text-blue-700"
                  prefetch={false}
                  href={userDetailHref(query)}
                >
                  Revenir au début de cette vue
                </Link>
              )}
            </section>
          ) : (
            <div className="card overflow-x-auto">
              {query.view === 'history' ? (
                <HistoryRows items={current.items as UserHistoryItem[]} />
              ) : query.view === 'chapters' ? (
                <ChapterRows items={current.items as ChapterProgressItem[]} />
              ) : (
                <CompetenceRows
                  items={current.items as CompetenceProgressItem[]}
                />
              )}
            </div>
          )}
          <nav
            aria-label="Pagination de la vue du profil"
            className="flex justify-between gap-4"
          >
            {current.page.previous ? (
              <Link
                className="button-secondary"
                prefetch={false}
                href={userDetailHref(query, { before: current.page.previous })}
              >
                Page précédente
              </Link>
            ) : (
              <span />
            )}
            {current.page.next ? (
              <Link
                className="button-secondary"
                prefetch={false}
                href={userDetailHref(query, { after: current.page.next })}
              >
                Page suivante
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
