import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import type { PublicInstance } from 'novlearn-exercise-engine';
import { PublicExercise } from '../../src/components/public-exercise';
import captures from '../fixtures/coordinate-projections.json';
import { WorkspaceNav } from './workspace-nav';
function Harness() {
  const [index, setIndex] = useState(0);
  const capture = captures[index];
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
      <p className="bg-amber-50 px-6 py-3 text-center text-sm text-amber-950">
        Projections publiques capturées du véritable Engine Linux · données
        d’essai · aucun calcul ni accès à une base depuis cette page
      </p>
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <h1 className="text-3xl font-semibold">Figures et vecteurs</h1>
        <p className="text-sm leading-6 text-slate-600">
          Tester les flèches, la projection 3D, la droite définie par deux
          points hors cadre, les fractions et la description textuelle. Le
          graphe de fonction annonce sa limite de tracé.
        </p>
        <div
          role="group"
          aria-label="Projection capturée"
          className="flex gap-3"
        >
          {captures.map((value, i) => (
            <button
              key={value.seed}
              type="button"
              className={
                index === i
                  ? 'button'
                  : 'rounded-lg border border-slate-300 bg-white px-5 py-3'
              }
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
            >
              Seed {value.seed}
            </button>
          ))}
        </div>
        <PublicExercise
          key={capture.instance.instanceId}
          instance={capture.instance as PublicInstance}
          disabled
        />
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
