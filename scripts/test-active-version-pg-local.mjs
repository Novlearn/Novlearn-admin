// Provision a fresh least-privilege identity on the already qualified COPY only.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { build } from 'vite';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [flag, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert(flag === undefined || flag === '--resume');
const resume = flag === '--resume';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const native = await json('.local/lot1a/active-version-copy-current.json');
assert.equal(native.phase, 'qualified-native');
const certified = await json(native.proof);
assert.equal(certified.result, 'PASS');
const container = native.container;
assert.match(container, /^novlearn-admin-active-version-copy-\d+$/);
const marker = '.local/lot1a/active-version-pg-current.json';
const retained = resume ? await json(marker) : null;
if (!resume) await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
else {
  assert.equal(retained.phase, 'provisioned');
  assert.equal(retained.container, container);
}
const artifact = path.resolve(
  retained?.artifact ?? '.local/lot1a/active-version-pg-' + Date.now(),
);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^active-version-pg-\d+$/);
if (!resume) await mkdir(artifact);
const retainedPrivate = resume ? await json(artifact + '/private.json') : null;
const password = retainedPrivate
  ? decodeURIComponent(new URL(retainedPrivate.config.url).password)
  : randomBytes(24).toString('hex');
const sha = (b) => createHash('sha256').update(b).digest('hex');
for (const [f, h] of Object.entries(certified.sourceHashes))
  assert.equal(sha(await readFile(f)), h, f);
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, allowFailure = false) => {
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
  if (!allowFailure)
    assert.equal(
      r.status,
      0,
      String(r.stderr).replaceAll(password, '[fixture reader]'),
    );
  return r;
};
const checked = (args, input) => cli(args, input).stdout.trim();
const args = [
  'exec',
  '-i',
  container,
  'psql',
  '-qAt',
  '-U',
  'supabase_admin',
  '-d',
  'admin_local',
  '-v',
  'ON_ERROR_STOP=1',
];
const sql = (q) => checked(args, q),
  value = (q) => JSON.parse(sql(q).split('\n').at(-1));
const stored = (name, v) =>
  writeFile(artifact + '/' + name, JSON.stringify(v, null, 2) + '\n');
const snapSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => value(snapSql);
const before = snapshot();
assert.deepEqual(
  before,
  await json(
    resume
      ? artifact + '/provisioned-snapshot.json'
      : native.artifact + '/upgraded.json',
  ),
);
if (!resume)
  assert(
    !before.metadata.roles.some(
      (r) => r.rolname === 'novlearn_admin_active_version_service',
    ),
  );
const inspected = JSON.parse(checked(['inspect', container]))[0];
assert.equal(inspected.State.Running, true);
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
if (!resume) {
  await writeFile(
    marker,
    JSON.stringify({ phase: 'preparing', container, artifact }, null, 2) + '\n',
  );
  for (const label of ['server', 'untrusted'])
    checked([
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'none',
      '--memory',
      '128m',
      '--memory-swap',
      '128m',
      '--pids-limit',
      '32',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--mount',
      `type=bind,source=${artifact},target=/certificates`,
      nodeImage,
      'openssl',
      'req',
      '-new',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      '/certificates/' + label + '.key',
      '-out',
      '/certificates/' + label + '.crt',
      '-subj',
      '/CN=active-version-local-fixture',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-days',
      '7',
    ]);
  const config = {
    url: `postgresql://novlearn_admin_active_version_service:${password}@127.0.0.1:55434/admin_local`,
    ca: await readFile(artifact + '/server.crt', 'utf8'),
    environment: 'local-copy',
    targetKey: 'local-http-fixture',
  };
  await stored('private.json', {
    container,
    artifact,
    config,
    untrustedCa: await readFile(artifact + '/untrusted.crt', 'utf8'),
  });
  await copyFile(native.proof, artifact + '/native-proof.json');
  for (const ext of ['key', 'crt'])
    checked([
      'cp',
      artifact + '/server.' + ext,
      container + ':/tmp/admin-active-version.' + ext,
    ]);
  checked([
    'exec',
    container,
    'chown',
    'postgres:postgres',
    '/tmp/admin-active-version.key',
    '/tmp/admin-active-version.crt',
  ]);
  checked([
    'exec',
    '--user',
    'postgres',
    container,
    'chmod',
    '600',
    '/tmp/admin-active-version.key',
  ]);
  for (const [k, v] of [
    ['ssl_cert_file', '/tmp/admin-active-version.crt'],
    ['ssl_key_file', '/tmp/admin-active-version.key'],
    ['ssl', 'on'],
  ])
    sql(`ALTER SYSTEM SET ${k}='${v}';`);
  const hba = sql('SHOW hba_file;');
  assert(hba.startsWith('/'));
  checked(['cp', container + ':' + hba, artifact + '/pg_hba.before.conf']);
  const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
  assert(!original.includes('novlearn_admin_active_version_service'));
  await writeFile(
    artifact + '/pg_hba.conf',
    [
      'hostssl admin_local novlearn_admin_active_version_service 127.0.0.1/32 scram-sha-256',
      'host all novlearn_admin_active_version_service 0.0.0.0/0 reject',
      'host all novlearn_admin_active_version_service ::0/0 reject',
      'local all novlearn_admin_active_version_service reject',
      original,
    ].join('\n'),
  );
  checked(['cp', artifact + '/pg_hba.conf', container + ':' + hba]);
  checked(['exec', container, 'chown', 'postgres:postgres', hba]);
  sql(
    `SET password_encryption='scram-sha-256';CREATE ROLE novlearn_admin_active_version_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}';GRANT novlearn_active_version_reader TO novlearn_admin_active_version_service WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;`,
  );
  sql('SELECT pg_reload_conf();');
  assert.equal(
    sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
    '0',
  );
  sql('ALTER ROLE novlearn_admin_active_version_service LOGIN;');
  const provisioned = snapshot();
  await stored('provisioned-snapshot.json', provisioned);
  assert.deepEqual(provisioned.rows, before.rows);
  assert.deepEqual(provisioned.sequences, before.sequences);
  await writeFile(
    marker,
    JSON.stringify({ phase: 'provisioned', container, artifact }, null, 2) +
      '\n',
  );
} else {
  assert.equal(retainedPrivate.container, container);
  assert.equal(retainedPrivate.artifact, artifact);
  assert.equal(
    retainedPrivate.config.ca,
    await readFile(artifact + '/server.crt', 'utf8'),
  );
  assert.equal(sql('SHOW ssl;'), 'on');
  assert.equal(sql('SHOW ssl_cert_file;'), '/tmp/admin-active-version.crt');
  assert.equal(sql('SHOW ssl_key_file;'), '/tmp/admin-active-version.key');
  assert.equal(
    checked(['exec', container, 'cat', sql('SHOW hba_file;')]),
    (await readFile(artifact + '/pg_hba.conf', 'utf8')).trim(),
  );
  assert.equal(
    checked([
      'exec',
      container,
      'sha256sum',
      '/tmp/admin-active-version.crt',
    ]).split(/\s/)[0],
    sha(await readFile(artifact + '/server.crt')),
  );
  assert.equal(
    checked([
      'exec',
      container,
      'sha256sum',
      '/tmp/admin-active-version.key',
    ]).split(/\s/)[0],
    sha(await readFile(artifact + '/server.key')),
  );
}
const provisioned = snapshot();
assert.deepEqual(
  provisioned,
  await json(artifact + '/provisioned-snapshot.json'),
);
const run = artifact + '/run-' + Date.now();
await mkdir(run);
const runner = run + '/runner';
await mkdir(runner);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  resolve: { conditions: ['react-server'] },
  build: {
    ssr: 'src/lib/active-version-pg.ts',
    outDir: runner,
    emptyOutDir: false,
    rollupOptions: {
      external: ['pg'],
      output: { entryFileNames: 'active-version-reader.mjs' },
    },
  },
});
await copyFile(
  'scripts/test-active-version-pg-worker.mjs',
  runner + '/worker.mjs',
);
const workerArgs = [
  'run',
  '--rm',
  '--pull',
  'never',
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
  `type=bind,source=${artifact},target=/fixture,readonly`,
  '--mount',
  `type=bind,source=${run},target=/output`,
  '--mount',
  `type=bind,source=${runner},target=/runner,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('scripts')},target=/app/scripts,readonly`,
  nodeImage,
  'node',
  '--conditions=react-server',
  '/runner/worker.mjs',
];
const runWorker = async (suffix = [], label = 'connection') => {
  const r = cli([...workerArgs, ...suffix], undefined, true);
  await writeFile(
    run + '/' + label + '.log',
    String(r.stdout) +
      '\n' +
      String(r.stderr).replaceAll(password, '[fixture reader]'),
  );
  assert.equal(
    r.status,
    0,
    'Inspect retained worker log: ' + run + '/' + label + '.log',
  );
};
await runWorker();
const drifts = [];
for (const [name, change, restore] of [
  [
    'definition column',
    'GRANT SELECT(definition) ON public.exercise_versions TO novlearn_active_version_reader',
    'REVOKE SELECT(definition) ON public.exercise_versions FROM novlearn_active_version_reader',
  ],
  [
    'restrictive policy',
    'CREATE POLICY unexpected_active_filter ON public.exercises AS RESTRICTIVE FOR SELECT TO novlearn_active_version_reader USING(false)',
    'DROP POLICY unexpected_active_filter ON public.exercises',
  ],
  [
    'implicit inheritance',
    'ALTER ROLE novlearn_admin_active_version_service INHERIT',
    'ALTER ROLE novlearn_admin_active_version_service NOINHERIT',
  ],
]) {
  try {
    sql(change);
    await runWorker(['--expect-drift'], 'drift-' + drifts.length);
    drifts.push(name);
  } finally {
    sql(restore);
  }
}
assert.deepEqual(
  snapshot(),
  provisioned,
  'Physical reads/denied writes and restored drifts preserve every row, sequence, policy and credential',
);
const worker = await json(run + '/worker-proof.json');
assert.equal(worker.result, 'PASS');
const sourceHashes = {};
for (const f of [
  'src/lib/active-version-pg.ts',
  'src/lib/active-version-config.ts',
  'src/lib/active-version.ts',
  'scripts/active-version-query.sql',
  'scripts/active-version-reader-audit.sql',
  'scripts/test-active-version-pg-local.mjs',
  'scripts/test-active-version-pg-worker.mjs',
])
  sourceHashes[f] = sha(await readFile(f));
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  container,
  artifact,
  run,
  nativeProof: native.proof,
  realTls: true,
  realServerReader: true,
  physicalLoginProvisioned: true,
  worker,
  drifts,
  sourceHashes,
  allRowsSequencesMetadataPreservedAfterTests: true,
  applicationTargetModified: false,
};
await writeFile(run + '/proof.json', JSON.stringify(proof, null, 2) + '\n');
await writeFile(
  marker,
  JSON.stringify(
    {
      phase: 'qualified',
      container,
      artifact,
      proof: run + '/proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    checks: worker.checks.length,
    denials: worker.denials,
    drifts: drifts.length,
    artifact,
  }),
);
