// Audit the already qualified SQL70 copy inside its isolated network namespace.
// Official CLI binary is pinned and cached locally; no remote database or socket.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';

assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const qualified = await json('.local/lot1a/active-version-pg-current.json');
assert.equal(qualified.phase, 'qualified');
const original = await json(qualified.proof);
assert.equal(original.result, 'PASS');
for (const [f, h] of Object.entries(original.sourceHashes))
  assert.equal(sha(await readFile(f)), h, f);
const container = qualified.container;
assert.match(container, /^novlearn-admin-active-version-copy-\d+$/);
const download = await json(
  '.local/lot1a/supabase-cli-linux-2.98.2/download-proof.json',
);
assert.equal(download.version, '2.98.2');
assert.equal(
  download.archiveSha256,
  '0f59df9e6837e876f309e0b4f47005133c51296e85a02727b2927f33ed9adb2d',
);
const binary = path.resolve(download.artifact, 'supabase');
assert.equal(
  sha(await readFile(binary)),
  '94e6d7a9b6d674126144cecbfc64ce871189c0cfd88f19acb2a1675200f674d2',
);
const state = await json(qualified.artifact + '/private.json');
const native = await json('.local/lot1a/active-version-copy-current.json');
assert.equal(native.container, container);
const owner = (await readFile(native.artifact + '/owner.env', 'utf8')).match(
  /^POSTGRES_PASSWORD=([0-9a-f]{48})\r?$/m,
)?.[1];
assert(owner, 'Preserved copy owner credential required; never rotate it');
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, allowFailure = false) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 33554432,
    },
  );
  if (!allowFailure)
    assert.equal(r.status, 0, String(r.stderr).replaceAll(owner, '[owner]'));
  return r;
};
const inspected = JSON.parse(cli(['inspect', container]).stdout)[0];
assert.equal(inspected.State.Running, true);
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = (name) =>
  JSON.parse(
    cli(
      [
        'exec',
        '-i',
        name,
        'psql',
        '-qAt',
        '-U',
        'supabase_admin',
        '-d',
        'admin_local',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      snapshotSql,
    )
      .stdout.trim()
      .split('\n')
      .at(-1),
  );
const before = snapshot(container);
assert.deepEqual(
  before,
  await json(qualified.artifact + '/provisioned-snapshot.json'),
);
const targetName = 'novlearn-admin-publication-local-1792259029889-target-db';
const targetBefore = snapshot(targetName);
const artifact = path.resolve(
  '.local/lot1a/active-version-advisors-' + Date.now(),
);
await mkdir(artifact);
await mkdir(artifact + '/runner');
await mkdir(artifact + '/runner/node_modules');
await copyFile(
  'scripts/test-active-version-advisors-worker.mjs',
  artifact + '/runner/worker.mjs',
);
await writeFile(
  artifact + '/private.json',
  JSON.stringify({ owner, ca: state.config.ca }) + '\n',
  { mode: 0o600 },
);
const result = cli(
  [
    'run',
    '--rm',
    '--pull',
    'never',
    '--network',
    'container:' + container,
    '--cpus',
    '2',
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
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777',
    '--workdir',
    '/output',
    '--mount',
    `type=bind,source=${binary},target=/tool/supabase,readonly`,
    '--mount',
    `type=bind,source=${artifact},target=/output`,
    '--mount',
    `type=bind,source=${artifact}/runner,target=/runner,readonly`,
    '--mount',
    `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
    'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
    'node',
    '/runner/worker.mjs',
  ],
  undefined,
  true,
);
await writeFile(
  artifact + '/execution.log',
  (String(result.stdout) + '\n' + String(result.stderr)).replaceAll(
    owner,
    '[owner]',
  ),
);
assert.deepEqual(
  snapshot(container),
  before,
  'Advisor must preserve the entire copy',
);
assert.deepEqual(
  snapshot(targetName),
  targetBefore,
  'Application target unchanged',
);
assert.equal(
  result.status,
  0,
  'Inspect retained advisor execution: ' + artifact,
);
const worker = await json(artifact + '/worker-proof.json');
assert.equal(worker.result, 'PASS');
assert.equal(worker.errors, 0);
const proof = {
  ...worker,
  at: new Date().toISOString(),
  artifact,
  container,
  officialArchiveSha256: download.archiveSha256,
  officialBinarySha256: download.binarySha256,
  copyRowsSequencesMetadataExact: true,
  applicationTargetUnchanged: true,
  sqlMigrationsApplied: false,
  network: 'preserved network-none database namespace',
  workerMemoryBytes: 402653184,
  workerSwapBytes: 0,
  workerPidsLimit: 64,
  globalSqlCertification: false,
  sourceHashes: Object.fromEntries(
    await Promise.all(
      [
        'scripts/test-active-version-advisors-local.mjs',
        'scripts/test-active-version-advisors-worker.mjs',
      ].map(async (f) => [f, sha(await readFile(f))]),
    ),
  ),
  remoteOperations: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/active-version-advisors-current.json',
  JSON.stringify({ artifact, proof: artifact + '/proof.json' }, null, 2) + '\n',
);
console.log(
  JSON.stringify({ result: proof.result, levels: proof.levels, artifact }),
);
