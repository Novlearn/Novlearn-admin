// New synthetic clone only; preserves the supplied source and retains artifacts.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [container, source] = process.argv.slice(2);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-[0-9]{17}$/);
assert.match(source ?? '', /^admin_friend_trigger_[0-9]+$/);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 16777216,
    },
  );
  if (r.status !== 0)
    writeFileSync(
      '.local/lot1a/taxonomy-command-failure-' + Date.now() + '.log',
      r.stdout + '\n' + r.stderr,
    );
  assert.equal(r.status, 0, r.stderr);
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
const stamp = Date.now(),
  database = 'admin_taxonomy_' + stamp,
  restored = database + '_restored';
const artifact = path.resolve('.local/lot1a/taxonomy-' + stamp);
await mkdir(artifact, { recursive: true });
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

const snapshotOriginalColumns = (db) =>
  JSON.parse(
    sql(
      db,
      `CREATE FUNCTION pg_temp.original_columns() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; expression text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP expression:=CASE WHEN t.schemaname='public' AND t.tablename IN ('chapters','competences') THEN '(to_jsonb(r)-''admin_epoch'')' ELSE 'to_jsonb(r)' END; EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(%s::text,E''\\n'' ORDER BY %s::text),''''),''sha256''),''hex'') FROM %I.%I r',expression,expression,t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.original_columns();`,
    )
      .split('\n')
      .at(-1),
  );
if (!wasRunning) cli(['start', container]);
try {
  for (let i = 0; i < 30; i++) {
    const r = spawnSync(
      docker,
      [
        '--host',
        'npipe:////./pipe/dockerDesktopLinuxEngine',
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
    if (i === 29) throw Error('PostgreSQL not ready');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const sourceBefore = snapshot(source);
  sql('postgres', `CREATE DATABASE ${database} TEMPLATE ${source}`);
  const migration =
    '../Novlearn/supabase/migrations/20261015072729_novlearn_admin_taxonomy.sql';
  cli(['cp', path.resolve(migration), container + ':/tmp/admin-taxonomy.sql']);
  cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '/tmp/admin-taxonomy.sql',
  ]);
  const before = snapshot(database);
  const normalized = snapshotOriginalColumns(database);
  for (const [table, rows] of Object.entries(sourceBefore))
    assert.deepEqual(normalized[table], rows, table);
  assert.equal(normalized['public.admin_taxonomy_events'].rows, 0);
  const run = (db) => {
    cli([
      'cp',
      path.resolve('scripts/test-taxonomy-local.sql'),
      container + ':/tmp/admin-taxonomy-tests.sql',
    ]);
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
      '/tmp/admin-taxonomy-tests.sql',
    ]);
    return {
      log: r.stdout + '\n' + r.stderr,
      summary: JSON.parse(
        r.stdout.split('\n').find((line) => line.startsWith('{')),
      ),
    };
  };
  const original = run(database);
  await writeFile(path.join(artifact, 'source-tests.log'), original.log);
  assert.equal(original.summary.result, 'PASS');
  assert.equal(original.summary.taxonomyAssertions, 39);
  assert.deepEqual(snapshot(database), before);
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '--format=custom',
    '--file=/tmp/' + restored + '.dump',
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
    '/tmp/' + restored + '.dump',
  ]);
  assert.deepEqual(snapshot(restored), before);
  const restore = run(restored);
  await writeFile(path.join(artifact, 'restored-tests.log'), restore.log);
  assert.deepEqual(restore.summary, original.summary);
  assert.deepEqual(snapshot(restored), before);
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
        assertions: original.summary.taxonomyAssertions,
        before,
        sourceBefore,
        sourceAfter: snapshot(source),
        tableCount: Object.keys(before).length,
        originalColumnsPreserved: {
          tables: Object.keys(sourceBefore).length,
          normalizedRows: normalized,
          onlyExcludedColumns: [
            'public.chapters.admin_epoch',
            'public.competences.admin_epoch',
          ],
        },
        fixtureRowsRolledBack: true,
        restoreRowsMatched: true,
        sequenceIntegrityCompared: false,
        scope:
          'Incremental migration on synthetic clone plus same-cluster dump/restore. No fresh full migration replay, no real Auth/browser or remote operation.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS: ' +
      original.summary.taxonomyAssertions +
      ' taxonomy SQL assertions before and after restore; proof=' +
      artifact,
  );
} finally {
  if (!wasRunning) cli(['stop', '--timeout', '15', container]);
}
