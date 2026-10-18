// Provision/test only an explicitly retained synthetic SQL-67 copy.
// No remote endpoint, operational app database or arbitrary SQL is accepted.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'vite';
import { userDetailProgressSeedSql } from './user-detail-local-fixture.mjs';

const [container, flag, resume, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-users-restore-\d+$/);
assert(flag === undefined || (flag === '--resume' && resume));
const artifact = path.resolve(
  resume ?? '.local/lot1a/user-detail-pg-' + Date.now(),
);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^user-detail-pg-\d+$/);
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
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_user_detail_reader' AND NOT rolcanlogin;",
  ),
  '1',
);
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_admin_user_detail_service';",
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
const previousMarker = JSON.parse(
  await readFile('.local/lot1a/users-pg-current.json', 'utf8'),
);
assert.equal(previousMarker.container, container);
assert.equal(previousMarker.phase, 'qualified');
const oldState = JSON.parse(
  await readFile(previousMarker.artifact + '/private.json', 'utf8'),
);
assert.equal(oldState.container, container);
if (!resume) {
  const dumpName = '/tmp/' + path.basename(artifact) + '-before.dump';
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '--dbname=activity_copy',
    '--format=custom',
    '--create',
    '--file=' + dumpName,
  ]);
  cli(['cp', container + ':' + dumpName, artifact + '/before-progress.dump']);
  await writeFile(
    artifact + '/before-progress-rows.json',
    JSON.stringify(snapshot(), null, 2) + '\n',
  );
  await writeFile(
    artifact + '/progress-seed.log',
    sql(await userDetailProgressSeedSql()) + '\n',
  );
}
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
  // Preserve the working certificate/key and previous users-reader identity.
  await writeFile(artifact + '/server.crt', oldState.config.ca);
  await writeFile(artifact + '/untrusted.crt', oldState.untrustedCa);
  const hba = sql('SHOW hba_file;');
  assert(hba.startsWith('/'));
  cli(['cp', container + ':' + hba, artifact + '/pg_hba.before.conf']);
  const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
  assert(!original.includes('novlearn_admin_user_detail_service'));
  await writeFile(
    artifact + '/pg_hba.conf',
    [
      'hostssl activity_copy novlearn_admin_user_detail_service 127.0.0.1/32 scram-sha-256',
      'host all novlearn_admin_user_detail_service 0.0.0.0/0 reject',
      'host all novlearn_admin_user_detail_service ::0/0 reject',
      'local all novlearn_admin_user_detail_service reject',
      original,
    ].join('\n'),
  );
  cli(['cp', artifact + '/pg_hba.conf', container + ':' + hba]);
  cli(['exec', container, 'chown', 'postgres:postgres', hba]);
  sql(
    `SET password_encryption='scram-sha-256'; CREATE ROLE novlearn_admin_user_detail_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'; GRANT novlearn_user_detail_reader TO novlearn_admin_user_detail_service WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
  );
  sql('SELECT pg_reload_conf();');
  sql('ALTER ROLE novlearn_admin_user_detail_service LOGIN;');
  assert.equal(
    sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
    '0',
  );
  const config = {
    url: `postgresql://novlearn_admin_user_detail_service:${password}@127.0.0.1:55435/activity_copy`,
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
        oldUsersConfig: oldState.config,
        untrustedCa: await readFile(artifact + '/untrusted.crt', 'utf8'),
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  await writeFile(
    '.local/lot1a/user-detail-pg-current.json',
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
    ssr: path.resolve('src/lib/user-detail-pg.ts'),
    outDir: artifact + '/runner',
    emptyOutDir: false,
    rolldownOptions: {
      external: ['pg', 'server-only'],
      output: { entryFileNames: 'user-detail-reader.mjs' },
    },
  },
});
for (const [source, name] of [
  ['src/lib/users-pg.ts', 'users-reader.mjs'],
  ['src/lib/user-detail.ts', 'user-detail-domain.mjs'],
])
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      ssr: path.resolve(source),
      outDir: artifact + '/runner',
      emptyOutDir: false,
      rolldownOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: name },
      },
    },
  });
await copyFile(
  'scripts/test-user-detail-pg-worker.mjs',
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
    'reader-birth-date',
    'GRANT SELECT(birth_date) ON public.profiles TO novlearn_user_detail_reader;',
    'REVOKE SELECT(birth_date) ON public.profiles FROM novlearn_user_detail_reader;',
  ],
  [
    'login-temporary',
    'GRANT TEMPORARY ON DATABASE activity_copy TO novlearn_admin_user_detail_service;',
    'REVOKE TEMPORARY ON DATABASE activity_copy FROM novlearn_admin_user_detail_service;',
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
  'src/lib/user-detail-pg.ts',
  'src/lib/user-detail-config.ts',
  'src/lib/user-detail.ts',
  'scripts/user-detail-reader-audit.sql',
  'scripts/user-detail-query.sql',
  'scripts/test-user-detail-pg-worker.mjs',
  'scripts/test-user-detail-pg-local.mjs',
  'scripts/user-detail-local-fixture.mjs',
  'tests/fixtures/user-detail-progress-local.sql',
  'src/lib/users-pg.ts',
  'src/lib/users.ts',
  'src/lib/users-config.ts',
  'scripts/users-reader-audit.sql',
  'scripts/users-list-query.sql',
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
  fixtureLoginCreatedAfterSql67: true,
  previousTlsCertificateAndCredentialsPreserved: true,
  additiveFixtureRows: 11,
  allPreexistingRowsComparedInsideSeedTransaction: true,
  fixtureHbaRequiresScramAndTls: true,
  fixtureNetwork: 'none',
  publishedPorts: [],
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/user-detail-pg-current.json',
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
