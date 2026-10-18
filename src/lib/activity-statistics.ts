/** Analytics DTO only. No database connection, profile projection or math grading. */
export type StatisticsEnvironment = 'production' | 'local-fixture';
export type StatisticsPeriod = {
  from: string;
  to: string;
  until: string;
  days: number;
};
export type ActivityCounts = {
  activeAccounts: string;
  exerciseAttempts: string;
  duelAttempts: string;
  completedDuels: string;
  accountsCreated: string;
  correct: string;
  incorrect: string;
  abandoned: string;
  unclassified: string;
};
export type ActivityStatistics = {
  schemaVersion: 1;
  environment: StatisticsEnvironment;
  asOf: string;
  period: Pick<StatisticsPeriod, 'from' | 'until'>;
  accounts: { total: string; anonymous: string };
  totals: ActivityCounts;
  daily: ({ date: string } & ActivityCounts)[];
};
const dayMs = 86400000;
const countKeys = [
  'activeAccounts',
  'exerciseAttempts',
  'duelAttempts',
  'completedDuels',
  'accountsCreated',
  'correct',
  'incorrect',
  'abandoned',
  'unclassified',
] as const;
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(x).sort().join(',') === [...keys].sort().join(',');
const count = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^(0|[1-9]\d{0,18})$/.test(x) &&
  BigInt(x) <= BigInt('9223372036854775807');
export function statisticsDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '2000-01-01' ||
    value > '2199-12-31'
  )
    return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === value
    ? ms
    : null;
}
export function statisticsPeriod(
  from: string,
  to: string,
): StatisticsPeriod | null {
  const a = statisticsDate(from),
    b = statisticsDate(to);
  if (a === null || b === null || b < a) return null;
  const days = (b - a) / dayMs + 1;
  if (days > 90) return null;
  return {
    from,
    to,
    until: new Date(b + dayMs).toISOString().slice(0, 10),
    days,
  };
}
export function readStatisticsPeriod(
  params: URLSearchParams,
  now = new Date(),
): { ok: true; period: StatisticsPeriod } | { ok: false; error: string } {
  const error = {
    ok: false as const,
    error:
      'Choisissez une période UTC valide de 1 à 90 jours, sans date future.',
  };
  if (
    !Number.isFinite(now.getTime()) ||
    [...params.keys()].some((key) => !['from', 'to'].includes(key)) ||
    params.getAll('from').length > 1 ||
    params.getAll('to').length > 1
  )
    return error;
  const today = now.toISOString().slice(0, 10);
  if (!params.has('from') && !params.has('to')) {
    const end = statisticsDate(today);
    if (end === null) return error;
    const period = statisticsPeriod(
      new Date(end - 29 * dayMs).toISOString().slice(0, 10),
      today,
    );
    return period ? { ok: true, period } : error;
  }
  const from = params.get('from'),
    to = params.get('to');
  const period = from && to ? statisticsPeriod(from, to) : null;
  return period && period.to <= today ? { ok: true, period } : error;
}
function counts(value: unknown): value is ActivityCounts {
  if (
    !object(value) ||
    !exact(value, countKeys) ||
    countKeys.some((key) => !count(value[key]))
  )
    return false;
  const v = value as ActivityCounts;
  return (
    BigInt(v.exerciseAttempts) ===
      BigInt(v.correct) +
        BigInt(v.incorrect) +
        BigInt(v.abandoned) +
        BigInt(v.unclassified) &&
    BigInt(v.activeAccounts) <=
      BigInt(v.exerciseAttempts) + BigInt(v.duelAttempts)
  );
}
/** Expected environment/period come from the caller, never from the response. */
export function decodeActivityStatistics(
  value: unknown,
  expected: { environment: StatisticsEnvironment; period: StatisticsPeriod },
): ActivityStatistics | null {
  if (!['production', 'local-fixture'].includes(expected.environment))
    return null;
  const period = statisticsPeriod(expected.period.from, expected.period.to);
  if (
    !period ||
    period.until !== expected.period.until ||
    period.days !== expected.period.days ||
    !object(value) ||
    !exact(value, [
      'schemaVersion',
      'environment',
      'asOf',
      'period',
      'accounts',
      'totals',
      'daily',
    ]) ||
    value.schemaVersion !== 1 ||
    value.environment !== expected.environment ||
    typeof value.asOf !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value.asOf,
    ) ||
    statisticsDate(value.asOf.slice(0, 10)) === null ||
    !Number.isFinite(Date.parse(value.asOf)) ||
    Date.parse(value.asOf) < Date.parse(period.from + 'T00:00:00Z') ||
    !object(value.period) ||
    !exact(value.period, ['from', 'until']) ||
    value.period.from !== period.from ||
    value.period.until !== period.until ||
    !object(value.accounts) ||
    !exact(value.accounts, ['total', 'anonymous']) ||
    !count(value.accounts.total) ||
    !count(value.accounts.anonymous) ||
    BigInt(value.accounts.anonymous) > BigInt(value.accounts.total) ||
    !counts(value.totals) ||
    !Array.isArray(value.daily) ||
    value.daily.length !== period.days
  )
    return null;
  const totals = value.totals;
  if (
    BigInt(totals.activeAccounts) > BigInt(value.accounts.total) ||
    BigInt(totals.accountsCreated) > BigInt(value.accounts.total)
  )
    return null;
  const daily: ActivityStatistics['daily'] = [];
  const start = statisticsDate(period.from)!;
  for (let i = 0; i < value.daily.length; i++) {
    const row = value.daily[i];
    if (
      !object(row) ||
      !exact(row, ['date', ...countKeys]) ||
      row.date !== new Date(start + i * dayMs).toISOString().slice(0, 10)
    )
      return null;
    const { date, ...metrics } = row;
    if (
      !counts(metrics) ||
      BigInt(metrics.activeAccounts) > BigInt(totals.activeAccounts)
    )
      return null;
    if (
      statisticsDate(date as string)! > Date.parse(value.asOf) &&
      countKeys.some((key) => metrics[key] !== '0')
    )
      return null;
    daily.push({ date: date as string, ...metrics });
  }
  for (const key of countKeys)
    if (
      key !== 'activeAccounts' &&
      daily.reduce((sum, row) => sum + BigInt(row[key]), BigInt(0)) !==
        BigInt(totals[key])
    )
      return null;
  if (
    daily.reduce((sum, row) => sum + BigInt(row.activeAccounts), BigInt(0)) <
    BigInt(totals.activeAccounts)
  )
    return null;
  return {
    schemaVersion: 1,
    environment: expected.environment,
    asOf: value.asOf,
    period: { from: period.from, until: period.until },
    accounts: {
      total: value.accounts.total,
      anonymous: value.accounts.anonymous,
    },
    totals: { ...totals },
    daily,
  };
}
/** One decimal percentage, rounded once using integer arithmetic. Null is not 0%. */
export function recordedSuccessRate(
  correct: string,
  incorrect: string,
): string | null {
  if (!count(correct) || !count(incorrect)) return null;
  const a = BigInt(correct),
    denominator = a + BigInt(incorrect);
  if (denominator === BigInt(0)) return null;
  const tenths = (a * BigInt(1000) + denominator / BigInt(2)) / denominator;
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(tenths) / 1000);
}
export function dailyBarHeight(value: string, max: string) {
  if (
    !count(value) ||
    !count(max) ||
    BigInt(max) === BigInt(0) ||
    BigInt(value) > BigInt(max)
  )
    return 0;
  return Number((BigInt(value) * BigInt(100)) / BigInt(max));
}
