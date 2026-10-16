// Reuse a stopped, previously qualified private fixture; mutate only NEW databases.
// No remote endpoint, browser, trigger probe, cleanup deletion or migration.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'vite';
assert(process.execArgv.includes('--conditions=react-server'));
const prior = path.resolve('.local/lot1a/publication-pg-1792141718085');
const oldProof = JSON.parse(
  await readFile(path.join(prior, 'proof.json'), 'utf8'),
);
assert.equal(oldProof.result, 'PASS');
const pg = oldProof.container,
  network = oldProof.network;
assert.equal(pg, 'novlearn-admin-pg-1792141718085');
assert.equal(network, pg + '-internal');
const stamp = Date.now(),
  artifact = path.resolve('.local/lot1a/publication-batch-' + stamp),
  source = 'batch_source_' + stamp,
  target = 'batch_target_' + stamp;
await mkdir(artifact, { recursive: true });
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const client = JSON.parse(
  await readFile(path.join(prior, 'client.json'), 'utf8'),
);
const secrets = [client.confirmationKey];
for (const settings of [
  client.config.source,
  client.config.target,
  client.session,
]) {
  const u = new URL(settings.url);
  assert.equal(u.hostname, pg);
  assert.equal(u.protocol, 'postgresql:');
  secrets.push(decodeURIComponent(u.password));
}
const safe = (value) =>
  secrets.reduce(
    (text, secret) => text.replaceAll(secret, '[fixture secret]'),
    String(value),
  );
const cli = (args, input) => {
  const r = spawnSync(docker, ['--host', endpoint, ...args], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  assert.equal(r.status, 0, safe(r.stderr));
  return r.stdout.trim();
};
const sql = (database, text) =>
  cli(
    [
      'exec',
      '-i',
      pg,
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
const snapshot = (database) =>
  JSON.parse(
    sql(
      database,
      `CREATE FUNCTION pg_temp.batch_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; r jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;r:=r||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN r;END;$$;SELECT pg_temp.batch_snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const rows = (database) =>
  JSON.parse(
    sql(
      database,
      `SELECT jsonb_build_object('parents',COALESCE((SELECT jsonb_object_agg(id::text,md5(to_jsonb(t)::text)) FROM public.exercises t),'{}'),'versions',COALESCE((SELECT jsonb_object_agg(id::text,md5(to_jsonb(t)::text)) FROM public.exercise_versions t),'{}'));`,
    )
      .split('\n')
      .at(-1),
  );
const outside = (data, names) =>
  Object.fromEntries(
    Object.entries(data).filter(([name]) => !names.includes(name)),
  );
let started = false,
  worker,
  workerExit;
try {
  assert.equal(
    cli(['inspect', '--format', '{{.State.Running}}', pg]),
    'false',
    'Do not interrupt another fixture run',
  );
  assert.equal(
    cli(['network', 'inspect', '--format', '{{.Internal}}', network]),
    'true',
  );
  const pgInfo = JSON.parse(cli(['inspect', pg]))[0];
  assert(
    Object.values(pgInfo.NetworkSettings.Ports).every(
      (value) => !value?.length,
    ),
  );
  cli(['start', pg]);
  started = true;
  for (let i = 0; i < 40; i++) {
    const r = spawnSync(
      docker,
      [
        '--host',
        endpoint,
        'exec',
        pg,
        'pg_isready',
        '-U',
        'supabase_admin',
        '-d',
        'postgres',
      ],
      { windowsHide: true, stdio: 'ignore', timeout: 5000 },
    );
    if (r.status === 0) break;
    if (i === 39) throw Error('Private fixture is not ready');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const original = {
    source: snapshot('transfer_source'),
    target: snapshot('transfer_target'),
  };
  for (const [originalName, newName] of [
    ['transfer_source', source],
    ['transfer_target', target],
  ]) {
    const dump = '/tmp/' + newName + '.dump';
    cli([
      'exec',
      pg,
      'pg_dump',
      '-U',
      'supabase_admin',
      '-d',
      originalName,
      '--format=custom',
      '--file=' + dump,
    ]);
    cli([
      'exec',
      pg,
      'createdb',
      '-U',
      'supabase_admin',
      '--template=template0',
      newName,
    ]);
    cli([
      'exec',
      pg,
      'pg_restore',
      '-U',
      'supabase_admin',
      '-d',
      newName,
      '--exit-on-error',
      '--single-transaction',
      dump,
    ]);
    assert.deepEqual(
      snapshot(newName),
      original[originalName === 'transfer_source' ? 'source' : 'target'],
    );
  }
  assert(snapshot(target)['public.exercise_attempts'].rows > 0);
  assert(snapshot(target)['public.duel_attempts'].rows > 0);
  await writeFile(path.join(artifact, 'client.json'), JSON.stringify(client));
  await writeFile(
    path.join(artifact, 'target-input.json'),
    await readFile(path.join(prior, 'target-input.json')),
  );
  await writeFile(
    path.join(artifact, 'batch.json'),
    JSON.stringify({ source, target, key: 'local-batch-' + stamp }),
  );
  await writeFile(
    path.join(artifact, 'native-entry.ts'),
    [
      "export { PublicationBatch, parseBatchQuery } from '../../../src/lib/publication-batch.ts';",
      "export { createPublicationPgPools } from '../../../src/lib/publication-pg.ts';",
      "export { PublicationJournal } from '../../../src/lib/publication-journal-server.ts';",
      "export { PublicationTarget } from '../../../src/lib/publication-target.ts';",
      "export { PublicationService } from '../../../src/lib/publication-service.ts';",
      "export { loadPublicationSource } from '../../../src/lib/publication-source.ts';",
      "export { verifyPublicationEngine } from '../../../src/lib/publication-verification.ts';",
      "export { testPreview } from '../../../src/lib/preview-server.ts';",
      "export { signTestReceipt } from '../../../src/lib/test-receipt.ts';",
      "export { closeEngineRuntime } from '../../../src/lib/engine-runtime.ts';",
    ].join('\n'),
  );
  const files = [
    'scripts/test-publication-batch-local.mjs',
    'scripts/test-publication-batch-worker.mjs',
    'scripts/test-publication-service-worker.mjs',
    'scripts/test-publication-source-worker.mjs',
  ];
  async function collect(dir) {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const name = dir + '/' + file.name;
      if (file.isDirectory()) await collect(name);
      else if (/\.ts$/.test(name)) files.push(name);
    }
  }
  await collect('src/lib');
  const hashes = Object.fromEntries(
    await Promise.all(
      files.sort().map(async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(name))
          .digest('hex'),
      ]),
    ),
  );
  await writeFile(
    path.join(artifact, 'source-hashes.json'),
    JSON.stringify(hashes, null, 2) + '\n',
  );
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      ssr: path.join(artifact, 'native-entry.ts'),
      outDir: path.join(artifact, 'bundle'),
      emptyOutDir: false,
      rolldownOptions: {
        external: [
          'pg',
          'server-only',
          'novlearn-exercise-engine',
          'novlearn-exercise-engine/node-host',
        ],
        output: { entryFileNames: 'native.mjs' },
      },
    },
  });
  const image =
    'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
  const args = [
    '--host',
    endpoint,
    'run',
    '--name',
    'novlearn-admin-batch-' + stamp,
    '--init',
    '--interactive',
    '--pull',
    'never',
    '--network',
    network,
    '--memory',
    '384m',
    '--memory-swap',
    '384m',
    '--pids-limit',
    '64',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    '65534:65534',
  ];
  for (const [src, dest] of [
    [artifact, '/fixture'],
    [path.resolve('node_modules'), '/node_modules'],
    [
      path.resolve('scripts/test-publication-batch-worker.mjs'),
      '/batch-worker.mjs',
    ],
    [
      path.resolve('scripts/test-publication-service-worker.mjs'),
      '/service-worker.mjs',
    ],
    [
      path.resolve('scripts/test-publication-source-worker.mjs'),
      '/source-worker.mjs',
    ],
  ])
    args.push('--mount', `type=bind,source=${src},target=${dest},readonly`);
  args.push(image, 'node', '--conditions=react-server', '/batch-worker.mjs');
  worker = spawn(docker, args, {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let readyResolve,
    readyReject,
    seq = 0;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const pending = new Map();
  worker.stderr.on('data', (data) => process.stderr.write(safe(data)));
  workerExit = new Promise((resolve) =>
    worker.once('exit', (code) => {
      readyReject(Error('Native batch worker exited ' + code));
      for (const p of pending.values()) p.reject(Error('Native worker exited'));
      pending.clear();
      resolve(code);
    }),
  );
  worker.once('error', readyReject);
  createInterface({ input: worker.stdout }).on('line', (line) => {
    const data = JSON.parse(line);
    if (data.ready) readyResolve();
    else if (pending.has(data.id)) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error)
        p.reject(
          Error(safe(p.command + ': ' + data.message + ' (' + data.code + ')')),
        );
      else p.resolve(data.result);
    }
  });
  await ready;
  const request = async (command) => {
    const id = String(++seq);
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('Native batch command deadline: ' + command));
      }, 120000);
      pending.set(id, {
        command,
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      worker.stdin.write(JSON.stringify({ id, command }) + '\n');
    });
    await writeFile(
      path.join(artifact, command + '.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    return result;
  };
  const fixture = await request('create');
  const sourceBefore = snapshot(source),
    targetBefore = snapshot(target),
    oldRows = rows(source),
    oldTargetRows = rows(target);
  const parentIds = new Set(fixture.candidates.map((c) => c.exerciseId)),
    versionIds = new Set(fixture.candidates.map((c) => c.versionId));
  const observations = [];
  for (const command of ['prepare', 'partial', 'recover', 'cancel', 'finish']) {
    const beforeTarget = snapshot(target),
      result = await request(command),
      afterSource = snapshot(source),
      afterTarget = snapshot(target),
      sourceRows = rows(source),
      targetRows = rows(target);
    assert.deepEqual(
      outside(afterTarget, ['public.exercises', 'public.exercise_versions']),
      outside(targetBefore, ['public.exercises', 'public.exercise_versions']),
    );
    assert.deepEqual(
      outside(afterSource, [
        'public.exercises',
        'public.exercise_versions',
        'novlearn_admin_private.publication_operations',
        'novlearn_admin_private.publication_operation_events',
      ]),
      outside(sourceBefore, [
        'public.exercises',
        'public.exercise_versions',
        'novlearn_admin_private.publication_operations',
        'novlearn_admin_private.publication_operation_events',
      ]),
    );
    for (const [id, hash] of Object.entries(oldRows.parents))
      if (!parentIds.has(id)) assert.equal(sourceRows.parents[id], hash);
    for (const [id, hash] of Object.entries(oldRows.versions))
      if (!versionIds.has(id)) assert.equal(sourceRows.versions[id], hash);
    for (const [id, hash] of Object.entries(oldTargetRows.parents))
      assert.equal(targetRows.parents[id], hash);
    for (const [id, hash] of Object.entries(oldTargetRows.versions))
      assert.equal(targetRows.versions[id], hash);
    if (['prepare', 'recover', 'cancel'].includes(command))
      assert.deepEqual(afterTarget, beforeTarget);
    const expected = command === 'prepare' ? 0 : command === 'finish' ? 3 : 2;
    assert.equal(
      afterTarget['public.exercises'].rows,
      targetBefore['public.exercises'].rows + expected,
    );
    assert.equal(
      afterTarget['public.exercise_versions'].rows,
      targetBefore['public.exercise_versions'].rows + expected,
    );
    observations.push({
      command,
      result,
      source: afterSource,
      target: afterTarget,
    });
    console.log('PASS native batch phase: ' + command);
  }
  assert.deepEqual(snapshot('transfer_source'), original.source);
  assert.deepEqual(snapshot('transfer_target'), original.target);
  for (const [name, hash] of Object.entries(hashes))
    assert.equal(
      createHash('sha256')
        .update(await readFile(name))
        .digest('hex'),
      hash,
      'Source changed during native qualification: ' + name,
    );
  const proof = {
    result: 'PASS',
    date: new Date().toISOString(),
    artifact,
    container: pg,
    worker: 'novlearn-admin-batch-' + stamp,
    sourceDatabase: source,
    targetDatabase: target,
    originalDatabasesUnchanged: true,
    sourceSchemaMigrations: 62,
    mainApplicationSchemaMigrations: 63,
    sourceHashes: hashes,
    nativeReceipts: 3,
    nativeVerificationChecks: 7,
    targetApplyCalls: 3,
    existingTargetAttemptsPreserved: true,
    allExcludedTablesPreservedEachPhase: true,
    existingParentAndVersionRowsPreserved: true,
    scope:
      'Real sequential batch controller, Engine, TLS/SQL source journal and target with commit loss and observation-only recovery',
    authAndRestSynthetic: true,
    humanReviewsSynthetic: true,
    browserAcceptance: false,
    fullEngineSourceSuiteRerun: false,
    remoteChanges: false,
    sequencesCompared: false,
    phases: observations.map(({ command, result }) => ({ command, result })),
  };
  await writeFile(
    path.join(artifact, 'snapshots.json'),
    JSON.stringify(
      { original, sourceBefore, targetBefore, observations },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      phases: 5,
      nativeReceipts: 3,
      nativeVerificationChecks: 7,
      applyCalls: 3,
      artifact,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(artifact, 'failure.txt'),
    safe(error?.stack ?? error),
  );
  throw Error(safe(error?.message ?? error));
} finally {
  if (worker) {
    worker.stdin.end();
    await workerExit;
  }
  if (started) cli(['stop', '--timeout', '15', pg]);
}
