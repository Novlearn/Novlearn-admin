// Partial compatibility fixture, NEVER a Staging clone or a deployment script.
// Only the newly created, network-isolated container below can be mutated.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const canonical = path.resolve(root, '../Novlearn');
const migrations = path.join(canonical, 'supabase/migrations');
const artifact = path.join(root, '.local/lot1a/observed-schema-' + Date.now());
const stamp = new Date().toISOString().replace(/\D/g, '');
const container = 'novlearn-admin-lot1a-replay-' + stamp;
const docker =
  'C:/Users/balth/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const postgresImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const authImage =
  'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b';
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
const authContainer = 'novlearn-admin-local-1792143739689-auth';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const columnsByName = (columns) => {
  const entries = columns.map((column) => [
    column.table + '.' + column.name,
    column,
  ]);
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
  return Object.fromEntries(entries);
};
const cli = (args, input, allowFailure = false) => {
  const result = spawnSync(docker, ['--host', endpoint, ...args], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  if (!allowFailure)
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result;
};
const sql = (statement) =>
  cli(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-XqAt',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    statement,
  ).stdout.trim();
const jsonSql = (statement) => JSON.parse(sql(statement).split('\n').at(-1));
const writeJson = (file, value) =>
  writeFile(path.join(artifact, file), JSON.stringify(value, null, 2) + '\n');
await mkdir(path.join(artifact, 'runner/node_modules'), { recursive: true });
await writeJson('state.json', {
  phase: 'preflight',
  artifact,
  container,
  scope: 'selected observed differences only; not a faithful clone',
});

const names = (await readdir(migrations))
  .filter((n) => n.endsWith('.sql'))
  .sort();
const firstAdmin = names.indexOf(
  '20261013174721_novlearn_admin_exercise_versioning.sql',
);
assert.equal(firstAdmin, 45);
assert.equal(names.length, 71);
const manifest = await Promise.all(
  names.map(async (name) => ({
    name,
    sha256: sha(await readFile(path.join(migrations, name))),
  })),
);
await writeJson('manifest.json', manifest);
const inputs = {};
for (const relative of [
  'scripts/test-observed-schema-local.mjs',
  'docs/observed-staging-shape-2026-10-20.sql',
  'docs/observed-staging-shape-2026-10-20.json',
]) {
  const file = path.join(root, relative);
  inputs[file] = sha(await readFile(file));
}
for (const name of [
  'test-novlearn-admin-local.mjs',
  'test-novlearn-admin-security-local.mjs',
  'local-database-url.mjs',
]) {
  const source = path.join(canonical, 'scripts', name);
  inputs[source] = sha(await readFile(source));
  await copyFile(source, path.join(artifact, 'runner', name));
}
for (const name of [
  'test-catalogue-local.sql',
  'test-receipts-local.sql',
  'test-editorial-review-local.sql',
  'test-taxonomy-local.sql',
  'test-flashcards-local.sql',
  'test-dashboard-local.sql',
  'test-friend-trigger-local.sql',
]) {
  const source = path.join(root, 'scripts', name);
  inputs[source] = sha(await readFile(source));
  await copyFile(source, path.join(artifact, name));
}
const overlay = await readFile(
  path.join(root, 'scripts/observed-staging-shape-local.sql'),
  'utf8',
);
inputs[path.join(root, 'scripts/observed-staging-shape-local.sql')] =
  sha(overlay);
await copyFile(
  path.join(root, 'scripts/observed-staging-shape-local.sql'),
  path.join(artifact, 'overlay.sql'),
);
const auth = JSON.parse(cli(['inspect', authContainer]).stdout)[0];
assert.equal(auth.Config.Image, authImage);
assert.equal(auth.State.Running, true);
cli([
  'cp',
  authContainer + ':/usr/local/bin/auth',
  path.join(artifact, 'auth-fixture'),
]);
const authSha256 = sha(await readFile(path.join(artifact, 'auth-fixture')));
let created = false;
let proof;
try {
  // The only Docker run in this harness creates a uniquely named EMPTY fixture.
  const id = cli([
    'run',
    '--detach',
    '--pull',
    'never',
    '--name',
    container,
    '--network',
    'none',
    '--cpus',
    '2',
    '--memory',
    '1g',
    '--memory-swap',
    '1g',
    '--pids-limit',
    '256',
    '--env',
    'POSTGRES_PASSWORD=local-fixture-only',
    '--env',
    'POSTGRES_DB=postgres',
    '--mount',
    `type=bind,source=${migrations},target=/fixture-migrations,readonly`,
    '--mount',
    `type=bind,source=${artifact},target=/fixture-bootstrap,readonly`,
    postgresImage,
  ]).stdout.trim();
  created = true;
  const inspected = JSON.parse(cli(['inspect', container]).stdout)[0];
  assert.equal(inspected.Id, id);
  assert.equal(inspected.Config.Image, postgresImage);
  assert.equal(inspected.HostConfig.NetworkMode, 'none');
  assert.deepEqual(inspected.HostConfig.PortBindings, {});
  assert.equal(inspected.HostConfig.NanoCpus, 2000000000);
  assert.equal(inspected.HostConfig.Memory, 1073741824);
  assert.equal(inspected.HostConfig.MemorySwap, 1073741824);
  assert.equal(inspected.HostConfig.PidsLimit, 256);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (
      cli(
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'supabase_admin',
          '-d',
          'postgres',
        ],
        undefined,
        true,
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await delay(500);
  }
  assert(ready, 'Fresh fixture PostgreSQL did not become ready');
  cli([
    'cp',
    path.join(artifact, 'auth-fixture'),
    container + ':/tmp/auth-fixture',
  ]);
  cli(['exec', container, 'chmod', '700', '/tmp/auth-fixture']);
  const bootstrap = cli([
    'exec',
    '-e',
    'GOTRUE_DB_DRIVER=postgres',
    '-e',
    'GOTRUE_DB_DATABASE_URL=postgres://supabase_admin@localhost/postgres?host=/run/postgresql&sslmode=disable&options=-crole%3Dsupabase_auth_admin',
    '-e',
    'GOTRUE_DB_NAMESPACE=auth',
    '-e',
    'API_EXTERNAL_URL=http://127.0.0.1:9999',
    '-e',
    'GOTRUE_SITE_URL=http://127.0.0.1:3000',
    '-e',
    'GOTRUE_JWT_SECRET=local-fixture-only-at-least-32-characters-long',
    container,
    '/tmp/auth-fixture',
    'migrate',
  ]);
  await writeFile(
    path.join(artifact, 'auth-bootstrap.log'),
    bootstrap.stdout + bootstrap.stderr,
  );
  const apply = async (entries, logName) => {
    let log = '';
    for (const entry of entries) {
      const result = cli(
        [
          'exec',
          container,
          'psql',
          '-XqAt',
          '-U',
          'supabase_admin',
          '-d',
          'postgres',
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          '/fixture-migrations/' + entry.name,
        ],
        undefined,
        true,
      );
      log += '\n' + entry.name + '\n' + result.stdout + result.stderr;
      await writeFile(path.join(artifact, logName), log);
      assert.equal(
        result.status,
        0,
        `Migration ${entry.name} failed; inspect ${logName}`,
      );
    }
  };
  await apply(manifest.slice(0, firstAdmin), 'legacy-replay.log');
  const overlayResult = sql(overlay);
  await writeFile(path.join(artifact, 'overlay.log'), overlayResult);
  const shapeQuery = await readFile(
    path.join(root, 'docs/observed-staging-shape-2026-10-20.sql'),
    'utf8',
  );
  const expected = JSON.parse(
    await readFile(
      path.join(root, 'docs/observed-staging-shape-2026-10-20.json'),
      'utf8',
    ),
  );
  const beforeShape = jsonSql(shapeQuery);
  await writeJson('shape-before.json', beforeShape);
  assert.deepEqual(
    columnsByName(beforeShape.columns),
    columnsByName(expected.columns),
    'Fixture must match every selected remote column attribute',
  );
  assert.deepEqual(
    beforeShape.indexes,
    expected.indexes,
    'Fixture must match all eight selected remote index definitions',
  );
  // Fixed synthetic sentinels include NULLs allowed by the observed schema.
  sql(`INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    VALUES('a7100000-0000-4000-8000-000000000001','authenticated','authenticated','observed-shape@fixture.invalid','',now(),
      '{"provider":"email","providers":["email"]}','{"first_name":"LOCAL SHAPE FIXTURE","birth_date":"2000-01-01"}',now(),now());
    UPDATE public.profiles SET current_streak=NULL,max_streak=NULL,role=NULL,has_seen_tutorial=NULL WHERE id='a7100000-0000-4000-8000-000000000001';
    INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('local-observed-null-sentinel','LOCAL SHAPE FIXTURE',NULL,NULL);
    INSERT INTO public.exercises(title,chapter,content,created_at) VALUES('LOCAL SHAPE FIXTURE','LOCAL SHAPE FIXTURE','{"legacy":"unchanged"}','2026-01-02T03:04:05Z');
    INSERT INTO public.exercise_attempts(user_id,exercise_id,is_correct,attempted_at,created_at)
      SELECT 'a7100000-0000-4000-8000-000000000001',id,true,'2026-01-03T04:05:06Z','2026-01-04T05:06:07Z' FROM public.exercises WHERE title='LOCAL SHAPE FIXTURE';`);
  const tables =
    jsonSql(`SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'columns',cols) ORDER BY table_schema,table_name)
    FROM (SELECT table_schema,table_name,jsonb_agg(column_name ORDER BY ordinal_position) cols FROM information_schema.columns
      WHERE table_schema IN ('public','auth') AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname IN ('public','auth')) GROUP BY table_schema,table_name) t;`);
  const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
  const rows = () =>
    Object.fromEntries(
      tables.map((t) => [
        t.schema + '.' + t.table,
        jsonSql(
          `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) FROM (SELECT ${t.columns.map(quote).join(',')} FROM ${quote(t.schema)}.${quote(t.table)}) r;`,
        ),
      ]),
    );
  const sequences = () =>
    jsonSql(
      `SELECT jsonb_agg(jsonb_build_object('name',schemaname||'.'||sequencename,'last',last_value,'start',start_value,'increment',increment_by,'max',max_value,'min',min_value,'cache',cache_size,'cycle',cycle) ORDER BY schemaname,sequencename) FROM pg_sequences WHERE schemaname IN ('public','auth');`,
    );
  const beforeRows = rows();
  const beforeSequences = sequences();
  await writeJson('rows-before.json', beforeRows);
  await writeJson('sequences-before.json', beforeSequences);
  await apply(manifest.slice(firstAdmin), 'admin-delta.log');
  const afterShape = jsonSql(shapeQuery);
  assert.deepEqual(
    afterShape.columns,
    beforeShape.columns,
    'Admin delta must preserve selected legacy columns',
  );
  assert.deepEqual(
    afterShape.indexes,
    beforeShape.indexes,
    'Admin delta must preserve all eight indexes',
  );
  assert.deepEqual(
    rows(),
    beforeRows,
    'Admin delta must preserve every old row and old column value',
  );
  const afterSequences = sequences();
  for (const s of beforeSequences)
    assert.deepEqual(
      afterSequences.find((after) => after.name === s.name),
      s,
      'Legacy sequence must not move during delta: ' + s.name,
    );
  assert.equal(
    sql('SELECT count(*) FROM public.exercise_versions'),
    '0',
    'No invented legacy exercise version',
  );
  assert.equal(
    sql(
      'SELECT count(*) FROM public.exercise_attempts WHERE exercise_version_id IS NOT NULL',
    ),
    '0',
    'No invented legacy attempt version',
  );
  await writeJson('shape-after.json', afterShape);
  await writeJson('sequences-after-delta.json', afterSequences);
  const regression = cli(
    [
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'container:' + container,
      '--cpus',
      '2',
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
      '--tmpfs',
      '/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777',
      '--env',
      'NOVLEARN_LOCAL_DATABASE_URL=postgresql://supabase_admin@127.0.0.1:5432/postgres',
      '--mount',
      `type=bind,source=${artifact}/runner,target=/runner,readonly`,
      '--mount',
      `type=bind,source=${path.join(root, 'node_modules')},target=/runner/node_modules,readonly`,
      nodeImage,
      'node',
      '--input-type=module',
      '-e',
      "await import('/runner/test-novlearn-admin-local.mjs');await import('/runner/test-novlearn-admin-security-local.mjs');",
    ],
    undefined,
    true,
  );
  await writeFile(
    path.join(artifact, 'canonical-regressions.log'),
    regression.stdout + regression.stderr,
  );
  assert.equal(
    regression.status,
    0,
    'Canonical tests failed; inspect canonical-regressions.log',
  );
  const counts = [...regression.stdout.matchAll(/PASS: (\d+) /g)].map((m) =>
    Number(m[1]),
  );
  assert.deepEqual(
    counts,
    [30, 26],
    'Use actual canonical suite counts, never historical totals',
  );
  const suites = [];
  for (const name of [
    'catalogue',
    'receipts',
    'editorial-review',
    'taxonomy',
    'flashcards',
    'dashboard',
    'friend-trigger',
  ]) {
    const result = cli(
      [
        'exec',
        container,
        'psql',
        '-XqAt',
        '-U',
        'supabase_admin',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '/fixture-bootstrap/test-' + name + '-local.sql',
      ],
      undefined,
      true,
    );
    await writeFile(
      path.join(artifact, name + '.log'),
      result.stdout + result.stderr,
    );
    assert.equal(
      result.status,
      0,
      `Existing ${name} suite failed; inspect ${name}.log`,
    );
    const summary = result.stdout
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line));
    const notices = [
      ...result.stderr.matchAll(/NOTICE:\s+PASS: ([^\r\n]+)/g),
    ].map((m) => m[1]);
    assert(
      summary.length > 0 || notices.length > 0,
      'Suite must produce actual assertions: ' + name,
    );
    suites.push({ name, summary, passNotices: notices.length });
    assert.deepEqual(rows(), beforeRows, name + ' must roll back all fixtures');
  }
  assert.deepEqual(jsonSql(shapeQuery).columns, beforeShape.columns);
  assert.deepEqual(jsonSql(shapeQuery).indexes, beforeShape.indexes);
  for (const entry of manifest)
    assert.equal(
      sha(await readFile(path.join(migrations, entry.name))),
      entry.sha256,
    );
  for (const [file, digest] of Object.entries(inputs))
    assert.equal(sha(await readFile(file)), digest);
  proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    artifact,
    container,
    containerId: id,
    scope:
      'Selected observed Staging differences over canonical legacy replay; not a faithful schema restoration or permission/deployment certification',
    legacyMigrations: firstAdmin,
    adminMigrations: manifest.length - firstAdmin,
    manifestSha256: sha(await readFile(path.join(artifact, 'manifest.json'))),
    postgresImage,
    authImage,
    authBinarySha256: authSha256,
    nodeImage,
    inputs,
    selectedColumns: beforeShape.columns.length,
    selectedColumnOrderMatchesObservation:
      beforeShape.columns.map((c) => c.table + '.' + c.name).join('|') ===
      expected.columns.map((c) => c.table + '.' + c.name).join('|'),
    selectedIndexes: beforeShape.indexes.length,
    oldTablesPreserved: tables.length,
    oldRowsAndValuesPreserved: true,
    oldSequencesPreservedDuringDelta: beforeSequences.length,
    canonicalAssertions: {
      integration: counts[0],
      security: counts[1],
      total: counts[0] + counts[1],
    },
    suites,
    network: 'none',
    publishedPorts: false,
    cpus: 2,
    memoryBytes: 1073741824,
    swapBytes: 0,
    pids: 256,
    existingDatabasesModified: false,
    remoteWrite: false,
    faithfulStagingClone: false,
    remoteApplicationQualified: false,
  };
} catch (error) {
  await writeJson('state.json', {
    phase: 'failed',
    at: new Date().toISOString(),
    artifact,
    container,
    error: error.message,
  });
  throw error;
} finally {
  if (created) cli(['stop', '--timeout', '15', container]);
}
assert.equal(
  JSON.parse(cli(['inspect', container]).stdout)[0].State.Running,
  false,
);
proof.fixtureStoppedNormally = true;
await writeJson('proof.json', proof);
await writeJson('state.json', { phase: 'qualified', artifact, container });
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact,
    legacyMigrations: proof.legacyMigrations,
    adminMigrations: proof.adminMigrations,
    canonicalAssertions: proof.canonicalAssertions,
    suites: proof.suites,
  }),
);
