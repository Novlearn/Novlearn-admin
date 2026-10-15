import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MathfieldElement } from 'mathlive';
import '@fontsource-variable/inter';
import { MathInput } from '../../src/components/math-input';
import '../../src/app/globals.css';
import { WorkspaceNav } from './workspace-nav';

const samples = [
  ['Fraction', '\\frac{1}{2}'],
  ['Puissance', 'x^{2}'],
  ['Racine', '\\sqrt{2}'],
  ['Logarithme', '\\ln(2)'],
  ['Exponentielle', 'e^{2}'],
  ['Trigonométrie', '\\sin(x)'],
  ['Infini', '-\\infty'],
  ['Intervalle', '\\rbrack0;1\\lbrack'],
  ['Ensemble', '\\lbrace1;2\\rbrace'],
  ['Équation', 'x+1=2'],
  ['Décimal', '1{,}25'],
  ['Incomplet', '2^{\\placeholder{}}'],
];

function Harness() {
  const [value, setValue] = useState('');
  const [locked, setLocked] = useState(false);
  const [events, setEvents] = useState(0);
  const [capture, setCapture] = useState('');
  const [fontStatus, setFontStatus] = useState('');
  return (
    <>
      <WorkspaceNav />
      <main>
        <h1 className="text-2xl font-semibold">
          Banc local de saisie MathLive
        </h1>
        <p>Fixtures synthétiques. Aucun exercice, aucune base ni correction.</p>
        <MathInput
          id="test-expression"
          label="Expression de test"
          value={value}
          readOnly={locked}
          onChange={(next) => {
            setValue(next);
            setEvents((count) => count + 1);
          }}
        />
        <button className="button" onClick={() => setLocked(!locked)}>
          {locked ? 'Déverrouiller' : 'Lecture seule'}
        </button>
        <div className="flex flex-wrap gap-2">
          {samples.map(([label, latex]) => (
            <button
              key={label}
              className="rounded-md border bg-white px-3 py-2"
              onClick={() => setValue(latex)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="button" onClick={() => setValue('')}>
          Effacer
        </button>
        <button
          className="button"
          onClick={() =>
            setCapture(
              document
                .querySelector<MathfieldElement>('math-field')
                ?.getValue('latex') ?? 'unavailable',
            )
          }
        >
          Capturer LaTeX MathLive
        </button>
        <button
          className="button"
          onClick={async () => {
            await document.fonts.ready;
            setFontStatus(
              JSON.stringify(
                Array.from(document.fonts)
                  .filter((font) => font.family.includes('KaTeX'))
                  .map((font) => ({
                    family: font.family,
                    status: font.status,
                  })),
              ),
            );
          }}
        >
          Vérifier les polices MathLive
        </button>
        <section className="card">
          <h2>LaTeX reçu par React</h2>
          <output id="latex-output" className="block whitespace-pre-wrap">
            {value}
          </output>
          <p>
            Événements input : <output id="event-count">{events}</output>
          </p>
          <p>
            Capture directe MathLive :{' '}
            <output id="mathlive-capture">{capture}</output>
          </p>
          <output
            id="mathlive-font-status"
            className="block whitespace-pre-wrap"
          >
            {fontStatus}
          </output>
        </section>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
