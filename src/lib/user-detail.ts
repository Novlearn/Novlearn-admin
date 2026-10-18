import {
  readStatisticsPeriod,
  type StatisticsPeriod,
} from './activity-statistics';

export const USER_DETAIL_PAGE_SIZE = 25;
export type UserDetailView = 'history' | 'chapters' | 'competences';
export type UserDetailQuery = {
  userId: string;
  period: StatisticsPeriod;
  view: UserDetailView;
  after: string | null;
  before: string | null;
};
export type DetailIdentity = {
  id: string;
  name: string;
  nameTruncated: boolean;
  email: string | null;
  anonymous: boolean;
};
export type DetailActivity = {
  exerciseAttempts: string;
  exerciseCorrect: string;
  exerciseIncorrect: string;
  exerciseAbandoned: string;
  duelAttempts: string;
  duelCorrect: string;
  duelIncorrect: string;
  undatedExerciseAttempts: string;
  undatedDuelAttempts: string;
  lastActivity: string | null;
};
export type UserHistoryItem = {
  kind: 'exercise' | 'duel';
  id: string;
  occurredAt: string;
  exerciseId: string | null;
  currentTitle: string | null;
  titleTruncated: boolean;
  duelId: string | null;
  versionId: string | null;
  outcome: 'correct' | 'incorrect' | 'abandoned';
};
export type ChapterProgressItem = {
  kind: 'chapter';
  id: string;
  label: string;
  labelTruncated: boolean;
  level: number | null;
  completed: string | null;
  recordedAt: string | null;
  issues: string[];
};
export type CompetenceProgressItem = {
  kind: 'competence';
  id: string;
  label: string;
  labelTruncated: boolean;
  chapterName: string | null;
  chapterNameTruncated: boolean;
  points: string;
  maximum: string | null;
  recordedAt: string | null;
  issues: string[];
};
export type UserDetailItem =
  | UserHistoryItem
  | ChapterProgressItem
  | CompetenceProgressItem;
export type UserDetailPage = {
  schemaVersion: 1;
  environment: 'local-copy';
  found: true;
  asOf: string;
  userId: string;
  period: { from: string; until: string };
  view: UserDetailView;
  cursor: { after: string | null; before: string | null };
  user: DetailIdentity;
  activity: DetailActivity;
  page: {
    size: number;
    total: string;
    previous: string | null;
    next: string | null;
  };
  items: UserDetailItem[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export const detailUserId = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const count = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(v) &&
  BigInt(v) <= BigInt('9223372036854775807');
const id = (v: unknown): v is string => count(v) && v !== '0';
const safeText = (v: unknown, max: number): v is string =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= max &&
  v === v.trim() &&
  !/[\u0000-\u001f\u007f]/.test(v) &&
  Array.from(v).every((c) => {
    const code = c.codePointAt(0)!;
    return code < 0xd800 || code > 0xdfff;
  });
const timestamp = (v: unknown): v is string => {
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(
      v,
    )
  )
    return false;
  const date = new Date(v);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === v.slice(0, 10)
  );
};
const micros = (v: string) =>
  BigInt(Date.parse(v)) * BigInt(1000) +
  BigInt((v.split('.')[1]?.slice(0, -1) ?? '').padEnd(6, '0').slice(3));
const viewName = (v: unknown): v is UserDetailView =>
  v === 'history' || v === 'chapters' || v === 'competences';
const label = (v: unknown, truncated: unknown, nullable = false) => {
  if (typeof truncated !== 'boolean') return false;
  if (v === null) return nullable && !truncated;
  return (
    typeof v === 'string' &&
    v.trim().length > 0 &&
    Array.from(v).length <= (truncated ? 201 : 200) &&
    (!truncated || (v.endsWith('…') && Array.from(v).length === 201))
  );
};
// SQL COLLATE "C" orders UTF-8 by Unicode code point; JS UTF-16 ordering differs
// for supplementary characters, so cursor checks use the same order explicitly.
export function compareDetailKeys(a: string, b: string) {
  const left = Array.from(a),
    right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = left[i].codePointAt(0)! - right[i].codePointAt(0)!;
    if (difference) return Math.sign(difference);
  }
  return Math.sign(left.length - right.length);
}
export function detailItemKey(item: UserDetailItem) {
  if (item.kind === 'chapter') return item.id.padStart(19, '0');
  if (item.kind === 'competence') return item.id;
  const [date, time] = item.occurredAt.replace('Z', '').split('T');
  const [seconds, fraction = ''] = time.split('.');
  return (
    date.replaceAll('-', '') +
    seconds.replaceAll(':', '') +
    fraction.padEnd(6, '0') +
    ':' +
    item.id.padStart(19, '0') +
    ':' +
    item.kind
  );
}
function validCursor(v: unknown, view: UserDetailView): v is string | null {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (view === 'competences') return safeText(v, 1000);
  if (view === 'chapters')
    return /^\d{19}$/.test(v) && id(BigInt(v).toString());
  const match = v.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{6}):(\d{19}):(exercise|duel)$/,
  );
  return (
    !!match &&
    timestamp(
      `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${match[7]}Z`,
    ) &&
    id(BigInt(match[8]).toString())
  );
}
export function readUserDetailQuery(
  userId: string,
  params: URLSearchParams,
  now = new Date(),
): { ok: true; value: UserDetailQuery } | { ok: false; error: string } {
  const error = {
    ok: false as const,
    error:
      'Choisissez une vue, une période UTC de 1 à 90 jours et une page valides.',
  };
  if (
    !detailUserId(userId) ||
    [...params.keys()].some(
      (k) =>
        !['from', 'to', 'view', 'after', 'before'].includes(k) ||
        params.getAll(k).length !== 1,
    )
  )
    return error;
  const dates = new URLSearchParams();
  for (const k of ['from', 'to'])
    if (params.has(k)) dates.set(k, params.get(k)!);
  const p = readStatisticsPeriod(dates, now),
    view = params.get('view') ?? 'history',
    after = params.get('after'),
    before = params.get('before');
  if (
    !p.ok ||
    !viewName(view) ||
    !validCursor(after, view) ||
    !validCursor(before, view) ||
    (after !== null && before !== null)
  )
    return error;
  return { ok: true, value: { userId, period: p.period, view, after, before } };
}
export function userDetailHref(
  query: UserDetailQuery,
  options: { view?: UserDetailView; after?: string; before?: string } = {},
) {
  const params = new URLSearchParams({
    from: query.period.from,
    to: query.period.to,
    view: options.view ?? query.view,
  });
  if (options.after) params.set('after', options.after);
  if (options.before) params.set('before', options.before);
  return '/admin/users/' + query.userId + '?' + params;
}
const issueList = (v: unknown, expected: string[]) =>
  Array.isArray(v) &&
  v.every((x) => typeof x === 'string') &&
  JSON.stringify([...v].sort()) === JSON.stringify([...expected].sort());

/** Returns 'not-found' only for the exact explicit SQL absence envelope. null is
 * malformed/untrusted output and must produce unavailability, never an empty profile. */
export function decodeUserDetail(
  value: unknown,
  expected: UserDetailQuery,
  limit = USER_DETAIL_PAGE_SIZE,
): UserDetailPage | 'not-found' | null {
  const params = new URLSearchParams({
    from: expected.period.from,
    to: expected.period.to,
    view: expected.view,
  });
  if (expected.after !== null) params.set('after', expected.after);
  if (expected.before !== null) params.set('before', expected.before);
  const parsed = readUserDetailQuery(expected.userId, params);
  if (
    !parsed.ok ||
    parsed.value.period.until !== expected.period.until ||
    parsed.value.period.days !== expected.period.days ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 25 ||
    !object(value)
  )
    return null;
  const baseKeys = [
    'schemaVersion',
    'environment',
    'found',
    'asOf',
    'userId',
    'period',
    'view',
    'cursor',
  ];
  if (
    value.userId !== expected.userId ||
    value.schemaVersion !== 1 ||
    value.environment !== 'local-copy' ||
    !timestamp(value.asOf) ||
    !object(value.period) ||
    !exact(value.period, ['from', 'until']) ||
    value.period.from !== expected.period.from ||
    value.period.until !== expected.period.until ||
    value.view !== expected.view ||
    !object(value.cursor) ||
    !exact(value.cursor, ['after', 'before']) ||
    value.cursor.after !== expected.after ||
    value.cursor.before !== expected.before ||
    Date.parse(value.asOf) < Date.parse(expected.period.from + 'T00:00:00Z')
  )
    return null;
  if (value.found === false) return exact(value, baseKeys) ? 'not-found' : null;
  if (
    value.found !== true ||
    !exact(value, [...baseKeys, 'user', 'activity', 'page', 'items']) ||
    !object(value.user) ||
    !exact(value.user, ['id', 'name', 'nameTruncated', 'email', 'anonymous']) ||
    value.user.id !== expected.userId ||
    !label(value.user.name, value.user.nameTruncated) ||
    typeof value.user.anonymous !== 'boolean' ||
    (value.user.email !== null &&
      (typeof value.user.email !== 'string' || value.user.email.length > 320))
  )
    return null;
  if (
    value.user.anonymous &&
    (value.user.name !== 'Compte invité' ||
      value.user.nameTruncated !== false ||
      value.user.email !== null)
  )
    return null;
  const a = value.activity;
  const countKeys = [
    'exerciseAttempts',
    'exerciseCorrect',
    'exerciseIncorrect',
    'exerciseAbandoned',
    'duelAttempts',
    'duelCorrect',
    'duelIncorrect',
    'undatedExerciseAttempts',
    'undatedDuelAttempts',
  ];
  if (
    !object(a) ||
    !exact(a, [...countKeys, 'lastActivity']) ||
    !countKeys.every((k) => count(a[k])) ||
    BigInt(a.exerciseAttempts as string) !==
      BigInt(a.exerciseCorrect as string) +
        BigInt(a.exerciseIncorrect as string) +
        BigInt(a.exerciseAbandoned as string) ||
    BigInt(a.duelAttempts as string) !==
      BigInt(a.duelCorrect as string) + BigInt(a.duelIncorrect as string)
  )
    return null;
  const start = micros(expected.period.from + 'T00:00:00Z'),
    until = micros(expected.period.until + 'T00:00:00Z'),
    asOf = micros(value.asOf);
  const inPeriod = (v: unknown): v is string =>
    timestamp(v) &&
    micros(v) >= start &&
    micros(v) < until &&
    micros(v) <= asOf;
  if (
    (a.lastActivity === null) !==
      (BigInt(a.exerciseAttempts as string) +
        BigInt(a.duelAttempts as string) ===
        BigInt(0)) ||
    (a.lastActivity !== null && !inPeriod(a.lastActivity))
  )
    return null;
  if (
    !object(value.page) ||
    !exact(value.page, ['size', 'total', 'previous', 'next']) ||
    value.page.size !== limit ||
    !count(value.page.total) ||
    !validCursor(value.page.previous, expected.view) ||
    !validCursor(value.page.next, expected.view) ||
    !Array.isArray(value.items) ||
    value.items.length > limit ||
    BigInt(value.items.length) > BigInt(value.page.total)
  )
    return null;
  let previous: string | null = null;
  for (const row of value.items) {
    if (!object(row) || (!id(row.id) && row.kind !== 'competence')) return null;
    if (expected.view === 'history') {
      if (
        !exact(row, [
          'kind',
          'id',
          'occurredAt',
          'exerciseId',
          'currentTitle',
          'titleTruncated',
          'duelId',
          'versionId',
          'outcome',
        ]) ||
        !['exercise', 'duel'].includes(String(row.kind)) ||
        !inPeriod(row.occurredAt) ||
        (row.exerciseId !== null && !id(row.exerciseId)) ||
        !label(row.currentTitle, row.titleTruncated, true) ||
        (row.currentTitle !== null && row.exerciseId === null) ||
        (row.versionId !== null && !detailUserId(row.versionId)) ||
        !['correct', 'incorrect', 'abandoned'].includes(String(row.outcome))
      )
        return null;
      if (
        (row.kind === 'exercise' && row.duelId !== null) ||
        (row.versionId !== null && row.exerciseId === null) ||
        (row.kind === 'duel' &&
          (!id(row.duelId) ||
            row.versionId !== null ||
            row.outcome === 'abandoned'))
      )
        return null;
    } else if (expected.view === 'chapters') {
      if (
        row.kind !== 'chapter' ||
        !exact(row, [
          'kind',
          'id',
          'label',
          'labelTruncated',
          'level',
          'completed',
          'recordedAt',
          'issues',
        ]) ||
        !label(row.label, row.labelTruncated) ||
        (row.level !== null &&
          (!Number.isInteger(row.level) ||
            Number(row.level) < 0 ||
            Number(row.level) > 100)) ||
        (row.completed !== null && !count(row.completed)) ||
        (row.recordedAt !== null && !timestamp(row.recordedAt))
      )
        return null;
      const required = [];
      if (row.level === null) required.push('missing-level');
      if (row.completed === null) {
        if (
          !Array.isArray(row.issues) ||
          !row.issues.some(
            (x) => x === 'missing-count' || x === 'invalid-count',
          )
        )
          return null;
        required.push(
          row.issues.includes('invalid-count')
            ? 'invalid-count'
            : 'missing-count',
        );
      }
      if (row.recordedAt === null) required.push('missing-date');
      else if (micros(row.recordedAt as string) > asOf)
        required.push('future-date');
      if (!issueList(row.issues, required)) return null;
    } else {
      if (
        row.kind !== 'competence' ||
        !safeText(row.id, 1000) ||
        !exact(row, [
          'kind',
          'id',
          'label',
          'labelTruncated',
          'chapterName',
          'chapterNameTruncated',
          'points',
          'maximum',
          'recordedAt',
          'issues',
        ]) ||
        !label(row.label, row.labelTruncated) ||
        !label(row.chapterName, row.chapterNameTruncated, true) ||
        !count(row.points) ||
        (row.maximum !== null && !id(row.maximum)) ||
        (row.recordedAt !== null && !timestamp(row.recordedAt))
      )
        return null;
      const required = [];
      if (row.maximum === null) required.push('unknown-competence');
      else if (BigInt(row.points) > BigInt(row.maximum as string))
        required.push('points-above-current-maximum');
      if (row.recordedAt === null) required.push('missing-date');
      else if (micros(row.recordedAt as string) > asOf)
        required.push('future-date');
      if (!issueList(row.issues, required)) return null;
    }
    const key = detailItemKey(row as unknown as UserDetailItem);
    if (!validCursor(key, expected.view)) return null;
    const direction = expected.view === 'history' ? -1 : 1;
    if (previous !== null && compareDetailKeys(previous, key) * direction >= 0)
      return null;
    if (
      expected.after !== null &&
      compareDetailKeys(key, expected.after) * direction <= 0
    )
      return null;
    if (
      expected.before !== null &&
      compareDetailKeys(key, expected.before) * direction >= 0
    )
      return null;
    previous = key;
  }
  const items = value.items as UserDetailItem[],
    total = BigInt(value.page.total);
  if (
    expected.view === 'history' &&
    total !==
      BigInt(a.exerciseAttempts as string) + BigInt(a.duelAttempts as string)
  )
    return null;
  if (items.length === 0) {
    if (
      value.page.previous !== null ||
      value.page.next !== null ||
      (expected.after === null &&
        expected.before === null &&
        total !== BigInt(0))
    )
      return null;
  } else {
    const first = detailItemKey(items[0]),
      last = detailItemKey(items.at(-1)!);
    if (
      expected.view === 'history' &&
      value.page.previous === null &&
      micros((items[0] as UserHistoryItem).occurredAt) !==
        micros(a.lastActivity as string)
    )
      return null;
    if (
      (value.page.previous !== null && value.page.previous !== first) ||
      (value.page.next !== null && value.page.next !== last)
    )
      return null;
    if (
      (value.page.previous !== null || value.page.next !== null) &&
      total <= BigInt(items.length)
    )
      return null;
    if (
      value.page.previous !== null &&
      value.page.next !== null &&
      total < BigInt(items.length + 2)
    )
      return null;
    if (
      expected.after === null &&
      expected.before === null &&
      total > BigInt(limit) !== (value.page.next !== null)
    )
      return null;
    if (
      expected.after === null &&
      expected.before === null &&
      (value.page.previous !== null ||
        items.length !== Number(total < BigInt(limit) ? total : BigInt(limit)))
    )
      return null;
    if (
      (value.page.next !== null &&
        expected.before === null &&
        items.length !== limit) ||
      (value.page.previous !== null &&
        expected.before !== null &&
        items.length !== limit)
    )
      return null;
  }
  return value as unknown as UserDetailPage;
}
