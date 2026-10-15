'use client';
import { useEffect, useState } from 'react';
import { flashcardFragments } from '@/lib/flashcards';
import { MathInput } from './math-input';
export function FlashcardContent({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words whitespace-pre-wrap leading-7">
      {flashcardFragments(text).map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <div
            className={
              part.kind === 'display-math'
                ? 'math-display relative my-3 block min-w-0 overflow-x-auto'
                : 'math-display relative inline-block max-w-full align-middle'
            }
            key={i}
          >
            <MathInput
              label="Expression de la flashcard"
              value={part.text}
              onChange={() => {}}
              readOnly
            />
          </div>
        ),
      )}
    </div>
  );
}
export function FlashcardPreview({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [question, answer]);
  return (
    <section className="card min-w-0" aria-label="Aperçu de la flashcard">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Aperçu</h3>
        <span className="badge">{flipped ? 'Réponse' : 'Question'}</span>
      </div>
      <div
        className="mt-5 min-h-28 rounded-xl border border-blue-100 bg-blue-50/40 p-5"
        aria-live="polite"
      >
        <FlashcardContent
          text={(flipped ? answer : question) || 'Le contenu apparaîtra ici.'}
        />
      </div>
      <button
        type="button"
        className="mt-4 text-sm font-semibold text-blue-700 underline"
        onClick={() => setFlipped((v) => !v)}
      >
        {flipped ? 'Afficher la question' : 'Afficher la réponse'}
      </button>
      <p className="mt-3 text-xs text-slate-500">
        Aperçu du contenu, sans génération ni correction automatique.
      </p>
    </section>
  );
}
