import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { PedagogyStatisticsView } from '@/components/pedagogy-statistics';
import {
  readPedagogyQuery,
  type PedagogyStatistics,
} from '@/lib/pedagogy-statistics';
import fixture from './fixtures/pedagogy-statistics.json';
const parsed = readPedagogyQuery(
  new URLSearchParams('from=2026-10-15&to=2026-10-17'),
);
if (!parsed.ok) throw Error('fixture');
const query = parsed.query;
const data = () =>
  ({
    ...structuredClone(fixture),
    environment: 'local-copy',
  }) as PedagogyStatistics;
const render = (p: PedagogyStatistics | null = data()) =>
  renderToStaticMarkup(
    createElement(PedagogyStatisticsView, { data: p, query }),
  );
it('renders accessible forms and tables with recorded-result limitations', () => {
  const html = render();
  for (const name of [
    'from',
    'to',
    'chapter',
    'competence',
    'difficulty',
    'exerciseType',
    'mode',
    'groupBy',
    'sort',
    'chapterSearch',
    'competenceSearch',
  ])
    expect(html).toContain(`name="${name}"`);
  expect(html).toContain('<caption');
  expect(html).toContain('scope="row"');
  expect(html).toContain('method="get"');
  expect(html).toContain('Les abandons sont exclus');
  expect(html).toContain('Référence non résolue');
  expect(html).toContain('Exercices différents traités');
  expect(html).toContain('Réponses terminées');
  expect(html).toContain('plusieurs personnes');
});
it('escapes current reference labels without embedding HTML', () => {
  const p = data();
  p.groups.rows[0].label = '<script>alert(1)</script>';
  p.references.chapters[0].label = '<img src=x onerror=alert(1)>';
  const html = render(p);
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<script>alert');
  expect(html).not.toContain('<img src=x');
});
it('renders a failed read without fabricated counts or a misleading empty result', () => {
  const html = render(null);
  expect(html).toContain('Statistiques pédagogiques indisponibles');
  expect(html).not.toContain('Tentatives en pratique');
  expect(html).not.toContain('Aucun résultat pour ces filtres');
});
it('rejects private projection fields and wrong source at the rendering boundary', () => {
  for (const change of [{ email: 'private' }, { environment: 'production' }]) {
    const p = Object.assign(data(), change);
    const html = render(p);
    expect(html).toContain('indisponibles');
    expect(html).not.toContain('Tentatives en pratique');
    expect(html).not.toContain('private');
  }
});
it('shows a successful empty selection distinctly from unavailability', () => {
  const p = data();
  for (const k of Object.keys(p.totals) as (keyof typeof p.totals)[])
    p.totals[k] = '0';
  p.completedWork = { distinctExercises: '0', completedResponses: '0' };
  for (const k of Object.keys(p.quality) as (keyof typeof p.quality)[])
    p.quality[k] = '0';
  p.groups.rows = [];
  p.groups.total = '0';
  const html = render(p);
  expect(html).toContain('Aucun résultat pour ces filtres');
  expect(html).not.toContain('Statistiques pédagogiques indisponibles');
});
it('keeps exact bigint pages and filters in backward navigation', () => {
  const p = data();
  p.groups.page = '9007199254740993';
  p.groups.rows = [];
  const html = renderToStaticMarkup(
    createElement(PedagogyStatisticsView, {
      data: p,
      query: { ...query, page: p.groups.page },
      chapterSearch: '%_\\',
    }),
  );
  expect(html).toContain('page=9007199254740992');
  expect(html).toContain('chapterSearch=%25_%5C');
  expect(html).toContain('from=2026-10-15');
  expect(html).toContain('Cette page ne contient plus de ligne');
});

it('renders production pedagogy only with the expected source', () => {
  const p = { ...data(), environment: 'production' as const };
  const html = renderToStaticMarkup(
    createElement(PedagogyStatisticsView, {
      data: p,
      query,
      environment: 'production',
    }),
  );
  expect(html).toContain('Production · résultats pédagogiques · lecture seule');
  expect(html).toContain('Les résultats des comptes invités sont exclus');
  expect(html).not.toContain('données de test');
  expect(
    renderToStaticMarkup(
      createElement(PedagogyStatisticsView, { data: p, query }),
    ),
  ).toContain('Statistiques pédagogiques indisponibles');
});
