// Real target primitives on a NEW populated database cloned from the SQL70 copy.
// Original databases, credentials and HBA are checked/restored exactly. No Auth
// or source approval is simulated as a real publication authorization.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'vite';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [flag, retainedArtifact, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
const resume = flag === '--resume';
assert(
  (flag === undefined && retainedArtifact === undefined) ||
    (resume && retainedArtifact),
);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const marker = await json('.local/lot1a/active-version-pg-current.json');
assert.equal(marker.phase, 'qualified');
const advisors = await json(
  '.local/lot1a/active-version-advisors-current.json',
);
assert.equal((await json(advisors.proof)).errors, 0);
const container = marker.container;
assert.match(container, /^novlearn-admin-active-version-copy-\d+$/);
const tls = await json(marker.artifact + '/private.json');
const root = '.local/local-admin-publication-1792259029889';
const pgMarker = await json(root + '/publication-pg.json');
const pg = await json(pgMarker.privateFile);
const password = decodeURIComponent(new URL(pg.config.target.url).password);
const stamp = resume
  ? path
      .basename(retainedArtifact)
      .match(/^active-version-publication-(\d+)$/)?.[1]
  : Date.now();
assert(stamp);
const database = 'active_version_regression_' + stamp;
const artifact = path.resolve(
  '.local/lot1a/active-version-publication-' + stamp,
);
if (resume)
  assert.equal(
    artifact.toLowerCase(),
    path.resolve(retainedArtifact).toLowerCase(),
  );
else await mkdir(artifact);
const run = artifact + '/run-' + Date.now();
await mkdir(run);
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
    assert.equal(
      r.status,
      0,
      String(r.stderr).replaceAll(password, '[writer]'),
    );
  return r;
};
const sql = (db, q, name = container) =>
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
      db,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  ).stdout.trim();
const value = (db, q, name) => JSON.parse(sql(db, q, name).split('\n').at(-1));
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = (db, name) => value(db, snapshotSql, name);
const before = snapshot('admin_local');
assert.deepEqual(
  before,
  await json(marker.artifact + '/provisioned-snapshot.json'),
);
const target = pgMarker.target;
const targetBefore = snapshot('admin_local', target);
const inspected = JSON.parse(cli(['inspect', container]).stdout)[0];
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
if (!resume) {
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=admin_local',
    database,
  ]);
  // createdb does not copy database ACLs. Reproduce the original ACL, including
  // each grant option, rather than accepting PUBLIC TEMP/CREATE defaults.
  sql(
    'admin_local',
    `REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
DO $$ DECLARE g record; BEGIN FOR g IN SELECT x.*,pg_get_userbyid(x.grantee) AS grantee_name
FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) x WHERE d.datname='admin_local' LOOP
EXECUTE format('GRANT %s ON DATABASE %I TO %s%s',g.privilege_type,'${database}',CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE quote_ident(g.grantee_name) END,CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END); END LOOP; END;$$;`,
  );
}
const copied = snapshot(database);
const expected = structuredClone(before);
expected.metadata.database.name = database;
const normalized = (v) =>
  JSON.parse(
    JSON.stringify(v, (k, x) =>
      k === 'acl' && typeof x === 'string' && x.startsWith('{')
        ? x.slice(1, -1).split(',').sort()
        : x,
    ),
  );
assert.deepEqual(
  normalized(copied),
  normalized(expected),
  'New populated database and effective ACLs must match',
);
if (resume)
  assert.deepEqual(
    copied,
    await json(artifact + '/before.json'),
    'Resume only the unchanged retained database after the preparation failure',
  );
else
  await writeFile(
    artifact + '/before.json',
    JSON.stringify(copied, null, 2) + '\n',
  );
const hbaPath = sql('admin_local', 'SHOW hba_file;');
assert(hbaPath.startsWith('/'));
const originalHba = cli(['exec', container, 'cat', hbaPath]).stdout;
const hbaMode = cli([
  'exec',
  container,
  'stat',
  '-c',
  '%a',
  hbaPath,
]).stdout.trim();
assert.match(hbaMode, /^[0-7]{3,4}$/);
assert.equal(
  originalHba.trim(),
  (await readFile(marker.artifact + '/pg_hba.conf', 'utf8')).trim(),
);
await writeFile(artifact + '/hba-before.conf', originalHba);
await writeFile(
  artifact + '/hba-test.conf',
  [
    `hostssl ${database} novlearn_admin_publication_service 127.0.0.1/32 scram-sha-256`,
    `host ${database} novlearn_admin_publication_service 0.0.0.0/0 reject`,
    `host ${database} novlearn_admin_publication_service ::0/0 reject`,
    `local ${database} novlearn_admin_publication_service reject`,
    originalHba,
  ].join('\n'),
);
await mkdir(run + '/runner');
await mkdir(run + '/runner/node_modules');
await writeFile(
  artifact + '/entry.ts',
  [
    "export { createPublicationPgPools } from '../../../src/lib/publication-pg.ts';",
    "export { PublicationTarget } from '../../../src/lib/publication-target.ts';",
    "export { decodeActiveVersionSnapshot, activeVersionState } from '../../../src/lib/active-version.ts';",
  ].join('\n'),
);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  resolve: { conditions: ['react-server'] },
  build: {
    ssr: artifact + '/entry.ts',
    outDir: run + '/runner',
    emptyOutDir: false,
    rollupOptions: {
      external: ['pg'],
      output: { entryFileNames: 'target.mjs' },
    },
  },
});
await copyFile(
  'scripts/test-active-version-publication-worker.mjs',
  run + '/runner/worker.mjs',
);
const sourceUrl = new URL(pg.config.source.url);
sourceUrl.pathname = '/' + database;
const targetUrl = new URL(pg.config.target.url);
targetUrl.pathname = '/' + database;
await writeFile(
  artifact + '/private.json',
  JSON.stringify({
    database,
    ca: tls.config.ca,
    config: {
      ...pg.config,
      source: { url: sourceUrl.href, ca: tls.config.ca },
      target: { url: targetUrl.href, ca: tls.config.ca },
    },
  }) + '\n',
  { mode: 0o600 },
);
const reload = async () => {
  const old = sql('admin_local', 'SELECT pg_conf_load_time()::text;');
  sql('admin_local', 'SELECT pg_reload_conf();');
  let loaded = false;
  for (let i = 0; i < 30; i++) {
    if (sql('admin_local', 'SELECT pg_conf_load_time()::text;') !== old) {
      loaded = true;
      break;
    }
    await delay(100);
  }
  assert(loaded, 'HBA reload must be observed, not assumed');
  assert.equal(
    sql(
      'admin_local',
      'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;',
    ),
    '0',
  );
};
let result;
try {
  cli(['cp', artifact + '/hba-test.conf', container + ':' + hbaPath]);
  cli(['exec', container, 'chown', 'postgres:postgres', hbaPath]);
  cli(['exec', container, 'chmod', hbaMode, hbaPath]);
  await reload();
  result = cli(
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
      '--workdir',
      '/app',
      '--mount',
      `type=bind,source=${artifact},target=/fixture`,
      '--mount',
      `type=bind,source=${run},target=/output`,
      '--mount',
      `type=bind,source=${run}/runner,target=/runner,readonly`,
      '--mount',
      `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
      '--mount',
      `type=bind,source=${path.resolve('scripts')},target=/app/scripts,readonly`,
      'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
      'node',
      '--conditions=react-server',
      '/runner/worker.mjs',
    ],
    undefined,
    true,
  );
  await writeFile(
    run + '/execution.log',
    (String(result.stdout) + '\n' + String(result.stderr)).replaceAll(
      password,
      '[writer]',
    ),
  );
} finally {
  cli(['cp', artifact + '/hba-before.conf', container + ':' + hbaPath]);
  cli(['exec', container, 'chown', 'postgres:postgres', hbaPath]);
  cli(['exec', container, 'chmod', hbaMode, hbaPath]);
  await reload();
  assert.equal(cli(['exec', container, 'cat', hbaPath]).stdout, originalHba);
  assert.equal(
    cli(['exec', container, 'stat', '-c', '%a', hbaPath]).stdout.trim(),
    hbaMode,
  );
}
assert.deepEqual(
  snapshot('admin_local'),
  before,
  'Original SQL70 database, sequences and identities unchanged',
);
assert.deepEqual(
  snapshot('admin_local', target),
  targetBefore,
  'Actual application target unchanged',
);
assert.equal(
  result.status,
  0,
  'Inspect retained publication regression log: ' + artifact,
);
const worker = await json(run + '/worker-proof.json');
const after = snapshot(database);
for (const [table, rows] of Object.entries(copied.rows)) {
  const counts = new Map();
  for (const row of after.rows[table])
    counts.set(row, (counts.get(row) ?? 0) + 1);
  for (const row of rows) {
    assert(
      (counts.get(row) ?? 0) > 0,
      'Preexisting copied row changed: ' + table,
    );
    counts.set(row, counts.get(row) - 1);
  }
  if (!['public.exercises', 'public.exercise_versions'].includes(table))
    assert.deepEqual(after.rows[table], rows, table);
}
const afterMetadata = structuredClone(after);
for (const [name, sequence] of Object.entries(copied.sequences)) {
  if (name === 'public.exercises_id_seq') {
    assert(
      BigInt(after.sequences[name].last_value) >= BigInt(sequence.last_value),
    );
    assert.equal(after.sequences[name].is_called, true);
  } else
    assert.deepEqual(
      after.sequences[name],
      sequence,
      'Unrelated sequence changed: ' + name,
    );
}
afterMetadata.rows = copied.rows;
afterMetadata.sequences = copied.sequences;
assert.deepEqual(
  afterMetadata,
  copied,
  'Only new target exercise rows and their monotonic sequences may differ',
);
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  artifact,
  container,
  database,
  worker,
  run,
  copiedTables: 62,
  copiedSequences: 11,
  originalDatabaseAndApplicationTargetExact: true,
  originalHbaRestoredExactly: true,
  originalHbaModeRestoredExactly: true,
  onlyExerciseSequenceMayAdvance: true,
  allPreexistingCopiedRowsPreserved: true,
  onlyNewLabelledTargetExercisesWritten: true,
  originalSequenceStatesUnchanged: true,
  newDatabaseSequencesNotReset: true,
  freshSourceAuthExercised: false,
  sourceJournalExercised: false,
  freshEngineCertification: false,
  actualApplicationTargetUpgraded: false,
  remoteOperations: false,
  sourceHashes: Object.fromEntries(
    await Promise.all(
      [
        'scripts/test-active-version-publication-local.mjs',
        'scripts/test-active-version-publication-worker.mjs',
        'src/lib/publication-target.ts',
        'src/lib/publication-pg.ts',
        'src/lib/active-version.ts',
        'scripts/active-version-query.sql',
      ].map(async (f) => [f, hash(await readFile(f))]),
    ),
  ),
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/active-version-publication-current.json',
  JSON.stringify({ artifact, proof: artifact + '/proof.json' }, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    checks: worker.checks.length,
    database,
    artifact,
  }),
);
