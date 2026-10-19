// Physical pool test only on the qualified large-data fixture. No app source is changed.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const current = await json('.local/lot1a/pedagogy-performance-current.json'),
  qualification = await json(
    '.local/lot1a/pedagogy-performance-proof-current.json',
  );
assert.equal(current.phase, 'measured');
assert.equal(qualification.phase, 'qualified');
assert.equal(current.artifact, qualification.artifact);
const qualified = await json(qualification.proof);
assert(qualified.result.startsWith('PASS'));
assert.equal(qualified.measurements.length, 28);
assert.equal(
  sha(await readFile('scripts/pedagogy-statistics-query.sql')),
  sha(await readFile(qualified.queryFile)),
  'Application must exactly match the measured candidate bytes',
);
const container = current.container;
assert.match(container, /^novlearn-admin-pedagogy-perf-\d+$/);
const native = await json('.local/lot1a/pedagogy-pg-current.json'),
  privateConfig = await json(native.artifact + '/private.json');
const artifact = current.artifact + '/pool-' + Date.now();
await mkdir(artifact);
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 33554432,
    },
  );
  if (r.status !== 0) {
    const secret = decodeURIComponent(
      new URL(privateConfig.config.url).password,
    );
    writeFileSync(
      artifact + '/command-failure-' + Date.now() + '.log',
      String(r.stdout ?? '').replaceAll(secret, '[fixture secret]') +
        '\n' +
        String(r.stderr ?? '').replaceAll(secret, '[fixture secret]'),
    );
    assert.equal(
      r.status,
      0,
      'Inspect retained pool fixture logs; do not repeat while a worker remains live',
    );
  }
  return r.stdout.trim();
};
const sql = (q) =>
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
      'activity_copy',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  );
const snapQuery =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => JSON.parse(sql(snapQuery).split('\n').at(-1));
assert.deepEqual(
  snapshot(),
  await json(current.artifact + '/seeded-snapshot.json'),
);
const inspection = JSON.parse(cli(['inspect', container]))[0];
assert.equal(inspection.State.Running, true);
assert.equal(inspection.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspection.HostConfig.PortBindings, {});
assert.equal(inspection.HostConfig.NanoCpus, 2000000000);
assert.equal(inspection.HostConfig.Memory, 1073741824);
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(
    cli(['image', 'inspect', inspection.Image]),
  )[0].RepoDigests.includes(pgImage),
);
assert.equal(
  await readFile(native.artifact + '/server.crt', 'utf8'),
  privateConfig.config.ca,
);
for (const ext of ['crt', 'key'])
  cli([
    'cp',
    native.artifact + '/server.' + ext,
    container + ':/tmp/admin-pedagogy-perf.' + ext,
  ]);
cli([
  'exec',
  container,
  'chown',
  'postgres:postgres',
  '/tmp/admin-pedagogy-perf.key',
  '/tmp/admin-pedagogy-perf.crt',
]);
cli([
  'exec',
  '--user',
  'postgres',
  container,
  'chmod',
  '600',
  '/tmp/admin-pedagogy-perf.key',
]);
for (const [name, v] of [
  ['ssl_cert_file', '/tmp/admin-pedagogy-perf.crt'],
  ['ssl_key_file', '/tmp/admin-pedagogy-perf.key'],
  ['ssl', 'on'],
])
  sql(`ALTER SYSTEM SET ${name}='${v}';`);
const hba = sql('SHOW hba_file;');
assert(hba.startsWith('/'));
cli(['cp', container + ':' + hba, artifact + '/pg_hba.before.conf']);
await writeFile(
  artifact + '/pg_hba.conf',
  [
    'hostssl activity_copy novlearn_admin_pedagogy_service 127.0.0.1/32 scram-sha-256',
    'host all novlearn_admin_pedagogy_service 0.0.0.0/0 reject',
    'host all novlearn_admin_pedagogy_service ::0/0 reject',
    'local all novlearn_admin_pedagogy_service reject',
    await readFile(artifact + '/pg_hba.before.conf', 'utf8'),
  ].join('\n'),
);
cli(['cp', artifact + '/pg_hba.conf', container + ':' + hba]);
cli(['exec', container, 'chown', 'postgres:postgres', hba]);
sql('SELECT pg_reload_conf();');
assert.equal(
  sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
  '0',
);
await writeFile(
  artifact + '/private.json',
  JSON.stringify({ config: privateConfig.config }, null, 2) + '\n',
  { mode: 0o600 },
);
const cases = [];
for (const name of ['wide-competence-success', 'wide-exercise-attempts']) {
  const measurement = qualified.measurements.find(
    (r) => r.case === name && r.repetition === 1,
  );
  assert(measurement);
  cases.push({
    name,
    query: measurement.parameters,
    report: await json(qualified.run + '/' + name + '-1-response.json'),
  });
}
await writeFile(
  artifact + '/goldens.json',
  JSON.stringify(cases, null, 2) + '\n',
);
const files = [
  'src/lib/pedagogy-pg.ts',
  'src/lib/pedagogy-config.ts',
  'src/lib/pedagogy-statistics.ts',
  'src/lib/pedagogy-references.ts',
  'scripts/pedagogy-reader-audit.sql',
  'scripts/pedagogy-statistics-query.sql',
  'scripts/test-pedagogy-performance-pool-local.mjs',
  'scripts/test-pedagogy-performance-pool-worker.mjs',
];
const hashes = {};
for (const f of files) hashes[f] = sha(await readFile(f));
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  build: {
    ssr: path.resolve('src/lib/pedagogy-pg.ts'),
    outDir: artifact + '/runner',
    emptyOutDir: false,
    rolldownOptions: {
      external: ['pg', 'server-only'],
      output: { entryFileNames: 'reader.mjs' },
    },
  },
});
await copyFile(
  'scripts/test-pedagogy-performance-pool-worker.mjs',
  artifact + '/runner/worker.mjs',
);
await mkdir(artifact + '/runner/node_modules', { recursive: true });
const worker = 'novlearn-admin-pedagogy-perf-pool-' + Date.now();
await writeFile(
  artifact + '/worker.json',
  JSON.stringify({ worker, phase: 'starting' }, null, 2) + '\n',
);
const output = cli([
  'run',
  '--rm',
  '--pull',
  'never',
  '--name',
  worker,
  '--network',
  'container:' + container,
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
  '--workdir',
  '/app',
  '--mount',
  `type=bind,source=${artifact},target=/fixture`,
  '--mount',
  `type=bind,source=${artifact}/runner,target=/runner,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('scripts')},target=/app/scripts,readonly`,
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
  'node',
  '--conditions=react-server',
  '/runner/worker.mjs',
]);
await writeFile(artifact + '/worker.log', output + '\n');
assert.deepEqual(
  snapshot(),
  await json(current.artifact + '/seeded-snapshot.json'),
  'Rows, sequences and permission metadata must remain exact',
);
for (const [f, h] of Object.entries(hashes))
  assert.equal(sha(await readFile(f)), h, f);
const connection = await json(artifact + '/connection-proof.json');
assert(connection.result.startsWith('PASS'));
assert.equal(connection.measurements.length, 4);
const proof = {
  ...connection,
  artifact,
  container,
  sourceHashes: hashes,
  nativeOracleProof: qualification.proof,
  allSeededRowsSequencesAndMetadataExact: true,
  tlsPhysicalConfigurationProvisionedOnlyOnPerformanceCopy: true,
  originalCredentialsAndCertificatePreserved: true,
  hostPortPublished: false,
  applicationModified: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/pedagogy-performance-pool-current.json',
  JSON.stringify(
    { artifact, proof: artifact + '/proof.json', phase: 'qualified' },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: proof.result,
    artifact,
    measurements: proof.measurements.length,
    worstObservedMs: Math.max(...proof.measurements.map((r) => r.elapsedMs)),
  }),
);
