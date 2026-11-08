import type { ReadEnvironment } from './production-read-config';
import {
  readStatisticsPeriod,
  statisticsDate,
  statisticsPeriod,
  type StatisticsPeriod,
} from './activity-statistics';
export const USERS_PAGE_SIZE = 25;
export type UsersQuery = {
  period: StatisticsPeriod;
  query: string;
  after: string | null;
  before: string | null;
};
export type UserSummary = {
  id: string;
  name: string;
  nameTruncated: boolean;
  email: string | null;
  anonymous: boolean;
  exerciseAttempts: string;
  duelAttempts: string;
  lastActivity: string | null;
};
export type UsersPage = {
  schemaVersion: 1;
  environment: ReadEnvironment;
  asOf: string;
  period: Pick<StatisticsPeriod, 'from' | 'until'>;
  query: string;
  cursor: { after: string | null; before: string | null };
  pageSize: number;
  total: string;
  items: UserSummary[];
  previous: string | null;
  next: string | null;
};
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const count = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(v) &&
  BigInt(v) <= BigInt('9223372036854775807');
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === keys.sort().join(',');
const timestamp = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(
    v,
  ) &&
  statisticsDate(v.slice(0, 10)) !== null &&
  Number.isFinite(Date.parse(v));
export function readUsersQuery(
  params: URLSearchParams,
  now = new Date(),
): { ok: true; value: UsersQuery } | { ok: false; error: string } {
  const error = {
    ok: false as const,
    error:
      'Choisissez une période UTC de 1 à 90 jours et une recherche de 100 caractères au plus.',
  };
  if (
    [...params.keys()].some(
      (k) => !['from', 'to', 'q', 'after', 'before'].includes(k),
    ) ||
    [...params.keys()].some((k) => params.getAll(k).length !== 1)
  )
    return error;
  const dates = new URLSearchParams();
  for (const key of ['from', 'to'])
    if (params.has(key)) dates.set(key, params.get(key)!);
  const span = readStatisticsPeriod(dates, now),
    raw = params.get('q') ?? '',
    after = params.get('after'),
    before = params.get('before');
  if (
    !span.ok ||
    raw.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(raw) ||
    (after !== null && !uuid(after)) ||
    (before !== null && !uuid(before)) ||
    (after !== null && before !== null)
  )
    return error;
  return {
    ok: true,
    value: { period: span.period, query: raw.trim(), after, before },
  };
}
export function usersHref(
  query: UsersQuery,
  cursor: { after?: string; before?: string } = {},
) {
  const params = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
  });
  if (query.query) params.set('q', query.query);
  if (cursor.after) params.set('after', cursor.after);
  if (cursor.before) params.set('before', cursor.before);
  return '/admin/users?' + params;
}
/** Only declared nominal/activity fields. Birth dates, secrets and extra fields
 * are rejected; the caller independently supplies the source/query context. */
export function decodeUsersPage(
  value: unknown,
  expected: UsersQuery,
  limit = USERS_PAGE_SIZE,
  environment: ReadEnvironment = 'local-copy',
): UsersPage | null {
  const p = statisticsPeriod(expected.period.from, expected.period.to);
  if (
    expected.query.length > 100 ||
    expected.query !== expected.query.trim() ||
    /[\u0000-\u001f\u007f]/.test(expected.query) ||
    (expected.after !== null && !uuid(expected.after)) ||
    (expected.before !== null && !uuid(expected.before)) ||
    (expected.after !== null && expected.before !== null)
  )
    return null;
  if (
    !p ||
    p.until !== expected.period.until ||
    p.days !== expected.period.days ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 25 ||
    !object(value) ||
    !exact(value, [
      'schemaVersion',
      'environment',
      'asOf',
      'period',
      'query',
      'cursor',
      'pageSize',
      'total',
      'items',
      'previous',
      'next',
    ]) ||
    value.schemaVersion !== 1 ||
    !['local-copy', 'production'].includes(environment) ||
    value.environment !== environment ||
    !timestamp(value.asOf) ||
    !object(value.period) ||
    !exact(value.period, ['from', 'until']) ||
    value.period.from !== p.from ||
    value.period.until !== p.until ||
    value.query !== expected.query ||
    !object(value.cursor) ||
    !exact(value.cursor, ['after', 'before']) ||
    value.cursor.after !== expected.after ||
    value.cursor.before !== expected.before ||
    value.pageSize !== limit ||
    !count(value.total) ||
    !Array.isArray(value.items) ||
    value.items.length > limit ||
    BigInt(value.items.length) > BigInt(value.total)
  )
    return null;
  const start = Date.parse(p.from + 'T00:00:00Z'),
    until = Date.parse(p.until + 'T00:00:00Z'),
    asOf = Date.parse(value.asOf);
  if (start > asOf) return null;
  const items: UserSummary[] = [];
  let previousId = '';
  for (const row of value.items) {
    if (
      !object(row) ||
      !exact(row, [
        'id',
        'name',
        'nameTruncated',
        'email',
        'anonymous',
        'exerciseAttempts',
        'duelAttempts',
        'lastActivity',
      ]) ||
      !uuid(row.id) ||
      row.id <= previousId ||
      (expected.after !== null && row.id <= expected.after) ||
      (expected.before !== null && row.id >= expected.before) ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      Array.from(row.name).length > (row.nameTruncated ? 201 : 200) ||
      typeof row.nameTruncated !== 'boolean' ||
      (row.nameTruncated &&
        (!row.name.endsWith('…') || Array.from(row.name).length !== 201)) ||
      !(
        row.email === null ||
        (typeof row.email === 'string' && row.email.length <= 320)
      ) ||
      typeof row.anonymous !== 'boolean' ||
      (row.anonymous &&
        (row.email !== null ||
          row.name !== 'Compte invité' ||
          row.nameTruncated)) ||
      !count(row.exerciseAttempts) ||
      !count(row.duelAttempts)
    )
      return null;
    const active =
      BigInt(row.exerciseAttempts) + BigInt(row.duelAttempts) > BigInt(0);
    if (
      active
        ? !timestamp(row.lastActivity) ||
          Date.parse(row.lastActivity) < start ||
          Date.parse(row.lastActivity) >= until ||
          Date.parse(row.lastActivity) > asOf
        : row.lastActivity !== null
    )
      return null;
    previousId = row.id;
    items.push(row as UserSummary);
  }
  if (
    (value.previous !== null && !uuid(value.previous)) ||
    (value.next !== null && !uuid(value.next))
  )
    return null;
  if (items.length === 0) {
    if (
      value.previous !== null ||
      value.next !== null ||
      (BigInt(value.total) > BigInt(0) &&
        expected.after === null &&
        expected.before === null)
    )
      return null;
  } else {
    if (
      (value.previous !== null && value.previous !== items[0].id) ||
      (value.next !== null && value.next !== items.at(-1)!.id) ||
      BigInt(value.total) <
        BigInt(items.length) +
          (value.previous !== null ? BigInt(1) : BigInt(0)) +
          (value.next !== null ? BigInt(1) : BigInt(0))
    )
      return null;
    if (
      expected.after === null &&
      expected.before === null &&
      value.previous !== null
    )
      return null;
    if (
      expected.after === null &&
      expected.before === null &&
      items.length !==
        Number(
          BigInt(value.total) < BigInt(limit)
            ? BigInt(value.total)
            : BigInt(limit),
        )
    )
      return null;
    if (
      expected.before === null &&
      value.next !== null &&
      items.length !== limit
    )
      return null;
    if (
      expected.before !== null &&
      value.previous !== null &&
      items.length !== limit
    )
      return null;
  }
  return {
    schemaVersion: 1,
    environment,
    asOf: value.asOf,
    period: { from: p.from, until: p.until },
    query: expected.query,
    cursor: { after: expected.after, before: expected.before },
    pageSize: limit,
    total: value.total,
    items,
    previous: value.previous as string | null,
    next: value.next as string | null,
  };
}
