import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { TaxonomyManager } from '../../src/components/taxonomy-manager';
import type {
  TaxonomyKind,
  TaxonomyData,
  TaxonomyItem,
} from '../../src/lib/taxonomy';
const chapterId = 'a5700000-0000-4000-8000-000000000001';
const zero = {
  exercises: 0,
  revisions: 0,
  competences: 0,
  flashcards: 0,
  scores: 0,
  exerciseIds: [],
};
let simulateConflict = false;
const original = window.fetch;
window.fetch = async (input, init) => {
  if (input !== '/api/admin/taxonomy') return original(input, init);
  const body = JSON.parse(String(init?.body));
  if (simulateConflict)
    return new Response(
      JSON.stringify({
        error: 'Cette fiche a changé. Rechargez avant de réessayer.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  const item = {
    id: body.id ?? (body.kind === 'chapter' ? chapterId : body.value.id),
    fingerprint: 'b'.repeat(64),
    value: body.value,
    usage: zero,
  };
  return new Response(
    JSON.stringify({
      environment: 'staging',
      result: { action: 'updated', item },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
function Harness() {
  const [kind, setKind] = useState<TaxonomyKind>('chapter'),
    [state, setState] = useState('normal');
  simulateConflict = state === 'conflict';
  const row: TaxonomyItem = {
    id: kind === 'chapter' ? chapterId : 'derivees.1',
    fingerprint: 'a'.repeat(64),
    value:
      kind === 'chapter'
        ? {
            name: 'Fonctions et dérivées',
            aliases: ['Analyse', 'fonctions'],
            emoji: '📐',
            order_index: 2,
          }
        : {
            id: 'derivees.1',
            name: 'Calculer une dérivée',
            chapter_id: chapterId,
            max_points: 10,
          },
    usage: {
      ...zero,
      exercises: 2,
      revisions: 3,
      competences: kind === 'chapter' ? 4 : 0,
      scores: kind === 'competence' ? 2 : 0,
      exerciseIds: ['9007199254740993', '2'],
    },
  };
  const data: TaxonomyData = {
    items: state === 'empty' ? [] : [row],
    total: state === 'empty' ? 0 : 1,
    chapters: [{ id: chapterId, name: 'Fonctions et dérivées' }],
  };
  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-10">
      <header className="mb-8 flex flex-wrap items-center gap-5">
        <object
          data="/logo/novlearn-principal-ui.svg"
          type="image/svg+xml"
          aria-label="NovLearn"
          className="h-10 w-40"
        >
          NovLearn Admin
        </object>
        <p className="text-sm text-amber-800">
          Banc synthétique local — aucun accès Supabase
        </p>
        <select
          aria-label="Vue du banc"
          className="field w-auto"
          value={kind}
          onChange={(e) => setKind(e.target.value as TaxonomyKind)}
        >
          <option value="chapter">Chapitres</option>
          <option value="competence">Compétences</option>
        </select>
        <select
          aria-label="État du banc"
          className="field w-auto"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="empty">Vide</option>
          <option value="error">Indisponible</option>
          <option value="conflict">Conflit 409</option>
        </select>
      </header>
      <TaxonomyManager
        key={kind + state}
        kind={kind}
        data={state === 'error' ? null : data}
        filter={{ query: '', chapter: null, page: 1 }}
      />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
