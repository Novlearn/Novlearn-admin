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
      <section className="mt-8" aria-labelledby="catalog-title">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="catalog-title" className="text-xl font-semibold">
            Catalogue pédagogique
          </h2>
        </div>
        {data ? (
          <>
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
            <div className="mt-6">
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
    </>
  );
}
