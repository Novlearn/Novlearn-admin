// New local SQL copy only. All protocol tests rollback; target observations in
// the SQL unit file are synthetic, not evidence of an actual target commit.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const stamp = Date.now(),
  artifact = path.resolve('.local/lot1a/source-state-' + stamp),
  container = 'novlearn-admin-source-' + stamp;
await mkdir(artifact, { recursive: true });
const dump = path.resolve(
  '.local/lot1a/publication-pg-1792089505633/source.dump',
);
const previous = JSON.parse(
  await readFile(
    '.local/lot1a/publication-pg-1792089505633/proof.json',
    'utf8',
  ),
);
const sha = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
assert.equal(await sha(dump), previous.sourceDumpSha256);
const migration = path.resolve(
  '../Novlearn/supabase/migrations/20261015191720_novlearn_admin_publication_source_finalization.sql',
);
const recovery = path.resolve(
  '../Novlearn/supabase/migrations/20261015131620_novlearn_admin_publication_recovery.sql',
);
const sqlTests = path.resolve('scripts/test-publication-source-local.sql');
const secret = randomBytes(24).toString('hex');
await writeFile(
  path.join(artifact, 'fixture.env'),
  'POSTGRES_PASSWORD=' + secret + '\nPOSTGRES_DB=postgres\n',
);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, fail = false) => {
  const result = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 16777216,
    },
  );
  if (!fail)
    assert.equal(
      result.status,
      0,
      result.stderr.replaceAll(secret, '[fixture secret]'),
    );
  return result;
};
const sql = (statement, database = 'source_copy') =>
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
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    statement,
  ).stdout.trim();
const snapshot = (database = 'source_copy') =>
  JSON.parse(
    sql(
      `CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.all_rows();`,
      database,
    )
      .split('\n')
      .at(-1),
  );
let created = false;
try {
  cli([
    'run',
    '--detach',
    '--pull',
    'never',
    '--name',
    container,
    '--network',
    'none',
    '--env-file',
    path.join(artifact, 'fixture.env'),
    '--mount',
    `type=bind,source=${dump},target=/fixture/source.dump,readonly`,
    '--mount',
    `type=bind,source=${recovery},target=/fixture/recovery.sql,readonly`,
    '--mount',
    `type=bind,source=${migration},target=/fixture/finalization.sql,readonly`,
    '--mount',
    `type=bind,source=${sqlTests},target=/fixture/tests.sql,readonly`,
    'public.ecr.aws/supabase/postgres:17.11.0.003',
  ]);
  created = true;
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready);
  cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'CREATE ROLE novlearn_publication_writer NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_executor NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_journal_executor NOLOGIN NOINHERIT;',
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    'source_copy',
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'source_copy',
    '--exit-on-error',
    '--single-transaction',
    '/fixture/source.dump',
  ]);
  const apply = (file) =>
    cli([
      'exec',
      container,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'source_copy',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      file,
    ]);
  const before = snapshot();
  apply('/fixture/recovery.sql');
  apply('/fixture/finalization.sql');
  assert.deepEqual(snapshot(), before);
  const run = apply('/fixture/tests.sql');
  await writeFile(path.join(artifact, 'sql.log'), run.stdout + run.stderr);
  const result = JSON.parse(
    run.stdout.split('\n').find((line) => line.startsWith('{')),
  );
  assert.equal(result.result, 'PASS');
  assert(result.sourceAssertions >= 25);
  assert.deepEqual(snapshot(), before);
  // Test restoration into a second fresh database with the final function/ACLs.
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'source_copy',
    '--format=custom',
    '--file=/tmp/source-state.dump',
  ]);
  cli([
    'cp',
    container + ':/tmp/source-state.dump',
    path.join(artifact, 'source-state.dump'),
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    'restored_source',
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'restored_source',
    '--exit-on-error',
    '--single-transaction',
    '/tmp/source-state.dump',
  ]);
  const restoredBefore = snapshot('restored_source');
  assert.deepEqual(restoredBefore, before);
  const restored = cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'restored_source',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '/fixture/tests.sql',
  ]);
  await writeFile(
    path.join(artifact, 'restored-sql.log'),
    restored.stdout + restored.stderr,
  );
  const afterRestore = JSON.parse(
    restored.stdout.split('\n').find((line) => line.startsWith('{')),
  );
  assert.equal(afterRestore.sourceAssertions, result.sourceAssertions);
  assert.deepEqual(snapshot('restored_source'), restoredBefore);
  await writeFile(
    path.join(artifact, 'snapshots.json'),
    JSON.stringify({ before, after: snapshot() }, null, 2) + '\n',
  );
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(
      {
        result: 'PASS for local SQL protocol and restoration only',
        container,
        network: 'none',
        newMigrationSha256: await sha(migration),
        sqlTestsSha256: await sha(sqlTests),
        sourceAssertions: result.sourceAssertions,
        sourceAssertionsAfterRestore: afterRestore.sourceAssertions,
        all62TableRowsPreservedAfterRollback: true,
        targetObservationsSynthetic: true,
        nativeEngineRun: false,
        realAuth: false,
        sequencesCompared: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      assertions: result.sourceAssertions,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(artifact, 'failure.txt'),
    String(error?.stack ?? error).replaceAll(secret, '[fixture secret]'),
  );
  throw error;
} finally {
  if (created) cli(['stop', '--timeout', '15', container]);
}
