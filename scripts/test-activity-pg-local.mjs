// Provision/test only an explicitly retained synthetic SQL-65 copy.
// No remote endpoint, operational app database or arbitrary SQL is accepted.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'vite';

const [container, flag, resume, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-activity-(?:sql|restore)-\d+$/);
assert(flag === undefined || (flag === '--resume' && resume));
const artifact = path.resolve(
  resume ?? '.local/lot1a/activity-pg-' + Date.now(),
);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^activity-pg-\d+$/);
if (!resume) await mkdir(artifact);
const retained = resume
  ? JSON.parse(await readFile(artifact + '/private.json', 'utf8'))
  : null;
if (retained) {
  assert.equal(retained.container, container);
  assert.equal(retained.artifact, artifact);
}
const password = retained
  ? decodeURIComponent(new URL(retained.config.url).password)
  : randomBytes(24).toString('hex');
const redact = (t) => String(t).replaceAll(password, '[fixture secret]');
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(r.status, 0, redact(r.stderr));
  return r.stdout.trim();
};
const inspect = JSON.parse(cli(['inspect', container]))[0];
assert.equal(
  inspect.State.Running,
  true,
  'Start this same retained fixture explicitly',
);
assert.equal(inspect.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspect.HostConfig.PortBindings ?? {}, {});
const pgDigest =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(cli(['image', 'inspect', inspect.Image]))[0].RepoDigests.includes(
    pgDigest,
  ),
);
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
const sql = (s) =>
  cli(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'activity_copy',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    s,
  );
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_activity_reader' AND NOT rolcanlogin;",
  ),
  '1',
);
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_admin_activity_service';",
  ),
  resume ? '1' : '0',
  'Never silently rotate or reuse an existing identity; inspect its retained private state',
);
assert.equal(sql('SELECT count(*) FROM auth.users;'), '4');
const snapshot = () =>
  JSON.parse(
    sql(
      `CREATE FUNCTION pg_temp.activity_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.activity_snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const before = resume
  ? JSON.parse(await readFile(artifact + '/rows-before.json', 'utf8'))
  : snapshot();
assert.deepEqual(snapshot(), before);
assert.equal(Object.keys(before).length, 62);
if (!resume) {
  await writeFile(
    artifact + '/rows-before.json',
    JSON.stringify(before, null, 2) + '\n',
  );
  // Read-only rootfs, no network, no capabilities: generate synthetic certificates.
  for (const label of ['server', 'untrusted'])
    cli([
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'none',
      '--memory',
      '128m',
      '--memory-swap',
      '128m',
      '--pids-limit',
      '32',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--mount',
      `type=bind,source=${artifact},target=/certificates`,
      nodeImage,
      'openssl',
      'req',
      '-new',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      '/certificates/' + label + '.key',
      '-out',
      '/certificates/' + label + '.crt',
      '-subj',
      '/CN=activity-local-fixture',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-days',
      '7',
    ]);
  for (const ext of ['key', 'crt'])
    cli([
      'cp',
      artifact + '/server.' + ext,
      container + ':/tmp/admin-activity-server.' + ext,
    ]);
  cli([
    'exec',
    container,
    'chown',
    'postgres:postgres',
    '/tmp/admin-activity-server.key',
    '/tmp/admin-activity-server.crt',
  ]);
  cli([
    'exec',
    '--user',
    'postgres',
    container,
    'chmod',
    '600',
    '/tmp/admin-activity-server.key',
  ]);
  sql("ALTER SYSTEM SET ssl_cert_file='/tmp/admin-activity-server.crt';");
  sql("ALTER SYSTEM SET ssl_key_file='/tmp/admin-activity-server.key';");
  sql('ALTER SYSTEM SET ssl=on;');
  const hba = sql('SHOW hba_file;');
  assert(hba.startsWith('/'));
  cli(['cp', container + ':' + hba, artifact + '/pg_hba.before.conf']);
  const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
  assert(!original.includes('novlearn_admin_activity_service'));
  await writeFile(
    artifact + '/pg_hba.conf',
    [
      'hostssl activity_copy novlearn_admin_activity_service 127.0.0.1/32 scram-sha-256',
      'host all novlearn_admin_activity_service 0.0.0.0/0 reject',
      'host all novlearn_admin_activity_service ::0/0 reject',
      'local all novlearn_admin_activity_service reject',
      original,
    ].join('\n'),
  );
  cli(['cp', artifact + '/pg_hba.conf', container + ':' + hba]);
  cli(['exec', container, 'chown', 'postgres:postgres', hba]);
  sql(
    `SET password_encryption='scram-sha-256'; CREATE ROLE novlearn_admin_activity_service LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'; GRANT novlearn_activity_reader TO novlearn_admin_activity_service WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
  );
  sql('SELECT pg_reload_conf();');
  assert.equal(
    sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
    '0',
  );
  const config = {
    url: `postgresql://novlearn_admin_activity_service:${password}@127.0.0.1:55435/activity_copy`,
    ca: await readFile(artifact + '/server.crt', 'utf8'),
    environment: 'local-copy',
  };
  await writeFile(
    artifact + '/private.json',
    JSON.stringify(
      {
        container,
        artifact,
        config,
        untrustedCa: await readFile(artifact + '/untrusted.crt', 'utf8'),
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  await writeFile(
    '.local/lot1a/activity-pg-current.json',
    JSON.stringify(
      { container, artifact, phase: 'provisioned-not-yet-qualified' },
      null,
      2,
    ) + '\n',
  );
}
await build({
  configFile: false,
  envDir: false,
  logLevel: 'warn',
  build: {
    ssr: path.resolve('src/lib/activity-pg.ts'),
    outDir: artifact + '/runner',
    emptyOutDir: false,
    rolldownOptions: {
      external: ['pg', 'server-only'],
      output: { entryFileNames: 'activity-reader.mjs' },
    },
  },
});
await copyFile(
  'scripts/test-activity-pg-worker.mjs',
  artifact + '/runner/worker.mjs',
);
// A nested bind cannot create a missing mountpoint in its read-only parent.
await mkdir(artifact + '/runner/node_modules', { recursive: true });
const workerArgs = [
  'run',
  '--rm',
  '--pull',
  'never',
  '--network',
  'container:' + container,
  '--memory',
  '384m',
  '--memory-swap',
  '384m',
  '--pids-limit',
  '64',
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--user',
  '65534:65534',
  '--workdir',
  '/app',
  '--mount',
  `type=bind,source=${artifact},target=/fixture`,
  '--mount',
  `type=bind,source=${artifact}/runner,target=/runner,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('scripts')},target=/app/scripts,readonly`,
  nodeImage,
  'node',
  '--conditions=react-server',
  '/runner/worker.mjs',
];
const result = cli(workerArgs);
await writeFile(artifact + '/connection.log', result + '\n');
const driftChecks = [];
for (const [label, grant, revoke] of [
  [
    'reader-email',
    'GRANT SELECT(email) ON auth.users TO novlearn_activity_reader;',
    'REVOKE SELECT(email) ON auth.users FROM novlearn_activity_reader;',
  ],
  [
    'login-temporary',
    'GRANT TEMPORARY ON DATABASE activity_copy TO novlearn_admin_activity_service;',
    'REVOKE TEMPORARY ON DATABASE activity_copy FROM novlearn_admin_activity_service;',
  ],
]) {
  sql(grant);
  try {
    const output = cli([...workerArgs, '--expect-drift']);
    await writeFile(artifact + '/' + label + '-refusal.log', output + '\n');
    driftChecks.push(label);
  } finally {
    sql(revoke);
  }
}
// Repeat the successful real reader after restoring the original minimal grants.
await writeFile(artifact + '/after-drift.log', cli(workerArgs) + '\n');
assert.deepEqual(snapshot(), before);
const checks = JSON.parse(
  await readFile(artifact + '/connection-proof.json', 'utf8'),
);
const files = [
  'src/lib/activity-pg.ts',
  'src/lib/activity-statistics.ts',
  'scripts/activity-reader-audit.sql',
  'scripts/activity-statistics-query.sql',
  'scripts/test-activity-pg-worker.mjs',
  'scripts/test-activity-pg-local.mjs',
];
const hashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      createHash('sha256')
        .update(await readFile(f))
        .digest('hex'),
    ]),
  ),
);
const proof = {
  ...checks,
  effectivePrivilegeDriftsRejected: driftChecks,
  container,
  artifact,
  postgresImageDigest: pgDigest,
  nodeImage,
  sourceHashes: hashes,
  tableSnapshotsCompared: 62,
  allTableRowsPreserved: true,
  existingApplicationModified: false,
  productionReaderActivated: false,
  remoteDatabaseOperationPerformed: false,
  fixtureLoginCreatedAfterSql65: true,
  fixtureHbaRequiresScramAndTls: true,
  fixtureNetwork: 'none',
  publishedPorts: [],
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/activity-pg-current.json',
  JSON.stringify(
    {
      container,
      artifact,
      phase: 'qualified',
      proof: artifact + '/proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: proof.result,
    artifact,
    checks: checks.checks.length,
    tableSnapshotsCompared: 62,
  }),
);
