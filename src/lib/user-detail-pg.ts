import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  validLocalUserDetailEndpoint,
  type LocalUserDetailPgConfiguration,
} from './user-detail-config';
import {
  decodeUserDetail,
  readUserDetailQuery,
  USER_DETAIL_PAGE_SIZE,
  type UserDetailPage,
  type UserDetailQuery,
} from './user-detail';

const login = 'novlearn_admin_user_detail_service';
const role = 'novlearn_user_detail_reader';
const columns = [
  'auth.users.email',
  'auth.users.id',
  'auth.users.is_anonymous',
  'public.chapters.id',
  'public.chapters.name',
  'public.competences.chapter_id',
  'public.competences.id',
  'public.competences.max_points',
  'public.competences.name',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.id',
  'public.duel_attempts.is_correct',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duels.exercise_id',
  'public.duels.id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.exercise_id',
  'public.exercise_attempts.exercise_version_id',
  'public.exercise_attempts.id',
  'public.exercise_attempts.is_abandoned',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.user_id',
  'public.exercises.app_title',
  'public.exercises.id',
  'public.exercises.title',
  'public.profiles.first_name',
  'public.profiles.id',
  'public.profiles.last_name',
  'public.user_competence_scores.competence_id',
  'public.user_competence_scores.points',
  'public.user_competence_scores.updated_at',
  'public.user_competence_scores.user_id',
  'public.user_progress.chapter',
  'public.user_progress.exercises_completed',
  'public.user_progress.id',
  'public.user_progress.last_activity',
  'public.user_progress.level',
  'public.user_progress.user_id',
];

export class UserDetailPgError extends Error {
  constructor() {
    super('Fiche utilisateur indisponible');
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
    a.rlsTables === 10
  );
}
/** Returns one validated profile and a bounded detail page. A raw SQL client never escapes.
 * The caller must freshly authorize the Admin before each read. */
export function createLocalUserDetailReader(
  config: LocalUserDetailPgConfiguration,
) {
  if (!validLocalUserDetailEndpoint(config)) throw new UserDetailPgError();
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
    query: UserDetailQuery,
  ): Promise<UserDetailPage | null> => {
    const params = new URLSearchParams({
      from: query.period.from,
      to: query.period.to,
      view: query.view,
    });
    if (query.after !== null) params.set('after', query.after);
    if (query.before !== null) params.set('before', query.before);
    const parsed = readUserDetailQuery(query.userId, params);
    if (
      !parsed.ok ||
      parsed.value.period.until !== query.period.until ||
      parsed.value.period.days !== query.period.days ||
      parsed.value.view !== query.view ||
      parsed.value.after !== query.after ||
      parsed.value.before !== query.before
    )
      throw new UserDetailPgError();
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
          path.join(process.cwd(), 'scripts/user-detail-reader-audit.sql'),
          'utf8',
        ),
        readFile(
          path.join(process.cwd(), 'scripts/user-detail-query.sql'),
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
      if (!stream.encrypted || !stream.authorized)
        throw new UserDetailPgError();
      await client.query('DISCARD ALL');
      await client.query(
        "SET search_path=''; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'",
      );
      await client.query('BEGIN READ ONLY');
      const before = await client.query(auditSql);
      if (!validAudit(before.rows[0]?.audit, false))
        throw new UserDetailPgError();
      await client.query('SET LOCAL ROLE novlearn_user_detail_reader');
      const after = await client.query(auditSql);
      if (!validAudit(after.rows[0]?.audit, true))
        throw new UserDetailPgError();
      const result = await client.query(listSql, [
        requested.userId,
        requested.period.from,
        requested.period.until,
        requested.view,
        requested.after,
        requested.before,
        USER_DETAIL_PAGE_SIZE,
      ]);
      const row = result.rows[0]?.detail;
      // SQL cannot supply or override the source label.
      if (result.rows.length !== 1 || !row || Object.hasOwn(row, 'environment'))
        throw new UserDetailPgError();
      const decoded = decodeUserDetail(
        { ...row, environment: 'local-copy' },
        requested,
      );
      if (decoded === null) throw new UserDetailPgError();
      await client.query('COMMIT');
      return decoded === 'not-found' ? null : decoded;
    } catch {
      broken = true;
      // Destroying the connection also rolls back; do not re-use a failed lease.
      throw new UserDetailPgError();
    } finally {
      client?.removeListener('error', onError);
      client?.release(broken);
    }
  };
  return { read, close: () => pool.end() };
}
