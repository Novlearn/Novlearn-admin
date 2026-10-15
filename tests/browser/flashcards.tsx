import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { FlashcardsManager } from '../../src/components/flashcards-manager';
import type { FlashcardItem } from '../../src/lib/flashcards';
const chapterId = 'a5810000-0000-4000-8000-000000000001';
let mode = 'normal';
const original = window.fetch;
window.fetch = async (input, init) => {
  if (input !== '/api/admin/flashcards') return original(input, init);
  if (mode === 'conflict')
    return new Response(
      JSON.stringify({
        error: 'Cette flashcard a changé. Rechargez avant de réessayer.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  const body = JSON.parse(String(init?.body));
  return new Response(
    JSON.stringify({
      environment: 'staging',
      result: {
        action:
          body.action === 'delete'
            ? 'deleted'
            : body.id
              ? 'updated'
              : 'created',
        item:
          body.action === 'delete'
            ? null
            : {
                id: body.id ?? 'a5820000-0000-4000-8000-000000000001',
                fingerprint: 'b'.repeat(64),
                chapter: 'Fonctions et dérivées',
                createdAt: '2026-10-15T10:00:00Z',
                ...body.value,
              },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
const item: FlashcardItem = {
  id: 'a5820000-0000-4000-8000-000000000001',
  fingerprint: 'a'.repeat(64),
  chapterId,
  chapter: 'Fonctions et dérivées',
  question: 'Quelle est la dérivée de $x^2$ ?',
  answer: 'La dérivée est $2x$.',
  createdAt: '2026-10-15T10:00:00Z',
};
function Harness() {
  const [state, setState] = useState('normal');
  mode = state;
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-10">
      <header className="mb-8 flex flex-wrap items-center gap-5">
        <object
          className="h-10 w-40"
          data="/logo/novlearn-principal-ui.svg"
          type="image/svg+xml"
          aria-label="NovLearn"
        >
          NovLearn
        </object>
        <p className="text-sm text-amber-800">
          Banc synthétique local — aucun accès Supabase
        </p>
        <label className="label">
          État du banc
          <select
            className="field"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="empty">Vide</option>
            <option value="error">Indisponible</option>
            <option value="conflict">Conflit 409</option>
            <option value="legacy">Chapitre à résoudre</option>
          </select>
        </label>
      </header>
      <FlashcardsManager
        key={state}
        data={
          state === 'error'
            ? null
            : {
                items:
                  state === 'empty'
                    ? []
                    : [
                        state === 'legacy'
                          ? {
                              ...item,
                              chapter: 'Ancienne référence',
                              chapterId: null,
                            }
                          : item,
                      ],
                total: state === 'empty' ? 0 : 1,
                chapters: [{ id: chapterId, name: 'Fonctions et dérivées' }],
              }
        }
        filter={{ query: '', chapter: null, page: 1 }}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
