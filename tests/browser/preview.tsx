import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { ExercisePreview } from '../../src/components/exercise-preview';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import fixture from '../fixtures/preview-definition.json';
import { WorkspaceNav } from './workspace-nav';
function Harness() {
  const [definition, setDefinition] = useState(fixture as ExerciseDefinition);
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
        Banc synthétique · propriétaire fictif · worker Engine réel dans Docker
        local · aucune base
      </div>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <span className="font-brand text-xl">NovLearn</span>
        <span className="badge">Admin · Staging synthétique</span>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="text-3xl font-semibold">Tester un exercice</h1>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
          onClick={() =>
            setDefinition({
              ...definition,
              title: definition.title + ' · modifié',
            })
          }
        >
          Modifier le titre du brouillon
        </button>
        <ExercisePreview definition={definition} engineEnabled />
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
