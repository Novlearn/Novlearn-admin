import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/exercises' }));
import { AdminNavigation } from '@/components/admin-navigation';

it('garde le contenu accessible et masque les services absents du principal local', () => {
  const html = renderToStaticMarkup(
    createElement(AdminNavigation, { publicationEnabled: false }),
  );
  for (const route of [
    '/admin/exercises',
    '/admin/chapters',
    '/admin/competences',
    '/admin/flashcards',
  ])
    expect(html).toContain(`href="${route}"`);
  for (const route of [
    '/admin/publication',
    '/admin/statistics',
    '/admin/users',
  ])
    expect(html).not.toContain(`href="${route}"`);
  expect(html).toContain('aria-current="page"');
});

it('conserve les entrées lorsqu’un environnement les active explicitement', () => {
  const html = renderToStaticMarkup(
    createElement(AdminNavigation, {
      publicationEnabled: true,
      statisticsEnabled: true,
      usersEnabled: true,
    }),
  );
  for (const route of [
    '/admin/publication',
    '/admin/statistics',
    '/admin/users',
  ])
    expect(html).toContain(`href="${route}"`);
});
