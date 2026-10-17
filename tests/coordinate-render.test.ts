import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicElement, PublicInstance } from 'novlearn-exercise-engine';
import { PublicExercise } from '@/components/public-exercise';
import captures from './fixtures/coordinate-projections.json';
const render = (elements: PublicElement[]) =>
  renderToStaticMarkup(
    createElement(PublicExercise, {
      instance: {
        schemaVersion: 5,
        instanceId: 'coordinate-test',
        title: 'Figures',
        elements,
      },
    }),
  );
const instance = captures[0].instance as PublicInstance;
const geometry = instance.elements.find(
  (e) => e.type === 'geometry',
)! as Extract<PublicElement, { type: 'geometry' }>;
const v2 = instance.elements.find(
  (e) => e.type === 'vectors' && e.dimension === 2,
)! as Extract<PublicElement, { type: 'vectors' }>;
const v3 = instance.elements.find(
  (e) => e.type === 'vectors' && e.dimension === 3,
)! as Extract<PublicElement, { type: 'vectors' }>;
it.each(captures)(
  'renders the actual native public projection for seed $seed without nonfinite SVG or private fields',
  ({ instance }) => {
    const html = render(instance.elements as PublicElement[]);
    expect(html).toContain('Projection orthographique 2D');
    expect(html).toContain('Description et coordonnées de la figure');
    expect(html).toContain('tracé de sa courbe restent');
    expect(html).not.toMatch(/(?:NaN|Infinity)/);
    expect(html).not.toContain('expectedLatex');
    expect(html).not.toContain('policy');
  },
);
it('draws the infinite line even when both of its defining points are far outside the view', () => {
  const html = render([geometry]);
  expect(html).toContain(
    '<line x1="40" y1="300" x2="480" y2="40" stroke="#ef4444"',
  );
  expect(html).not.toMatch(/<line[^>]*stroke="#6366f1"/); // outside segment is not extended
  expect(html).toContain('Droite d passant par A et B.');
  expect(html).toContain('Hors de la fenêtre');
  expect(html).toContain('Polygone triangle : sommets P, Q, R.');
  expect(html).toContain('Rayon du cercle c');
});
it('gives every arrow a distinct marker and keeps labels readable without relying on color', () => {
  const html = render([v2, { ...v2, id: 'second-vector-figure' }]);
  const ids = [...html.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
  expect(ids).toHaveLength(8);
  expect(new Set(ids).size).toBe(8);
  const links = [...html.matchAll(/marker-end="url\(#([^)]*)\)"/g)].map(
    (m) => m[1],
  );
  expect(links).toHaveLength(6);
  expect(links.every((id) => ids.includes(id))).toBe(true);
  expect(html).toContain('Liste des vecteurs');
  expect(html).toContain('Projection confondue avec l’origine.');
});
it('announces the 3D projection ambiguity without showing hidden coordinate fields', () => {
  const html = render([v3]);
  expect(html).toContain('des vecteurs distincts peuvent se superposer');
  expect(html).toContain('Les longueurs spatiales ne se lisent pas');
  expect(html).toContain('Projection confondue avec l’origine.');
  expect(html.match(/Coordonnées masquées/g)).toHaveLength(4);
  expect(html).not.toContain('Coordonnées du vecteur');
  expect(html).not.toContain('\\left(');
});
it('keeps fractional bounds in MathLive fields instead of raw LaTeX SVG text', () => {
  const complex = instance.elements.find((e) => e.type === 'complex-plane')!;
  const html = render([complex]);
  expect(html).toContain('Borne x min');
  expect(html).toContain('Borne y max');
  expect(html).not.toMatch(/<text(?:\s[^>]*)?>[^<]*\\frac/);
  expect(html).toContain('<title');
  expect(html).toContain('<desc');
  expect(html).toContain('aria-describedby=');
});
it('refuses an unusable drawing window or vector without emitting an invalid SVG', () => {
  const html = render([
    { ...geometry, window: { ...geometry.window, xMax: geometry.window.xMin } },
  ]);
  expect(html).toContain('La fenêtre ne permet pas un tracé fini');
  expect(html).not.toContain('<svg');
  const invalid = render([
    {
      ...v2,
      vectors: [
        {
          ...v2.vectors[0],
          coordinates: [
            { numerator: Infinity, denominator: 1, latex: 'NONFINITE' },
            { numerator: 0, denominator: 1, latex: '0' },
          ],
        },
      ],
    },
  ]);
  expect(invalid).toContain('Les coordonnées ne permettent pas un tracé fini');
  expect(invalid).not.toContain('<svg');
});
it('escapes figure labels and descriptions from the public contract', () => {
  const html = render([
    {
      ...geometry,
      points: geometry.points.map((p) => ({
        ...p,
        label: '<img src=x onerror=alert(1)>',
      })),
    },
  ]);
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img');
});
