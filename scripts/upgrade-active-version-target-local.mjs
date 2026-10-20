// One explicit upgrade of the retained synthetic publication TARGET only.
// Preserve backup, data, identities and all private application configuration.
// The metadata reader remains disabled. No restore, deletion or remote write.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, open, access } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import net from 'node:net';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (v) => createHash('sha256').update(v).digest('hex');
const ledger = '.local/lot1a/active-version-target-upgrade-current.json';
await assert.rejects(access(ledger), (e) => e.code === 'ENOENT');
const nativeMarker = await json(
  '.local/lot1a/active-version-copy-current.json',
);
assert.equal(nativeMarker.phase, 'qualified-native');
const native = await json(nativeMarker.proof);
const prerequisiteMarker = await json(
  '.local/lot1a/active-version-prerequisites-current.json',
);
assert.equal(prerequisiteMarker.phase, 'qualified');
assert.equal((await json(prerequisiteMarker.proof)).failures.length, 15);
const pg = await json('.local/lot1a/active-version-pg-current.json');
assert.equal(pg.phase, 'qualified');
const advisor = await json('.local/lot1a/active-version-advisors-current.json');
assert.equal((await json(advisor.proof)).errors, 0);
const regression = await json(
  '.local/lot1a/active-version-publication-current.json',
);
const regressionProof = await json(regression.proof);
assert.equal(regressionProof.result, 'PASS');
assert.equal(regressionProof.worker.checks.length, 13);
assert.equal(regressionProof.originalHbaRestoredExactly, true);
assert.equal(regressionProof.onlyExerciseSequenceMayAdvance, true);
for (const proof of [
  await json(pg.proof),
  await json(advisor.proof),
  regressionProof,
])
  for (const [f, h] of Object.entries(proof.sourceHashes))
    assert.equal(sha(await readFile(f)), h, f);
const baseline = await json(
  '.local/lot1a/publication-http-restart-baseline.json',
);
for (const [f, h] of Object.entries(baseline.hashes))
  assert.equal(sha(await readFile(f)), h, f);
const root = path.resolve('.local/local-admin-publication-1792259029889');
const state = await json(root + '/app-config.json');
const marker = await json(root + '/publication-pg.json');
assert.equal(marker.artifact, root);
assert.equal(
  marker.target,
  'novlearn-admin-publication-local-1792259029889-target-db',
);
assert.equal(state.schemaVersion, 64); // Auth/source stays SQL64.
assert.equal(state.publicationFixture, true);
const runtime = await json(root + '/app-runtime.json');
assert.equal(runtime.origin, 'http://127.0.0.1:3152');
const artifact = path.resolve(
  '.local/lot1a/active-version-target-upgrade-' + Date.now(),
);
await mkdir(artifact);
const save = (name, v) =>
  writeFile(artifact + '/' + name, JSON.stringify(v, null, 2) + '\n');
const update = (phase, extra = {}) =>
  writeFile(
    ledger,
    JSON.stringify(
      { phase, artifact, target: marker.target, ...extra },
      null,
      2,
    ) + '\n',
  );
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, binary = false) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: binary ? undefined : 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 67108864,
    },
  );
  assert.equal(
    r.status,
    0,
    'Retained target operation failed; inspect phase and local artifacts',
  );
  return r.stdout;
};
const sql = (q) =>
  cli(
    [
      'exec',
      '-i',
      marker.target,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'admin_local',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  ).trim();
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => JSON.parse(sql(snapshotSql).split('\n').at(-1));
const info = JSON.parse(cli(['inspect', marker.target]))[0];
assert.equal(info.State.Running, true);
assert.equal(info.Id.length, 64);
assert(
  JSON.parse(cli(['image', 'inspect', info.Image]))[0].RepoDigests.includes(
    'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
  ),
);
const migrations = [];
for (const m of native.migrations) {
  const body = await readFile(
    path.resolve('../Novlearn/supabase/migrations', m.file),
    'utf8',
  );
  assert.equal(sha(body), m.sha256, m.file);
  migrations.push({ ...m, body });
}
assert.equal(migrations.length, 6);
const healthy = async (port) => {
  const r = await fetch(`http://127.0.0.1:${port}/login`, {
    signal: AbortSignal.timeout(15000),
  });
  await r.arrayBuffer();
  assert.equal(r.status, 200);
};
await healthy(3150);
await healthy(3152);
await update('stopping-dedicated-publication-app');
const stopped = spawnSync(
  process.execPath,
  ['scripts/run-publication-http-workspace.mjs', root, '--stop'],
  { encoding: 'utf8', windowsHide: true, timeout: 15000 },
);
assert.equal(stopped.status, 0);
const absent = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.once('connect', () => {
      s.destroy();
      resolve(false);
    });
    s.once('error', (e) => resolve(e.code === 'ECONNREFUSED'));
    s.setTimeout(1000, () => {
      s.destroy();
      resolve(false);
    });
  });
let closed = false;
for (let i = 0; i < 40; i++) {
  if ((await absent(3152)) && (await absent(3153))) {
    closed = true;
    break;
  }
  await delay(250);
}
assert(closed, 'Inspect the same owned application; do not force-stop it');
let qualified = false;
const applied = [];
try {
  await update('backing-up');
  const before = snapshot();
  assert.deepEqual(
    before,
    await json(native.artifact + '/source-before.json'),
    'Retained original SQL64 target must match before any upgrade',
  );
  await save('before.json', before);
  const dump = cli(
    [
      'exec',
      marker.target,
      'pg_dump',
      '-U',
      'supabase_admin',
      '-d',
      'admin_local',
      '--format=custom',
      '--create',
    ],
    undefined,
    true,
  );
  assert(dump.subarray(0, 5).equals(Buffer.from('PGDMP')));
  await writeFile(artifact + '/before-64.dump', dump, { mode: 0o600 });
  const roles = cli([
    'exec',
    marker.target,
    'pg_dumpall',
    '-U',
    'supabase_admin',
    '--roles-only',
  ]);
  await writeFile(artifact + '/roles-private.sql', roles, { mode: 0o600 });
  assert.deepEqual(snapshot(), before, 'Backup must not change data');
  for (const m of migrations) {
    await update('applying', { migration: m.file, applied });
    const log = sql(m.body);
    await writeFile(artifact + '/' + m.file + '.log', log + '\n');
    applied.push(m.file);
    const interim = snapshot();
    assert.deepEqual(
      interim.rows,
      before.rows,
      m.file + ': preserve all 62 tables',
    );
    assert.deepEqual(
      interim.sequences,
      before.sequences,
      m.file + ': preserve all 11 sequences',
    );
  }
  const after = snapshot();
  await save('after.json', after);
  const expected = await json(native.artifact + '/upgraded.json');
  const normalize = (v) => {
    const x = structuredClone(v);
    for (const role of x.metadata.roles)
      if (!role.rolname.startsWith('novlearn_')) role.password_digest = null;
    return JSON.parse(
      JSON.stringify(x, (k, y) =>
        k === 'acl' && typeof y === 'string' && y.startsWith('{')
          ? y.slice(1, -1).split(',').sort()
          : y,
      ),
    );
  };
  assert.deepEqual(
    normalize(after),
    normalize(expected),
    'Exact qualified SQL70 schema/rights and copied rows, except builtin passwords specific to clusters and ACL order',
  );
  for (const role of before.metadata.roles)
    assert.deepEqual(
      after.metadata.roles.find((r) => r.rolname === role.rolname),
      role,
      'Every preexisting role/password stays exact',
    );
  const current = JSON.parse(cli(['inspect', marker.target]))[0];
  assert.equal(current.Id, info.Id);
  assert.equal(current.Image, info.Image);
  for (const [f, h] of Object.entries(baseline.hashes))
    assert.equal(sha(await readFile(f)), h, f);
  const proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    artifact,
    target: marker.target,
    containerId: info.Id,
    sourceSchemaVersion: 64,
    targetSchemaVersion: 70,
    applied: migrations.map(({ file, sha256 }) => ({ file, sha256 })),
    beforeDumpSha256: sha(dump),
    beforeRolesSha256: sha(roles),
    preservedTables: 62,
    preservedSequences: 11,
    allOriginalRowsAndSequencesExact: true,
    preexistingRolesAndPasswordsExact: true,
    qualifiedMetadataExactExceptBuiltinPasswordDigestsAndAclOrder: true,
    privateConfigurationsExact: Object.keys(baseline.hashes).length,
    physicalReaderLoginCreated: false,
    readerActivated: false,
    publicationHttpRegressionExecuted: false,
    browserExecuted: false,
    remoteOperations: false,
    sourceSha256: sha(
      await readFile('scripts/upgrade-active-version-target-local.mjs'),
    ),
  };
  await save('proof.json', proof);
  qualified = true;
  await update('upgraded', { proof: artifact + '/proof.json' });
} finally {
  const out = await open(artifact + '/application.log', 'a'),
    err = await open(artifact + '/application-error.log', 'a');
  const child = spawn(
    process.execPath,
    ['scripts/run-publication-http-workspace.mjs', root],
    { detached: true, windowsHide: true, stdio: ['ignore', out.fd, err.fd] },
  );
  child.unref();
  await out.close();
  await err.close();
  await save('application-restart.json', {
    at: new Date().toISOString(),
    processId: child.pid,
    qualified,
    applied,
    stoppingWasGraceful: true,
    mainApplicationNotStopped: true,
  });
}
let ready = false;
for (let i = 0; i < 45; i++) {
  try {
    await healthy(3152);
    ready = true;
    break;
  } catch {}
  await delay(500);
}
assert(
  ready,
  'Observe the same launched application; do not start another instance',
);
await healthy(3150);
await save('availability.json', {
  at: new Date().toISOString(),
  login3150: 200,
  login3152: 200,
  activeVersionReaderActivated: false,
  authenticatedLoginNotYetRetested: true,
});
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact,
    migrations: applied.length,
    targetSchema: 70,
    preservedTables: 62,
    preservedSequences: 11,
    mainAvailable: true,
    publicationFixtureAvailable: true,
    readerActivated: false,
  }),
);
