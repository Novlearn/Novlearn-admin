import Link from 'next/link';
import { formatCount, overviewDate } from '@/lib/dashboard';
import { recordedSuccessRate } from '@/lib/activity-statistics';
import type { ReadEnvironment } from '@/lib/production-read-config';
import {
  decodePedagogyStatistics,
  pedagogyQueryParams,
  type PedagogyQuery,
  type PedagogyStatistics,
} from '@/lib/pedagogy-statistics';
import {
  decodePedagogyReferences,
  type PedagogyReferences,
} from '@/lib/pedagogy-references';
type Choice = PedagogyReferences['items'][number];
const base = '/admin/statistics/pedagogy';
export function PedagogyStatisticsView({
  data,
  query,
  error,
  chapters = null,
  competences = null,
  selectedChapter = null,
  selectedCompetence = null,
  chapterSearch = '',
  competenceSearch = '',
  environment = 'local-copy',
}: {
  data: PedagogyStatistics | null;
  query: PedagogyQuery;
  error?: string;
  chapters?: PedagogyReferences | null;
  competences?: PedagogyReferences | null;
  selectedChapter?: Choice | null;
  selectedCompetence?: Choice | null;
  chapterSearch?: string;
  competenceSearch?: string;
  environment?: ReadEnvironment;
}) {
  const current = decodePedagogyStatistics(data, {
    environment,
    query,
  });
  const chapterResult = decodePedagogyReferences(chapters, {
    environment,
    query: { kind: 'chapter', q: chapterSearch },
  });
  const competenceResult = decodePedagogyReferences(competences, {
    environment,
    query: { kind: 'competence', q: competenceSearch },
  });
  const chapterItems =
      chapterResult?.items ?? current?.references.chapters ?? [],
    competenceItems =
      competenceResult?.items ?? current?.references.competences ?? [];
  const choices = (
    items: Choice[],
    selected: string | null,
    lookedUp: Choice | null,
  ) => {
    const extra =
      selected && !items.some((item) => item.id === selected) ? (
        <option value={selected}>
          {lookedUp?.id === selected
            ? lookedUp.label
            : 'Référence sélectionnée non retrouvée'}
          {lookedUp?.truncated ? '…' : ''} (sélectionnée)
        </option>
      ) : null;
    return (
      <>
        {extra}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.truncated ? '…' : ''}
          </option>
        ))}
      </>
    );
  };
  const pageLink = (page: string) => {
    const params = pedagogyQueryParams({ ...query, page });
    if (chapterSearch) params.set('chapterSearch', chapterSearch);
    if (competenceSearch) params.set('competenceSearch', competenceSearch);
    return base + '?' + params.toString();
  };
  const groupLabel = {
    chapter: 'chapitre',
    competence: 'compétence',
    exercise: 'exercice',
  }[query.groupBy];
  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/admin/statistics"
          prefetch={false}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Activité générale
        </Link>
        <div className="mt-4">
          <span className="badge">
            {environment === 'production'
              ? 'Production · résultats pédagogiques · lecture seule'
              : 'Base pédagogique locale · données synthétiques'}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Résultats pédagogiques
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Explorer les résultats enregistrés par chapitre, compétence et
          exercice. Les références sont celles d’aujourd’hui ; aucune version
          historique manquante n’est inventée. Les résultats des comptes invités
          sont exclus.
        </p>
        <p className="notice mt-4">
          {environment === 'production'
            ? 'Résultats enregistrés en Production. Consultation en lecture seule.'
            : 'Ce jeu de données de test est distinct de l’activité générale et ne décrit pas les utilisateurs de Production. Consultation en lecture seule.'}
        </p>
      </header>
      <form method="get" action={base} className="card space-y-5">
        <input type="hidden" name="page" value="1" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="label">
            Début (UTC)
            <input
              className="field"
              type="date"
              name="from"
              defaultValue={query.period.from}
              required
            />
          </label>
          <label className="label">
            Fin incluse (UTC)
            <input
              className="field"
              type="date"
              name="to"
              defaultValue={query.period.to}
              required
            />
          </label>
          <label className="label">
            Chapitre
            <select
              className="field"
              name="chapter"
              defaultValue={query.chapter ?? ''}
            >
              <option value="">Tous les chapitres</option>
              {choices(chapterItems, query.chapter, selectedChapter)}
            </select>
          </label>
          <label className="label">
            Compétence
            <select
              className="field"
              name="competence"
              defaultValue={query.competence ?? ''}
            >
              <option value="">Toutes les compétences</option>
              {choices(competenceItems, query.competence, selectedCompetence)}
            </select>
          </label>
          <label className="label">
            Difficulté actuelle
            <select
              className="field"
              name="difficulty"
              defaultValue={query.difficulty ?? ''}
            >
              <option value="">Toutes</option>
              <option value="easy">Facile</option>
              <option value="medium">Moyenne</option>
              <option value="hard">Difficile</option>
              <option value="unknown">Non renseignée</option>
            </select>
          </label>
          <label className="label">
            Type actuel
            <select
              className="field"
              name="exerciseType"
              defaultValue={query.exerciseType ?? ''}
            >
              <option value="">Tous les types</option>
              <option value="classic">Classique</option>
              <option value="flash">Flash</option>
              <option value="unknown">Non renseigné</option>
            </select>
          </label>
          <label className="label">
            Activité
            <select className="field" name="mode" defaultValue={query.mode}>
              <option value="all">Pratique et duels</option>
              <option value="exercise">Pratique seulement</option>
              <option value="duel">Duels seulement</option>
            </select>
          </label>
          <label className="label">
            Regrouper par
            <select
              className="field"
              name="groupBy"
              defaultValue={query.groupBy}
            >
              <option value="chapter">Chapitre</option>
              <option value="competence">Compétence</option>
              <option value="exercise">Exercice</option>
            </select>
          </label>
          <label className="label">
            Classement
            <select className="field" name="sort" defaultValue={query.sort}>
              <option value="attempts">Tentatives décroissantes</option>
              <option value="success">Réussite enregistrée croissante</option>
            </select>
          </label>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-blue-700">
            Rechercher un chapitre ou une compétence
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="label">
              Nom ou alias de chapitre
              <input
                className="field"
                name="chapterSearch"
                maxLength={400}
                defaultValue={chapterSearch}
              />
            </label>
            <label className="label">
              Nom de compétence ou de son chapitre
              <input
                className="field"
                name="competenceSearch"
                maxLength={400}
                defaultValue={competenceSearch}
              />
            </label>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            Appliquez la recherche pour actualiser les choix, puis sélectionnez
            la référence. La recherche reste disponible au-delà des 200 premiers
            choix.
          </p>
        </details>
        {(chapterResult?.more ?? current?.references.moreChapters) ||
        (competenceResult?.more ?? current?.references.moreCompetences) ? (
          <p role="status" className="notice">
            Plus de 200 choix correspondent. Affinez la recherche pour retrouver
            une référence absente de la liste ; les résultats agrégés restent
            complets.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <button className="button" type="submit">
            Appliquer les filtres
          </button>
          <Link
            className="text-sm text-blue-700 hover:underline"
            href={base}
            prefetch={false}
          >
            Réinitialiser
          </Link>
          <span className="text-xs text-slate-500">
            De 1 à 90 jours UTC. Le jour courant reste partiel.
          </span>
        </div>
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!current ? (
        <section className="card" role="status">
          <h2 className="text-lg font-semibold">
            Statistiques pédagogiques indisponibles
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Aucun chiffre ne peut être confirmé pour ces filtres. Réessayez
            après vérification de la lecture autorisée.
          </p>
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Relevé du {overviewDate(current.asOf)} (heure de Paris) ·{' '}
            {query.period.days} jours UTC.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Tentatives en pratique', current.totals.exerciseAttempts],
              ['Réponses aux questions en duel', current.totals.duelAttempts],
              ['Duels terminés', current.totals.completedDuels],
              [
                'Exercices différents traités',
                current.completedWork.distinctExercises,
              ],
              ['Réponses terminées', current.completedWork.completedResponses],
              ['Comptes actifs', current.totals.activeAccounts],
            ].map(([label, value]) => (
              <section key={label} className="card">
                <h2 className="text-sm font-medium text-slate-600">{label}</h2>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {formatCount(value)}
                </p>
              </section>
            ))}
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Les réponses terminées sont les réponses enregistrées justes ou
            fausses, hors abandons. Un même exercice compte une seule fois parmi
            les exercices différents, même s’il est répété ou traité par
            plusieurs personnes. Ces compteurs suivent la période et les modes
            sélectionnés. Une réponse sans exercice identifiable reste comptée
            parmi les réponses terminées.
          </p>
          <p className="text-sm leading-7 text-slate-600">
            Une réponse en duel n’est pas un match complet. En mode combiné, le
            taux porte sur les événements des deux modes ; choisissez un mode
            pour comparer des résultats de même nature. Les abandons sont exclus
            du taux. Ces verdicts enregistrés ne sont pas une certification
            Engine.
          </p>
          {Object.values(current.quality).some((v) => v !== '0') && (
            <section className="card border-amber-200">
              <h2 className="font-semibold">Références incomplètes</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  [
                    'Exercice non retrouvé',
                    current.quality.missingExerciseAttempts,
                  ],
                  [
                    'Chapitre absent ou ambigu',
                    current.quality.unresolvedChapterAttempts,
                  ],
                  [
                    'Compétence non renseignée',
                    current.quality.noCompetenceAttempts,
                  ],
                  [
                    'Liens de compétence inconnus',
                    current.quality.unknownCompetenceLinks,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {formatCount(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {query.groupBy === 'competence' && (
            <p className="notice">
              Une tentative peut concerner plusieurs compétences. Les lignes
              peuvent se chevaucher ; les totaux ci-dessus comptent chaque
              tentative une seule fois.
            </p>
          )}
          {current.groups.total === '0' ? (
            <section className="card" role="status">
              <h2 className="font-semibold">Aucun résultat pour ces filtres</h2>
              <p className="mt-2 text-sm text-slate-600">
                La lecture a réussi. Élargissez la période ou retirez un filtre
                pour explorer les données.
              </p>
            </section>
          ) : (
            <section className="card overflow-x-auto">
              <table className="preview-table">
                <caption>
                  Résultats par {groupLabel} · référentiel actuel · page{' '}
                  {formatCount(current.groups.page)}
                </caption>
                <thead>
                  <tr>
                    {[
                      'Référence',
                      'Pratique',
                      'Questions en duel',
                      'Duels terminés',
                      'Actifs',
                      'Correctes',
                      'Incorrectes',
                      'Abandons',
                      'Non classées',
                      'Réussite enregistrée',
                    ].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.groups.rows.map((row) => (
                    <tr key={row.id ?? 'unresolved'}>
                      <th scope="row">
                        {row.label}
                        {row.truncated ? '…' : ''}
                        {row.id === null && (
                          <span className="mt-1 block text-xs font-normal text-amber-800">
                            Référence non résolue
                          </span>
                        )}
                      </th>
                      {[
                        row.counts.exerciseAttempts,
                        row.counts.duelAttempts,
                        row.counts.completedDuels,
                        row.counts.activeAccounts,
                        row.counts.correct,
                        row.counts.incorrect,
                        row.counts.abandoned,
                        row.counts.unclassified,
                      ].map((value, i) => (
                        <td key={i} className="tabular-nums">
                          {formatCount(value)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap tabular-nums">
                        {recordedSuccessRate(
                          row.counts.correct,
                          row.counts.incorrect,
                        ) ?? 'Non calculable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {current.groups.rows.length === 0 && (
                <p role="status" className="mt-3 text-sm text-slate-600">
                  Cette page ne contient plus de ligne. Revenez à la première
                  page.
                </p>
              )}
              <nav
                aria-label="Pagination des résultats pédagogiques"
                className="mt-5 flex flex-wrap items-center gap-4"
              >
                {BigInt(query.page) > BigInt(1) && (
                  <>
                    <Link
                      href={pageLink('1')}
                      prefetch={false}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      Première page
                    </Link>
                    <Link
                      href={pageLink(String(BigInt(query.page) - BigInt(1)))}
                      prefetch={false}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      Page précédente
                    </Link>
                  </>
                )}
                <p className="text-sm text-slate-500">
                  {formatCount(current.groups.total)} groupes · 25 par page
                </p>
                {current.groups.hasMore && (
                  <Link
                    href={pageLink(String(BigInt(query.page) + BigInt(1)))}
                    prefetch={false}
                    className="text-sm text-blue-700 hover:underline"
                  >
                    Page suivante
                  </Link>
                )}
              </nav>
            </section>
          )}
        </>
      )}
    </div>
  );
}
