import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { UserDetailView } from '@/components/user-detail';
import {
  readUserDetailQuery,
  detailItemKey,
  type UserDetailPage,
  type UserDetailView as View,
  type ChapterProgressItem,
} from '@/lib/user-detail';
import fixture from './fixtures/user-detail-sql.json';
const data = (view: View = 'history') =>
  ({
    ...structuredClone(fixture[view]),
    environment: 'local-copy',
  }) as unknown as UserDetailPage;
const query = (view: View = 'history') => {
  const parsed = readUserDetailQuery(
    fixture.history.userId,
    new URLSearchParams({ from: '2026-10-15', to: '2026-10-17', view }),
  );
  if (!parsed.ok) throw Error('fixture query');
  return parsed.value;
};
const render = (view: View = 'history', p = data(view)) =>
  renderToStaticMarkup(
    createElement(UserDetailView, { data: p, query: query(view) }),
  );
it('renders the minimized identity and exact historical source with a clear certification limit', () => {
  const html = render();
  for (const text of [
    'LOCAL ACTIVITY A',
    'activity-a@example.test',
    'Base locale synthétique',
    'Tentatives enregistrées',
    'Version référencée',
    'Version historique non renseignée',
    'Version non consultée',
    'pas une certification par l’Engine',
    'Titre actuel',
    'Réussite déclarée',
    'Abandon déclaré',
    'sans date',
  ])
    expect(html).toContain(text);
  expect(html).toContain('<caption');
  expect(html).toContain('scope="row"');
  expect(html).toContain('dateTime=');
  expect(html).not.toContain('birth_date');
  expect(html).not.toContain('encrypted_password');
});
it('escapes identity and current labels as text', () => {
  const p = data();
  p.user.name = '<script>alert(1)</script>';
  const row = p.items.find(
    (i) => i.kind === 'exercise' && i.exerciseId !== null,
  )!;
  if (row.kind !== 'exercise') throw Error('fixture history');
  row.currentTitle = '<img src=x onerror=alert(1)>';
  row.titleTruncated = false;
  const html = render('history', p);
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<script>alert(1)');
  expect(html).not.toContain('<img src=x');
});
it('shows missing and invalid chapter values without zero replacement', () => {
  const html = render('chapters');
  for (const text of [
    'état actuel',
    'Libellé enregistré',
    'Niveau non renseigné',
    'Nombre d’exercices non renseigné',
    'Nombre d’exercices incohérent',
    'Valeur incohérente',
    'Date future signalée',
    'Libellé abrégé',
    'ne sont pas rattachés arbitrairement',
  ])
    expect(html).toContain(text);
  expect(html).not.toMatch(/>0 \/ 100</);
  expect(html).not.toContain('NaN');
});
it('shows recorded points above a current maximum and unknown taxonomy honestly', () => {
  const html = render('competences');
  for (const text of [
    'barème actuel',
    '15 points / 10',
    'Points supérieurs au barème actuel',
    'barème inconnu',
    'Compétence absente du référentiel actuel',
    'sans recalcul ni plafonnement',
  ])
    expect(html).toContain(text);
});
it('never renders fabricated empty statistics for unavailable data', () => {
  const html = renderToStaticMarkup(
    createElement(UserDetailView, {
      data: null,
      query: query(),
      error: 'Fiche indisponible',
    }),
  );
  expect(html).toContain('Fiche utilisateur indisponible');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('0 ligne');
  expect(html).not.toContain('Aucune tentative datée');
  expect(html).not.toContain('Tentatives d’exercice');
});
it('rejects malformed data at the rendering boundary as unavailable', () => {
  const p = data();
  Object.assign(p.user, { privateAnswer: 'secret' });
  const html = render('history', p);
  expect(html).toContain('Fiche utilisateur indisponible');
  expect(html).not.toContain('privateAnswer');
  expect(html).not.toContain('activity-a@example.test');
});
it('uses a GET form and resets cursor state on period or tab changes', () => {
  const html = render('chapters');
  expect(html).toContain('method="get"');
  expect(html).toContain('name="view"');
  expect(html).toContain('value="chapters"');
  expect(html).not.toContain('name="after"');
  expect(html).not.toContain('name="before"');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('hors filtre de période');
});
it('renders accessible forward/backward cursor links only for valid boundaries', () => {
  const p = data('chapters'),
    base = p.items[0] as ChapterProgressItem;
  p.items = Array.from({ length: 25 }, (_, i) => ({
    ...base,
    id: String(i + 1),
  }));
  p.page.total = '26';
  p.page.next = detailItemKey(p.items[24]);
  const html = render('chapters', p);
  expect(html).toContain('Page suivante');
  expect(html).not.toContain('Page précédente');
  expect(html).toContain('after=0000000000000000025');
  const q = { ...query('chapters'), after: p.page.next };
  p.cursor.after = p.page.next;
  p.items = [{ ...base, id: '26' }];
  p.page.previous = detailItemKey(p.items[0]);
  p.page.next = null;
  const back = renderToStaticMarkup(
    createElement(UserDetailView, { data: p, query: q }),
  );
  expect(back).toContain('Page précédente');
  expect(back).not.toContain('Page suivante');
  expect(back).toContain('before=0000000000000000026');
});
it('distinguishes an empty activity period from a missing account or failure', () => {
  const p = data();
  p.items = [];
  p.page.total = '0';
  for (const key of [
    'exerciseAttempts',
    'exerciseCorrect',
    'exerciseIncorrect',
    'exerciseAbandoned',
    'duelAttempts',
    'duelCorrect',
    'duelIncorrect',
  ] as const)
    p.activity[key] = '0';
  p.activity.lastActivity = null;
  const html = render('history', p);
  expect(html).toContain('Aucune tentative datée sur cette période');
  expect(html).toContain('Aucune sur la période');
  expect(html).not.toContain('Fiche utilisateur indisponible');
});
