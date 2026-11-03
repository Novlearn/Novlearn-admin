'use client';
import { useEffect, useId, useState } from 'react';
import type { TaxonomyData, TaxonomyItem, ChapterValue } from '@/lib/taxonomy';

function ReferenceSearch({
  kind,
  chapterId,
  selected,
  onSelect,
}: {
  kind: 'chapter' | 'competence';
  chapterId?: string;
  selected: string[];
  onSelect: (item: TaxonomyItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaxonomyData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setData(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          kind,
          q: query,
          page: String(page),
        });
        if (chapterId) params.set('chapter', chapterId);
        const response = await fetch(`/api/admin/taxonomy?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const body = await response.json();
        if (
          !response.ok ||
          body.environment !== 'staging' ||
          !Array.isArray(body.result?.items) ||
          !Number.isSafeInteger(body.result?.total)
        )
          throw Error('Reference response');
        if (!controller.signal.aborted) {
          setData(body.result);
          setState('ready');
        }
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, page, chapterId, retry]);
  const label = kind === 'chapter' ? 'un chapitre' : 'des compétences';
  return (
    <div className="space-y-3">
      <label className="label" htmlFor={id}>
        Rechercher {label}
      </label>
      <input
        id={id}
        className="field"
        type="search"
        maxLength={120}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      <div aria-live="polite">
        {state === 'loading' && (
          <p className="text-sm text-slate-500">Chargement du référentiel…</p>
        )}
        {state === 'error' && (
          <p role="alert">
            Référentiel indisponible.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setRetry(retry + 1)}
            >
              Réessayer
            </button>
          </p>
        )}
        {state === 'ready' && !data?.items.length && (
          <p className="text-sm">Aucun résultat.</p>
        )}
      </div>
      {data && (
        <>
          <ul
            className="max-h-52 space-y-2 overflow-auto rounded-lg border border-slate-200 p-3"
            aria-label={`Résultats : ${label}`}
          >
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded p-2 text-left text-sm hover:bg-blue-50 focus-visible:outline-blue-600"
                  aria-pressed={selected.includes(item.id)}
                  disabled={
                    kind === 'competence' &&
                    selected.length >= 64 &&
                    !selected.includes(item.id)
                  }
                  onClick={() => onSelect(item)}
                >
                  {selected.includes(item.id) ? '✓ ' : ''}
                  {item.value.name}
                  {kind === 'competence' && (
                    <span className="ml-2 text-xs text-slate-500">
                      {item.id}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Précédent
            </button>
            <span>
              Page {page} · {data.total} résultats
            </span>
            <button
              type="button"
              disabled={page * 25 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ExerciseReferenceFields({
  chapter,
  skills,
  onChapter,
  onSkills,
  disabled = false,
}: {
  chapter: string;
  skills: string[];
  onChapter: (name: string) => void;
  onSkills: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [selection, setSelection] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const chapterId = selection?.name === chapter ? selection.id : undefined;
  return (
    <fieldset disabled={disabled} className="space-y-5 md:col-span-2">
      <legend className="mb-3 font-semibold">Références pédagogiques</legend>
      <p className="text-sm">Chapitre conservé : {chapter || 'À choisir'}</p>
      {chapter && !chapterId && (
        <p className="text-sm text-slate-500">
          Référence à rapprocher dans la recherche si nécessaire ; elle sera
          contrôlée par le serveur.
        </p>
      )}
      <ReferenceSearch
        kind="chapter"
        selected={chapterId ? [chapterId] : []}
        onSelect={(item) => {
          setSelection({
            id: item.id,
            name: (item.value as ChapterValue).name,
          });
          onChapter(item.value.name);
        }}
      />
      <ReferenceSearch
        key={chapterId ?? chapter}
        kind="competence"
        chapterId={chapterId}
        selected={skills}
        onSelect={(item) => {
          onSkills(
            skills.includes(item.id)
              ? skills.filter((id) => id !== item.id)
              : [...skills, item.id],
          );
        }}
      />
      <ul
        className="flex flex-wrap gap-2"
        aria-label="Compétences sélectionnées"
      >
        {skills.map((id) => (
          <li key={id} className="badge">
            {id}{' '}
            <button
              type="button"
              aria-label={`Retirer ${id}`}
              onClick={() => onSkills(skills.filter((s) => s !== id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {!!skills.length && (
        <p className="text-sm text-amber-800">
          Changer de chapitre conserve les compétences. Le serveur refusera une
          référence inconnue ou associée à un autre chapitre ; retirez-la
          explicitement si nécessaire.
        </p>
      )}
    </fieldset>
  );
}
