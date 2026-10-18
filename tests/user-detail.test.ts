import { expect, it } from 'vitest';
import {
  decodeUserDetail,
  readUserDetailQuery,
  userDetailHref,
  detailItemKey,
  compareDetailKeys,
  type UserDetailPage,
  type UserDetailView,
  type UserHistoryItem,
  type ChapterProgressItem,
  type CompetenceProgressItem,
} from '@/lib/user-detail';
import fixture from './fixtures/user-detail-sql.json';
const uid = 'a8100000-0000-4000-8000-000000000001';
const params = (extra = '') =>
  new URLSearchParams('from=2026-10-15&to=2026-10-17' + extra);
const query = (view: UserDetailView = 'history', userId = uid) => {
  const q = readUserDetailQuery(userId, params('&view=' + view));
  if (!q.ok) throw Error('fixture query');
  return q.value;
};
type PageFor<V extends UserDetailView> = Omit<
  UserDetailPage,
  'items' | 'view'
> & {
  view: V;
  items: (V extends 'history'
    ? UserHistoryItem
    : V extends 'chapters'
      ? ChapterProgressItem
      : CompetenceProgressItem)[];
};
const page = <V extends UserDetailView = 'history'>(
  view: V = 'history' as V,
): PageFor<V> =>
  ({
    ...structuredClone(fixture[view]),
    environment: 'local-copy',
  }) as unknown as PageFor<V>;
it.each(['history', 'chapters', 'competences'] as const)(
  'accepts the actual native SQL %s output',
  (view) => {
    const decoded = decodeUserDetail(page(view), query(view));
    expect(decoded).not.toBeNull();
    expect(decoded).not.toBe('not-found');
  },
);
it('recognizes only the explicit matching absence envelope as not found', () => {
  const missing = { ...fixture.missing, environment: 'local-copy' };
  expect(
    decodeUserDetail(missing, query('history', fixture.missing.userId)),
  ).toBe('not-found');
  expect(decodeUserDetail(missing, query())).toBeNull();
  expect(
    decodeUserDetail(
      { ...missing, user: {} },
      query('history', fixture.missing.userId),
    ),
  ).toBeNull();
  expect(decodeUserDetail({ ...page(), user: null }, query())).toBeNull();
});
it.each([
  '&view=unknown',
  '&view=history&view=chapters',
  '&from=2026-10-14',
  '&environment=production',
  '&limit=1000',
  '&q=email',
  '&after=invalid',
  '&before=invalid',
  '&view=chapters&after=0000000000000000000',
  '&view=chapters&after=9999999999999999999',
  '&view=competences&after=' + encodeURIComponent('a\n'),
  '&view=competences&after=' + 'a'.repeat(1001),
])('refuses invalid or ambiguous detail request %s', (extra) => {
  expect(readUserDetailQuery(uid, params(extra)).ok).toBe(false);
});
it('requires a canonical UUID and mutually exclusive cursors', () => {
  expect(readUserDetailQuery('INVALID', params()).ok).toBe(false);
  expect(readUserDetailQuery(uid.toUpperCase(), params()).ok).toBe(false);
  expect(
    readUserDetailQuery(
      uid,
      params(
        '&view=chapters&after=0000000000000000001&before=0000000000000000002',
      ),
    ).ok,
  ).toBe(false);
  expect(
    readUserDetailQuery(
      uid,
      new URLSearchParams('from=2026-10-18&to=2026-10-19'),
      new Date('2026-10-18T12:00:00Z'),
    ).ok,
  ).toBe(false);
});
it('keeps the period and uses explicit replacement cursors in links', () => {
  const q = { ...query('competences'), after: 'old' };
  const href = userDetailHref(q, { before: 'local_detail_😀' });
  const u = new URL(href, 'http://local.test');
  expect(u.pathname).toBe('/admin/users/' + uid);
  expect(u.searchParams.get('from')).toBe('2026-10-15');
  expect(u.searchParams.get('before')).toBe('local_detail_😀');
  expect(u.searchParams.has('after')).toBe(false);
  expect(
    new URL(
      userDetailHref(q, { view: 'history' }),
      'http://local.test',
    ).searchParams.has('after'),
  ).toBe(false);
});
it('uses PostgreSQL C ordering for supplementary Unicode keys', () => {
  expect(compareDetailKeys('local_detail_￿', 'local_detail_😀')).toBe(-1);
  expect(compareDetailKeys('é', 'é')).toBe(0);
  expect(compareDetailKeys('a', 'ab')).toBe(-1);
});
it('rejects unpaired surrogate cursors instead of changing their identity during encoding', () => {
  const p = page('competences');
  p.items[0].id = 'bad\ud800';
  expect(decodeUserDetail(p, query('competences'))).toBeNull();
});
it('preserves every microsecond and the kind tie-breaker in history keys', () => {
  const p = decodeUserDetail(page(), query()) as UserDetailPage;
  const collisions = p.items.filter(
    (i) => 'occurredAt' in i && i.occurredAt === '2026-10-16T12:00:00.123456Z',
  );
  expect(detailItemKey(collisions[0])).toBe(
    '20261016120000123456:0000000000981100002:exercise',
  );
  expect(
    compareDetailKeys(
      detailItemKey(collisions[0]),
      detailItemKey(collisions[1]),
    ),
  ).toBe(1);
});
it.each([
  (p: Record<string, unknown>) => {
    p.environment = 'production';
  },
  (p: Record<string, unknown>) => {
    p.userId = 'a8100000-0000-4000-8000-000000000004';
  },
  (p: Record<string, unknown>) => {
    p.found = false;
  },
  (p: Record<string, unknown>) => {
    p.view = 'chapters';
  },
  (p: Record<string, unknown>) => {
    p.password = 'secret';
  },
])('rejects source/context/schema drift %#', (mutate) => {
  const p: Record<string, unknown> = page();
  mutate(p);
  expect(decodeUserDetail(p, query())).toBeNull();
});
it('does not accept additional personal data on the identity or history', () => {
  const p = page();
  Object.assign(p.user, { birth_date: '2000-01-01' });
  expect(decodeUserDetail(p, query())).toBeNull();
  const h = page();
  Object.assign(h.items[0], { answer: 'private' });
  expect(decodeUserDetail(h, query())).toBeNull();
});
it('refuses guest name or email disclosure', () => {
  const guest = {
    ...structuredClone(fixture.guest),
    environment: 'local-copy',
  } as unknown as UserDetailPage;
  const q = query('history', guest.userId);
  expect(decodeUserDetail(guest, q)).not.toBeNull();
  guest.user.email = 'hidden@example.test';
  expect(decodeUserDetail(guest, q)).toBeNull();
});
it('requires exact historical activity partitions and safe string counts', () => {
  const p = page();
  p.activity.exerciseCorrect = '999';
  expect(decodeUserDetail(p, query())).toBeNull();
  const other = page();
  Object.assign(other.activity, { exerciseAttempts: 5 });
  expect(decodeUserDetail(other, query())).toBeNull();
  const overflow = page();
  overflow.activity.undatedExerciseAttempts = '9223372036854775808';
  expect(decodeUserDetail(overflow, query())).toBeNull();
});
it('rejects times outside the selected period and inconsistent last activity', () => {
  const p = page();
  p.items[0].occurredAt = '2026-10-18T00:00:00Z';
  expect(decodeUserDetail(p, query())).toBeNull();
  const other = page();
  other.activity.lastActivity = null;
  expect(decodeUserDetail(other, query())).toBeNull();
});
it('detects future timestamps even within the same millisecond', () => {
  const p = page('chapters');
  p.asOf = '2026-10-18T12:00:00.123455Z';
  p.items[0].recordedAt = '2026-10-18T12:00:00.123456Z';
  p.items[0].issues = [];
  expect(decodeUserDetail(p, query('chapters'))).toBeNull();
  p.items[0].issues = ['future-date'];
  expect(decodeUserDetail(p, query('chapters'))).not.toBeNull();
});
it('does not guess versions for duel attempts or accept an abandoned duel verdict', () => {
  const p = page();
  const row = p.items.find((i) => i.kind === 'duel')!;
  row.versionId = 'a8200000-0000-4000-8000-000000000001';
  expect(decodeUserDetail(p, query())).toBeNull();
  row.versionId = null;
  row.outcome = 'abandoned';
  expect(decodeUserDetail(p, query())).toBeNull();
});
it('refuses a known version without its exercise identity or a false latest-activity timestamp', () => {
  const p = page();
  const row = p.items.find((i) => i.versionId !== null)!;
  row.exerciseId = null;
  row.currentTitle = null;
  row.titleTruncated = false;
  expect(decodeUserDetail(p, query())).toBeNull();
  const other = page();
  other.activity.lastActivity = '2026-10-15T01:00:00Z';
  expect(decodeUserDetail(other, query())).toBeNull();
});
it('requires exact ordering and unique event keys', () => {
  const p = page();
  [p.items[0], p.items[1]] = [p.items[1], p.items[0]];
  expect(decodeUserDetail(p, query())).toBeNull();
  const duplicate = page();
  duplicate.items[1] = structuredClone(duplicate.items[0]);
  expect(decodeUserDetail(duplicate, query())).toBeNull();
});
it('rejects missing navigation when the result is larger than a first page', () => {
  const p = page();
  p.items = p.items.slice(0, 2);
  p.page.size = 2;
  expect(decodeUserDetail(p, query(), 2)).toBeNull();
  p.page.next = detailItemKey(p.items[1] as UserDetailPage['items'][number]);
  expect(decodeUserDetail(p, query(), 2)).not.toBeNull();
});
it('never turns missing or invalid recorded progression into a valid zero', () => {
  const p = page('chapters');
  p.items[1].completed = '0';
  expect(decodeUserDetail(p, query('chapters'))).toBeNull();
  const invalid = page('chapters');
  invalid.items[2].issues = ['future-date'];
  expect(decodeUserDetail(invalid, query('chapters'))).toBeNull();
});
it('requires the unknown-competence and above-current-maximum warnings', () => {
  const p = page('competences');
  p.items[0].issues = ['missing-date'];
  expect(decodeUserDetail(p, query('competences'))).toBeNull();
  const other = page('competences');
  other.items[2].issues = [];
  expect(decodeUserDetail(other, query('competences'))).toBeNull();
});
