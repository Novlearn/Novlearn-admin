import Link from 'next/link';
import { editorialLabels } from '@/lib/catalogue';
import {
  dashboardStatuses,
  formatCount,
  overviewDate,
  type ContentOverview as Overview,
} from '@/lib/dashboard';

export function ContentOverview({ data }: { data: Overview | null }) {
  return (
    <>
      <p className="text-sm font-medium text-slate-500">Administration</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Vue d’ensemble
        </h1>
        <form action="/admin" method="get">
          <button
            type="submit"
            className="text-sm font-semibold text-brand-700 underline underline-offset-4"
          >
            Actualiser les indicateurs
          </button>
        </form>
      </div>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">
        Votre catalogue et vos contenus pédagogiques. Chaque indicateur précise
        son environnement d’origine.
      </p>
      <section className="mt-8" aria-labelledby="catalog-title">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge">Staging</span>
          <h2 id="catalog-title" className="text-xl font-semibold">
            Catalogue pédagogique
          </h2>
        </div>
        {data ? (
          <>
            <p className="mt-3 text-sm text-slate-500">
              Relevé du{' '}
              <time dateTime={data.asOf}>{overviewDate(data.asOf)}</time>.{' '}
              <Link
                href="/admin/exercises"
                className="font-medium text-brand-700 underline"
              >
                {formatCount(data.catalogue.total)} exercices au total
              </Link>
              , archives comprises.
            </p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {dashboardStatuses.map((status) => (
                <div className="card" key={status}>
                  <dt>
                    <Link
                      className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-brand-700"
                      href={`/admin/exercises?status=${status}`}
                    >
                      {editorialLabels[status]}
                    </Link>
                  </dt>
                  <dd className="mt-3 text-3xl font-semibold tabular-nums">
                    {formatCount(data.catalogue[status])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Un exercice est compté une fois, selon sa dernière révision ;
              l’archivage est prioritaire. « Publié » décrit le statut dans
              Staging. Ce relevé ne confirme pas la version en Production.
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="card" aria-labelledby="failed-title">
                <h3 id="failed-title" className="font-semibold">
                  Tests en échec
                </h3>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {formatCount(data.tests.failed)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Dernier reçu enregistré pour le contenu et l’état actuels de
                  la dernière révision, hors archives. Un ancien échec remplacé
                  par un succès ou invalidé par une édition n’est pas compté.
                </p>
                <Link
                  href="/admin/exercises"
                  className="mt-4 inline-block text-sm font-semibold text-brand-700 underline"
                >
                  Consulter les exercices et leurs tests
                </Link>
              </section>
              <section className="card" aria-labelledby="active-title">
                <h3 id="active-title" className="font-semibold">
                  Versions actives dans Staging
                </h3>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {formatCount(data.activeVersions)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Exercices non archivés dont le pointeur actif désigne une
                  version publiée. Une nouvelle révision brouillon peut
                  coexister avec cette version active.
                </p>
              </section>
            </div>
            <section className="card mt-6" aria-labelledby="recent-title">
              <h3 id="recent-title" className="text-lg font-semibold">
                Versions actives récentes · Staging
              </h3>
              {data.recentActiveVersions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  Aucune version publiée active dans Staging.
                </p>
              ) : (
                <ol className="mt-4 divide-y divide-slate-100">
                  {data.recentActiveVersions.map((item) => (
                    <li
                      key={item.versionId}
                      className="flex flex-wrap items-start justify-between gap-3 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          className="break-words font-medium text-brand-700 underline"
                          href={`/admin/exercises/${item.exerciseId}`}
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          Révision {item.revision} · Exercice {item.exerciseId}
                        </p>
                      </div>
                      <time
                        className="text-sm text-slate-500"
                        dateTime={item.publishedAt}
                      >
                        {overviewDate(item.publishedAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Les cinq versions actuellement actives les plus récentes, par
                date de publication de la version. Ce n’est pas un journal des
                transferts ou retours arrière.
              </p>
            </section>
            <section className="mt-6" aria-labelledby="content-title">
              <h3 id="content-title" className="text-lg font-semibold">
                Référentiel et flashcards · Staging
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ['chapters', 'Chapitres', '/admin/chapters'],
                    ['competences', 'Compétences', '/admin/competences'],
                    ['flashcards', 'Flashcards', '/admin/flashcards'],
                  ] as const
                ).map(([key, label, href]) => (
                  <div key={key} className="card">
                    <dt>
                      <Link
                        className="font-medium text-slate-600 underline"
                        href={href}
                      >
                        {label}
                      </Link>
                    </dt>
                    <dd className="mt-3 text-3xl font-semibold tabular-nums">
                      {formatCount(data.content[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        ) : (
          <div className="card mt-5" role="status">
            <h3 className="font-semibold">Indicateurs Staging indisponibles</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Le relevé n’a pas pu être chargé. Aucun nombre n’est affiché tant
              que les données ne sont pas disponibles.
            </p>
            <Link
              className="mt-4 inline-block font-medium text-brand-700 underline"
              href="/admin/exercises"
            >
              Accéder au catalogue
            </Link>
          </div>
        )}
      </section>
      <section className="card mt-8" aria-labelledby="production-title">
        <span className="badge bg-slate-100 text-slate-600">
          Production · accès non activé
        </span>
        <h2 id="production-title" className="mt-5 text-xl font-semibold">
          Activité NovLearn
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Les comptes, utilisateurs actifs, tentatives et taux de réussite
          nécessitent un accès Production distinct en lecture seule. Ces
          indicateurs restent indisponibles jusqu’à sa validation.
        </p>
      </section>
    </>
  );
}
