import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const container = process.argv[2];
assert.match(
  container ?? '',
  /^novlearn-admin-lot1a-replay-[0-9]{17}$/,
  'Only a local synthetic replay container is accepted',
);
const executable = join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const database = `admin_catalogue_race_${Date.now()}`;
const administrator = '92000000-0000-0000-0000-000000000001';
const definition = {
  schemaVersion: 5,
  kind: 'composed',
  id: 'race-draft',
  revision: '1',
  title: 'LOCAL CONCURRENCY TEST',
  generation: {
    schemaVersion: 5,
    definitions: [],
    constraints: [],
    maxAttempts: 100,
    maxDraws: 1000,
  },
  variables: [],
  elements: [],
};
const literal = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['--host', endpoint, ...args], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let errors = '';
    child.stdout.on('data', (value) => {
      output += value;
    });
    child.stderr.on('data', (value) => {
      errors += value;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output, errors }));
    child.stdin.end(input);
  });
}
async function checked(args, input = '') {
  const result = await docker(args, input);
  assert.equal(result.code, 0, result.errors);
  return result.output.trim();
}
const sql = (input) =>
  docker(
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
    input,
  );
function identity() {
  return `SELECT set_config('request.jwt.claim.sub','${administrator}',false);
    SELECT set_config('request.jwt.claims','{"sub":"${administrator}","is_anonymous":false}',false);
    SET LOCAL ROLE authenticated;`;
}
function resultObject(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .find((value) => Object.hasOwn(value, 'exerciseId'));
}
const running = await checked([
  'inspect',
  '--format',
  '{{.State.Running}}',
  container,
]);
const started = running !== 'true';
try {
  if (started) await checked(['start', container]);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (
      (
        await docker([
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'supabase_admin',
        ])
      ).code === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(ready, 'Synthetic replay is not ready');
  // Logical copy into a NEW fixture DB. The source may have background sessions;
  // never terminate them, reset their database, or loosen the race assertions.
  const archive = `/tmp/${database}.dump`;
  await checked([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '--format=custom',
    `--file=${archive}`,
  ]);
  await checked([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    database,
  ]);
  await checked([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    database,
    '--single-transaction',
    '--exit-on-error',
    archive,
  ]);
  const setup = await sql(`BEGIN;
    INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      VALUES('${administrator}','authenticated','authenticated','race-admin@fixture.test','',now(),
        '{"provider":"email","providers":["email"]}','{"first_name":"LOCAL RACE TEST","birth_date":"2000-01-01"}',now(),now());
    UPDATE public.profiles SET role='admin' WHERE id='${administrator}';
    ${identity()}
    SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,${literal(definition)});
    COMMIT;`);
  assert.equal(setup.code, 0, setup.errors);
  const created = resultObject(setup.output);
  assert(created);
  assert.match(created.exerciseId, /^[1-9]\d*$/);
  assert.match(created.versionId, /^[0-9a-f-]{36}$/);
  assert.match(created.fingerprint, /^[0-9a-f]{64}$/);
  function mutation(version, fingerprint, title) {
    return `\\set VERBOSITY verbose
      SET statement_timeout='10s';SET idle_in_transaction_session_timeout='15s';BEGIN;
      ${identity()}
      SELECT public.admin_save_exercise_draft(${created.exerciseId},${version ? `'${version}'` : 'NULL'},${fingerprint ? `'${fingerprint}'` : 'NULL'},${literal({ ...definition, title })});
      SELECT pg_sleep(0.2);COMMIT;`;
  }
  const saves = await Promise.all([
    sql(mutation(created.versionId, created.fingerprint, 'RACE EDITOR A')),
    sql(mutation(created.versionId, created.fingerprint, 'RACE EDITOR B')),
  ]);
  assert.equal(
    saves.filter((result) => result.code === 0).length,
    1,
    'Exactly one competing stale save must commit',
  );
  const loser = saves.find((result) => result.code !== 0);
  assert.match(
    loser.errors,
    /ERROR:\s+PT409:/,
    'The losing writer must get the concurrency SQLSTATE, not an arbitrary failure',
  );
  const winner = resultObject(saves.find((result) => result.code === 0).output);
  assert(winner);
  const revisionWrites = await Promise.all([
    sql(mutation(null, null, 'RACE REVISION A')),
    sql(mutation(null, null, 'RACE REVISION B')),
  ]);
  for (const result of revisionWrites)
    assert.equal(result.code, 0, result.errors);
  const revisions = revisionWrites
    .map((result) => resultObject(result.output).revision)
    .sort();
  assert.deepEqual(
    revisions,
    [2, 3],
    'Parallel new revisions must receive unique sequential numbers',
  );
  const inspection = await sql(`SELECT jsonb_build_object(
    'versions',(SELECT count(*) FROM public.exercise_versions WHERE exercise_id=${created.exerciseId}),
    'events',(SELECT count(*) FROM public.admin_content_events WHERE exercise_id=${created.exerciseId}),
    'savedFingerprint',(SELECT approval_fingerprint_sha256 FROM public.exercise_versions WHERE id='${created.versionId}'),
    'approved',(SELECT count(*) FROM public.exercise_versions WHERE exercise_id=${created.exerciseId} AND editorial_status<>'draft')
  );`);
  assert.equal(inspection.code, 0, inspection.errors);
  const state = JSON.parse(inspection.output.trim());
  assert.equal(state.versions, 3);
  assert.equal(
    state.events,
    4,
    'Losing transaction must not leave an audit event',
  );
  assert.equal(state.savedFingerprint, winner.fingerprint);
  assert.equal(state.approved, 0);
  console.log(
    JSON.stringify({
      result: 'PASS',
      competingSaves: { committed: 1, refusedWithSqlstate: 'PT409' },
      parallelRevisions: revisions,
      auditEvents: state.events,
      sourceDatabaseUnchanged: true,
      fixtureDatabase: database,
    }),
  );
} finally {
  // Preserve the fixture database/volume, restore only the initial running state.
  if (started) await checked(['stop', '--timeout', '15', container]);
}
