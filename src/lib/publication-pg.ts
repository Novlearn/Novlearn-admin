import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { readAuthConfiguration, STAGING_PROJECT_REF } from './auth/config';
import type { PublicationConnection } from './publication-journal-server';

const sourceRole = 'novlearn_publication_journal_executor';
const targetRole = 'novlearn_publication_executor';
const sourceLogin = 'novlearn_admin_journal_service';
const targetLogin = 'novlearn_admin_publication_service';
export type PublicationPgEndpoint = { url: string; ca?: string };
export type PublicationPgConfiguration = {
  source: PublicationPgEndpoint;
  target: PublicationPgEndpoint;
  targetKey: `production-${string}`;
  review: string;
};

function endpoint(
  value: unknown,
  login: string,
  ca: unknown,
): PublicationPgEndpoint | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      decodeURIComponent(url.username) !== login ||
      decodeURIComponent(url.password).length < 16 ||
      decodeURIComponent(url.password).length > 512 ||
      url.search ||
      url.hash ||
      url.pathname !== '/postgres' ||
      (url.port && url.port !== '5432')
    )
      return null;
    if (
      ca !== undefined &&
      (typeof ca !== 'string' ||
        ca.length > 32768 ||
        !ca.includes('-----BEGIN CERTIFICATE-----'))
    )
      return null;
    return { url: value, ...(typeof ca === 'string' ? { ca } : {}) };
  } catch {
    return null;
  }
}
/** This reads configuration only. No connection or activation is inferred from keys. */
export function readPublicationPgConfiguration(
  env: Record<string, string | undefined>,
): PublicationPgConfiguration | null {
  if (env.ADMIN_PUBLICATION_ENABLED !== 'true' || !readAuthConfiguration(env))
    return null;
  const review = env.ADMIN_PUBLICATION_SECURITY_REVIEW?.trim(),
    targetRef = env.ADMIN_PUBLICATION_TARGET_PROJECT_REF;
  if (
    !review ||
    !targetRef ||
    !/^[a-z]{20}$/.test(targetRef) ||
    targetRef === STAGING_PROJECT_REF
  )
    return null;
  const source = endpoint(
    env.ADMIN_PUBLICATION_SOURCE_PG_URL,
    sourceLogin,
    env.ADMIN_PUBLICATION_SOURCE_PG_CA,
  );
  const target = endpoint(
    env.ADMIN_PUBLICATION_TARGET_PG_URL,
    targetLogin,
    env.ADMIN_PUBLICATION_TARGET_PG_CA,
  );
  if (!source || !target) return null;
  const s = new URL(source.url),
    t = new URL(target.url);
  if (
    s.hostname !== `db.${STAGING_PROJECT_REF}.supabase.co` ||
    t.hostname !== `db.${targetRef}.supabase.co` ||
    s.hostname === t.hostname ||
    decodeURIComponent(s.password) === decodeURIComponent(t.password)
  )
    return null;
  return { source, target, targetKey: `production-${targetRef}`, review };
}

const identitySql = `SELECT r.rolname AS login,r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,
 ARRAY(SELECT pg_get_userbyid(m.roleid)::text FROM pg_auth_members m WHERE m.member=r.oid ORDER BY 1) AS memberships,
 (SELECT bool_and(NOT m.admin_option AND NOT m.inherit_option AND m.set_option) FROM pg_auth_members m WHERE m.member=r.oid) AS membership_safe,
 (SELECT to_jsonb(c)||jsonb_build_object('memberships',ARRAY(SELECT pg_get_userbyid(m.roleid)::text FROM pg_auth_members m WHERE m.member=c.oid ORDER BY 1))
  FROM (SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1) c) AS capability,
 has_database_privilege(r.rolname,current_database(),'CREATE') AS database_create,
 has_schema_privilege(r.rolname,'public','CREATE') AS schema_create
 FROM pg_roles r WHERE r.rolname=session_user`;

export class PublicationPgError extends Error {
  constructor() {
    super('Publication backend unavailable');
  }
}
/** Source and target pools have separate credentials and checked SQL identities.
 * Construction performs no network I/O. Call only with trusted operator config. */
export function createPublicationPgPools(config: PublicationPgConfiguration) {
  const make = (
    connection: PublicationPgEndpoint,
    login: string,
    role: typeof sourceRole | typeof targetRole,
    max: number,
  ) => {
    let url: URL;
    let username: string;
    try {
      url = new URL(connection.url);
      username = decodeURIComponent(url.username);
      decodeURIComponent(url.password);
    } catch {
      throw new PublicationPgError();
    }
    // A trusted local fixture may use another TCP port; production config above
    // accepts direct PostgreSQL only. URL SSL overrides are never accepted.
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.search ||
      url.hash ||
      username !== login ||
      !url.password ||
      !url.hostname ||
      !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)
    )
      throw new PublicationPgError();
    const pool = new Pool({
      connectionString: connection.url,
      ssl: {
        rejectUnauthorized: true,
        ...(connection.ca ? { ca: connection.ca } : {}),
      },
      max,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      query_timeout: 12000,
      allowExitOnIdle: true,
      enableChannelBinding: true,
    });
    // Idle connection failures are surfaced by the next operation as unavailable;
    // never log raw connection errors, which can contain operator details.
    pool.on('error', () => {});
    const connect = async (): Promise<PublicationConnection> => {
      let client: PoolClient | undefined;
      let broken = false;
      const onError = () => {
        broken = true;
      };
      try {
        client = await pool.connect();
        // pg's pool handles idle-client errors; a checked-out client needs its
        // own listener so a transport loss cannot crash the Node process.
        client.on('error', onError);
        await client.query('DISCARD ALL');
        await client.query("SET search_path=''");
        const result = await client.query(identitySql, [role]),
          identity = result.rows[0] as Record<string, unknown> | undefined;
        const capability = identity?.capability as
          | Record<string, unknown>
          | undefined;
        if (
          !identity ||
          identity.login !== login ||
          identity.rolcanlogin !== true ||
          [
            'rolinherit',
            'rolsuper',
            'rolcreatedb',
            'rolcreaterole',
            'rolreplication',
            'rolbypassrls',
            'database_create',
            'schema_create',
          ].some((k) => identity[k] !== false) ||
          !Array.isArray(identity.memberships) ||
          identity.memberships.length !== 1 ||
          identity.memberships[0] !== role ||
          identity.membership_safe !== true ||
          !capability ||
          [
            'rolcanlogin',
            'rolinherit',
            'rolsuper',
            'rolcreatedb',
            'rolcreaterole',
            'rolreplication',
            'rolbypassrls',
          ].some((k) => capability[k] !== false) ||
          !Array.isArray(capability.memberships) ||
          capability.memberships.length !== 0
        )
          throw new PublicationPgError();
        await client.query(
          role === sourceRole
            ? 'SET ROLE novlearn_publication_journal_executor'
            : 'SET ROLE novlearn_publication_executor',
        );
        const bound = await client.query('SELECT current_user AS role');
        if (bound.rows[0]?.role !== role) throw new PublicationPgError();
        await client.query(
          "SET statement_timeout='10s'; SET lock_timeout='3s'; SET idle_in_transaction_session_timeout='60s'",
        );
        if (role === sourceRole) {
          const contract = await client.query(
            'SELECT novlearn_admin_private.publication_source_contract() AS contract',
          );
          if (contract.rows[0]?.contract !== 'atomic-source-finalization-v1')
            throw new PublicationPgError();
        }
        const checked = client;
        const release = client.release.bind(client);
        client.release = (destroy) => {
          checked.removeListener('error', onError);
          release(Boolean(destroy) || broken);
        };
        return client;
      } catch {
        client?.removeListener('error', onError);
        client?.release(true);
        throw new PublicationPgError();
      }
    };
    return { connect, close: () => pool.end() };
  };
  const source = make(config.source, sourceLogin, sourceRole, 4);
  const target = make(config.target, targetLogin, targetRole, 2);
  return {
    source: source.connect,
    target: target.connect,
    close: async () => {
      await Promise.all([source.close(), target.close()]);
    },
  };
}
