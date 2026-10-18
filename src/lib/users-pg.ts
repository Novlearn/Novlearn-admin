import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  validLocalUsersEndpoint,
  type LocalUsersPgConfiguration,
} from './users-config';
import {
  decodeUsersPage,
  readUsersQuery,
  USERS_PAGE_SIZE,
  type UsersPage,
  type UsersQuery,
} from './users';

const login = 'novlearn_admin_users_service';
const role = 'novlearn_users_reader';
const columns = [
  'auth.users.id',
  'auth.users.email',
  'public.profiles.id',
  'public.profiles.first_name',
  'public.profiles.last_name',
  'auth.users.is_anonymous',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duels.id',
  'public.duels.player1_id',
  'public.duels.player2_id',
].sort();

export class UsersPgError extends Error {
  constructor() {
    super('Utilisateurs indisponibles');
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
    a.rlsTables === 5
  );
}
/** Only returns the bounded decoded nominal list. A raw checked-out SQL client never escapes.
 * The caller must freshly authorize the Admin before each read. */
export function createLocalUsersReader(config: LocalUsersPgConfiguration) {
  if (!validLocalUsersEndpoint(config)) throw new UsersPgError();
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
  const read = async (query: UsersQuery): Promise<UsersPage> => {
    const params = new URLSearchParams({
      from: query.period.from,
      to: query.period.to,
      q: query.query,
    });
    if (query.after !== null) params.set('after', query.after);
    if (query.before !== null) params.set('before', query.before);
    const parsed = readUsersQuery(params);
    if (
      !parsed.ok ||
      parsed.value.period.until !== query.period.until ||
      parsed.value.period.days !== query.period.days ||
      parsed.value.query !== query.query
    )
      throw new UsersPgError();
    // Copy validated strings before any asynchronous work.
    const requested = parsed.value;
    let client: PoolClient | undefined;
    let broken = false;
    const onError = () => {
      broken = true;
    };
    try {
      // Literal source files only; never an uploaded query or request path.
      const [auditSql, listSql] = await Promise.all([
        readFile(
          path.join(process.cwd(), 'scripts/users-reader-audit.sql'),
          'utf8',
        ),
        readFile(
          path.join(process.cwd(), 'scripts/users-list-query.sql'),
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
      if (!stream.encrypted || !stream.authorized) throw new UsersPgError();
      await client.query('DISCARD ALL');
      await client.query(
        "SET search_path=''; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'",
      );
      await client.query('BEGIN READ ONLY');
      const before = await client.query(auditSql);
      if (!validAudit(before.rows[0]?.audit, false)) throw new UsersPgError();
      await client.query('SET LOCAL ROLE novlearn_users_reader');
      const after = await client.query(auditSql);
      if (!validAudit(after.rows[0]?.audit, true)) throw new UsersPgError();
      const result = await client.query(listSql, [
        requested.period.from,
        requested.period.until,
        requested.query,
        requested.after,
        requested.before,
        USERS_PAGE_SIZE,
      ]);
      const row = result.rows[0]?.users;
      // SQL cannot supply or override the source label.
      if (result.rows.length !== 1 || !row || Object.hasOwn(row, 'environment'))
        throw new UsersPgError();
      const decoded = decodeUsersPage(
        { ...row, environment: 'local-copy' },
        requested,
      );
      if (!decoded) throw new UsersPgError();
      await client.query('COMMIT');
      return decoded;
    } catch {
      broken = true;
      // Destroying the connection also rolls back; do not re-use a failed lease.
      throw new UsersPgError();
    } finally {
      client?.removeListener('error', onError);
      client?.release(broken);
    }
  };
  return { read, close: () => pool.end() };
}
