'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  FEEDBACK_CATEGORIES,
  type DifficultyExerciseSummary,
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

const statusStyles = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
} as const;

const categoryStyles: Record<string, string> = {
  content_error: 'bg-rose-50 text-rose-800 ring-rose-200',
  suggestion: 'bg-sky-50 text-sky-800 ring-sky-200',
  other: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function FeedbacksManager({
  data,
  query,
  error,
  view = 'general',
  difficultySummary,
}: {
  data: FeedbackPage | null;
  query: FeedbackQuery;
  error?: string;
  view?: 'general' | 'difficulty';
  difficultySummary?: DifficultyExerciseSummary[] | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(new Set<string>());
  const [resolvedStatuses, setResolvedStatuses] = useState<
    Record<string, FeedbackStatus>
  >({});

  async function decide(feedbackId: string, action: 'approve' | 'reject') {
    if (inFlight.current.has(feedbackId)) return;
    inFlight.current.add(feedbackId);
    setBusy(feedbackId);
    setNotice('');
    try {
      const response = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feedbackId, action }),
      });
      const result = (await response.json()) as {
        error?: string;
        status?: FeedbackStatus;
      };
      if (!response.ok) {
        const currentStatus = result.status;
        if (
          response.status === 409 &&
          (currentStatus === 'approved' || currentStatus === 'rejected')
        ) {
          setResolvedStatuses((current) => ({
            ...current,
            [feedbackId]: currentStatus,
          }));
          router.refresh();
        }
        throw new Error(result.error ?? 'Action indisponible.');
      }
      setNotice(action === 'approve' ? 'Feedback validé.' : 'Feedback refusé.');
      router.refresh();
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : 'Action indisponible.',
      );
    } finally {
      inFlight.current.delete(feedbackId);
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
            Consultez les retours et les notes de difficulté par exercice.
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

      <nav
        aria-label="Sections des feedbacks"
        className="flex gap-2 border-b border-slate-200"
      >
        <Link
          href="/admin/feedback"
          aria-current={view === 'general' ? 'page' : undefined}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            view === 'general'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Retours
        </Link>
        <Link
          href="/admin/feedback?view=difficulty"
          aria-current={view === 'difficulty' ? 'page' : undefined}
          className={`border-b-2 px-4 py-3 text-sm font-medium ${
            view === 'difficulty'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Difficulté
        </Link>
      </nav>

      {view === 'general' && data && (
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

      {view === 'general' && (
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
                    {query.categories.length ===
                    Object.keys(FEEDBACK_CATEGORIES).length - 1
                      ? 'Toutes sauf difficulté'
                      : `${query.categories.length} sélectionnée${query.categories.length > 1 ? 's' : ''}`}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ⌄
                  </span>
                </summary>
                <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {Object.entries(FEEDBACK_CATEGORIES)
                    .filter(([value]) => value !== 'difficulty')
                    .map(([value, label]) => (
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
      )}

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
      {view === 'difficulty' ? (
        !difficultySummary ? (
          <section className="card" role="status">
            <h2 className="font-semibold">Notes de difficulté indisponibles</h2>
            <p className="mt-2 text-sm text-slate-600">
              Les données Production n’ont pas pu être vérifiées.
            </p>
          </section>
        ) : difficultySummary.length === 0 ? (
          <section className="card" role="status">
            <h2 className="font-semibold">Aucun retour de difficulté.</h2>
          </section>
        ) : (
          <section aria-label="Moyennes de difficulté" className="space-y-4">
            {difficultySummary.map((group) => (
              <article
                key={group.exerciseId ?? 'unassigned'}
                className="rounded-xl border border-l-4 border-l-amber-400 border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-semibold text-slate-900">
                    {group.exerciseId === null ? (
                      'Sans exercice associé'
                    ) : (
                      <Link
                        href={`/admin/exercises/${group.exerciseId}`}
                        className="text-sky-800 underline decoration-sky-300 underline-offset-4 hover:text-sky-950"
                      >
                        Exercice #{group.exerciseId}
                      </Link>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {group.averageRating === null ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        Aucune note
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1.5 font-semibold tabular-nums text-amber-950 ring-1 ring-inset ring-amber-300">
                        Moyenne&nbsp;
                        {group.averageRating.toLocaleString('fr-FR', {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-slate-500">
                      {group.ratingCount} note
                      {group.ratingCount > 1 ? 's' : ''}
                    </span>
                  </p>
                </div>
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Afficher le détail ({group.feedbackCount} retour
                    {group.feedbackCount > 1 ? 's' : ''})
                  </summary>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {group.details.map((detail) => (
                      <li key={detail.id} className="py-3">
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                          <time dateTime={detail.createdAt}>
                            {new Intl.DateTimeFormat('fr-FR', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: 'Europe/Paris',
                            }).format(new Date(detail.createdAt))}
                          </time>
                          <span className="font-semibold text-slate-700">
                            {detail.difficultyRating === null
                              ? 'Sans note'
                              : `Note : ${detail.difficultyRating}`}
                          </span>
                        </div>
                        {detail.message && (
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                            {detail.message}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </section>
        )
      ) : !data ? (
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
            const status =
              resolvedStatuses[item.id] ?? item.status ?? 'pending';
            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        categoryStyles[item.category] ??
                        'bg-slate-100 text-slate-700 ring-slate-200'
                      }`}
                    >
                      {category}
                    </span>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
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
                        <dt className="sr-only">Exercice Production</dt>
                        <dd>
                          <Link
                            href={`/admin/exercises/${item.exerciseId}`}
                            className="inline-flex items-center gap-1 font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4 hover:text-sky-950"
                          >
                            Ouvrir l’exercice #{item.exerciseId}
                            <span aria-hidden="true">↗</span>
                          </Link>
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
                      disabled={busy === item.id}
                      onClick={() => void decide(item.id, 'approve')}
                    >
                      {busy === item.id ? 'Enregistrement…' : 'Valider'}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary min-h-10 px-4 py-2"
                      disabled={busy === item.id}
                      onClick={() => void decide(item.id, 'reject')}
                    >
                      Refuser
                    </button>
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
