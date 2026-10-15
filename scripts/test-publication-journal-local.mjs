// Ordinary local workflow tests only. No target connection, trigger-planting
// probe or security-policy workaround. Every database is a retained fixture.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [nativePath] = process.argv.slice(2);
assert.match(
  nativePath ?? '',
  /^\.local\/lot1a\/receipt-native-flow-\d+\/proof\.json$/,
);
const native = JSON.parse(await readFile(nativePath, 'utf8'));
assert.equal(native.result, 'PASS');
assert.equal(native.report.passed, true);
assert.equal(native.editorialStatus, 'approved');
const container = native.sourceContainer,
  source = native.database,
  actor = native.stored.actor,
  version = native.versionId;
assert.match(container, /^novlearn-admin-lot1a-replay-\d{17}$/);
assert.match(source, /^admin_receipt_native_\d+$/);
assert.match(actor, /^[0-9a-f-]{36}$/);
assert.match(version, /^[0-9a-f-]{36}$/);
const docker = path.join(
    process.env.LOCALAPPDATA,
    'Programs/DockerDesktop/resources/bin/docker.exe',
  ),
  endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const stamp = Date.now(),
  database = 'admin_publication_journal_' + stamp,
  restored = database + '_restored';
const artifact = path.resolve('.local/lot1a/publication-journal-' + stamp);
await mkdir(artifact, { recursive: true });
const cli = (args, allowFailure = false) => {
  const r = spawnSync(docker, ['--host', endpoint, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  if (!allowFailure) assert.equal(r.status, 0, r.stderr);
  return r;
};
const args = (db, statement) => [
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
  '-v',
  'VERBOSITY=verbose',
  '-c',
  statement,
];
const sql = (db, statement) => cli(args(db, statement)).stdout.trim();
const values = (text) =>
  text
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
const value = (db, statement) => values(sql(db, statement)).at(-1);
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`;
const obj = (value) => literal(JSON.stringify(value)) + '::jsonb';
const backend =
  'SET SESSION AUTHORIZATION novlearn_publication_journal_executor;';
const snapshot = (db) =>
  JSON.parse(
    sql(
      db,
      `CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.all_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const wasRunning =
  cli([
    'inspect',
    '--format',
    '{{.State.Running}}',
    container,
  ]).stdout.trim() === 'true';
assert.equal(
  cli([
    'inspect',
    '--format',
    '{{.HostConfig.NetworkMode}}',
    container,
  ]).stdout.trim(),
  'none',
);
if (!wasRunning) cli(['start', container]);
try {
  for (let i = 0; i < 30; i++) {
    const r = cli(
      [
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
      true,
    );
    if (r.status === 0) break;
    if (i === 29) throw Error('PostgreSQL not ready');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const before = snapshot(source);
  assert.equal(
    sql(
      source,
      "SELECT to_regprocedure('novlearn_admin_private.lock_publication_source(uuid,uuid,text)') IS NOT NULL",
    ),
    't',
  );
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
  assert.deepEqual(snapshot(database), before);
  cli([
    'cp',
    path.resolve('scripts/test-publication-journal-local.sql'),
    container + ':/tmp/publication-journal-tests.sql',
  ]);
  const run = async (db) => {
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
      '-v',
      `actor=${actor}`,
      '-v',
      `version=${version}`,
      '-f',
      '/tmp/publication-journal-tests.sql',
    ]);
    await writeFile(
      path.join(artifact, db + '-tests.log'),
      r.stdout + '\n' + r.stderr,
    );
    const rows = values(r.stdout),
      summary = rows.find((row) => row.result === 'PASS'),
      sample = rows.find((row) => row.state === 'committed');
    assert.equal(summary?.journalAssertions, 41);
    assert(sample);
    assert.deepEqual(snapshot(db), before);
    return { summary, sample };
  };
  const first = await run(database);
  await writeFile(
    path.join(artifact, 'operation-sample.json'),
    JSON.stringify(first.sample, null, 2) + '\n',
  );
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
  assert.deepEqual((await run(restored)).summary, first.summary);
  const regressions = [];
  for (const [name, count] of [
    ['test-catalogue-local', 48],
    ['test-receipts-local', 21],
    ['test-editorial-review-local', 43],
    ['test-taxonomy-local', 39],
    ['test-flashcards-local', 38],
    ['test-dashboard-local', 35],
  ]) {
    cli([
      'cp',
      path.resolve('scripts/' + name + '.sql'),
      container + ':/tmp/' + name + '.sql',
    ]);
    const r = cli([
      'exec',
      container,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      restored,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '/tmp/' + name + '.sql',
    ]);
    await writeFile(
      path.join(artifact, name + '.log'),
      r.stdout + '\n' + r.stderr,
    );
    const row = values(r.stdout).find((v) => v.result === 'PASS');
    const actual = row
      ? Object.entries(row).find(([key]) => key.endsWith('Assertions'))?.[1]
      : (r.stderr.match(/PASS:/g) ?? []).length;
    assert.equal(actual, count, name);
    assert.deepEqual(snapshot(restored), before);
    regressions.push({ name, count, result: 'PASS' });
  }
  // Independent sessions on a retained clone test claims and a source connection
  // closing while the durable guard must remain. No target write is attempted.
  const sample = first.sample;
  const prepare = () =>
    value(
      database,
      backend +
        `SELECT novlearn_admin_private.prepare_publication_operation('${actor}',gen_random_uuid(),'${version}','${sample.source_fingerprint}',${sample.source_epoch},${obj(JSON.parse(sample.payload.definitionJson))},'local-target','publish',${obj(sample.inspection)});`,
    );
  const a = prepare(),
    b = prepare();
  const claim = (op) =>
    backend +
    `SELECT novlearn_admin_private.claim_publication_operation('${actor}','${op.id}','${op.plan_digest}','claim');`;
  const runAsync = (statement) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        docker,
        ['--host', endpoint, ...args(database, statement)],
        {
          windowsHide: true,
          timeout: 30000,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (b) => (stdout += b));
      child.stderr.on('data', (b) => (stderr += b));
      child.once('error', reject);
      child.once('close', (status) => resolve({ status, stdout, stderr }));
    });
  const race = await Promise.all([runAsync(claim(a)), runAsync(claim(b))]);
  await writeFile(
    path.join(artifact, 'claim-race.json'),
    JSON.stringify(race, null, 2) + '\n',
  );
  assert.equal(race.filter((r) => r.status === 0).length, 1);
  assert.equal(
    race.filter((r) => r.status !== 0 && /ERROR:\s+40001:/.test(r.stderr))
      .length,
    1,
  );
  const winner = race[0].status === 0 ? a : b,
    loser = winner === a ? b : a;
  const keyId = sql(
    database,
    `SELECT key_id FROM public.admin_exercise_test_runs WHERE id='${sample.source_snapshot.receiptId}'`,
  );
  const holder = spawn(
    docker,
    [
      '--host',
      endpoint,
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
    { windowsHide: true, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let heldOutput = '',
    heldError = '';
  holder.stdout.on('data', (b) => (heldOutput += b));
  holder.stderr.on('data', (b) => (heldError += b));
  const closed = new Promise((resolve, reject) => {
    holder.once('error', reject);
    holder.once('close', resolve);
  });
  try {
    holder.stdin.write(
      `BEGIN; SET LOCAL idle_in_transaction_session_timeout='20s'; SET LOCAL ROLE novlearn_publication_journal_executor;SELECT novlearn_admin_private.lock_publication_source('${actor}','${winner.id}','${winner.plan_digest}');SELECT 'SOURCE_GUARD_HELD';\n`,
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error('Source guard not observed')),
        10000,
      );
      const observe = () => {
        if (heldOutput.includes('SOURCE_GUARD_HELD')) {
          clearTimeout(timeout);
          holder.stdout.off('data', observe);
          resolve();
        }
      };
      holder.stdout.on('data', observe);
      observe();
    });
    const blocked = cli(
      args(
        database,
        `BEGIN;SET LOCAL lock_timeout='150ms';UPDATE novlearn_admin_private.test_signing_keys SET enabled=enabled WHERE id='${keyId}';ROLLBACK;`,
      ),
      true,
    );
    await writeFile(
      path.join(artifact, 'held-source-key.log'),
      blocked.stdout + '\n' + blocked.stderr,
    );
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /ERROR:\s+55P03:/);
  } finally {
    holder.stdin.end('ROLLBACK;\n');
    assert.equal(await closed, 0, heldError);
    await writeFile(
      path.join(artifact, 'source-holder.log'),
      heldOutput + '\n' + heldError,
    );
  }
  const archive = `BEGIN;SELECT set_config('request.jwt.claim.sub','${actor}',true);SELECT set_config('request.jwt.claims','{"sub":"${actor}","is_anonymous":false}',true);SET LOCAL ROLE authenticated;SELECT public.admin_archive_exercise((SELECT exercise_id FROM public.exercise_versions WHERE id='${version}'),false,true);ROLLBACK;`;
  const afterClose = cli(args(database, archive), true);
  await writeFile(
    path.join(artifact, 'durable-after-close.log'),
    afterClose.stdout + '\n' + afterClose.stderr,
  );
  assert.notEqual(afterClose.status, 0);
  assert.match(afterClose.stderr, /ERROR:\s+40001:/);
  value(
    database,
    backend +
      `SELECT novlearn_admin_private.record_publication_outcome('${winner.id}','${winner.plan_digest}','executing','uncertain',NULL,NULL);`,
  );
  const uncertain = cli(args(database, archive), true);
  assert.notEqual(uncertain.status, 0);
  assert.match(uncertain.stderr, /ERROR:\s+40001:/);
  // Known not applied: this harness never contacted any target.
  value(
    database,
    backend +
      `SELECT novlearn_admin_private.record_publication_outcome('${winner.id}','${winner.plan_digest}','uncertain','failed',NULL,'not_applied');`,
  );
  value(
    database,
    backend +
      `SELECT novlearn_admin_private.claim_publication_operation('${actor}','${loser.id}','${loser.plan_digest}','cancel');`,
  );
  cli(args(database, archive));
  // Persist a genuinely uncertain operation, restart this exclusively owned
  // fixture when possible, then restore its real rows/events and durable guard.
  const pending = prepare();
  value(database, claim(pending));
  value(
    database,
    backend +
      `SELECT novlearn_admin_private.record_publication_outcome('${pending.id}','${pending.plan_digest}','executing','uncertain',NULL,NULL);`,
  );
  const pendingBefore = snapshot(database);
  let restartTested = false;
  if (!wasRunning) {
    cli(['restart', '--timeout', '15', container]);
    for (let attempt = 0; attempt < 30; attempt++) {
      const ready = cli(
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'supabase_admin',
          '-d',
          database,
        ],
        true,
      );
      if (ready.status === 0) break;
      if (attempt === 29)
        throw Error('PostgreSQL not ready after owned fixture restart');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.deepEqual(snapshot(database), pendingBefore);
    const blocked = cli(args(database, archive), true);
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /ERROR:\s+40001:/);
    restartTested = true;
  }
  const pendingRestored = database + '_pending';
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '--format=custom',
    `--file=/tmp/${pendingRestored}.dump`,
  ]);
  cli([
    'cp',
    `${container}:/tmp/${pendingRestored}.dump`,
    path.join(artifact, 'pending-operations.dump'),
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '-T',
    'template0',
    pendingRestored,
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    pendingRestored,
    '--exit-on-error',
    `/tmp/${pendingRestored}.dump`,
  ]);
  assert.deepEqual(snapshot(pendingRestored), pendingBefore);
  const pendingBlocked = cli(args(pendingRestored, archive), true);
  await writeFile(
    path.join(artifact, 'pending-restored-guard.log'),
    pendingBlocked.stdout + '\n' + pendingBlocked.stderr,
  );
  assert.notEqual(pendingBlocked.status, 0);
  assert.match(pendingBlocked.stderr, /ERROR:\s+40001:/);
  // No target was contacted, so not_applied is known in both independent copies.
  for (const db of [database, pendingRestored]) {
    value(
      db,
      backend +
        `SELECT novlearn_admin_private.record_publication_outcome('${pending.id}','${pending.plan_digest}','uncertain','failed',NULL,'not_applied');`,
    );
    cli(args(db, archive));
  }
  const after = snapshot(database);
  for (const [table, rows] of Object.entries(before))
    if (
      ![
        'novlearn_admin_private.publication_operations',
        'novlearn_admin_private.publication_operation_events',
      ].includes(table)
    )
      assert.deepEqual(after[table], rows, table);
  assert.deepEqual(snapshot(source), before);
  await writeFile(
    path.join(artifact, 'data-snapshots.json'),
    JSON.stringify({ source: before, cloneAfterFixtures: after }, null, 2) +
      '\n',
  );
  const proof = {
    result: 'PASS',
    container,
    source,
    database,
    restored,
    nativeProof: nativePath,
    nativeProofSha256: createHash('sha256')
      .update(await readFile(nativePath))
      .digest('hex'),
    assertionsBeforeAndAfterRestore: 41,
    tableCount: Object.keys(before).length,
    sourceUnchanged: true,
    fixtureRowsRolledBack: true,
    restoreRowsMatched: true,
    regressions,
    concurrency: { commits: 1, conflicts40001: 1 },
    sourceGuard: {
      signingKeyLockObserved: true,
      durableAfterConnectionClose: true,
      durableWhileUncertain: true,
      releasedAfterKnownNotApplied: true,
    },
    pendingPersistence: {
      restartTested,
      rowsAndEventsRestored: true,
      guardRestored: true,
      restoredDatabase: pendingRestored,
      dumpSha256: createHash('sha256')
        .update(await readFile(path.join(artifact, 'pending-operations.dump')))
        .digest('hex'),
    },
    businessTablesPreserved: Object.keys(before).length - 2,
    sequencesCompared: false,
    scope:
      'Actual journal/locking protocol in isolated local synthetic databases; outcomes inside SQL fixtures are simulated; no target transfer, live Auth or complete confinement certification',
  };
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    'PASS: 41 journal SQL assertions before/after restore, six regressions, concurrent claim and durable source guard; proof=' +
      artifact,
  );
} catch (error) {
  await writeFile(path.join(artifact, 'failure.txt'), String(error));
  throw error;
} finally {
  if (!wasRunning) cli(['stop', '--timeout', '15', container]);
}
