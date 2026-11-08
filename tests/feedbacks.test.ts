import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { decodeFeedbackPage, readFeedbackQuery } from '@/lib/feedbacks';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
import { FeedbacksManager } from '@/components/feedbacks-manager';

const id = 'a8100000-0000-4000-8000-000000000001';
const query = {
  categories: [],
  status: 'all' as const,
  sort: 'newest' as const,
  page: 1,
};
const page = {
  environment: 'production',
  pageSize: 25,
  total: 1,
  summary: { total: 1, pending: 1, approved: 0, rejected: 0 },
  items: [
    {
      id,
      createdAt: '2026-11-08T09:00:00Z',
      category: 'content_error',
      message: '<script>alert("retour")</script> Texte envoyé par l’élève.',
      status: null,
      difficultyRating: null,
      exerciseId: 42,
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

it('valide et borne les filtres, le tri et la pagination', () => {
  expect(
    readFeedbackQuery(
      new URLSearchParams(
        'category=difficulty&category=other&status=pending&sort=oldest&page=2',
      ),
    ),
  ).toEqual({
    categories: ['difficulty', 'other'],
    status: 'pending',
    sort: 'oldest',
    page: 2,
  });
  for (const invalid of [
    'status=admin',
    'sort=message',
    'page=0',
    'page=50000',
    `category=${'x'.repeat(81)}`,
    'category=difficulty&category=content_error&category=suggestion&category=other&category=unknown',
  ])
    expect(readFeedbackQuery(new URLSearchParams(invalid))).toBeNull();
});

it('décode les seules colonnes prévues et refuse une projection élargie', () => {
  expect(decodeFeedbackPage(page, query)?.items[0].status).toBeNull();
  expect(
    decodeFeedbackPage(
      { ...page, items: [{ ...page.items[0], email: 'private@example.test' }] },
      query,
    ),
  ).toBeNull();
  expect(
    decodeFeedbackPage({ ...page, environment: 'staging' }, query),
  ).toBeNull();
});

it('affiche la source Production, les catégories, les statuts et échappe les messages', () => {
  const selectedQuery = {
    ...query,
    categories: ['content_error', 'difficulty'],
  };
  const data = decodeFeedbackPage(page, selectedQuery);
  if (!data) throw new Error('Fixture invalide');
  const html = renderToStaticMarkup(
    createElement(FeedbacksManager, {
      data,
      query: selectedQuery,
      reviewEnabled: false,
    }),
  );
  expect(html).toContain('Production · données réelles');
  expect(html).toContain('Erreur de contenu');
  expect(html).toContain('À traiter');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>alert');
  expect(html).toContain('disabled=""');
  expect(html).toContain('Exercice Production');
  expect(html).toContain('name="category" checked="" value="content_error"');
  expect(html).toContain('name="category" checked="" value="difficulty"');
});

it('distingue une lecture Production indisponible d’une liste vide', () => {
  const html = renderToStaticMarkup(
    createElement(FeedbacksManager, {
      data: null,
      query,
      error: 'Lecture impossible',
      reviewEnabled: false,
    }),
  );
  expect(html).toContain('Liste des feedbacks indisponible');
  expect(html).not.toContain('Aucun feedback pour ces filtres');
});
