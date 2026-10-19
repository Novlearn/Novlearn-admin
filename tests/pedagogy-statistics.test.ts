import { expect, it } from 'vitest';
import {
  decodePedagogyStatistics,
  pedagogyQueryParams,
  readPedagogyQuery,
  type PedagogyStatistics,
} from '@/lib/pedagogy-statistics';
const chapter = 'ab100000-0000-4000-8000-000000000001';
const read = (extra = '') =>
  readPedagogyQuery(
    new URLSearchParams('from=2026-10-15&to=2026-10-17' + extra),
  );
const base = read();
if (!base.ok) throw Error('Invalid test period');
const query = base.query;
const expected = { environment: 'local-copy' as const, query };
const counts = {
  exerciseAttempts: '2',
  duelAttempts: '1',
  completedDuels: '1',
  activeAccounts: '1',
  correct: '1',
  incorrect: '1',
  abandoned: '1',
  unclassified: '0',
};
const fixture = (): PedagogyStatistics => ({
  schemaVersion: 1,
  environment: 'local-copy',
  asOf: '2026-10-19T10:00:00.123456Z',
  period: { from: '2026-10-15', until: '2026-10-18' },
  filters: {
    chapter: null,
    competence: null,
    difficulty: null,
    exerciseType: null,
    mode: 'all',
    groupBy: 'chapter',
    sort: 'attempts',
  },
  totals: { ...counts },
  quality: {
    missingExerciseAttempts: '0',
    unresolvedChapterAttempts: '0',
    noCompetenceAttempts: '0',
    unknownCompetenceLinks: '0',
  },
  references: {
    chapters: [{ id: chapter, label: 'Analyse', truncated: false }],
    competences: [
      { id: 'derivee', label: 'Analyse · Dérivée', truncated: false },
    ],
    moreChapters: false,
    moreCompetences: false,
  },
  groups: {
    page: '1',
    size: 25,
    total: '1',
    hasMore: false,
    rows: [
      {
        id: chapter,
        label: 'Analyse',
        truncated: false,
        counts: { ...counts },
      },
    ],
  },
});
it('conserve une projection agrégée réentrante et indépendante de son entrée', () => {
  const original = fixture(),
    decoded = decodePedagogyStatistics(original, expected);
  expect(decoded).toEqual(original);
  expect(decodePedagogyStatistics(decoded, expected)).toEqual(original);
  decoded!.groups.rows[0].label = 'Changed';
  expect(original.groups.rows[0].label).toBe('Analyse');
});
it('conserve exactement une compétence Unicode et des filtres combinés', () => {
  const parsed = read(
    '&chapter=' +
      chapter +
      '&competence=' +
      encodeURIComponent('local_😀') +
      '&difficulty=hard&exerciseType=flash&mode=duel&groupBy=competence&sort=success&page=2',
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(readPedagogyQuery(pedagogyQueryParams(parsed.query))).toEqual(parsed);
});
it.each([
  '&source=production',
  '&userId=123',
  '&mode=all&mode=duel',
  '&competence=a&competence=b',
  '&page=01',
  '&page=0',
  '&page=-1',
  '&page=1.5',
  '&page=368934881474191033',
  '&groupBy=definition',
  '&sort=title',
  '&mode=bad',
  '&exerciseType=qcm',
  '&difficulty=impossible',
  '&chapter=Analyse',
  '&competence=%00',
  '&competence=%0A',
  '&competence=' + encodeURIComponent('😀'.repeat(201)),
])('refuse le filtre ambigu ou hors contrat %s', (extra) =>
  expect(read(extra).ok).toBe(false),
);
it('réutilise le contrat UTC sans accepter une date isolée ou future', () => {
  expect(readPedagogyQuery(new URLSearchParams('from=2026-10-15')).ok).toBe(
    false,
  );
  expect(
    readPedagogyQuery(new URLSearchParams('from=2099-01-01&to=2099-01-02')).ok,
  ).toBe(false);
});
it.each([
  (v: Record<string, unknown>) => {
    v.userEmail = 'private@example.test';
  },
  (v: Record<string, unknown>) => {
    v.environment = 'production';
  },
  (v: Record<string, unknown>) => {
    v.schemaVersion = 2;
  },
  (v: Record<string, unknown>) => {
    v.asOf = '2026-02-30T12:00:00Z';
  },
  (v: Record<string, unknown>) => {
    v.asOf = '2026-10-14T12:00:00Z';
  },
  (v: Record<string, unknown>) => {
    (v.totals as Record<string, unknown>).answers = [];
  },
  (v: Record<string, unknown>) => {
    (v.totals as Record<string, unknown>).exerciseAttempts = 2;
  },
  (v: Record<string, unknown>) => {
    (v.totals as Record<string, unknown>).correct = '9223372036854775808';
  },
  (v: Record<string, unknown>) => {
    (v.totals as Record<string, unknown>).correct = '0';
  },
  (v: Record<string, unknown>) => {
    (v.quality as Record<string, unknown>).missingExerciseAttempts = '4';
  },
  (v: Record<string, unknown>) => {
    (v.filters as Record<string, unknown>).difficulty = 'hard';
  },
  (v: Record<string, unknown>) => {
    (v.filters as Record<string, unknown>).identity = 'private';
  },
  (v: Record<string, unknown>) => {
    (v.groups as Record<string, unknown>).hasMore = true;
  },
  (v: Record<string, unknown>) => {
    (v.groups as Record<string, unknown>).rows = [];
  },
  (v: Record<string, unknown>) => {
    (v.groups as Record<string, unknown>).total = '0';
  },
])('refuse une projection fausse ou excessive %#', (mutate) => {
  const value = fixture();
  mutate(value as unknown as Record<string, unknown>);
  expect(decodePedagogyStatistics(value, expected)).toBeNull();
});
it('ne remplace pas une source locale par une source Production attendue', () =>
  expect(
    decodePedagogyStatistics(fixture(), {
      ...expected,
      environment: 'production',
    }),
  ).toBeNull());
it('préserve des compteurs et une page au-delà de la précision JavaScript', () => {
  const v = fixture();
  v.totals = {
    ...counts,
    exerciseAttempts: '9007199254740993',
    duelAttempts: '0',
    correct: '9007199254740993',
    incorrect: '0',
    abandoned: '0',
  };
  v.groups.rows[0].counts = { ...v.totals };
  expect(decodePedagogyStatistics(v, expected)?.totals.correct).toBe(
    '9007199254740993',
  );
  const p = read('&page=9007199254740993');
  expect(p.ok).toBe(true);
  if (!p.ok) return;
  v.groups.page = p.query.page;
  v.groups.rows = [];
  expect(
    decodePedagogyStatistics(v, { ...expected, query: p.query })?.groups.page,
  ).toBe(p.query.page);
});
it('refuse un total incomplet quand tous les groupes non chevauchants sont visibles', () => {
  const v = fixture();
  v.groups.rows[0].counts = { ...counts, duelAttempts: '0', incorrect: '0' };
  expect(decodePedagogyStatistics(v, expected)).toBeNull();
});
it('autorise le chevauchement des compétences sans gonfler les totaux', () => {
  const v = fixture();
  v.filters.groupBy = 'competence';
  v.groups.total = '2';
  v.groups.rows = [
    { id: 'a', label: 'A', truncated: false, counts: { ...counts } },
    { id: 'b', label: 'B', truncated: false, counts: { ...counts } },
  ];
  expect(
    decodePedagogyStatistics(v, {
      ...expected,
      query: { ...query, groupBy: 'competence' },
    })?.totals.exerciseAttempts,
  ).toBe('2');
});
it('contrôle les ex æquo selon les scalaires Unicode comme PostgreSQL C', () => {
  const v = fixture();
  v.filters.groupBy = 'competence';
  v.groups.total = '2';
  v.groups.rows = [
    { id: '\uffff', label: 'A', truncated: false, counts: { ...counts } },
    { id: '😀', label: 'B', truncated: false, counts: { ...counts } },
  ];
  const e = {
    ...expected,
    query: { ...query, groupBy: 'competence' as const },
  };
  expect(decodePedagogyStatistics(v, e)).not.toBeNull();
  v.groups.rows.reverse();
  expect(decodePedagogyStatistics(v, e)).toBeNull();
});
it('refuse la duplication des groupes et les identifiants de chapitre tronqués', () => {
  const v = fixture();
  v.groups.rows[0].id = 'ab100000-';
  expect(decodePedagogyStatistics(v, expected)).toBeNull();
  const w = fixture();
  w.references.chapters.push({ ...w.references.chapters[0] });
  expect(decodePedagogyStatistics(w, expected)).toBeNull();
});
it('signale les listes de références bornées plutôt que de les présenter comme complètes', () => {
  const v = fixture();
  v.references.moreChapters = true;
  expect(decodePedagogyStatistics(v, expected)).toBeNull();
  v.references.chapters = Array.from({ length: 200 }, (_, i) => ({
    id: `ab100000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    label: String(i),
    truncated: false,
  }));
  expect(decodePedagogyStatistics(v, expected)).not.toBeNull();
});
it('refuse des compteurs de duel sous un filtre exercices', () => {
  const v = fixture();
  v.filters.mode = 'exercise';
  expect(
    decodePedagogyStatistics(v, {
      ...expected,
      query: { ...query, mode: 'exercise' },
    }),
  ).toBeNull();
});
