// Exercise the restored capability inside a rolled-back synthetic transaction.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const container = process.argv[2];
assert.match(container ?? '', /^novlearn-admin-lot1a-backup-[0-9]{17}$/);
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
      timeout: 30000,
      maxBuffer: 16777216,
      windowsHide: true,
    },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
assert.equal(
  cli(['inspect', '--format', '{{.HostConfig.NetworkMode}}', container]),
  'none',
);
assert.equal(
  cli(['inspect', '--format', '{{.State.Running}}', container]),
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
    'admin_backup_restore',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    statement,
  ]);
const value = (statement) => JSON.parse(sql(statement).split('\n').at(-1));
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text).toString('base64')}','base64'),'UTF8')`;
const fixture = JSON.parse(
  await readFile(
    new URL('../tests/fixtures/publication-sql.json', import.meta.url),
    'utf8',
  ),
);
const payload = literal(JSON.stringify(fixture.payload)) + '::jsonb';
const snapshot = () =>
  value(`CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $snapshot$
DECLARE t record; n bigint; hash text; result jsonb:='{}'; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY schemaname,tablename LOOP
EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,hash;
result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',hash)); END LOOP; RETURN result; END; $snapshot$;
SELECT pg_temp.all_rows();`);
const before = snapshot();
const result = value(`BEGIN;
INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('a5530000-0000-4000-8000-000000000001','LOCAL PUBLICATION CHAPTER',990,'{}');
INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('restored-publication-target-skill','LOCAL PUBLICATION SKILL','a5530000-0000-4000-8000-000000000001',10);
UPDATE novlearn_admin_private.publication_runtime SET enabled=true WHERE singleton;
SET SESSION AUTHORIZATION novlearn_publication_executor;
WITH inspected AS MATERIALIZED (SELECT public.inspect_exercise_publication(${payload},'publish') AS data)
SELECT public.apply_exercise_publication(${payload},data->'state'->>'stateToken','publish') FROM inspected;
ROLLBACK;`);
assert.equal(result.result, 'published');
assert.equal(result.businessDigest, fixture.payload.businessDigest);
assert.equal(
  result.target.active.businessDigest,
  fixture.payload.businessDigest,
);
assert.deepEqual(result.target.parent.competences, [
  'restored-publication-target-skill',
]);
const after = snapshot();
assert.deepEqual(after, before);
const artifact = path.resolve(
  '.local/lot1a/publication-restored-' + Date.now(),
);
await mkdir(artifact, { recursive: true });
await writeFile(
  path.join(artifact, 'proof.json'),
  JSON.stringify(
    {
      result: 'PASS',
      scope:
        'Restored local SQL capability; fixture transaction rolled back, no real Auth or remote connection',
      container,
      assertions: 5,
      businessDigest: result.businessDigest,
      target: result.target,
      tableCount: Object.keys(before).length,
      before,
      after,
      sequenceValuesCompared: false,
      reason:
        'PostgreSQL nextval is not transactional; row integrity is checked here, backup sequence integrity was checked separately before this fixture',
      remoteWrites: false,
      existingDataDeleted: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'PASS: 5 restored publication assertions, all ' +
    Object.keys(before).length +
    ' table snapshots unchanged after fixture rollback; proof=' +
    artifact,
);
