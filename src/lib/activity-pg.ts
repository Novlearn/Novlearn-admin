import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  decodeActivityStatistics,
  readStatisticsPeriod,
  type ActivityStatistics,
  type StatisticsPeriod,
} from './activity-statistics';

const login = 'novlearn_admin_activity_service';
const role = 'novlearn_activity_reader';
const columns = [
  'auth.users.id',
  'auth.users.created_at',
  'auth.users.is_anonymous',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.is_abandoned',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duels.id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.duels.status',
  'public.duels.finished_at',
].sort();

/** Trusted operator configuration for the isolated SQL copy only.
 * No environment parser, route or remote activation is provided by this module. */
export type LocalActivityPgConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
};
export class ActivityPgError extends Error {
  constructor() {
    super('Statistiques indisponibles');
  }
}
function validEndpoint(config: LocalActivityPgConfiguration) {
  try {
    const url = new URL(config.url);
    return (
      config.environment === 'local-copy' &&
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname === '127.0.0.1' &&
      url.port === '55435' &&
      url.pathname === '/activity_copy' &&
      !url.search &&
      !url.hash &&
      decodeURIComponent(url.username) === login &&
      decodeURIComponent(url.password).length >= 16 &&
      decodeURIComponent(url.password).length <= 512 &&
      config.ca.length <= 32768 &&
      config.ca.includes('-----BEGIN CERTIFICATE-----')
    );
  } catch {
    return false;
  }
}
function validAudit(value: unknown, assumed: boolean): boolean {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  const flags = a.flags as Record<string, unknown> | undefined;
  const memberships = a.memberships;
  const member = Array.isArray(memberships) && memberships[0];
  const expectedFlags = {
    login: !assumed,
    inherit: false,
    super: false,
    createdb: false,
    createrole: false,
    replication: false,
    bypassrls: false,
  };
  return (
    a.login === login &&
    a.role === (assumed ? role : login) &&
    a.database === 'activity_copy' &&
    !!flags &&
    Object.entries(expectedFlags).every(([key, v]) => flags[key] === v) &&
    Array.isArray(memberships) &&
    (assumed
      ? memberships.length === 0
      : memberships.length === 1 &&
        member?.role === role &&
        member?.admin === false &&
        member?.inherit === false &&
        member?.set === true) &&
    Array.isArray(a.columns) &&
    JSON.stringify([...a.columns].sort()) ===
      JSON.stringify(assumed ? columns : []) &&
    [
      'databaseCreate',
      'temporary',
      'schemaCreate',
      'ownedObjects',
      'tableWrite',
      'sequenceAccess',
      'unexpectedDefinerAccess',
      'largeObjectCreate',
    ].every((key) => a[key] === false) &&
    a.rlsTables === 4
  );
}
/** Only returns decoded aggregates. A raw checked-out SQL client never escapes.
 * The caller must freshly authorize the Admin before each read. */
export function createLocalActivityReader(
  config: LocalActivityPgConfiguration,
) {
  if (!validEndpoint(config)) throw new ActivityPgError();
  const pool = new Pool({
    connectionString: config.url,
    ssl: { rejectUnauthorized: true, ca: config.ca, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
    max: 2,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    query_timeout: 12000,
    allowExitOnIdle: true,
  });
  pool.on('error', () => {});
  const read = async (
    period: StatisticsPeriod,
  ): Promise<ActivityStatistics> => {
    const parsed = readStatisticsPeriod(
      new URLSearchParams({ from: period.from, to: period.to }),
    );
    if (
      !parsed.ok ||
      parsed.period.until !== period.until ||
      parsed.period.days !== period.days
    )
      throw new ActivityPgError();
    const requested = parsed.period;
    let client: PoolClient | undefined;
    let broken = false;
    const onError = () => {
      broken = true;
    };
    try {
      // Literal source files only; never an uploaded query or request path.
      const [auditSql, aggregateSql] = await Promise.all([
        readFile(
          path.join(process.cwd(), 'scripts/activity-reader-audit.sql'),
          'utf8',
        ),
        readFile(
          path.join(process.cwd(), 'scripts/activity-statistics-query.sql'),
          'utf8',
        ),
      ]);
      client = await pool.connect();
      client.on('error', onError);
      const stream = (
        client as PoolClient & {
          connection: { stream: { encrypted?: boolean; authorized?: boolean } };
        }
      ).connection.stream;
      if (!stream.encrypted || !stream.authorized) throw new ActivityPgError();
      await client.query('DISCARD ALL');
      await client.query(
        "SET search_path=''; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'",
      );
      await client.query('BEGIN READ ONLY');
      const before = await client.query(auditSql);
      if (!validAudit(before.rows[0]?.audit, false))
        throw new ActivityPgError();
      await client.query('SET LOCAL ROLE novlearn_activity_reader');
      const after = await client.query(auditSql);
      if (!validAudit(after.rows[0]?.audit, true)) throw new ActivityPgError();
      const result = await client.query(aggregateSql, [
        requested.from,
        requested.until,
      ]);
      const row = result.rows[0]?.statistics;
      // SQL cannot supply or override the source label.
      if (result.rows.length !== 1 || !row || Object.hasOwn(row, 'environment'))
        throw new ActivityPgError();
      const decoded = decodeActivityStatistics(
        { ...row, environment: 'local-copy' },
        { environment: 'local-copy', period: requested },
      );
      if (!decoded) throw new ActivityPgError();
      await client.query('COMMIT');
      return decoded;
    } catch {
      broken = true;
      // Destroying the connection also rolls back; do not re-use a failed lease.
      throw new ActivityPgError();
    } finally {
      client?.removeListener('error', onError);
      client?.release(broken);
    }
  };
  return { read, close: () => pool.end() };
}
