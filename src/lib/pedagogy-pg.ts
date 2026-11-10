import 'server-only';
import {
  decodePedagogyReferences,
  readPedagogyReferenceQuery,
  type PedagogyReferenceQuery,
  type PedagogyReferences,
} from './pedagogy-references';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  validPedagogyEndpoint,
  type PedagogyPgConfiguration,
} from './pedagogy-config';
import {
  decodePedagogyStatistics,
  readPedagogyQuery,
  pedagogyQueryParams,
  type PedagogyStatistics,
  type PedagogyQuery,
} from './pedagogy-statistics';

const login = 'novlearn_admin_pedagogy_service';
const role = 'novlearn_pedagogy_reader';
const columns = [
  'auth.users.id',
  'auth.users.is_anonymous',
  'public.exercise_attempts.id',
  'public.exercise_attempts.exercise_id',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.is_abandoned',
  'public.duel_attempts.id',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duel_attempts.is_correct',
  'public.duels.id',
  'public.duels.exercise_id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.duels.status',
  'public.duels.finished_at',
  'public.exercises.id',
  'public.exercises.title',
  'public.exercises.app_title',
  'public.exercises.chapter',
  'public.exercises.difficulty',
  'public.exercises.competences',
  'public.exercises.competence_id',
  'public.exercises.Is_Flash',
  'public.chapters.id',
  'public.chapters.name',
  'public.chapters.aliases',
  'public.competences.id',
  'public.competences.name',
  'public.competences.chapter_id',
].sort();

export class PedagogyPgError extends Error {
  constructor() {
    super('Analyse pédagogique indisponible');
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
    a.rlsTables === 7
  );
}
/** Only returns decoded aggregates. A raw checked-out SQL client never escapes.
 * The caller must freshly authorize the Admin before each read. */
export function createPedagogyReader(config: PedagogyPgConfiguration) {
  if (!validPedagogyEndpoint(config)) throw new PedagogyPgError();
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
  const execute = async <T>(
    sqlName: 'pedagogy-statistics-query.sql' | 'pedagogy-references-query.sql',
    rowKey: 'statistics' | 'reference_choices',
    parameters: (string | null)[],
    decode: (row: Record<string, unknown>) => T | null,
  ): Promise<T> => {
    let client: PoolClient | undefined;
    let broken = false;
    const onError = () => {
      broken = true;
    };
    try {
      const [auditSql, querySql] = await Promise.all([
        readFile(
          path.join(process.cwd(), 'scripts/pedagogy-reader-audit.sql'),
          'utf8',
        ),
        readFile(path.join(process.cwd(), 'scripts', sqlName), 'utf8'),
      ]);
      client = await pool.connect();
      client.on('error', onError);
      const stream = (
        client as PoolClient & {
          connection: { stream: { encrypted?: boolean; authorized?: boolean } };
        }
      ).connection.stream;
      if (!stream.encrypted || !stream.authorized) throw new PedagogyPgError();
      await client.query('DISCARD ALL');
      await client.query(
        "SET search_path=''; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'",
      );
      await client.query('BEGIN READ ONLY');
      if (!validAudit((await client.query(auditSql)).rows[0]?.audit, false))
        throw new PedagogyPgError();
      await client.query('SET LOCAL ROLE novlearn_pedagogy_reader');
      if (!validAudit((await client.query(auditSql)).rows[0]?.audit, true))
        throw new PedagogyPgError();
      const result = await client.query(querySql, parameters),
        row = result.rows[0]?.[rowKey];
      if (
        result.rows.length !== 1 ||
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        Object.hasOwn(row, 'environment')
      )
        throw new PedagogyPgError();
      const decoded = decode(row);
      if (!decoded) throw new PedagogyPgError();
      await client.query('COMMIT');
      return decoded;
    } catch {
      broken = true;
      throw new PedagogyPgError();
    } finally {
      client?.removeListener('error', onError);
      client?.release(broken);
    }
  };
  const read = async (query: PedagogyQuery): Promise<PedagogyStatistics> => {
    if (
      !query ||
      typeof query !== 'object' ||
      !query.period ||
      Object.keys(query).length !== 9 ||
      Object.keys(query.period).length !== 4
    )
      throw new PedagogyPgError();
    const parsed = readPedagogyQuery(pedagogyQueryParams(query));
    if (
      !parsed.ok ||
      parsed.query.period.until !== query.period.until ||
      parsed.query.period.days !== query.period.days ||
      Object.entries(parsed.query).some(
        ([key, value]) =>
          key !== 'period' && query[key as keyof PedagogyQuery] !== value,
      )
    )
      throw new PedagogyPgError();
    const q = parsed.query;
    return execute(
      'pedagogy-statistics-query.sql',
      'statistics',
      [
        q.period.from,
        q.period.until,
        q.chapter,
        q.competence,
        q.difficulty,
        q.exerciseType,
        q.mode,
        q.groupBy,
        q.sort,
        q.page,
      ],
      (row) =>
        decodePedagogyStatistics(
          { ...row, environment: 'local-copy' },
          { environment: 'local-copy', query: q },
        ),
    );
  };
  const references = async (
    query: PedagogyReferenceQuery,
  ): Promise<PedagogyReferences> => {
    if (
      !query ||
      Object.keys(query).length !== 2 ||
      typeof query.q !== 'string'
    )
      throw new PedagogyPgError();
    const parsed = readPedagogyReferenceQuery(new URLSearchParams(query));
    if (!parsed.ok) throw new PedagogyPgError();
    const q = parsed.query;
    return execute(
      'pedagogy-references-query.sql',
      'reference_choices',
      [q.kind, q.q],
      (row) =>
        decodePedagogyReferences(
          { ...row, environment: 'local-copy' },
          { environment: 'local-copy', query: q },
        ),
    );
  };
  return { read, references, close: () => pool.end() };
}
