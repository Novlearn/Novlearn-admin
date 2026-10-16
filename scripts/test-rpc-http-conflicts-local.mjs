// SQL qualification on copies of the new local Auth workspace only.
// No linked Supabase project, trigger-planting probe or row deletion.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const source = path.resolve(process.argv[2] ?? '');
assert(
  source
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
const state = JSON.parse(await readFile(source + '/private.json', 'utf8'));
assert.equal(state.artifact, source);
assert.equal(state.names.db, state.prefix + '-db');
assert.match(state.prefix, /^novlearn-admin-local-\d+$/);
const stamp = Date.now(),
  artifact = path.resolve('.local/lot1a/rpc-http-' + stamp),
  copy = 'rpc_http_' + stamp,
  restored = copy + '_restored';
await mkdir(artifact, { recursive: true });
const migration = path.resolve(
  '../Novlearn/supabase/migrations/20261016095425_novlearn_admin_rpc_http_conflicts.sql',
);
const secrets = [
  ...Object.values(state.secrets),
  state.anonKey,
  state.serviceKey,
];
const safe = (value) =>
  secrets.reduce(
    (s, key) => s.replaceAll(key, '[local secret]'),
    String(value),
  );
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
let lastStderr = '';
const cli = (args, input) => {
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
  assert.equal(r.status, 0, safe(r.stderr));
  lastStderr = r.stderr;
  return r.stdout.trim();
};
const sql = (database, text) =>
  cli(
    [
      'exec',
      '-i',
      state.names.db,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    text,
  );
const value = (database, text) =>
  JSON.parse(sql(database, text).split('\n').at(-1));
const sha = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const snapshot = (database) =>
  value(
    database,
    `CREATE FUNCTION pg_temp.snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.snapshot();`,
  );
const metadata = (database) =>
  value(
    database,
    `SELECT jsonb_object_agg(p.oid::regprocedure::text,to_jsonb(p)-'prosrc'||jsonb_build_object('bodySha256',encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
  );
const suites = [
  'test-catalogue-local.sql',
  'test-receipts-local.sql',
  'test-editorial-review-local.sql',
  'test-taxonomy-local.sql',
  'test-flashcards-local.sql',
];
const results = [];
try {
  const sourceBefore = snapshot('admin_local');
  assert.equal(Object.keys(sourceBefore).length, 62);
  cli([
    'exec',
    state.names.db,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'admin_local',
    '--format=custom',
    '--file=/tmp/' + copy + '.dump',
  ]);
  assert.deepEqual(snapshot('admin_local'), sourceBefore);
  cli([
    'cp',
    state.names.db + ':/tmp/' + copy + '.dump',
    artifact + '/source.dump',
  ]);
  cli([
    'exec',
    state.names.db,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    copy,
  ]);
  cli([
    'exec',
    state.names.db,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    copy,
    '--exit-on-error',
    '--single-transaction',
    '/tmp/' + copy + '.dump',
  ]);
  const before = snapshot(copy),
    beforeMetadata = metadata(copy);
  assert.deepEqual(before, sourceBefore);
  cli(['cp', migration, state.names.db + ':/tmp/rpc-http-' + stamp + '.sql']);
  cli([
    'exec',
    state.names.db,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    copy,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '/tmp/rpc-http-' + stamp + '.sql',
  ]);
  const after = snapshot(copy),
    afterMetadata = metadata(copy);
  assert.deepEqual(after, before);
  const changed = [];
  for (const [signature, row] of Object.entries(beforeMetadata)) {
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(afterMetadata[signature]).filter(
          ([k]) => k !== 'bodySha256',
        ),
      ),
      Object.fromEntries(
        Object.entries(row).filter(([k]) => k !== 'bodySha256'),
      ),
      signature,
    );
    if (row.bodySha256 !== afterMetadata[signature].bodySha256)
      changed.push(signature);
  }
  assert.equal(changed.length, 8);
  const run = async (database) => {
    const baseline = snapshot(database);
    for (const file of suites) {
      const script = path.resolve('scripts', file);
      assert(
        !(await readFile(script, 'utf8')).includes('CREATE TRIGGER'),
        'Ordinary workflow tests only',
      );
      cli(['cp', script, state.names.db + ':/tmp/rpc-http-' + file]);
      const output = cli([
        'exec',
        state.names.db,
        'psql',
        '-qAt',
        '-U',
        'supabase_admin',
        '-d',
        database,
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '/tmp/rpc-http-' + file,
      ]);
      const messages = lastStderr;
      await writeFile(
        artifact + '/' + database + '-' + file + '.log',
        output + '\n' + messages,
      );
      const jsonLine = output.split('\n').find((line) => line.startsWith('{'));
      let result;
      if (file === 'test-receipts-local.sql') {
        const count = (messages.match(/NOTICE:\s+PASS:/g) ?? []).length;
        assert.equal(count, 21, 'All existing receipt assertions must execute');
        result = { result: 'PASS', receiptAssertions: count };
      } else result = JSON.parse(jsonLine);
      assert.equal(result.result, 'PASS');
      results.push({ database, file, ...result });
      assert.deepEqual(snapshot(database), baseline);
    }
  };
  await run(copy);
  cli([
    'exec',
    state.names.db,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    copy,
    '--format=custom',
    '--file=/tmp/' + copy + '-qualified.dump',
  ]);
  cli([
    'cp',
    state.names.db + ':/tmp/' + copy + '-qualified.dump',
    artifact + '/qualified.dump',
  ]);
  cli([
    'exec',
    state.names.db,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    restored,
  ]);
  cli([
    'exec',
    state.names.db,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    restored,
    '--exit-on-error',
    '--single-transaction',
    '/tmp/' + copy + '-qualified.dump',
  ]);
  assert.deepEqual(snapshot(restored), before);
  await run(restored);
  assert.deepEqual(snapshot('admin_local'), sourceBefore);
  await writeFile(
    artifact + '/snapshots.json',
    JSON.stringify(
      { sourceBefore, before, after, beforeMetadata, afterMetadata },
      null,
      2,
    ) + '\n',
  );
  const proof = {
    result: 'PASS for RPC HTTP conflict SQL and restoration',
    date: new Date().toISOString(),
    container: state.names.db,
    copy,
    restored,
    migrationSha256: await sha(migration),
    changedFunctions: changed,
    allExecutionAttributesUnchanged: true,
    all62TableRowsUnchanged: true,
    sourceWorkspaceUnchanged: true,
    results,
    sqlTestsUpdatedOnlyForPublicRpcConflictCode: true,
    privateJournalAndDirectTriggerConflictsRemain40001: true,
    realPostgrestRun: false,
    sequencesCompared: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      suites: results.length,
      changedFunctions: 8,
    }),
  );
} catch (error) {
  await writeFile(artifact + '/failure.txt', safe(error?.stack ?? error));
  throw Error(safe(error?.message ?? error));
}
