// Provision a NEW metadata-only identity on the qualified retained local target.
// Never rotate existing credentials, change app files, seed data or accept a URL.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [flag, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert(flag === undefined || flag === '--resume');
const resume = flag === '--resume';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const certified = await json(
  'docs/archives/active-version-target-local-proof.json',
);
assert.equal(certified.applicationTargetUpgrade.targetSchemaVersion, 70);
assert.equal(certified.publicationHttp.checks.length, 13);
const upgrade = await json(
  '.local/lot1a/active-version-target-upgrade-current.json',
);
assert.equal(upgrade.phase, 'upgraded');
const qualified = await json(upgrade.proof);
assert.equal(qualified.result, 'PASS');
assert.equal(
  qualified.containerId,
  certified.applicationTargetUpgrade.containerId,
);
const root = path.resolve('.local/local-admin-publication-1792259029889');
const publication = await json(root + '/publication-pg.json');
const writer = await json(publication.privateFile);
const target = publication.target;
assert.equal(
  target,
  'novlearn-admin-publication-local-1792259029889-target-db',
);
assert.equal(target, upgrade.target);
const markerFile = '.local/lot1a/active-version-http-current.json';
const retained = resume ? await json(markerFile) : null;
if (!resume)
  await assert.rejects(access(markerFile), (e) => e.code === 'ENOENT');
else assert(['preparing', 'provisioned'].includes(retained.phase));
const artifact = path.resolve(
  retained?.artifact ?? '.local/lot1a/active-version-http-' + Date.now(),
);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^active-version-http-\d+$/);
if (!resume) await mkdir(artifact);
const prior = resume ? await json(artifact + '/private.json') : null;
const password = prior
  ? decodeURIComponent(new URL(prior.config.url).password)
  : randomBytes(24).toString('hex');
const config = {
  url: `postgresql://novlearn_admin_active_version_service:${password}@127.0.0.1:55434/admin_local`,
  ca: writer.config.target.ca,
  environment: 'local-copy',
  targetKey: 'local-http-fixture',
};
const cert = new X509Certificate(config.ca);
assert(Date.parse(cert.validTo) > Date.now());
assert.equal(cert.checkIP('127.0.0.1'), '127.0.0.1');
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
    'Local target operation failed; raw output withheld',
  );
  return r.stdout;
};
const inspect = (name) => JSON.parse(cli(['inspect', name]))[0];
const info = inspect(target);
assert.equal(info.Id, qualified.containerId);
assert(info.State.Running);
const proxy = inspect(publication.proxy);
assert(proxy.State.Running);
const common = Object.keys(info.NetworkSettings.Networks).filter(
  (n) => proxy.NetworkSettings.Networks[n],
);
assert.equal(common.length, 1);
assert.equal(
  JSON.parse(cli(['network', 'inspect', common[0]]))[0].Internal,
  true,
);
const proxyIp = proxy.NetworkSettings.Networks[common[0]].IPAddress;
assert.match(proxyIp, /^10\.241\.240\.\d+$/);
const sql = (q) =>
  cli(
    [
      'exec',
      '-i',
      target,
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
const value = (q) => JSON.parse(sql(q).split('\n').at(-1));
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => value(snapshotSql);
const before = resume ? await json(artifact + '/before.json') : snapshot();
const stored = (name, data) =>
  writeFile(artifact + '/' + name, JSON.stringify(data, null, 2) + '\n');
const phase = (step) =>
  writeFile(
    markerFile,
    JSON.stringify(
      { phase: step, artifact, target, containerId: info.Id },
      null,
      2,
    ) + '\n',
  );
const login = 'novlearn_admin_active_version_service';
const role = 'novlearn_active_version_reader';
const hbaPath = sql('SHOW hba_file;');
assert(hbaPath.startsWith('/'));
if (!resume) {
  assert(!before.metadata.roles.some((r) => r.rolname === login));
  await stored('before.json', before);
  await stored('private.json', {
    artifact,
    target,
    containerId: info.Id,
    proxy: publication.proxy,
    proxyIp,
    config,
    physicalConnectionQualified: false,
  });
  await phase('preparing');
  const dump = cli(
    [
      'exec',
      target,
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
  await writeFile(artifact + '/before-reader.dump', dump, { mode: 0o600 });
  await writeFile(
    artifact + '/roles-before-private.sql',
    cli(['exec', target, 'pg_dumpall', '-U', 'supabase_admin', '--roles-only']),
    { mode: 0o600 },
  );
  const hba = cli(['exec', target, 'cat', hbaPath]);
  assert(!hba.includes(login));
  const mode = cli(['exec', target, 'stat', '-c', '%a', hbaPath]).trim();
  assert.match(mode, /^[0-7]{3,4}$/);
  await writeFile(artifact + '/hba-before.conf', hba);
  await stored('hba-state.json', { path: hbaPath, mode });
  const rules = [
    `hostssl admin_local ${login} ${proxyIp}/32 scram-sha-256`,
    `host all ${login} 0.0.0.0/0 reject`,
    `host all ${login} ::0/0 reject`,
    `local all ${login} reject`,
    hba,
  ].join('\n');
  await writeFile(artifact + '/hba-reader.conf', rules);
}
const current = snapshot();
assert.deepEqual(current.rows, before.rows);
assert.deepEqual(current.sequences, before.sequences);
const existing = current.metadata.roles.find((r) => r.rolname === login);
if (!existing) {
  assert.equal(resume ? retained.phase : 'preparing', 'preparing');
  sql(
    `BEGIN;SET LOCAL password_encryption='scram-sha-256'; CREATE ROLE ${login} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'; GRANT ${role} TO ${login} WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;COMMIT;`,
  );
}
const hbaState = await json(artifact + '/hba-state.json');
assert.equal(hbaState.path, hbaPath);
const activeHba = cli(['exec', target, 'cat', hbaPath]);
const desired = await readFile(artifact + '/hba-reader.conf', 'utf8');
if (activeHba !== desired) {
  assert.equal(
    activeHba,
    await readFile(artifact + '/hba-before.conf', 'utf8'),
    'Unexpected HBA drift; do not overwrite it',
  );
  cli(['cp', artifact + '/hba-reader.conf', target + ':' + hbaPath]);
  cli(['exec', target, 'chown', 'postgres:postgres', hbaPath]);
  cli(['exec', target, 'chmod', hbaState.mode, hbaPath]);
}
const loadedBefore = sql('SELECT pg_conf_load_time()::text;');
sql('SELECT pg_reload_conf();');
let loaded = false;
for (let i = 0; i < 30; i++) {
  if (sql('SELECT pg_conf_load_time()::text;') !== loadedBefore) {
    loaded = true;
    break;
  }
  await delay(100);
}
assert(loaded);
assert.equal(
  sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
  '0',
);
sql(`ALTER ROLE ${login} LOGIN;`);
const provisioned = snapshot();
const oldOnly = structuredClone(provisioned);
oldOnly.metadata.roles = oldOnly.metadata.roles.filter(
  (r) => r.rolname !== login,
);
oldOnly.metadata.memberships = oldOnly.metadata.memberships.filter(
  (m) => m.member !== login,
);
assert.deepEqual(
  oldOnly,
  before,
  'Only the dedicated LOGIN and its unique membership may be added',
);
assert.deepEqual(
  provisioned.metadata.memberships
    .filter((m) => m.member === login)
    .map(({ role: r, member, admin_option, inherit_option, set_option }) => ({
      role: r,
      member,
      admin_option,
      inherit_option,
      set_option,
    })),
  [
    {
      role,
      member: login,
      admin_option: false,
      inherit_option: false,
      set_option: true,
    },
  ],
);
await stored('provisioned.json', provisioned);
await phase('provisioned');
// Independent owner projection of the target pointer; never copy definitions.
const expected = value(
  `SELECT jsonb_agg(jsonb_build_object('catalogId',e.catalog_id,'parent',jsonb_build_object('exerciseId',e.id::text,'catalogId',e.catalog_id,'activeVersionId',e.active_version_id,'publicationEpoch',e.publication_epoch::text,'archivedAt',to_char(e.admin_archived_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'active',CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object('versionId',v.id,'exerciseId',v.exercise_id::text,'revision',v.revision,'status',v.editorial_status,'publishedAt',to_char(v.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'definitionSha256',v.definition_sha256,'engineContract',v.engine_contract,'generationVersion',v.generation_version,'canonicalizationVersion',v.canonicalization_version) END,'latestRevision',(SELECT max(revision) FROM public.exercise_versions x WHERE x.exercise_id=e.id)) ORDER BY e.id) FROM public.exercises e LEFT JOIN public.exercise_versions v ON v.id=e.active_version_id WHERE e.catalog_id IS NOT NULL;`,
);
assert(expected.some((p) => p.active && p.latestRevision > p.active.revision));
const native = await json('.local/lot1a/active-version-copy-current.json');
const nativeProof = await json(native.proof);
await stored('expectations.json', {
  observations: expected,
  denials: nativeProof.denials,
});
const run = artifact + '/pg-' + Date.now();
await mkdir(run);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  resolve: { conditions: ['react-server'] },
  build: {
    ssr: 'src/lib/active-version-pg.ts',
    outDir: run + '/bundle',
    emptyOutDir: false,
    rollupOptions: {
      external: ['pg'],
      output: { entryFileNames: 'reader.mjs' },
    },
  },
});
const log = spawnSync(
  process.execPath,
  [
    '--conditions=react-server',
    'scripts/test-active-version-target-pg-worker.mjs',
    artifact,
    run,
  ],
  { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 16777216 },
);
await writeFile(
  run + '/execution.log',
  (String(log.stdout) + '\n' + String(log.stderr)).replaceAll(
    password,
    '[reader]',
  ),
);
assert.deepEqual(
  snapshot(),
  provisioned,
  'Physical test must preserve every row, sequence, role, credential and policy',
);
assert.equal(log.status, 0, 'Inspect retained physical test: ' + run);
const proof = await json(run + '/proof.json');
assert.equal(proof.result, 'PASS');
await stored('private.json', {
  artifact,
  target,
  containerId: info.Id,
  proxy: publication.proxy,
  proxyIp,
  config,
  physicalConnectionQualified: true,
});
const sourceHashes = {};
for (const f of [
  'scripts/prepare-active-version-http-local.mjs',
  'scripts/test-active-version-target-pg-worker.mjs',
  'src/lib/active-version-pg.ts',
  'src/lib/active-version-config.ts',
  'src/lib/active-version.ts',
  'scripts/active-version-query.sql',
  'scripts/active-version-reader-audit.sql',
])
  sourceHashes[f] = sha(await readFile(f));
await stored('pg-proof.json', {
  result: 'PASS',
  at: new Date().toISOString(),
  artifact,
  run,
  target,
  containerId: info.Id,
  proxyIp,
  checks: proof.checks,
  denials: proof.denials,
  observations: proof.observations.length,
  allRowsAndSequencesExact: true,
  allPreexistingRolesAndCredentialsExact: true,
  onlyDedicatedIdentityAdded: true,
  existingHbaRulesPreservedWithOnlyNewLoginGuards: true,
  existingAppConfigurationsModified: false,
  sourceHashes,
  readerHttpQualified: false,
  remoteOperations: false,
});
await writeFile(
  markerFile,
  JSON.stringify(
    {
      phase: 'qualified-pg',
      artifact,
      target,
      containerId: info.Id,
      proof: artifact + '/pg-proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    checks: proof.checks.length,
    denials: proof.denials,
    observations: proof.observations.length,
    artifact,
    phase: 'qualified-pg',
  }),
);
