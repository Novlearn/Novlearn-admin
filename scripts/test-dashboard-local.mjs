// Read-only aggregation migration tested only in a fresh synthetic local clone.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [container] = process.argv.slice(2);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-[0-9]{17}$/);
const source = 'postgres';
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const stamp = Date.now(),
  database = `admin_dashboard_${stamp}`,
  restored = `${database}_restored`;
const artifact = path.resolve('.local/lot1a/dashboard-' + stamp);
await mkdir(artifact, { recursive: true });
const cli = (args) => {
  const r = spawnSync(docker, ['--host', endpoint, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  if (r.status !== 0)
    throw Error(`Local Docker check failed (${r.status}): ${r.stderr}`);
  return r;
};
assert.equal(
  cli([
    'inspect',
    '--format',
    '{{.HostConfig.NetworkMode}}',
    container,
  ]).stdout.trim(),
  'none',
);
const wasRunning =
  cli([
    'inspect',
    '--format',
    '{{.State.Running}}',
    container,
  ]).stdout.trim() === 'true';
const sql = (db, statement) =>
  cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    statement,
  ]).stdout.trim();
const snapshot = (db) =>
  JSON.parse(
    sql(
      db,
      `CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.all_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const file = async (db, local, name) => {
  cli(['cp', path.resolve(local), `${container}:/tmp/${name}.sql`]);
  const r = cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    `/tmp/${name}.sql`,
  ]);
  await writeFile(
    path.join(artifact, name + '-' + db + '.log'),
    r.stdout + '\n' + r.stderr,
  );
  return r;
};
if (!wasRunning) cli(['start', container]);
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = spawnSync(
      docker,
      [
        '--host',
        endpoint,
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'supabase_admin',
        '-d',
        source,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    if (r.status === 0) break;
    if (attempt === 29) throw Error('PostgreSQL not ready');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(
    sql(
      source,
      "SELECT to_regprocedure('public.admin_list_flashcards(text,uuid,integer)') IS NOT NULL AND to_regprocedure('public.admin_content_overview()') IS NULL",
    ),
    't',
    'source must have 58 migrations, without dashboard',
  );
  const sourceBefore = snapshot(source);
  // Logical copy also works when background sessions use the source; never terminate them.
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    source,
    '--format=custom',
    `--file=/tmp/${database}-source.dump`,
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '-T',
    'template0',
    database,
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '--exit-on-error',
    `/tmp/${database}-source.dump`,
  ]);
  const migration =
    '../Novlearn/supabase/migrations/20261015122337_novlearn_admin_dashboard.sql';
  await file(database, migration, 'dashboard-migration');
  const before = snapshot(database);
  assert.deepEqual(before, sourceBefore);
  const run = async (db) => {
    const r = await file(
      db,
      'scripts/test-dashboard-local.sql',
      'dashboard-tests',
    );
    const result = JSON.parse(
      r.stdout.split('\n').find((line) => line.startsWith('{')),
    );
    assert.equal(result.result, 'PASS');
    assert.equal(result.dashboardAssertions, 35);
    assert.deepEqual(snapshot(db), before);
    return result;
  };
  const result = await run(database);
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '--format=custom',
    `--file=/tmp/${restored}.dump`,
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '-T',
    'template0',
    restored,
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    restored,
    '--exit-on-error',
    `/tmp/${restored}.dump`,
  ]);
  assert.deepEqual(snapshot(restored), before);
  assert.deepEqual(await run(restored), result);
  const regressions = [];
  for (const [name, count] of [
    ['test-catalogue-local', 48],
    ['test-receipts-local', 21],
    ['test-editorial-review-local', 43],
    ['test-taxonomy-local', 39],
    ['test-flashcards-local', 38],
  ]) {
    const r = await file(restored, `scripts/${name}.sql`, name);
    const actual =
      name === 'test-receipts-local'
        ? (r.stderr.match(/NOTICE:\s+PASS:/g) ?? []).length
        : Number(
            Object.values(
              JSON.parse(
                r.stdout.split('\n').find((line) => line.startsWith('{')),
              ),
            ).find((v) => typeof v === 'number'),
          );
    assert.equal(actual, count, name);
    assert.deepEqual(snapshot(restored), before);
    regressions.push({ name, count: actual, result: 'PASS' });
  }
  assert.deepEqual(snapshot(source), sourceBefore);
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(
      {
        result: 'PASS',
        container,
        source,
        database,
        restored,
        migration,
        sha256: createHash('sha256')
          .update(await readFile(migration))
          .digest('hex'),
        assertions: 35,
        tableCount: Object.keys(before).length,
        sourceUnchanged: true,
        migrationRowsUnchanged: true,
        fixtureRowsRolledBack: true,
        restoreRowsMatched: true,
        sequencesCompared: false,
        regressions,
        scope:
          'Incremental read-only RPC migration on new synthetic clone and same-cluster restore; no remote activity, browser or real Auth certification',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `PASS: 35 dashboard SQL assertions before/after restore; five content regression suites; proof=${artifact}`,
  );
} catch (error) {
  await writeFile(path.join(artifact, 'failure.txt'), String(error));
  throw error;
} finally {
  if (!wasRunning) cli(['stop', '--timeout', '15', container]);
}
