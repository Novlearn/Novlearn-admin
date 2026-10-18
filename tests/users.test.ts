import { beforeEach, expect, it, vi } from 'vitest';
import {
  readUsersQuery,
  decodeUsersPage,
  usersHref,
  type UsersPage,
} from '@/lib/users';
import { statisticsPeriod } from '@/lib/activity-statistics';
const period = statisticsPeriod('2026-10-15', '2026-10-17')!;
const expected = { period, query: '', after: null, before: null };
const a = 'a8100000-0000-4000-8000-000000000001',
  b = 'a8100000-0000-4000-8000-000000000002';
const fixture = (): UsersPage => ({
  schemaVersion: 1,
  environment: 'local-copy',
  asOf: '2026-10-18T12:00:00.000000Z',
  period: { from: period.from, until: period.until },
  query: '',
  cursor: { after: null, before: null },
  pageSize: 2,
  total: '4',
  items: [
    {
      id: a,
      name: 'LOCAL ACTIVITY A',
      nameTruncated: false,
      email: 'activity-a@example.test',
      anonymous: false,
      exerciseAttempts: '3',
      duelAttempts: '1',
      lastActivity: '2026-10-17T23:59:59.000000Z',
    },
    {
      id: b,
      name: 'Compte invité',
      nameTruncated: false,
      email: null,
      anonymous: true,
      exerciseAttempts: '2',
      duelAttempts: '1',
      lastActivity: '2026-10-17T16:00:00.000000Z',
    },
  ],
  previous: null,
  next: b,
});
beforeEach(() => vi.useRealTimers());
it('parses default UTC dates without treating account creation as activity', () => {
  const parsed = readUsersQuery(
    new URLSearchParams(),
    new Date('2026-10-18T00:00:00Z'),
  );
  expect(parsed.ok && parsed.value.period).toEqual(
    statisticsPeriod('2026-09-19', '2026-10-18'),
  );
});
it.each([
  'from=2026-10-15',
  'from=2026-10-15&to=2026-10-17&q=a&q=b',
  'from=2026-10-15&to=2026-10-17&environment=production',
  'from=2026-10-15&to=2026-10-17&limit=1000',
  'from=2026-10-15&to=2026-10-17&after=not-a-uuid',
  'from=2026-10-15&to=2026-10-17&after=' + a + '&before=' + b,
  'from=2026-10-15&to=2026-10-17&q=' + 'x'.repeat(101),
  'from=2026-10-15&to=2026-10-17&q=%00',
  'from=2026-07-01&to=2026-10-17',
  'from=2099-01-01&to=2099-01-02',
])('rejects ambiguous or unbounded filters %#', (q) =>
  expect(readUsersQuery(new URLSearchParams(q)).ok).toBe(false),
);
it('normalizes whitespace while retaining percent and underscore as literal text', () => {
  const parsed = readUsersQuery(
    new URLSearchParams({ from: period.from, to: period.to, q: '  %_\\  ' }),
  );
  expect(parsed.ok && parsed.value.query).toBe('%_\\');
});
it('encodes navigation while preserving search/period and replacing direction', () => {
  const href = usersHref(
    { ...expected, query: 'A&B %', after: a },
    { before: b },
  );
  const params = new URL(href, 'http://127.0.0.1').searchParams;
  expect(params.get('q')).toBe('A&B %');
  expect(params.get('after')).toBeNull();
  expect(params.get('before')).toBe(b);
  expect(params.get('to')).toBe(period.to);
});
it('accepts and re-decodes the exact native wire contract', () => {
  const page = decodeUsersPage(fixture(), expected, 2);
  expect(page).not.toBeNull();
  expect(decodeUsersPage(page, expected, 2)).toEqual(page);
  expect(decodeUsersPage(fixture(), expected)).toBeNull();
});
it.each([
  (p: Record<string, unknown>) => {
    p.environment = 'production';
  },
  (p: Record<string, unknown>) => {
    p.birth_date = '2000-01-01';
  },
  (p: Record<string, unknown>) => {
    p.total = 4;
  },
  (p: Record<string, unknown>) => {
    p.total = '9223372036854775808';
  },
  (p: Record<string, unknown>) => {
    p.query = 'another';
  },
  (p: Record<string, unknown>) => {
    p.asOf = '2026-02-30T00:00:00Z';
  },
  (p: Record<string, unknown>) => {
    p.period = { from: period.from, until: '2026-10-19' };
  },
  (p: Record<string, unknown>) => {
    p.cursor = { after: a, before: null };
  },
  (p: Record<string, unknown>) => {
    p.next = a;
  },
  (p: Record<string, unknown>) => {
    p.previous = a;
  },
  (p: Record<string, unknown>) => {
    p.pageSize = 3;
  },
])('refuses source/context drift and extra private fields %#', (mutate) => {
  const p: Record<string, unknown> = fixture();
  mutate(p);
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
});
it.each([
  (r: Record<string, unknown>) => {
    r.birth_date = '2000-01-01';
  },
  (r: Record<string, unknown>) => {
    r.exerciseAttempts = '-1';
  },
  (r: Record<string, unknown>) => {
    r.exerciseAttempts = 3;
  },
  (r: Record<string, unknown>) => {
    r.lastActivity = null;
  },
  (r: Record<string, unknown>) => {
    r.lastActivity = '2026-10-18T00:00:00Z';
  },
  (r: Record<string, unknown>) => {
    r.lastActivity = '2026-10-14T23:59:59Z';
  },
  (r: Record<string, unknown>) => {
    r.name = 'x'.repeat(201);
  },
])('rejects malformed or misleading row data %#', (mutate) => {
  const p = fixture();
  mutate(p.items[0]);
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
});
it('requires ordered, distinct UUIDs and consistent navigation boundaries', () => {
  const p = fixture();
  p.items.reverse();
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
  p.items = [p.items[1], p.items[1]];
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
});
it('does not leak an anonymous name/email even when an SQL projection is wrong', () => {
  const p = fixture();
  p.items[1].email = 'hidden-guest@example.test';
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
  p.items[1].email = null;
  p.items[1].name = 'hidden guest name';
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
});
it('distinguishes no activity from missing timestamps and empty results', () => {
  const p = fixture();
  p.items = p.items.map((row) => ({
    ...row,
    exerciseAttempts: '0',
    duelAttempts: '0',
    lastActivity: null,
  }));
  expect(decodeUsersPage(p, expected, 2)).not.toBeNull();
  p.items = [];
  p.total = '0';
  p.next = null;
  expect(decodeUsersPage(p, expected, 2)).not.toBeNull();
  p.total = '4';
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
  expect(
    decodeUsersPage(
      { ...p, cursor: { after: b, before: null } },
      { ...expected, after: b },
      2,
    ),
  ).not.toBeNull();
});
it('accepts Unicode truncation only when explicitly marked', () => {
  const p = fixture();
  p.items[0].name = '😀'.repeat(200) + '…';
  p.items[0].nameTruncated = true;
  expect(decodeUsersPage(p, expected, 2)).not.toBeNull();
  p.items[0].nameTruncated = false;
  expect(decodeUsersPage(p, expected, 2)).toBeNull();
});
