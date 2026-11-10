'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  flashcardValue,
  insertFlashcardMath,
  FLASHCARD_TEXT_LIMIT,
  type FlashcardItem,
  type FlashcardPage,
  type FlashcardValue,
} from '@/lib/flashcards';
import { bindEditorNavigation } from '@/lib/editor-navigation';
import { MathInput } from './math-input';
import { FlashcardPreview } from './flashcard-preview';
type Pending =
  | { type: 'close' | 'delete' }
  | { type: 'edit'; item: FlashcardItem | null };
export function FlashcardsManager({
  data,
  filter,
}: {
  data: FlashcardPage | null;
  filter: { query: string; chapter: string | null; page: number };
}) {
  const router = useRouter();
  const [item, setItem] = useState<FlashcardItem | null>(null),
    [open, setOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [value, setValue] = useState<FlashcardValue>({
      chapterId: '',
      question: '',
      answer: '',
    }),
    [pending, setPending] = useState<Pending | null>(null);
  const [latex, setLatex] = useState(''),
    [target, setTarget] = useState<'question' | 'answer'>('question'),
    [display, setDisplay] = useState(false);
  const selection = useRef({
      question: { start: 0, end: 0 },
      answer: { start: 0, end: 0 },
    }),
    dirtyRef = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    editor = useRef<HTMLDialogElement>(null),
    confirmation = useRef<HTMLDialogElement>(null);
  dirtyRef.current = dirty;
  useEffect(() => bindEditorNavigation(() => dirtyRef.current), []);
  useEffect(() => {
    if (open) {
      if (!editor.current?.open) editor.current?.showModal();
      heading.current?.focus();
    } else if (editor.current?.open) editor.current.close();
  }, [open, item?.id]);
  useEffect(() => {
    if (pending) confirmation.current?.showModal();
    else confirmation.current?.close();
  }, [pending]);
  function edit(next: FlashcardItem | null, confirmed = false) {
    if (dirty && !confirmed) {
      setPending({ type: 'edit', item: next });
      return;
    }
    setItem(next);
    setValue({
      chapterId: next
        ? (next.chapterId ?? '')
        : (filter.chapter ?? data?.chapters[0]?.id ?? ''),
      question: next?.question ?? '',
      answer: next?.answer ?? '',
    });
    selection.current = {
      question: {
        start: next?.question.length ?? 0,
        end: next?.question.length ?? 0,
      },
      answer: {
        start: next?.answer.length ?? 0,
        end: next?.answer.length ?? 0,
      },
    };
    setOpen(true);
    setDirty(false);
    setMessage('');
    setLatex('');
  }
  function insert() {
    const selected = selection.current[target];
    const start = Math.min(selected.start, value[target].length),
      end = Math.max(start, Math.min(selected.end, value[target].length));
    const text = insertFlashcardMath(
      value[target],
      latex,
      { start, end },
      display,
    );
    if (text === null) {
      setMessage(
        'Expression vide, délimiteur $ déjà présent ou limite de 4 000 caractères dépassée.',
      );
      return;
    }
    setValue({ ...value, [target]: text });
    setDirty(true);
    setMessage('Expression insérée. Enregistrez pour conserver la flashcard.');
    selection.current[target] = { start: text.length, end: text.length };
  }
  async function mutate(action: 'save' | 'delete', confirmed = false) {
    if (action === 'save' && !flashcardValue(value)) {
      setMessage(
        'Choisissez un chapitre et renseignez les deux faces (4 000 caractères maximum chacune).',
      );
      return;
    }
    if (action === 'delete') {
      if (!item || dirty) return;
      if (!confirmed) {
        setPending({ type: 'delete' });
        return;
      }
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        setItem(null);
        setOpen(false);
        setMessage('Flashcard supprimée de Staging.');
      } else {
        setItem(body.result.item);
        setMessage('Flashcard enregistrée dans Staging.');
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
    `/admin/flashcards?${new URLSearchParams({ q: filter.query, chapter: filter.chapter ?? '', page: String(page) })}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Flashcards
          </h1>
          <p className="mt-3 text-slate-600">
            Des questions courtes pour retenir l’essentiel.
          </p>
        </div>
        <button
          className="button"
          disabled={busy || !data || !data.chapters.length}
          onClick={() => edit(null)}
        >
          ＋ Nouvelle flashcard
        </button>
      </div>
      <form
        action="/admin/flashcards"
        className="card mt-8 flex flex-wrap items-end gap-4"
      >
        <label className="label grow">
          Rechercher
          <input
            className="field"
            name="q"
            type="search"
            maxLength={120}
            defaultValue={filter.query}
            placeholder="Question, réponse ou identifiant…"
          />
        </label>
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
        <p className="notice mt-6" role="status">
          Les flashcards Staging sont indisponibles. Réessayez plus tard.
        </p>
      ) : (
        <>
          {!data.chapters.length && (
            <p className="notice mt-6">
              Créez un{' '}
              <Link className="text-blue-700 underline" href="/admin/chapters">
                chapitre
              </Link>{' '}
              avant d’ajouter une flashcard.
            </p>
          )}
          <div className="relative mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Flashcards Staging</caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4">Question</th>
                  <th className="p-4">Chapitre</th>
                  <th className="p-4">Créée le</th>
                  <th className="p-4">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((card) => (
                  <tr key={card.id}>
                    <td className="max-w-lg p-4">
                      <p className="break-words font-semibold">
                        {card.question.slice(0, 160)}
                        {card.question.length > 160 ? '…' : ''}
                      </p>
                    </td>
                    <td className="p-4">
                      {card.chapter}
                      {!card.chapterId && (
                        <span className="mt-1 block text-xs text-amber-800">
                          Référence à résoudre
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {card.createdAt
                        ? new Date(card.createdAt).toLocaleDateString('fr-FR', {
                            timeZone: 'Europe/Paris',
                          })
                        : '—'}
                    </td>
                    <td className="p-4">
                      <button
                        className="font-semibold text-blue-700 underline"
                        disabled={busy}
                        onClick={() => edit(card)}
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
                Aucune flashcard pour cette recherche.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <p>
              {data.total} {data.total === 1 ? 'flashcard' : 'flashcards'} ·
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
        <dialog
          ref={editor}
          aria-labelledby="flashcard-editor"
          onCancel={(event) => {
            event.preventDefault();
            if (dirty) setPending({ type: 'close' });
            else setOpen(false);
          }}
          className="max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-2xl backdrop:bg-slate-950/40 sm:w-[calc(100%_-_2rem)] sm:p-6"
        >
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <h2
                ref={heading}
                tabIndex={-1}
                id="flashcard-editor"
                className="text-xl font-semibold outline-none"
              >
                {item ? 'Modifier la flashcard' : 'Nouvelle flashcard'}
              </h2>
              <button
                className="text-sm text-slate-600 underline"
                disabled={busy}
                onClick={() => {
                  if (dirty) setPending({ type: 'close' });
                  else setOpen(false);
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
            {item && !item.chapterId && (
              <p className="notice mt-4">
                Le chapitre « {item.chapter} » ne correspond pas à une référence
                unique. Choisissez explicitement un chapitre pour enregistrer.
              </p>
            )}
            <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="min-w-0">
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate('save');
                  }}
                >
                  <label className="label">
                    Chapitre de la flashcard
                    <select
                      className="field"
                      required
                      value={value.chapterId}
                      disabled={busy}
                      onChange={(e) => {
                        setValue({ ...value, chapterId: e.target.value });
                        setDirty(true);
                      }}
                    >
                      <option value="">Choisir un chapitre</option>
                      {data?.chapters.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                    {(['question', 'answer'] as const).map((face) => (
                      <label className="label min-w-0" key={face}>
                        {face === 'question'
                          ? 'Question (recto)'
                          : 'Réponse (verso)'}
                        <textarea
                          className="field min-h-36"
                          value={value[face]}
                          required
                          maxLength={FLASHCARD_TEXT_LIMIT}
                          disabled={busy}
                          onChange={(e) => {
                            setValue({ ...value, [face]: e.target.value });
                            setDirty(true);
                          }}
                          onSelect={(e) => {
                            selection.current[face] = {
                              start: e.currentTarget.selectionStart,
                              end: e.currentTarget.selectionEnd,
                            };
                          }}
                          onFocus={() => setTarget(face)}
                        />
                        <span className="text-xs font-normal text-slate-500">
                          {value[face].length} / {FLASHCARD_TEXT_LIMIT} · Texte
                          et expressions entre $…$ ou $$…$$.
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button className="button" type="submit" disabled={busy}>
                      {busy ? 'Enregistrement…' : 'Enregistrer dans Staging'}
                    </button>
                    {dirty && (
                      <span className="text-sm text-amber-800">
                        Modifications non enregistrées
                      </span>
                    )}
                  </div>
                </form>
                <details className="mt-6 rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold">
                    Insérer une expression avec MathLive
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">
                    Composez une expression, puis insérez-la à l’endroit
                    sélectionné dans la question ou la réponse.
                  </p>
                  <div className="mt-4">
                    <MathInput
                      label="Expression à insérer"
                      value={latex}
                      onChange={setLatex}
                      disabled={busy}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <label className="label">
                      Insérer dans
                      <select
                        className="field"
                        value={target}
                        onChange={(e) =>
                          setTarget(e.target.value as 'question' | 'answer')
                        }
                        disabled={busy}
                      >
                        <option value="question">Question</option>
                        <option value="answer">Réponse</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={display}
                        onChange={(e) => setDisplay(e.target.checked)}
                        disabled={busy}
                      />
                      Expression sur une ligne séparée
                    </label>
                    <button
                      type="button"
                      className="button"
                      disabled={busy || !latex.trim()}
                      onClick={insert}
                    >
                      Insérer l’expression
                    </button>
                  </div>
                </details>
                {item && (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <button
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                      disabled={busy || dirty}
                      onClick={() => void mutate('delete')}
                    >
                      Supprimer de Staging
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <FlashcardPreview
                  question={value.question}
                  answer={value.answer}
                />
              </div>
            </div>
          </div>
        </dialog>
      )}
      <dialog
        ref={confirmation}
        aria-labelledby="flashcard-confirm"
        onCancel={() => setPending(null)}
        className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <h2 className="text-xl font-semibold" id="flashcard-confirm">
          {pending?.type === 'delete'
            ? 'Supprimer cette flashcard ?'
            : 'Abandonner les modifications ?'}
        </h2>
        <p className="mt-3 text-slate-600">
          {pending?.type === 'delete'
            ? 'La flashcard sera supprimée définitivement de Staging. Son événement d’audit sera conservé.'
            : 'Les modifications non enregistrées seront perdues. Annulez pour conserver votre saisie.'}
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
