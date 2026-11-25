'use client';
import Link from 'next/link';
import { difficultyLabel } from '@/lib/exercise-metadata';
import {
  catalogueStatusOptions,
  editorialLabels,
  exerciseDisplayTitle,
  PAGE_SIZE,
  type CatalogueFilter,
  type CataloguePage,
} from '@/lib/catalogue';

export function EditorialBadge({
  status,
}: {
  status: keyof typeof editorialLabels;
}) {
  const color =
    status === 'published'
      ? 'bg-amber-50 text-amber-800'
      : status === 'approved' || status === 'ready'
        ? 'bg-indigo-50 text-indigo-700'
        : status === 'legacy' || status === 'archived'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-blue-50 text-blue-700';
  return (
    <span className={`badge ${color}`}>
      {editorialLabels[status === 'in_review' ? 'draft' : status]}
    </span>
  );
}
export function CatalogueList({
  data,
  filter,
}: {
  data: CataloguePage | null;
  filter: CatalogueFilter;
}) {
  const pageLink = (page: number) =>
    `/admin/exercises?${new URLSearchParams({ q: filter.query, status: filter.status, sort: filter.sort, page: String(page) })}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Exercices
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/catalogue-sync"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            Synchroniser le catalogue
          </Link>
          <Link
            href="/admin/exercises/new"
            className="button inline-flex items-center gap-2"
          >
            <span aria-hidden="true">＋</span> Nouvel exercice
          </Link>
        </div>
      </div>
      <form
        action="/admin/exercises"
        className="card mt-8 grid gap-4 md:grid-cols-[1fr_200px_180px_auto] md:items-end"
      >
        <label className="label">
          Rechercher
          <input
            name="q"
            defaultValue={filter.query}
            maxLength={120}
            placeholder="Titre ou identifiant…"
            className="field"
            type="search"
          />
        </label>
        <label className="label">
          Statut
          <select name="status" defaultValue={filter.status} className="field">
            <option value="all">Tous les statuts</option>
            {filter.status === 'approved' && (
              <option value="approved">Approuvé (ancien statut)</option>
            )}
            {catalogueStatusOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Trier par
          <select name="sort" defaultValue={filter.sort} className="field">
            <option value="recent">Plus récents</option>
            <option value="title">Titre</option>
          </select>
        </label>
        <button type="submit" className="button">
          Filtrer
        </button>
      </form>
      {!data ? (
        <div className="notice mt-6" role="status">
          Le catalogue Préproduction est indisponible. Réessayez plus tard.
        </div>
      ) : (
        <section
          className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          aria-label="Catalogue Préproduction"
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <p className="text-sm font-medium text-slate-600">
                {data.total} exercice{data.total > 1 ? 's' : ''}
              </p>
              <span className="badge">Préproduction</span>
            </div>
            {data.items.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <h2 className="text-lg font-semibold">
                  {data.total
                    ? 'Aucun exercice sur cette page'
                    : filter.query || filter.status !== 'all'
                      ? 'Aucun résultat'
                      : 'Votre catalogue est prêt à accueillir ses premiers exercices'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {filter.query || filter.status !== 'all'
                    ? 'Essayez une autre recherche ou un autre statut.'
                    : 'Créez un brouillon pour commencer.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Exercices et dernières révisions de Préproduction
                  </caption>
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {[
                        'Exercice',
                        'Chapitre · niveau',
                        'Format',
                        'Statut',
                        'Version',
                        'Modifié',
                      ].map((title) => (
                        <th
                          key={title}
                          scope="col"
                          className="px-6 py-3 font-semibold"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((item) => {
                      const title = exerciseDisplayTitle(
                        item.title,
                        item.appTitle,
                      );
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="min-w-64 px-6 py-5">
                            <Link
                              href={`/admin/exercises/${item.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {title}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">
                              #{item.id}
                            </p>
                            {item.skills.length > 0 && (
                              <p className="mt-2 text-xs text-slate-500">
                                {item.skills.join(' · ')}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {item.chapter || 'À préciser'}
                            <p className="mt-1 text-xs text-slate-500">
                              {difficultyLabel(
                                item.versionId && /^\d+$/.test(item.difficulty)
                                  ? Number(item.difficulty)
                                  : item.difficulty,
                              )}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            {item.exerciseType === 'flash'
                              ? 'Flash'
                              : 'Classique'}
                            <p className="mt-1 text-xs text-slate-500">
                              {item.needsCalculator
                                ? 'Avec calculatrice'
                                : 'Sans calculatrice'}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            <EditorialBadge
                              status={item.archived ? 'archived' : item.status}
                            />
                          </td>
                          <td className="px-6 py-5">
                            {item.revision ? `v${item.revision}` : '—'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-5 text-xs text-slate-500">
                            {item.updatedAt
                              ? new Intl.DateTimeFormat('fr-FR', {
                                  dateStyle: 'medium',
                                  timeZone: 'Europe/Paris',
                                }).format(new Date(item.updatedAt))
                              : 'Date inconnue'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <nav
              aria-label="Pagination du catalogue"
              className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm"
            >
              <div>
                {filter.page > 1 && (
                  <Link
                    href={pageLink(filter.page - 1)}
                    className="font-medium text-blue-700"
                  >
                    ← Précédente
                  </Link>
                )}
              </div>
              <span className="text-slate-500">
                Page {filter.page} sur{' '}
                {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              </span>
              <div>
                {filter.page * PAGE_SIZE < data.total && (
                  <Link
                    href={pageLink(filter.page + 1)}
                    className="font-medium text-blue-700"
                  >
                    Suivante →
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </section>
      )}
    </>
  );
}
