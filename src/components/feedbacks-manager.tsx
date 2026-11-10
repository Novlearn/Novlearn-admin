'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackPage,
  type FeedbackQuery,
} from '@/lib/feedbacks';

function feedbackHref(query: FeedbackQuery, page: number) {
  const params = new URLSearchParams();
  for (const category of query.categories) params.append('category', category);
  if (query.exerciseId !== null)
    params.set('exerciseId', String(query.exerciseId));
  if (query.status !== 'all') params.set('status', query.status);
  if (query.sort !== 'newest') params.set('sort', query.sort);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return `/admin/feedback${suffix ? `?${suffix}` : ''}`;
}

const statusLabels = {
  pending: 'À traiter',
  approved: 'Validé',
  rejected: 'Refusé',
} as const;

export function FeedbacksManager({
  data,
  query,
  error,
  reviewEnabled,
}: {
  data: FeedbackPage | null;
  query: FeedbackQuery;
  error?: string;
  reviewEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function decide(feedbackId: string, action: 'approve' | 'reject') {
    setBusy(feedbackId);
    setNotice('');
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feedbackId, action }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Action indisponible.');
      setNotice(action === 'approve' ? 'Feedback validé.' : 'Feedback refusé.');
      router.refresh();
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : 'Action indisponible.',
      );
    } finally {
      setBusy(null);
    }
  }

  const lastPage = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Feedbacks
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Consultez, classez et traitez les retours reçus.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary min-h-10 px-3 py-2"
          onClick={() => router.refresh()}
          aria-label="Actualiser les feedbacks"
        >
          <span aria-hidden="true" className="mr-2">
            ↻
          </span>
          Actualiser
        </button>
      </header>

      {data && (
        <section
          aria-label="État des feedbacks"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {(
            [
              ['Total', data.summary.total],
              ['À traiter', data.summary.pending],
              ['Validés', data.summary.approved],
              ['Refusés', data.summary.rejected],
            ] as const
          ).map(([label, count]) => (
            <article
              key={label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <h2 className="text-xs font-medium text-slate-500">{label}</h2>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {count.toLocaleString('fr-FR')}
              </p>
            </article>
          ))}
        </section>
      )}

      <form
        action="/admin/feedback"
        method="get"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="min-w-52">
            <legend className="mb-1 text-xs font-medium text-slate-500">
              Catégories
            </legend>
            <details className="group relative">
              <summary className="field flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {query.categories.length === 0
                    ? 'Toutes les catégories'
                    : `${query.categories.length} sélectionnée${query.categories.length > 1 ? 's' : ''}`}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ⌄
                </span>
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      className="size-4 accent-slate-700"
                      type="checkbox"
                      name="category"
                      value={value}
                      defaultChecked={query.categories.includes(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
          {query.categories.includes('difficulty') && (
            <label className="min-w-52 flex-1 text-xs font-medium text-slate-500">
              Exercice de difficulté
              <input
                className="field mt-1 min-h-10"
                type="search"
                name="exerciseId"
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                placeholder="Rechercher par identifiant"
                defaultValue={query.exerciseId ?? ''}
              />
            </label>
          )}
          <label className="min-w-40 text-xs font-medium text-slate-500">
            Statut
            <select
              className="field mt-1 min-h-10"
              name="status"
              defaultValue={query.status}
            >
              <option value="all">Tous</option>
              <option value="pending">À traiter</option>
              <option value="approved">Validés</option>
              <option value="rejected">Refusés</option>
            </select>
          </label>
          <label className="min-w-40 text-xs font-medium text-slate-500">
            Trier par
            <select
              className="field mt-1 min-h-10"
              name="sort"
              defaultValue={query.sort}
            >
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="category">Catégorie</option>
            </select>
          </label>
          <button className="button min-h-10 px-4 py-2" type="submit">
            Filtrer
          </button>
        </div>
      </form>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {!data ? (
        <section className="card" role="status">
          <h2 className="font-semibold">Liste des feedbacks indisponible</h2>
          <p className="mt-2 text-sm text-slate-600">
            Les données Production n’ont pas pu être vérifiées.
          </p>
        </section>
      ) : data.items.length === 0 ? (
        <section className="card" role="status">
          <h2 className="font-semibold">Aucun feedback pour ces filtres.</h2>
          <p className="mt-2 text-sm text-slate-600">
            Essayez une autre catégorie ou un autre statut.
          </p>
        </section>
      ) : (
        <section aria-label="Liste des feedbacks" className="space-y-4">
          {data.items.map((item) => {
            const category =
              FEEDBACK_CATEGORIES[
                item.category as keyof typeof FEEDBACK_CATEGORIES
              ] ?? item.category;
            const status = item.status ?? 'pending';
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {category}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {statusLabels[status]}
                    </span>
                  </div>
                  <time
                    className="text-sm text-slate-500"
                    dateTime={item.createdAt}
                  >
                    {new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Europe/Paris',
                    }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
                  {item.message}
                </p>
                {(item.difficultyRating !== null ||
                  item.exerciseId !== null) && (
                  <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {item.difficultyRating !== null && (
                      <div className="flex gap-1.5">
                        <dt>Note de difficulté</dt>
                        <dd className="font-semibold text-slate-700">
                          {item.difficultyRating}
                        </dd>
                      </div>
                    )}
                    {item.exerciseId !== null && (
                      <div className="flex gap-1.5">
                        <dt>Exercice Production</dt>
                        <dd className="font-semibold text-slate-700">
                          #{item.exerciseId}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
                {status === 'pending' && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      className="button button-secondary min-h-10 px-4 py-2"
                      disabled={!reviewEnabled || busy === item.id}
                      onClick={() => void decide(item.id, 'approve')}
                    >
                      {busy === item.id ? 'Enregistrement…' : 'Valider'}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary min-h-10 px-4 py-2"
                      disabled={!reviewEnabled || busy === item.id}
                      onClick={() => void decide(item.id, 'reject')}
                    >
                      Refuser
                    </button>
                    {!reviewEnabled && (
                      <p className="self-center text-xs text-slate-500">
                        Les décisions seront activées après installation du
                        script de permissions Production.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {data && (
        <nav
          className="flex flex-wrap items-center justify-between gap-4"
          aria-label="Pagination des feedbacks"
        >
          <span className="text-sm text-slate-500">
            {data.total.toLocaleString('fr-FR')} résultat
            {data.total > 1 ? 's' : ''} · page {query.page} sur {lastPage}
          </span>
          <div className="flex gap-3">
            {query.page > 1 ? (
              <Link
                className="font-semibold text-blue-700 hover:underline"
                href={feedbackHref(query, query.page - 1)}
              >
                Précédent
              </Link>
            ) : (
              <span aria-disabled="true" className="text-slate-400">
                Précédent
              </span>
            )}
            {query.page < lastPage ? (
              <Link
                className="font-semibold text-blue-700 hover:underline"
                href={feedbackHref(query, query.page + 1)}
              >
                Suivant
              </Link>
            ) : (
              <span aria-disabled="true" className="text-slate-400">
                Suivant
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
