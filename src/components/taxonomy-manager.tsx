'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { bindEditorNavigation } from '@/lib/editor-navigation';
import {
  canDeleteTaxonomy,
  taxonomyValue,
  type ChapterValue,
  type CompetenceValue,
  type TaxonomyData,
  type TaxonomyItem,
  type TaxonomyKind,
} from '@/lib/taxonomy';

export function TaxonomyManager({
  kind,
  data,
  filter,
}: {
  kind: TaxonomyKind;
  data: TaxonomyData | null;
  filter: { query: string; chapter: string | null; page: number };
}) {
  const router = useRouter();
  const chapter = kind === 'chapter',
    label = chapter ? 'Chapitre' : 'Compétence',
    plural = chapter ? 'Chapitres' : 'Compétences',
    base = chapter ? '/admin/chapters' : '/admin/competences';
  const [open, setOpen] = useState(false),
    [item, setItem] = useState<TaxonomyItem | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [dirty, setDirty] = useState(false);
  const [name, setName] = useState(''),
    [id, setId] = useState(''),
    [aliases, setAliases] = useState(''),
    [emoji, setEmoji] = useState(''),
    [order, setOrder] = useState('0'),
    [chapterId, setChapterId] = useState(''),
    [points, setPoints] = useState('10');
  const dirtyRef = useRef(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<
    | { type: 'close' | 'delete' }
    | { type: 'edit'; item: TaxonomyItem | null }
    | null
  >(null);
  dirtyRef.current = dirty;
  useEffect(() => bindEditorNavigation(() => dirtyRef.current), []);
  useEffect(() => {
    if (open) editorHeading.current?.focus();
  }, [open, item?.id]);
  useEffect(() => {
    if (pending) confirmation.current?.showModal();
    else confirmation.current?.close();
  }, [pending]);
  function edit(next: TaxonomyItem | null, confirmed = false) {
    if (dirty && !confirmed) {
      setPending({ type: 'edit', item: next });
      return;
    }
    const value = next?.value;
    setItem(next);
    setName(value?.name ?? '');
    setId(next?.id ?? '');
    setAliases(
      chapter ? ((value as ChapterValue)?.aliases ?? []).join('\n') : '',
    );
    setEmoji(chapter ? ((value as ChapterValue)?.emoji ?? '') : '');
    setOrder(String(chapter ? ((value as ChapterValue)?.order_index ?? 0) : 0));
    setChapterId(
      !chapter
        ? ((value as CompetenceValue)?.chapter_id ??
            filter.chapter ??
            data?.chapters[0]?.id ??
            '')
        : '',
    );
    setPoints(
      String(!chapter ? ((value as CompetenceValue)?.max_points ?? 10) : 10),
    );
    setOpen(true);
    setDirty(false);
    setMessage('');
  }
  async function mutate(action: 'save' | 'delete', confirmed = false) {
    const value = chapter
      ? {
          name: name.trim(),
          aliases: aliases
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          emoji,
          order_index: Number(order),
        }
      : {
          id,
          name: name.trim(),
          chapter_id: chapterId,
          max_points: Number(points),
        };
    if (
      action === 'save' &&
      (!taxonomyValue(kind, value) ||
        !name.trim() ||
        (chapter ? !order.trim() : !points.trim()))
    ) {
      setMessage('Vérifiez les champs obligatoires et les valeurs numériques.');
      return;
    }
    if (action === 'delete') {
      if (!item || !canDeleteTaxonomy(item.usage)) return;
      if (!confirmed) {
        setPending({ type: 'delete' });
        return;
      }
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          action,
          id: item?.id ?? null,
          fingerprint: item?.fingerprint ?? null,
          value: action === 'save' ? value : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? 'Opération indisponible.');
        return;
      }
      setDirty(false);
      dirtyRef.current = false;
      if (action === 'delete') {
        setOpen(false);
        setItem(null);
        setMessage('Fiche supprimée de Staging.');
      } else {
        setItem(body.result.item);
        setAliases(
          chapter ? (body.result.item.value.aliases ?? []).join('\n') : '',
        );
        setMessage('Enregistré dans Staging.');
      }
      router.refresh();
    } catch {
      setMessage(
        'Connexion interrompue. Rechargez pour vérifier le résultat avant de réessayer.',
      );
    } finally {
      setBusy(false);
    }
  }
  const pageLink = (page: number) =>
    `${base}?${new URLSearchParams({ q: filter.query, chapter: filter.chapter ?? '', page: String(page) })}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Référentiel pédagogique · Staging
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {plural}
          </h1>
          <p className="mt-3 text-slate-600">
            {chapter
              ? 'Organisez les chapitres et leurs compétences.'
              : 'Définissez les compétences et leur rattachement pédagogique.'}
          </p>
        </div>
        <button
          className="button"
          onClick={() => edit(null)}
          disabled={busy || !data}
        >
          ＋ {chapter ? 'Nouveau chapitre' : 'Nouvelle compétence'}
        </button>
      </div>
      <form action={base} className="card mt-8 flex flex-wrap items-end gap-4">
        <label className="label grow">
          Rechercher
          <input
            className="field"
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filter.query}
            placeholder="Nom ou identifiant…"
          />
        </label>
        {!chapter && (
          <label className="label">
            Chapitre
            <select
              className="field"
              name="chapter"
              defaultValue={filter.chapter ?? ''}
            >
              <option value="">Tous les chapitres</option>
              {data?.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="button" type="submit">
          Filtrer
        </button>
      </form>
      {!open && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-sm text-slate-700"
        >
          {message}
        </p>
      )}
      {!data ? (
        <div className="notice mt-6">
          Le référentiel Staging est indisponible. Réessayez plus tard.
        </div>
      ) : (
        <>
          <div className="relative mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{plural} Staging</caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4">{label}</th>
                  <th className="p-4">{chapter ? 'Ordre' : 'Chapitre'}</th>
                  <th className="p-4">
                    {chapter ? 'Compétences' : 'Points max.'}
                  </th>
                  <th className="p-4">Exercices</th>
                  <th className="p-4">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="p-4">
                      <span className="font-semibold">
                        {chapter ? (row.value as ChapterValue).emoji : ''}{' '}
                        {row.value.name}
                      </span>
                      <span className="mt-1 block break-all font-mono text-xs text-slate-500">
                        {row.id}
                      </span>
                    </td>
                    <td className="p-4">
                      {chapter
                        ? (row.value as ChapterValue).order_index
                        : (data.chapters.find(
                            (c) =>
                              c.id ===
                              (row.value as CompetenceValue).chapter_id,
                          )?.name ?? 'Chapitre absent')}
                    </td>
                    <td className="p-4">
                      {chapter ? (
                        <Link
                          className="text-blue-700 underline"
                          href={`/admin/competences?chapter=${row.id}`}
                        >
                          {row.usage.competences}
                        </Link>
                      ) : (
                        (row.value as CompetenceValue).max_points
                      )}
                    </td>
                    <td className="p-4">{row.usage.exercises}</td>
                    <td className="p-4">
                      <button
                        className="font-semibold text-blue-700 underline"
                        onClick={() => edit(row)}
                        disabled={busy}
                      >
                        Consulter / modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <p className="p-8 text-center text-slate-500">
                Aucun résultat pour cette recherche.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <p>
              {data.total}{' '}
              {data.total === 1 ? label.toLowerCase() : plural.toLowerCase()} ·
              page {filter.page}
            </p>
            <div className="flex gap-4">
              {filter.page > 1 && (
                <Link
                  className="text-blue-700 underline"
                  href={pageLink(filter.page - 1)}
                >
                  Précédent
                </Link>
              )}
              {filter.page * 25 < data.total && (
                <Link
                  className="text-blue-700 underline"
                  href={pageLink(filter.page + 1)}
                >
                  Suivant
                </Link>
              )}
            </div>
          </div>
        </>
      )}
      {open && (
        <section className="card mt-8" aria-labelledby="taxonomy-editor">
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-xl font-semibold outline-none"
              id="taxonomy-editor"
              ref={editorHeading}
              tabIndex={-1}
            >
              {item
                ? `${label} : ${item.value.name}`
                : `${chapter ? 'Nouveau chapitre' : 'Nouvelle compétence'}`}
            </h2>
            <button
              className="text-sm text-slate-600 underline"
              disabled={busy}
              onClick={() => {
                if (dirty) setPending({ type: 'close' });
                else {
                  setOpen(false);
                  setDirty(false);
                }
              }}
            >
              Fermer
            </button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-sm text-slate-700"
          >
            {message}
          </p>
          <form
            className="mt-6 grid gap-5 sm:grid-cols-2"
            onChange={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void mutate('save');
            }}
          >
            <label className="label">
              Nom
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                disabled={busy}
              />
            </label>
            {chapter ? (
              <>
                <label className="label">
                  Emoji
                  <input
                    className="field"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="label">
                  Ordre d’affichage
                  <input
                    className="field"
                    type="number"
                    step="1"
                    min="-2147483648"
                    max="2147483647"
                    required
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="label">
                  Alias, un par ligne
                  <textarea
                    className="field min-h-28"
                    value={aliases}
                    onChange={(e) => setAliases(e.target.value)}
                    disabled={busy}
                  />
                  <span className="text-xs font-normal text-slate-500">
                    Un ancien nom est conservé en alias lors d’un renommage.
                  </span>
                </label>
              </>
            ) : (
              <>
                <label className="label">
                  Identifiant stable
                  <input
                    className="field"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    maxLength={100}
                    required
                    readOnly={!!item}
                    disabled={busy}
                  />
                  <span className="text-xs font-normal text-slate-500">
                    Lettres, chiffres, points, tirets ou deux-points. Fixé après
                    création.
                  </span>
                </label>
                <label className="label">
                  Chapitre
                  <select
                    className="field"
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    required
                    disabled={busy}
                  >
                    <option value="">Choisir un chapitre</option>
                    {data?.chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Nombre maximal de points
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            <div className="flex flex-wrap gap-4 sm:col-span-2">
              <button className="button" type="submit" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer dans Staging'}
              </button>
              {dirty && (
                <span className="self-center text-sm text-amber-800">
                  Modifications non enregistrées
                </span>
              )}
            </div>
          </form>
          {item && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h3 className="font-semibold">Associations et suppression</h3>
              <p className="mt-2 text-sm text-slate-600">
                {item.usage.exercises} exercices · {item.usage.revisions}{' '}
                révisions · {item.usage.competences} compétences ·{' '}
                {item.usage.flashcards} flashcards · {item.usage.scores} scores
              </p>
              {chapter && (
                <Link
                  className="mt-3 inline-block text-sm text-blue-700 underline"
                  href={`/admin/competences?chapter=${item.id}`}
                >
                  Voir les compétences associées
                </Link>
              )}
              {item.usage.exerciseIds.length > 0 && (
                <ul
                  className="mt-3 flex flex-wrap gap-3 text-sm"
                  aria-label="Exercices associés"
                >
                  {item.usage.exerciseIds.map((exercise) => (
                    <li key={exercise}>
                      <Link
                        className="text-blue-700 underline"
                        href={`/admin/exercises/${exercise}`}
                      >
                        Exercice {exercise}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {item.usage.exercises > 25 && (
                <p className="mt-2 text-xs text-slate-500">
                  Les 25 premiers liens sont affichés.
                </p>
              )}
              <button
                className="mt-5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                disabled={busy || dirty || !canDeleteTaxonomy(item.usage)}
                onClick={() => void mutate('delete')}
              >
                Supprimer de Staging
              </button>
              {!canDeleteTaxonomy(item.usage) && (
                <p className="mt-2 text-sm text-slate-600">
                  Suppression bloquée : cette fiche est encore utilisée.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      <dialog
        ref={confirmation}
        aria-labelledby="taxonomy-confirm"
        onCancel={() => setPending(null)}
        className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <h2 id="taxonomy-confirm" className="text-xl font-semibold">
          {pending?.type === 'delete'
            ? 'Supprimer cette fiche ?'
            : 'Abandonner les modifications ?'}
        </h2>
        <p className="mt-3 text-slate-600">
          {pending?.type === 'delete'
            ? `« ${item?.value.name} » sera supprimé de Staging. Cette action est définitive et sera refusée si une référence existe.`
            : 'Les modifications non enregistrées seront perdues. Vous pouvez annuler pour conserver votre saisie.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold"
            onClick={() => setPending(null)}
          >
            Annuler
          </button>
          <button
            className="button"
            onClick={() => {
              const action = pending;
              setPending(null);
              if (action?.type === 'edit') edit(action.item, true);
              else if (action?.type === 'close') {
                setOpen(false);
                setDirty(false);
              } else if (action?.type === 'delete') void mutate('delete', true);
            }}
          >
            {pending?.type === 'delete'
              ? 'Confirmer la suppression'
              : 'Abandonner les modifications'}
          </button>
        </div>
      </dialog>
    </>
  );
}
