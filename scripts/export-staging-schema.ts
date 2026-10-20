// Explicit operator tool. Never imported by the app; no connection without private input.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, open } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import pg from 'pg';

export const STAGING_EXPORT_HOST = 'db.tksvbkvfusrnxulpahky.supabase.co';
// Exact Session pooler coordinates supplied by the operator from Staging Connect.
export const STAGING_SESSION_POOLER_HOST =
  'aws-1-eu-west-3.pooler.supabase.com';
const image =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const options =
  '-c default_transaction_read_only=on -c search_path=pg_catalog -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=120000';
export type StagingExportSource = {
  host: typeof STAGING_EXPORT_HOST;
  port: 5432;
  database: 'postgres';
  user: string;
  password: string;
  caFile?: string;
};
export function readStagingExportSource(input: unknown): StagingExportSource {
  const fail = () => new Error('Configuration privée Staging invalide.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail();
  const v = input as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        !['host', 'port', 'database', 'user', 'password', 'caFile'].includes(k),
    ) ||
    v.host !== STAGING_EXPORT_HOST ||
    v.port !== 5432 ||
    v.database !== 'postgres' ||
    typeof v.user !== 'string' ||
    !/^[a-z_][a-z0-9_-]{0,62}$/.test(v.user) ||
    typeof v.password !== 'string' ||
    v.password.length < 8 ||
    v.password.length > 512 ||
    /[\r\n\0]/.test(v.password) ||
    (v.caFile !== undefined && v.caFile !== 'supabase-ca.crt')
  )
    throw fail();
  return { ...v } as StagingExportSource;
}
export function stagingExportConnection(
  input: unknown,
  mode: 'direct' | 'session-pooler',
) {
  const source = readStagingExportSource(input);
  if (mode !== 'direct' && mode !== 'session-pooler')
    throw new Error('Mode de connexion Staging invalide.');
  return {
    ...source,
    host: mode === 'direct' ? source.host : STAGING_SESSION_POOLER_HOST,
    user:
      mode === 'direct' ? source.user : source.user + '.tksvbkvfusrnxulpahky',
  };
}
export function stagingDumpArguments(snapshot: string, schemas: string[]) {
  if (
    !/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-\d+$/.test(snapshot) ||
    schemas.length < 1 ||
    schemas.length > 2 ||
    !schemas.includes('public') ||
    new Set(schemas).size !== schemas.length ||
    schemas.some((s) => !['public', 'novlearn_admin_private'].includes(s))
  )
    throw new Error('Contrat d’export de structure invalide.');
  return [
    '--schema-only',
    '--no-password',
    '--no-publications',
    '--no-subscriptions',
    '--no-tablespaces',
    '--lock-wait-timeout=5s',
    '--encoding=UTF8',
    '--snapshot=' + snapshot,
    ...schemas.map((s) => '--schema=' + s),
  ];
}
export function redactExportError(value: unknown, password: string) {
  return [password, encodeURIComponent(password)].reduce(
    (text, secret) => (secret ? text.replaceAll(secret, '[secret]') : text),
    String(value instanceof Error ? value.message : value),
  );
}
/** Preserve the firing mode separately: pg_get_triggerdef omits tgenabled. */
export function managedAuthTriggerSql(rows: unknown): string {
  const modes: Record<string, string> = {
    O: 'ENABLE',
    D: 'DISABLE',
    R: 'ENABLE REPLICA',
    A: 'ENABLE ALWAYS',
  };
  if (!Array.isArray(rows))
    throw new Error('Métadonnées de trigger invalides.');
  const names = new Set<string>();
  return rows
    .map((row: unknown) => {
      if (!row || typeof row !== 'object' || Array.isArray(row))
        throw new Error('Métadonnées de trigger invalides.');
      const { name, enabled, definition } = row as Record<string, unknown>;
      if (
        typeof name !== 'string' ||
        !name ||
        name.includes('\0') ||
        names.has(name) ||
        typeof enabled !== 'string' ||
        !Object.hasOwn(modes, enabled) ||
        typeof definition !== 'string' ||
        !/^CREATE (?:CONSTRAINT )?TRIGGER /.test(definition) ||
        definition.includes('\0')
      )
        throw new Error('Métadonnées de trigger invalides.');
      names.add(name);
      const identifier = '"' + name.replaceAll('"', '""') + '"';
      return `${definition};\nALTER TABLE ONLY "auth"."users" ${modes[enabled]} TRIGGER ${identifier};\n`;
    })
    .join('');
}
const fingerprint = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

async function main() {
  const args = process.argv.slice(2);
  assert(
    new Set(args).size === args.length &&
      args.every((arg) => ['--check', '--session-pooler'].includes(arg)),
    'Seules les options --check et --session-pooler sont acceptées.',
  );
  const workspace = process.cwd(),
    sourceRoot = path.resolve('.local/staging-schema-export'),
    sourceFile = path.join(sourceRoot, 'source.json');
  assert.equal(path.dirname(sourceRoot), path.join(workspace, '.local'));
  let source: StagingExportSource;
  try {
    assert.equal(await realpath(sourceFile), sourceFile);
    source = readStagingExportSource(
      JSON.parse(await readFile(sourceFile, 'utf8')),
    );
  } catch {
    throw new Error(
      'Configurer uniquement Staging dans .local/staging-schema-export/source.json ; ne transmettre aucun secret dans la conversation.',
    );
  }
  const connectionMode = args.includes('--session-pooler')
    ? 'session-pooler'
    : 'direct';
  const connection = stagingExportConnection(source, connectionMode);
  let ca: string | undefined;
  if (source.caFile) {
    const caPath = path.join(sourceRoot, source.caFile);
    assert.equal(await realpath(caPath), caPath);
    ca = await readFile(caPath, 'utf8');
    assert(
      ca.length <= 65536 &&
        ca.includes('-----BEGIN CERTIFICATE-----') &&
        !ca.includes('PRIVATE KEY'),
      'Certificat public attendu.',
    );
  }
  if (args.includes('--check')) {
    console.log(
      JSON.stringify({
        result: 'Configuration shape accepted only; no connection or export',
        host: connection.host,
        connectionMode,
        tls: 'verify-full',
        sourceConnected: false,
      }),
    );
    return;
  }
  const artifact = path.join(sourceRoot, 'export-' + Date.now());
  await mkdir(artifact);
  const client = new pg.Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.user,
    password: source.password,
    ssl: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      ...(ca ? { ca } : {}),
    },
    options,
    connectionTimeoutMillis: 8000,
    application_name: 'novlearn_admin_staging_schema_export',
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const observed = (
      await client.query(
        "SELECT current_database() AS database, current_setting('transaction_read_only') AS readonly, current_setting('server_version_num') AS version, (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_catalog.pg_backend_pid()) AS ssl",
      )
    ).rows[0];
    assert.equal(observed.database, 'postgres');
    assert.equal(observed.readonly, 'on');
    assert.equal(observed.ssl, true);
    assert(
      Number(observed.version) >= 170000 && Number(observed.version) < 180000,
    );
    const schemas = (
      await client.query(
        "SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('public','novlearn_admin_private') ORDER BY nspname",
      )
    ).rows.map((r: { nspname: string }) => r.nspname);
    const snapshot = (
      await client.query('SELECT pg_catalog.pg_export_snapshot() AS snapshot')
    ).rows[0].snapshot as string;
    const dumpArgs = stagingDumpArguments(snapshot, schemas);
    const authTriggers = (
      await client.query(
        "SELECT t.tgname AS name, t.tgenabled AS enabled, pg_catalog.pg_get_triggerdef(t.oid,true) AS definition FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace WHERE NOT t.tgisinternal AND n.nspname='auth' AND c.relname='users' AND pn.nspname='public' ORDER BY t.tgname",
      )
    ).rows;
    const triggerText = managedAuthTriggerSql(authTriggers);
    const caFile = path.join(artifact, 'ca.crt');
    if (ca) await writeFile(caFile, ca, { flag: 'wx' });
    const environment = {
      PGHOST: connection.host,
      PGPORT: String(connection.port),
      PGDATABASE: connection.database,
      PGUSER: connection.user,
      PGPASSWORD: source.password,
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: ca ? '/export-ca.crt' : 'system',
      PGOPTIONS: options,
      PGAPPNAME: 'novlearn_admin_staging_schema_export',
    };
    const envFile = path.join(artifact, 'private.env');
    await writeFile(
      envFile,
      Object.entries(environment)
        .map(([k, v]) => k + '=' + v)
        .join('\n') + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    const schemaFile = path.join(artifact, 'schema.sql');
    const file = await open(schemaFile, 'wx', 0o600);
    let stderr = '';
    try {
      const args = [
        '--host',
        'npipe:////./pipe/dockerDesktopLinuxEngine',
        'run',
        '--rm',
        '--pull=never',
        '--name',
        path.basename(artifact).replace('export-', 'novlearn-staging-schema-'),
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--cpus=1',
        '--memory=268435456',
        '--memory-swap=268435456',
        '--pids-limit=64',
        '--env-file',
        envFile,
        ...(ca
          ? [
              '--mount',
              `type=bind,src=${caFile},target=/export-ca.crt,readonly`,
            ]
          : []),
        '--entrypoint=pg_dump',
        image,
        ...dumpArgs,
      ];
      const code = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          path.join(
            process.env.LOCALAPPDATA ?? '',
            'Programs/DockerDesktop/resources/bin/docker.exe',
          ),
          args,
          { windowsHide: true, stdio: ['ignore', file.fd, 'pipe'] },
        );
        assert(child.stderr, 'Canal de diagnostic pg_dump absent.');
        child.stderr.on('data', (b) => {
          if (stderr.length < 262144) stderr += b.toString();
        });
        child.once('error', reject);
        child.once('exit', (value) => resolve(value ?? 1));
      });
      await writeFile(
        path.join(artifact, 'pg-dump.log'),
        redactExportError(stderr, source.password),
      );
      assert.equal(
        code,
        0,
        'pg_dump a échoué ; conserver cet artefact partiel.',
      );
    } finally {
      await file.close();
    }
    const schema = await readFile(schemaFile);
    assert(schema.length > 0, 'Export de structure vide.');
    await writeFile(
      path.join(artifact, 'auth-user-triggers.sql'),
      triggerText,
      {
        flag: 'wx',
        mode: 0o600,
      },
    );
    await client.query('ROLLBACK');
    await writeFile(
      path.join(artifact, 'proof.json'),
      JSON.stringify(
        {
          result: 'PASS for schema export only; restoration not executed',
          at: new Date().toISOString(),
          host: connection.host,
          connectionMode,
          stagingProjectRef: 'tksvbkvfusrnxulpahky',
          schemas,
          image,
          sourceTlsVerified: true,
          defaultTransactionReadOnly: true,
          sharedExportedSnapshot: true,
          sourceObserved: observed,
          schemaSha256: fingerprint(schema),
          authTriggers: authTriggers.length,
          authTriggerStates: authTriggers.map(({ name, enabled }) => ({
            name,
            enabled,
          })),
          authTriggersSha256: fingerprint(triggerText),
          caSha256: ca ? fingerprint(ca) : null,
          sourceRowValuesExported: false,
          sequenceCurrentValuesExported: false,
          managedSchemasOrGlobalRolesExported: false,
          publicationsAndSubscriptionsExported: false,
          remoteWrites: false,
          restorationExecuted: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(JSON.stringify({ result: 'Schema export captured', artifact }));
  } catch (error) {
    const message = redactExportError(error, source.password);
    await writeFile(path.join(artifact, 'failure.txt'), message);
    throw new Error(message);
  } finally {
    if (connected) await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Export impossible.',
    );
    process.exitCode = 1;
  });
