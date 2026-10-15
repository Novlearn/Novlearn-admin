// Retained synthetic clones only. Ordinary SQL regression and editing concurrency.
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [container, databaseSource] = process.argv.slice(2);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-[0-9]{17}$/);
assert.match(databaseSource ?? '', /^admin_taxonomy_[0-9]+$/);
const previous = { container, database: databaseSource };
const docker = path.join(
    process.env.LOCALAPPDATA,
    'Programs/DockerDesktop/resources/bin/docker.exe',
  ),
  endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const cli = (args) => {
  const r = spawnSync(docker, ['--host', endpoint, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
  return r;
};
const sqlArgs = (db, statement) => [
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
const sql = (db, statement) => cli(sqlArgs(db, statement)).stdout.trim();
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
if (!wasRunning) cli(['start', container]);
const stamp = Date.now(),
  artifact = '.local/lot1a/taxonomy-regression-' + stamp;
await mkdir(artifact, { recursive: true });
try {
  for (let i = 0; i < 30; i++) {
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
        previous.database,
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    if (r.status === 0) break;
    if (i === 29) throw Error('Postgres not ready');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const regressions = [];
  for (const [name, count] of [
    ['test-catalogue-local', 48],
    ['test-receipts-local', 21],
    ['test-editorial-review-local', 43],
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
      previous.database,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '/tmp/' + name + '.sql',
    ]);
    await writeFile(artifact + '/' + name + '.log', r.stdout + '\n' + r.stderr);
    const summary = r.stdout.split('\n').find((line) => line.startsWith('{'));
    const actual = summary
      ? Object.entries(JSON.parse(summary)).find(([key]) =>
          key.endsWith('Assertions'),
        )?.[1]
      : [...r.stderr.matchAll(/PASS:/g)].length;
    assert.equal(actual, count, name);
    regressions.push({ name, count, result: 'PASS' });
    console.log('PASS: ' + name + ' ' + count);
  }
  const database = 'admin_taxonomy_race_' + stamp;
  sql('postgres', `CREATE DATABASE ${database} TEMPLATE ${previous.database}`);
  const actor = 'a5700000-0000-4000-8000-000000000099';
  const identity = `SELECT set_config('request.jwt.claim.sub','${actor}',true);SELECT set_config('request.jwt.claims','{"sub":"${actor}","is_anonymous":false}',true);SET LOCAL ROLE authenticated;`;
  const output = sql(
    database,
    `BEGIN;INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES('${actor}','authenticated','authenticated','taxonomy-race@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"LOCAL RACE FIXTURE","birth_date":"2000-01-01"}',now(),now());UPDATE public.profiles SET role='admin' WHERE id='${actor}';${identity}SELECT public.admin_mutate_taxonomy('chapter','save',NULL,NULL,'{"name":"LOCAL CONCURRENT CHAPTER","aliases":[],"emoji":"","order_index":0}');COMMIT;`,
  );
  const item = JSON.parse(
    output.split('\n').find((line) => line.startsWith('{"id"')),
  ).item;
  const run = (order) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        docker,
        [
          '--host',
          endpoint,
          ...sqlArgs(
            database,
            `BEGIN;${identity}SELECT public.admin_mutate_taxonomy('chapter','save','${item.id}','${item.fingerprint}','{"name":"LOCAL CONCURRENT CHAPTER","aliases":[],"emoji":"","order_index":${order}}');COMMIT;`,
          ),
        ],
        { windowsHide: true, timeout: 30000 },
      );
      let out = '',
        err = '';
      child.stdout.on('data', (v) => (out += v));
      child.stderr.on('data', (v) => (err += v));
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, out, err }));
    });
  const results = await Promise.all([run(1), run(2)]);
  await writeFile(
    artifact + '/concurrency.log',
    JSON.stringify(results, null, 2),
  );
  assert.equal(results.filter((r) => r.code === 0).length, 1);
  assert.equal(
    results.filter((r) => r.code !== 0 && r.err.includes('40001')).length,
    1,
  );
  const state = JSON.parse(
    sql(
      database,
      `SELECT jsonb_build_object('epoch',(SELECT admin_epoch FROM public.chapters WHERE id='${item.id}'),'events',(SELECT count(*) FROM public.admin_taxonomy_events WHERE entity_id='${item.id}'),'order',(SELECT order_index FROM public.chapters WHERE id='${item.id}'));`,
    ),
  );
  assert.equal(state.epoch, 1);
  assert.equal(state.events, 2);
  assert([1, 2].includes(state.order));
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(
      {
        result: 'PASS',
        container,
        database,
        regressions,
        concurrency: { commits: 1, conflicts40001: 1, state },
        scope:
          'Ordinary CRUD concurrency in a new local synthetic clone; not an adversarial security probe or live Auth test',
        remoteWrites: false,
        existingDataDeleted: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS: concurrent ordinary edits produce one commit and one conflict; proof=' +
      artifact,
  );
} finally {
  if (!wasRunning) cli(['stop', '--timeout', '15', container]);
}
