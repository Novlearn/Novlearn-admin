// Upgrade only the retained synthetic activity source after SQL-66 qualification.
// Never changes the main Auth/catalogue database, remote DBs or existing credentials.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
assert(process.execArgv.includes('--conditions=react-server'));
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const marker = '.local/lot1a/users-http-current.json';
await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
const qualified = await json('.local/lot1a/users-pg-current.json');
assert.equal(qualified.phase, 'qualified');
const qualification = await json(qualified.proof);
assert.equal(qualification.result, 'PASS');
assert.equal(qualification.realLogin, true);
assert.equal(qualification.realTls, true);
for (const [f, h] of Object.entries(qualification.sourceHashes))
  assert.equal(sha(await readFile(f)), h, f);
const migrationPath =
  '../Novlearn/supabase/migrations/20261018181426_novlearn_admin_user_readonly.sql';
const migration = await readFile(migrationPath);
assert.equal(
  sha(migration),
  'e72c7df6bcf4761c37d127ff967d247664e18ce0aa162d4e009c695bea4fedc9',
);
const retained = await json('.local/lot1a/activity-http-current.json');
assert.equal(retained.phase, 'prepared');
const source = await json(retained.artifact + '/private.json');
assert.equal(source.artifact, path.resolve(retained.artifact));
assert.match(source.names.db, /^novlearn-admin-activity-http-\d+-db$/);
assert.equal(source.physicalConnectionQualified, true);
const artifact = path.resolve('.local/lot1a/users-http-' + Date.now());
await mkdir(artifact);
const password = randomBytes(24).toString('hex');
const safe = (t) =>
  [password, ...Object.values(source.secrets)].reduce(
    (s, v) => (typeof v === 'string' ? s.replaceAll(v, '[fixture secret]') : s),
    String(t),
  );
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const docker = (args, input, binary = false) => {
  const r = spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: binary ? undefined : 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
  assert.equal(r.status, 0, safe(r.stderr));
  return binary ? r.stdout : r.stdout.trim();
};
const db = source.names.db;
const inspect = JSON.parse(docker(['inspect', db]))[0];
assert.equal(inspect.State.Running, true);
assert.deepEqual(inspect.HostConfig.PortBindings, {});
assert.deepEqual(Object.keys(inspect.NetworkSettings.Networks), [
  source.names.network,
]);
assert.equal(
  docker([
    'network',
    'inspect',
    '--format',
    '{{.Internal}}',
    source.names.network,
  ]),
  'true',
);
assert(
  JSON.parse(
    docker(['image', 'inspect', inspect.Image]),
  )[0].RepoDigests.includes(
    'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
  ),
);
const proxy = JSON.parse(docker(['inspect', source.names.proxy]))[0];
assert.equal(proxy.State.Running, true);
assert.deepEqual(proxy.HostConfig.PortBindings, {
  '5435/tcp': [{ HostIp: '127.0.0.1', HostPort: '55435' }],
});
const ip = proxy.NetworkSettings.Networks[source.names.network].IPAddress;
assert.match(ip, /^\d+\.\d+\.\d+\.\d+$/);
const sql = (s) =>
  docker(
    [
      'exec',
      '-i',
      db,
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
    "SELECT count(*) FROM pg_roles WHERE rolname IN ('novlearn_users_reader','novlearn_admin_users_service');",
  ),
  '0',
);
assert.equal(sql('SELECT count(*) FROM auth.users;'), '4');
const snapshot = () =>
  JSON.parse(
    sql(
      `CREATE FUNCTION pg_temp.users_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.users_snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const before = snapshot();
assert.equal(Object.keys(before).length, 62);
assert.deepEqual(before, await json(retained.artifact + '/rows-before.json'));
await writeFile(
  artifact + '/rows-before.json',
  JSON.stringify(before, null, 2) + '\n',
);
const dump = docker(
  [
    'exec',
    db,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'activity_copy',
    '--format=custom',
    '--create',
  ],
  undefined,
  true,
);
assert(dump.subarray(0, 5).equals(Buffer.from('PGDMP')));
await writeFile(artifact + '/before-66.dump', dump);
await writeFile(
  artifact + '/roles-before.sql',
  docker(['exec', db, 'pg_dumpall', '-U', 'supabase_admin', '--roles-only']) +
    '\n',
);
const hba = sql('SHOW hba_file;');
assert(hba.startsWith('/'));
docker(['cp', db + ':' + hba, artifact + '/pg_hba.before.conf']);
const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
assert(!original.includes('novlearn_admin_users_service'));
const config = {
  url: `postgresql://novlearn_admin_users_service:${password}@127.0.0.1:55435/activity_copy`,
  ca: source.config.ca,
  environment: 'local-copy',
};
const privateState = {
  artifact,
  sourceArtifact: source.artifact,
  names: source.names,
  config,
  physicalConnectionQualified: false,
};
await writeFile(
  artifact + '/private.json',
  JSON.stringify(privateState, null, 2) + '\n',
  { mode: 0o600 },
);
await writeFile(
  marker,
  JSON.stringify({ artifact, phase: 'preparing' }, null, 2) + '\n',
);
await writeFile(artifact + '/migration.log', sql(migration) + '\n');
assert.deepEqual(snapshot(), before);
sql(
  `SET password_encryption='scram-sha-256';CREATE ROLE novlearn_admin_users_service LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}';GRANT novlearn_users_reader TO novlearn_admin_users_service WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;`,
);
await writeFile(
  artifact + '/pg_hba.conf',
  [
    'hostssl activity_copy novlearn_admin_users_service ' +
      ip +
      '/32 scram-sha-256',
    'hostssl activity_copy novlearn_admin_users_service 127.0.0.1/32 scram-sha-256',
    'host all novlearn_admin_users_service 0.0.0.0/0 reject',
    'host all novlearn_admin_users_service ::0/0 reject',
    'local all novlearn_admin_users_service reject',
    original,
  ].join('\n'),
);
docker(['cp', artifact + '/pg_hba.conf', db + ':' + hba]);
docker(['exec', db, 'chown', 'postgres:postgres', hba]);
sql('SELECT pg_reload_conf();');
assert.equal(
  sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
  '0',
);
const results = {};
for (const kind of ['users', 'activity']) {
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      ssr: path.resolve('src/lib/' + kind + '-pg.ts'),
      outDir: artifact + '/bundle',
      emptyOutDir: false,
      rolldownOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: kind + '-reader.mjs' },
      },
    },
  });
  const readerModule = await import(
    pathToFileURL(artifact + '/bundle/' + kind + '-reader.mjs').href
  );
  const reader =
    kind === 'users'
      ? readerModule.createLocalUsersReader(config)
      : readerModule.createLocalActivityReader(source.config);
  try {
    const period = {
      from: '2026-10-15',
      to: '2026-10-17',
      until: '2026-10-18',
      days: 3,
    };
    const result = await reader.read(
      kind === 'users'
        ? { period, query: '', after: null, before: null }
        : period,
    );
    if (kind === 'users') {
      assert.equal(result.total, '4');
      assert.equal(result.items[0].email, 'activity-a@example.test');
      assert.equal(result.items[1].email, null);
    } else {
      assert.equal(result.totals.exerciseAttempts, '5');
      assert.equal(result.accounts.total, '4');
    }
    results[kind] = true;
    await writeFile(
      artifact + '/' + kind + '-physical-result.json',
      JSON.stringify(result, null, 2) + '\n',
    );
  } finally {
    await reader.close();
  }
}
assert.deepEqual(snapshot(), before);
privateState.physicalConnectionQualified = true;
await writeFile(
  artifact + '/private.json',
  JSON.stringify(privateState, null, 2) + '\n',
  { mode: 0o600 },
);
const proof = {
  result: 'PASS',
  date: new Date().toISOString(),
  artifact,
  database: db,
  canonicalMigration: sha(migration),
  backupSha256: sha(dump),
  backupCreatedBeforeChanges: true,
  tableRowsPreserved: 62,
  readerQualifiedOverVerifiedTls: results,
  existingCredentialsRotated: false,
  mainDatabaseModified: false,
  remoteOperations: false,
  browserExecuted: false,
};
await writeFile(
  artifact + '/preparation-proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  marker,
  JSON.stringify(
    {
      artifact,
      phase: 'prepared',
      proof: artifact + '/preparation-proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(proof));
