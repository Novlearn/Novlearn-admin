import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { requestEditorLeave } from '../../src/lib/editor-navigation';
import { CatalogueList } from '../../src/components/catalogue-list';
import { DraftMetadataForm } from '../../src/components/draft-metadata-form';
import { EditorialReview } from '../../src/components/editorial-review';
import type { CatalogueItem } from '../../src/lib/catalogue';
import { WorkspaceNav } from './workspace-nav';

const base: CatalogueItem = {
  id: '9007199254740993',
  catalogId: '91000000-0000-0000-0000-000000000001',
  title: 'Résoudre une équation du premier degré',
  appTitle: 'Équations et raisonnement',
  chapter: 'Algèbre',
  difficulty: '2',
  skills: ['Résoudre une équation', 'Justifier un calcul'],
  exerciseType: 'classic',
  needsCalculator: false,
  status: 'draft',
  revision: 2,
  versionId: '91000000-0000-0000-0000-000000000002',
  activeVersionId: null,
  archived: false,
  updatedAt: '2026-10-14T12:00:00Z',
};
const items: CatalogueItem[] = [
  base,
  {
    ...base,
    id: '2',
    title: 'Lire un tableau de variations',
    appTitle: 'Variations d’une fonction',
    chapter: 'Fonctions',
    skills: ['Lire un tableau'],
    status: 'approved',
    revision: 3,
  },
  {
    ...base,
    id: '3',
    title: 'Calcul mental — fractions',
    appTitle: 'Fractions',
    chapter: 'Nombres',
    skills: [],
    exerciseType: 'flash',
    status: 'published',
    activeVersionId: '91000000-0000-0000-0000-000000000004',
    revision: 1,
  },
  {
    ...base,
    id: '4',
    title: 'Exercice historique conservé',
    appTitle: 'Exercice historique',
    catalogId: null,
    skills: [],
    status: 'legacy',
    revision: null,
    updatedAt: null,
  },
];

function Harness() {
  const [view, setView] = useState(
    new URLSearchParams(window.location.search).get('view') ?? 'catalogue',
  );
  useEffect(() => {
    const restore = () =>
      setView(
        new URLSearchParams(window.location.search).get('view') ?? 'catalogue',
      );
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const openView = (next: string) => {
    if (!requestEditorLeave()) return;
    window.history.pushState(null, '', '?view=' + next);
    setView(next);
  };
  return (
    <div
      style={
        {
          '--font-inter': '"Inter Variable"',
          '--font-fredoka': '"Fredoka Variable"',
        } as React.CSSProperties
      }
    >
      <WorkspaceNav />
      <div className="bg-amber-50 px-6 py-3 text-center text-xs font-semibold text-amber-900">
        Banc visuel local · données synthétiques · aucune connexion à une base
      </div>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <img
              src="/logo/novlearn-logo-ui.svg"
              width="28"
              height="32"
              alt=""
            />
            <span className="font-brand text-xl font-medium">NovLearn</span>
            <span className="badge">Admin</span>
          </div>
          <nav className="mt-8 space-y-1" aria-label="Banc visuel">
            <button
              className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-600"
              onClick={() => openView('review')}
            >
              Relecture synthétique
            </button>
            <button
              className="block w-full rounded-lg bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700"
              onClick={() => openView('catalogue')}
            >
              Exercices
            </button>
            <button
              className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-600"
              onClick={() => openView('new')}
            >
              Créer un exercice
            </button>
            <button
              className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-600"
              onClick={() => openView('empty')}
            >
              Catalogue vide
            </button>
            <button
              className="block w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-600"
              onClick={() => openView('unavailable')}
            >
              Source indisponible
            </button>
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
            <span className="badge">Staging · aperçu synthétique</span>
          </header>
          <main className="px-6 py-9 lg:px-10">
            {view === 'review' ? (
              <div className="max-w-4xl space-y-6">
                <h1 className="text-3xl font-semibold">Relire une révision</h1>
                <EditorialReview
                  versionId="91000000-0000-4000-8000-000000000002"
                  fingerprint={'a'.repeat(64)}
                  epoch={2}
                  status="in_review"
                  receiptId="91000000-0000-4000-8000-000000000003"
                  enabled
                />
              </div>
            ) : view === 'new' ? (
              <div className="max-w-4xl">
                <h1 className="mb-8 text-3xl font-semibold">
                  Créer un exercice
                </h1>
                <DraftMetadataForm />
              </div>
            ) : (
              <CatalogueList
                data={
                  view === 'unavailable'
                    ? null
                    : {
                        total: view === 'empty' ? 0 : items.length,
                        items: view === 'empty' ? [] : items,
                      }
                }
                filter={{ query: '', status: 'all', sort: 'recent', page: 1 }}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
