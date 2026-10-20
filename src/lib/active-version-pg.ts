import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  activeCatalogId,
  decodeActiveVersionSnapshot,
  type ActiveVersionSnapshot,
} from './active-version';
import {
  validLocalActiveVersionEndpoint,
  type LocalActiveVersionConfiguration,
} from './active-version-config';

const login = 'novlearn_admin_active_version_service';
const role = 'novlearn_active_version_reader';
const columns = [
  'public.exercises.id',
  'public.exercises.catalog_id',
  'public.exercises.active_version_id',
  'public.exercises.publication_epoch',
  'public.exercises.admin_archived_at',
  'public.exercise_versions.id',
  'public.exercise_versions.exercise_id',
  'public.exercise_versions.revision',
  'public.exercise_versions.editorial_status',
  'public.exercise_versions.published_at',
  'public.exercise_versions.definition_sha256',
  'public.exercise_versions.engine_contract',
  'public.exercise_versions.generation_version',
  'public.exercise_versions.canonicalization_version',
].sort();
export class ActiveVersionPgError extends Error {
  constructor() {
    super('Version publiée indisponible');
  }
}
function validAudit(value: unknown, assumed: boolean): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>,
    flags = a.flags as Record<string, unknown> | undefined;
  const memberships = a.memberships,
    member = Array.isArray(memberships) && memberships[0];
  return (
    a.login === login &&
    a.role === (assumed ? role : login) &&
    a.database === 'admin_local' &&
    !!flags &&
    Object.entries({
      login: !assumed,
      inherit: false,
      super: false,
      createdb: false,
      createrole: false,
      replication: false,
      bypassrls: false,
    }).every(([key, v]) => flags[key] === v) &&
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
    a.rlsTables === 2 &&
    a.policyScopeVerified === true
  );
}
/** Call only after fresh server-side Admin authorization and source parent lookup.
 * The pool is reusable; neither authorization nor observations are cached. */
export function createLocalActiveVersionReader(
  config: LocalActiveVersionConfiguration,
) {
  if (!validLocalActiveVersionEndpoint(config))
    throw new ActiveVersionPgError();
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
  const read = async (catalogId: string): Promise<ActiveVersionSnapshot> => {
    if (!activeCatalogId(catalogId)) throw new ActiveVersionPgError();
    let client: PoolClient | undefined,
      broken = false;
    const onError = () => {
      broken = true;
    };
    try {
      const [auditSql, querySql] = await Promise.all([
        readFile(
          path.join(process.cwd(), 'scripts/active-version-reader-audit.sql'),
          'utf8',
        ),
        readFile(
          path.join(process.cwd(), 'scripts/active-version-query.sql'),
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
        throw new ActiveVersionPgError();
      await client.query('DISCARD ALL');
      await client.query(
        "SET search_path=''; SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='15s'",
      );
      await client.query('BEGIN READ ONLY');
      for (const assumed of [false, true]) {
        if (assumed)
          await client.query('SET LOCAL ROLE novlearn_active_version_reader');
        const audit = await client.query(auditSql);
        if (
          audit.rows.length !== 1 ||
          !validAudit(audit.rows[0]?.audit, assumed)
        )
          throw new ActiveVersionPgError();
      }
      const result = await client.query(querySql, [catalogId]),
        row = result.rows[0]?.active_version;
      if (
        result.rows.length !== 1 ||
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        Object.hasOwn(row, 'environment') ||
        Object.hasOwn(row, 'targetKey')
      )
        throw new ActiveVersionPgError();
      const decoded = decodeActiveVersionSnapshot(
        {
          ...row,
          environment: config.environment,
          targetKey: config.targetKey,
        },
        {
          environment: config.environment,
          targetKey: config.targetKey,
          catalogId,
        },
      );
      if (!decoded) throw new ActiveVersionPgError();
      await client.query('COMMIT');
      if (broken) throw new ActiveVersionPgError();
      return decoded;
    } catch {
      broken = true;
      throw new ActiveVersionPgError();
    } finally {
      client?.removeListener('error', onError);
      client?.release(broken);
    }
  };
  return { read, close: () => pool.end() };
}
