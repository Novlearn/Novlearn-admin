// ACL and legitimate workflow regression only. No adversarial trigger probe.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [container, database] = process.argv.slice(2);
assert.match(
  container ?? '',
  /^novlearn-admin-lot1a-(replay|backup)-[0-9]{17}$/,
);
assert.match(
  database ?? '',
  /^(postgres|admin_backup_restore|admin_friend_trigger_[0-9]+)$/,
);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args) => {
  const result = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result;
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
assert.equal(
  cli(['inspect', '--format', '{{.State.Running}}', container]).stdout.trim(),
  'true',
);
const sql = (statement) =>
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
    '-c',
    statement,
  ]).stdout.trim();
const snapshot = () =>
  JSON.parse(
    sql(`CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $snapshot$
DECLARE t record; n bigint; hash text; result jsonb:='{}'; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY schemaname,tablename LOOP
EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,hash;
result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',hash)); END LOOP; RETURN result; END; $snapshot$;
SELECT pg_temp.all_rows();`)
      .split('\n')
      .at(-1),
  );
const before = snapshot();
cli([
  'cp',
  path.resolve('scripts/test-friend-trigger-local.sql'),
  container + ':/tmp/admin-friend-trigger-tests.sql',
]);
const result = cli([
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
  '/tmp/admin-friend-trigger-tests.sql',
]);
const checks = [...result.stderr.matchAll(/NOTICE:\s+PASS: ([^\r\n]+)/g)].map(
  (match) => match[1],
);
assert.equal(checks.length, 6);
const after = snapshot();
assert.deepEqual(after, before);
const artifact = path.resolve('.local/lot1a/friend-trigger-' + Date.now());
await mkdir(artifact, { recursive: true });
await writeFile(
  path.join(artifact, 'test.log'),
  result.stdout + '\n' + result.stderr,
);
await writeFile(
  path.join(artifact, 'proof.json'),
  JSON.stringify(
    {
      result: 'PASS',
      container,
      database,
      checks,
      tableCount: Object.keys(before).length,
      before,
      after,
      sequenceValuesCompared: false,
      scope:
        'Local ACL inspection and legitimate Auth/friend-request workflows. Fixture transaction rolled back. No adversarial probe or remote connection.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'PASS: ' +
    checks.length +
    ' ACL/workflow checks and ' +
    Object.keys(before).length +
    ' unchanged table snapshots; proof=' +
    artifact,
);
