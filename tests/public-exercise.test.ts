import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicExercise } from '@/components/public-exercise';
import type { PublicElement } from 'novlearn-exercise-engine';
const n = (latex: string) => ({
  numerator: Number(latex),
  denominator: 1,
  latex,
});
const window = { xMin: n('-5'), xMax: n('5'), yMin: n('-5'), yMax: n('5') };
const projection = {
  schemaVersion: 5 as const,
  instanceId: 'render-fixture',
  title: 'Titre canonique',
  elements: [] as PublicElement[],
};
it('rend la projection élève, échappe le texte et ne génère aucune politique ou attendu', () => {
  const html = renderToStaticMarkup(
    createElement(PublicExercise, {
      instance: {
        ...projection,
        elements: [
          {
            id: 'q',
            type: 'question',
            text: '<script>alert(1)</script>',
            points: 1,
            response: { format: 'latex', kind: 'rational' },
          },
          {
            id: 'mcq',
            type: 'mcq',
            text: 'Choisissez',
            points: 1,
            mode: 'multiple',
            options: [
              { id: 'a', content: { format: 'text', text: 'A' } },
              { id: 'b', content: { format: 'latex', latex: '\\frac{1}{2}' } },
            ],
          },
        ],
      },
    }),
  );
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('checkbox');
  expect(html).not.toContain('expected');
  expect(html).not.toContain('policy');
});
it('rend les tableaux, points prescrits, géométrie, vecteurs et arbre sans calculer de formules', () => {
  const elements: PublicElement[] = [
    {
      id: 'values',
      type: 'value-table',
      formulaDomain: 'unverified',
      columns: ['x', 'y'],
      rows: [
        [
          { kind: 'number', value: n('1') },
          { kind: 'math', latex: 'x+1' },
        ],
      ],
    },
    {
      id: 'stats',
      type: 'statistics-table',
      formulaDomain: 'unverified',
      rows: [{ label: 'Groupe', value: n('1'), frequency: n('2') }],
    },
    {
      id: 'signs',
      type: 'sign-table',
      formulaDomain: 'unverified',
      variable: 'x',
      points: [
        { kind: 'negative-infinity' },
        { kind: 'finite', value: n('0') },
        { kind: 'positive-infinity' },
      ],
      rows: [
        {
          id: 'r',
          label: 'f',
          signs: ['-', '+'],
          pointSigns: [null, '0', null],
        },
      ],
    },
    {
      id: 'variations',
      type: 'variation-table',
      formulaDomain: 'unverified',
      variable: 'x',
      points: [
        {
          x: { kind: 'finite', value: n('0') },
          value: { kind: 'finite', value: n('1') },
          excluded: false,
        },
        {
          x: { kind: 'finite', value: n('1') },
          value: { kind: 'finite', value: n('2') },
          excluded: false,
        },
      ],
      directions: ['increasing'],
    },
    {
      id: 'sequence',
      type: 'sequence-graph',
      formulaDomain: 'unverified',
      window,
      showGrid: true,
      connectPoints: true,
      sequence: {
        mode: 'points',
        points: [
          { index: 0, value: n('1') },
          { index: 1, value: n('2') },
        ],
      },
    },
    {
      id: 'function',
      type: 'function-graph',
      formulaDomain: 'unverified',
      window,
      showGrid: true,
      variable: 'x',
      functions: [
        { id: 'f', latex: 'x^2', color: '#2563eb', showExpression: true },
      ],
    },
    {
      id: 'vectors',
      type: 'vectors',
      formulaDomain: 'unverified',
      dimension: 2,
      showCoordinates: true,
      vectors: [
        {
          id: 'v',
          label: 'u',
          coordinates: [n('1'), n('2')],
          color: '#2563eb',
        },
      ],
    },
    {
      id: 'geometry',
      type: 'geometry',
      formulaDomain: 'unverified',
      window,
      showGrid: true,
      points: [
        { id: 'a', label: 'A', coordinates: [n('0'), n('0')] },
        { id: 'b', label: 'B', coordinates: [n('1'), n('1')] },
      ],
      objects: [
        { id: 's', kind: 'segment', from: 'a', to: 'b', color: '#2563eb' },
        {
          id: 'c',
          kind: 'circle',
          center: 'a',
          radius: n('1'),
          color: '#2563eb',
        },
      ],
    },
    {
      id: 'complex',
      type: 'complex-plane',
      formulaDomain: 'unverified',
      window,
      showGrid: true,
      showCoordinates: true,
      points: [
        {
          id: 'z',
          label: 'Z',
          real: n('1'),
          imaginary: n('2'),
          color: '#2563eb',
        },
      ],
    },
    {
      id: 'tree',
      type: 'probability-tree',
      formulaDomain: 'unverified',
      exhaustive: false,
      nodes: [
        { id: 'root', label: 'Départ' },
        { id: 'child', parentId: 'root', label: 'A', probability: n('1') },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    createElement(PublicExercise, { instance: { ...projection, elements } }),
  );
  for (const label of [
    'Tableau de valeurs',
    'Tableau statistique',
    'Tableau de signes',
    'Tableau de variations',
    'Graphe de suite',
    'Plan complexe',
    'Figure géométrique',
    'Arbre de probabilités',
  ])
    expect(html).toContain(label);
  expect(html).toContain('polyline');
  expect(html).toContain('ellipse');
  expect(html).toContain('Croissante');
  expect(html).toContain('tracé de sa courbe restent');
  expect(html).not.toContain('NaN');
});
