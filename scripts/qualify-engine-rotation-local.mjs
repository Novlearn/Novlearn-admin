import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  options: {
    'source-container': { type: 'string' },
    'baseline-dump': { type: 'string' },
  },
  strict: true,
  allowPositionals: false,
});
const baselineDump = path.resolve(values['baseline-dump'] ?? '');
assert(
  baselineDump
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
  'Use a retained local baseline dump inside .local',
);
const source = values['source-container'];
assert.match(source ?? '', /^novlearn-admin-lot1a-replay-\d{17}$/);
const copyDatabase = 'rotation_copy_' + Date.now();
const directory = path.resolve('.local/lot1a/engine-rotation-' + Date.now());
await mkdir(directory);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, acceptFailure = false) => {
  const r = spawnSync(
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
  if (!acceptFailure)
    assert.equal(r.status, 0, String(r.stderr).slice(0, 1800));
  return r;
};
const sql = (db, text, acceptFailure = false) =>
  cli(
    [
      'exec',
      '-i',
      source,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      db,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    text,
    acceptFailure,
  );
const snapshot = (db) =>
  JSON.parse(
    sql(
      db,
      `CREATE FUNCTION pg_temp.snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h; result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h)); END LOOP;RETURN result;END;$$;SELECT pg_temp.snapshot();`,
    )
      .stdout.trim()
      .split('\n')
      .at(-1),
  );
const checks = [];
const migration = await readFile(
  '../Novlearn/supabase/migrations/20261017171853_novlearn_admin_engine_archive_rotation.sql',
  'utf8',
);
const migrationBody = migration
  .replace(/\nBEGIN;\n/, '\n')
  .replace(/\nCOMMIT;\s*$/, '\n');
assert.notEqual(migration, migrationBody);
const baseline = {
  metadata: {
    runtime: {
      enabled: false,
      singleton: true,
      engine_contract: 'schema-5;engine-0.1.0',
      generation_version: 'mulberry32-rejection-v1',
      engine_archive_sha256:
        '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290',
      canonicalization_version: 'pg-jsonb-text-v1',
    },
  },
};
assert.equal(
  cli(['inspect', '--format', '{{.State.Running}}', source]).stdout.trim(),
  'false',
);
assert.equal(
  cli([
    'inspect',
    '--format',
    '{{.HostConfig.NetworkMode}}',
    source,
  ]).stdout.trim(),
  'none',
);
cli(['start', source]);
try {
  for (let attempt = 0; ; attempt++) {
    const r = cli(
      [
        'exec',
        source,
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
    );
    if (r.status === 0) break;
    assert(attempt < 25);
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    sql('postgres', 'SELECT count(*) FROM auth.users;').stdout.trim(),
    '0',
    'Fresh schema fixture must contain no account',
  );
  for (const file of [
    'scripts/test-receipts-local.sql',
    'scripts/test-editorial-review-local.sql',
  ]) {
    const r = sql('postgres', await readFile(file, 'utf8'));
    await writeFile(
      directory + '/fresh-' + path.basename(file) + '.log',
      r.stdout + r.stderr,
    );
    checks.push({
      name: 'Fresh 64 ' + file,
      assertions: (r.stderr.match(/NOTICE:  PASS:/g) || []).length,
    });
  }
  await writeFile(directory + '/source-63.dump', await readFile(baselineDump));
  cli(['cp', directory + '/source-63.dump', source + ':/tmp/source-63.dump']);
  // The original API login is not provisioned in this isolated cluster. An
  // inert NOLOGIN role preserves its ACL entries without importing credentials.
  sql(
    'postgres',
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='novlearn_admin_local_api') THEN CREATE ROLE novlearn_admin_local_api NOLOGIN NOINHERIT; END IF; END; $$;",
  );
  cli([
    'exec',
    source,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    copyDatabase,
  ]);
  cli([
    'exec',
    source,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    copyDatabase,
    '--single-transaction',
    '--exit-on-error',
    '/tmp/source-63.dump',
  ]);
  assert.equal(
    sql(
      copyDatabase,
      'SELECT engine_archive_sha256 FROM novlearn_admin_private.publication_runtime WHERE singleton;',
    ).stdout.trim(),
    baseline.metadata.runtime.engine_archive_sha256,
  );
  const review = await readFile(
    'scripts/test-editorial-review-local.sql',
    'utf8',
  );
  const marker =
    "PERFORM pg_temp.review_assert((SELECT editorial_status='approved' AND approved_by=actor AND approved_fingerprint_sha256=approval_fingerprint_sha256 FROM public.exercise_versions WHERE id=v),'approval binds current content and actual actor');";
  assert.equal(review.split(marker).length, 2);
  const fixture =
    review.slice(0, review.indexOf(marker) + marker.length) +
    '\nRESET ROLE;\nEND;\n$tests$;\nCOMMIT;\n';
  const setup = sql(copyDatabase, fixture);
  await writeFile(
    directory + '/historical-fixture.log',
    setup.stdout + setup.stderr,
  );
  const before = snapshot(copyDatabase);
  await writeFile(directory + '/before.json', JSON.stringify(before, null, 2));
  const attrs = () =>
    sql(
      copyDatabase,
      "SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid) FROM pg_proc p WHERE p.oid IN ('public.admin_record_exercise_test(text,text)'::regprocedure,'public.admin_review_exercise_version(uuid,text,bigint,text,text,uuid,jsonb,text)'::regprocedure,'public.admin_export_exercise_publication(uuid,text,bigint,jsonb)'::regprocedure);",
    ).stdout.trim();
  const attributesBefore = attrs();
  const refused = async (name, setup, message) => {
    const r = sql(
      copyDatabase,
      'BEGIN;\n' + setup + '\n' + migrationBody + '\nROLLBACK;',
      true,
    );
    await writeFile(directory + '/' + name + '.log', r.stdout + r.stderr);
    assert.notEqual(r.status, 0);
    assert(r.stderr.includes(message), name + ': expected exact guard');
    assert.deepEqual(snapshot(copyDatabase), before);
    assert.equal(attrs(), attributesBefore);
    checks.push({ name, refused: true, allRowsPreserved: true });
  };
  await refused(
    'enabled-runtime',
    'UPDATE novlearn_admin_private.publication_runtime SET enabled=true WHERE singleton;',
    'disabled reviewed runtime baseline',
  );
  await refused(
    'unknown-runtime',
    "UPDATE novlearn_admin_private.publication_runtime SET engine_archive_sha256=repeat('f',64) WHERE singleton;",
    'disabled reviewed runtime baseline',
  );
  await refused(
    'changed-contract',
    "UPDATE novlearn_admin_private.publication_runtime SET generation_version='unknown' WHERE singleton;",
    'disabled reviewed runtime baseline',
  );
  await refused(
    'pending-outcome',
    `INSERT INTO novlearn_admin_private.publication_operations(batch_id,actor_id,version_id,target_key,mode,source_fingerprint,source_epoch,source_snapshot,payload,inspection,plan_digest,state,expires_at)
 SELECT gen_random_uuid(),created_by,id,'rotation-fixture','publish',approval_fingerprint_sha256,test_epoch,'{}','{}','{}',repeat('a',64),'uncertain',now()+interval '1 hour' FROM public.exercise_versions WHERE definition->>'title'='LOCAL REVIEW FIXTURE' AND created_by='99100000-0000-4000-8000-000000000001';`,
    'Reconcile pending publication outcomes',
  );
  await refused(
    'changed-rpc-body',
    `DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.admin_record_exercise_test(text,text)'::regprocedure) INTO definition; EXECUTE replace(definition,'administrator access required','modified fixture body'); END; $$;`,
    'RPC body differs from reviewed baseline',
  );
  const applied = sql(copyDatabase, migration);
  await writeFile(directory + '/upgrade.log', applied.stdout + applied.stderr);
  const after = snapshot(copyDatabase);
  await writeFile(directory + '/after.json', JSON.stringify(after, null, 2));
  assert.equal(Object.keys(before).length, 62);
  assert.equal(attrs(), attributesBefore);
  const expected = structuredClone(before);
  delete expected['novlearn_admin_private.publication_runtime'];
  const actual = structuredClone(after);
  delete actual['novlearn_admin_private.publication_runtime'];
  assert.deepEqual(actual, expected);
  assert.equal(before['novlearn_admin_private.publication_runtime'].rows, 1);
  assert.equal(after['novlearn_admin_private.publication_runtime'].rows, 1);
  assert.deepEqual(
    JSON.parse(
      sql(
        copyDatabase,
        "SELECT to_jsonb(r)-'engine_archive_sha256' FROM novlearn_admin_private.publication_runtime r;",
      ).stdout.trim(),
    ),
    Object.fromEntries(
      Object.entries(baseline.metadata.runtime).filter(
        ([k]) => k !== 'engine_archive_sha256',
      ),
    ),
  );
  checks.push({
    name: 'Actual 63→64 upgrade on restored local data',
    tables: 62,
    unchangedTables: 61,
    onlyRowChange: 'private runtime archive',
    allFunctionAttributesPreserved: true,
  });
  for (const file of [
    'scripts/test-engine-rotation-local.sql',
    'scripts/test-receipts-local.sql',
    'scripts/test-editorial-review-local.sql',
  ]) {
    // Historic fixtures intentionally remain only in this isolated copy. The
    // existing fixed-ID suites run on pristine schema 64 instead of colliding.
    if (!file.includes('engine-rotation')) continue;
    const r = sql(copyDatabase, await readFile(file, 'utf8'), true);
    await writeFile(
      directory + '/' + path.basename(file) + '.log',
      r.stdout + r.stderr,
    );
    assert.equal(r.status, 0, 'Focused SQL tests failed; see retained log');
    assert.deepEqual(snapshot(copyDatabase), after);
    checks.push({
      name: file,
      assertions: (r.stderr.match(/NOTICE:  PASS:/g) || []).length,
      rolledBack: true,
    });
  }
  const twice = sql(copyDatabase, migration, true);
  await writeFile(
    directory + '/duplicate-upgrade.log',
    twice.stdout + twice.stderr,
  );
  assert.notEqual(twice.status, 0);
  assert(twice.stderr.includes('disabled reviewed runtime baseline'));
  assert.deepEqual(snapshot(copyDatabase), after);
  checks.push({ name: 'Second application refused atomically', refused: true });
  const proof = {
    result: 'PASS',
    date: new Date().toISOString(),
    directory,
    sourceContainer: source,
    copyDatabase,
    baselineDumpSha256: createHash('sha256')
      .update(await readFile(baselineDump))
      .digest('hex'),
    migration: '20261017171853_novlearn_admin_engine_archive_rotation.sql',
    migrationSha256: createHash('sha256').update(migration).digest('hex'),
    checks,
    before,
    after,
    applicationInstanceChanged: false,
    remoteChanged: false,
    nativeEngineExecution: false,
  };
  await writeFile(
    directory + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    '.local/lot1a/engine-rotation-qualified.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(JSON.stringify({ result: 'PASS', directory, checks }));
} finally {
  cli(['stop', '--timeout', '15', source]);
}
