import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { UsersListView } from '@/components/users-list';
import { statisticsPeriod } from '@/lib/activity-statistics';
import type { UsersPage } from '@/lib/users';
const query = {
  period: statisticsPeriod('2026-10-15', '2026-10-17')!,
  query: '',
  after: null,
  before: null,
};
const page = (): UsersPage => ({
  schemaVersion: 1,
  environment: 'local-copy',
  asOf: '2026-10-18T12:00:00Z',
  period: { from: query.period.from, until: query.period.until },
  query: '',
  cursor: { after: null, before: null },
  pageSize: 25,
  total: '1',
  previous: null,
  next: null,
  items: [
    {
      id: 'a8100000-0000-4000-8000-000000000001',
      name: 'LOCAL <script>ACTIVITY</script>',
      nameTruncated: false,
      email: 'activity-a@example.test',
      anonymous: false,
      exerciseAttempts: '3',
      duelAttempts: '1',
      lastActivity: '2026-10-17T23:59:59Z',
    },
  ],
});
it('renders only verified nominal data, an accessible table and the truthful source', () => {
  const html = renderToStaticMarkup(
    createElement(UsersListView, { data: page(), query }),
  );
  expect(html).toContain('Base locale synthétique');
  expect(html).toContain('activity-a@example.test');
  expect(html).toContain('<caption');
  expect(html).toContain('scope="row"');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>ACTIVITY');
  expect(html).toContain('3 tentatives d’exercice');
  expect(html).toContain('action="/admin/users"');
});
it('does not turn unavailable data into an empty list or zero count', () => {
  const html = renderToStaticMarkup(
    createElement(UsersListView, {
      data: null,
      query,
      error: 'Lecture indisponible',
    }),
  );
  expect(html).toContain('Utilisateurs indisponibles');
  expect(html).not.toContain('0 comptes');
  expect(html).not.toContain('Aucun compte ne correspond');
});
it('distinguishes a valid empty search from unavailable data', () => {
  const p = page();
  p.items = [];
  p.total = '0';
  const html = renderToStaticMarkup(
    createElement(UsersListView, { data: p, query }),
  );
  expect(html).toContain('Aucun compte ne correspond');
  expect(html).not.toContain('Utilisateurs indisponibles');
});
it('refuses extra private fields instead of silently displaying a permissive object', () => {
  const p = page();
  (p.items[0] as unknown as Record<string, unknown>).birth_date = '2000-01-01';
  const html = renderToStaticMarkup(
    createElement(UsersListView, { data: p, query }),
  );
  expect(html).toContain('Utilisateurs indisponibles');
  expect(html).not.toContain('2000-01-01');
});
it('does not label an account inactive when no attempt timestamp is available', () => {
  const p = page();
  p.items[0].exerciseAttempts = '0';
  p.items[0].duelAttempts = '0';
  p.items[0].lastActivity = null;
  const html = renderToStaticMarkup(
    createElement(UsersListView, { data: p, query }),
  );
  expect(html).toContain('Aucune tentative datée');
  expect(html).not.toContain('Dernière tentative :');
});
it('does not preserve an obsolete cursor when starting a new search', () => {
  const p = page();
  p.cursor.after = 'a8100000-0000-4000-8000-000000000000';
  p.previous = p.items[0].id;
  p.total = '2';
  const html = renderToStaticMarkup(
    createElement(UsersListView, {
      data: p,
      query: { ...query, after: p.cursor.after },
    }),
  );
  expect(html).not.toContain('name="after"');
  expect(html).toContain('before=');
});
