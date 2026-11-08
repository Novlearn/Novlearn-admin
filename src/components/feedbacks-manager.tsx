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
    <div className="space-y-7">
      <header className="editor-intro">
        <p className="text-sm font-semibold text-blue-800">
          Retours utilisateurs
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Feedbacks
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Consultez les retours envoyés depuis NovLearn en Production,
          classez-les par catégorie et enregistrez votre décision.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-emerald-500"
          />
          Production · données réelles
        </p>
      </header>

      {data && (
        <section
          aria-label="État des feedbacks"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {(
            [
              ['Total', data.summary.total, 'bg-blue-50 text-blue-800'],
              ['À traiter', data.summary.pending, 'bg-amber-50 text-amber-900'],
              [
                'Validés',
                data.summary.approved,
                'bg-emerald-50 text-emerald-900',
              ],
              ['Refusés', data.summary.rejected, 'bg-slate-100 text-slate-700'],
            ] as const
          ).map(([label, count, color]) => (
            <article
              key={label}
              className="card flex items-center justify-between gap-3"
            >
              <h2 className="text-sm font-medium text-slate-600">{label}</h2>
              <p
                className={`rounded-xl px-3 py-2 text-xl font-bold tabular-nums ${color}`}
              >
                {count.toLocaleString('fr-FR')}
              </p>
            </article>
          ))}
        </section>
      )}

      <form action="/admin/feedback" method="get" className="card space-y-5">
        <fieldset>
          <legend className="label">Catégories</legend>
          <p className="mt-1 text-xs text-slate-500">
            {query.categories.length === 0
              ? 'Toutes les catégories'
              : `${query.categories.length} catégorie${query.categories.length > 1 ? 's' : ''} sélectionnée${query.categories.length > 1 ? 's' : ''}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => (
              <label
                key={value}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              >
                <input
                  className="size-4 accent-blue-700"
                  type="checkbox"
                  name="category"
                  value={value}
                  defaultChecked={query.categories.includes(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
          <label className="label">
            Statut
            <select className="field" name="status" defaultValue={query.status}>
              <option value="all">Tous les statuts</option>
              <option value="pending">À traiter</option>
              <option value="approved">Validés</option>
              <option value="rejected">Refusés</option>
            </select>
          </label>
          <label className="label">
            Trier par
            <select className="field" name="sort" defaultValue={query.sort}>
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="category">Catégorie</option>
            </select>
          </label>
          <button className="button" type="submit">
            Appliquer les filtres
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
              <article key={item.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge">{category}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'pending' ? 'bg-amber-50 text-amber-900' : status === 'approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}
                    >
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
                      className="button min-h-10 px-4 py-2"
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
