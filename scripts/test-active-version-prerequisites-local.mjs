// Migration preconditions, transactional rollback and populated logical restore.
// All mutations target NEW network-isolated copies of the qualified SQL64 dump.
// No application database, remote endpoint, deletion or existing-role rotation.
import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  access,
  copyFile,
  readdir,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';

assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const nativeMarker = await json(
  '.local/lot1a/active-version-copy-current.json',
);
assert.equal(nativeMarker.phase, 'qualified-native');
const documented = await json('docs/active-version-readonly-proof.json');
assert.equal(nativeMarker.proof, documented.populatedCopy.rawProof);
assert.equal(
  sha(await readFile(nativeMarker.proof)),
  documented.populatedCopy.rawProofSha256,
);
const native = await json(nativeMarker.proof);
assert.equal(nativeMarker.artifact, native.artifact);
assert.equal(
  path.dirname(path.resolve(native.artifact)).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(native.artifact), /^active-version-copy-\d+$/);
assert.equal(native.result, 'PASS');
assert.equal(
  native.source,
  'novlearn-admin-publication-local-1792259029889-target-db',
);
for (const [file, hash] of Object.entries(native.sourceHashes))
  assert.equal(sha(await readFile(file)), hash, file);
const dump64 = await readFile(native.artifact + '/source-64.dump');
assert.equal(sha(dump64), native.dumpSha256);
const original = await json(native.artifact + '/source-before.json');
assert.equal(Object.keys(original.rows).length, 62);
assert.equal(Object.keys(original.sequences).length, 11);
const globals64 = await readFile(
  native.artifact + '/roles-private.sql',
  'utf8',
);
const migrationsDirectory = path.resolve('../Novlearn/supabase/migrations');
const files = (await readdir(migrationsDirectory))
  .filter((f) => f.endsWith('.sql'))
  .sort();
assert.equal(files.length, 70);
const migrations = [];
for (const entry of native.migrations) {
  const body = await readFile(
    path.join(migrationsDirectory, entry.file),
    'utf8',
  );
  assert.equal(sha(body), entry.sha256, entry.file);
  migrations.push({ ...entry, body });
}
assert.equal(migrations.length, 6);
const candidate = migrations.at(-1);
assert.equal(
  candidate.file,
  '20261019184535_novlearn_admin_active_version_readonly.sql',
);
assert.equal(candidate.body.split('\nBEGIN;\n').length, 2);
assert.match(candidate.body, /\nCOMMIT;\s*$/);

const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const owner = randomBytes(24).toString('hex');
const cli = (args, input, binary = false, allowFailure = false) => {
  const result = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: binary ? undefined : 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 33554432,
    },
  );
  if (!allowFailure)
    assert.equal(
      result.status,
      0,
      String(result.stderr).replaceAll(owner, '[fixture owner]'),
    );
  return result;
};
const checked = (args, input) => cli(args, input).stdout.trim();
// Fail before creating state when the local daemon is unavailable.
checked(['version', '--format', '{{.Server.Version}}']);
const marker = '.local/lot1a/active-version-prerequisites-current.json';
await assert.rejects(access(marker), (error) => error.code === 'ENOENT');
const stamp = Date.now();
const artifact = path.resolve(
  '.local/lot1a/active-version-prerequisites-' + stamp,
);
await mkdir(artifact);
const names = {
  preflight: 'novlearn-admin-active-version-preflight-' + stamp,
  restored: 'novlearn-admin-active-version-restored-' + stamp,
};
const stored = (name, value) =>
  writeFile(artifact + '/' + name, JSON.stringify(value, null, 2) + '\n');
const phase = (step) =>
  writeFile(
    marker,
    JSON.stringify({ phase: step, artifact, names }, null, 2) + '\n',
  );
await phase('creating-sql69-copy');
await writeFile(
  artifact + '/owner.env',
  'POSTGRES_PASSWORD=' + owner + '\nPOSTGRES_DB=postgres\n',
  { mode: 0o600 },
);
await copyFile(
  native.artifact + '/source-64.dump',
  artifact + '/source-64.dump',
);
assert.equal(
  sha(await readFile(artifact + '/source-64.dump')),
  native.dumpSha256,
);
const image =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const args = (container, db = 'admin_local') => [
  'exec',
  '-i',
  container,
  'psql',
  '-qAt',
  '-U',
  'supabase_admin',
  '-d',
  db,
  '-v',
  'ON_ERROR_STOP=1',
];
const sql = (container, statement) => checked(args(container), statement);
const value = (container, statement) =>
  JSON.parse(sql(container, statement).split('\n').at(-1));
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = (container) => value(container, snapshotSql);
const normalized = (input) => {
  const result = structuredClone(input);
  // Built-in role passwords intentionally differ between brand-new clusters.
  // Compare all their other attributes; every custom SCRAM digest is retained.
  result.metadata.roles = result.metadata.roles.map((role) =>
    role.rolname.startsWith('novlearn_')
      ? role
      : { ...role, password_digest: null },
  );
  return JSON.parse(
    JSON.stringify(result, (key, v) =>
      key === 'acl' && typeof v === 'string' && v.startsWith('{')
        ? v.slice(1, -1).split(',').sort()
        : v,
    ),
  );
};
const ident = (text) => '"' + text.replaceAll('"', '""') + '"';
function roleStatements(globals, source) {
  const roles = source.metadata.roles.filter((role) =>
    role.rolname.startsWith('novlearn_'),
  );
  assert(roles.length >= 4 && roles.length <= 12);
  assert(
    roles.every(
      (role) =>
        !role.rolsuper &&
        !role.rolcreatedb &&
        !role.rolcreaterole &&
        !role.rolreplication &&
        !role.rolbypassrls &&
        role.rolconfig === null,
    ),
  );
  const result = globals
    .split(/\r?\n/)
    .filter((line) => /^(CREATE|ALTER) ROLE novlearn_[a-z_]+\b/.test(line));
  for (const role of roles)
    assert.equal(
      result.filter((line) => line === `CREATE ROLE ${role.rolname};`).length,
      1,
    );
  for (const member of source.metadata.memberships.filter(
    (m) => m.role.startsWith('novlearn_') || m.member.startsWith('novlearn_'),
  )) {
    assert(
      roles.some((role) => role.rolname === member.role) &&
        roles.some((role) => role.rolname === member.member),
    );
    result.push(
      `SET ROLE ${ident(member.grantor)}; GRANT ${ident(member.role)} TO ${ident(member.member)} WITH ADMIN ${member.admin_option}, INHERIT ${member.inherit_option}, SET ${member.set_option}; RESET ROLE;`,
    );
  }
  return result.join('\n');
}
async function createCopy(container, backupName, globals, source) {
  checked([
    'run',
    '-d',
    '--pull',
    'never',
    '--name',
    container,
    '--network',
    'none',
    '--cpus',
    '2',
    '--memory',
    '1g',
    '--memory-swap',
    '1g',
    '--pids-limit',
    '256',
    '--env-file',
    artifact + '/owner.env',
    '--mount',
    `type=bind,source=${artifact},target=/seed,readonly`,
    image,
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      cli(
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'supabase_admin',
          '-d',
          'postgres',
        ],
        undefined,
        false,
        true,
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await delay(500);
  }
  assert(
    ready,
    'Inspect the same retained container; do not recreate after observation timeout',
  );
  const inspection = JSON.parse(checked(['inspect', container]))[0];
  assert.equal(inspection.HostConfig.NetworkMode, 'none');
  assert.deepEqual(inspection.HostConfig.PortBindings, {});
  assert.equal(inspection.HostConfig.Memory, 1073741824);
  assert.equal(inspection.HostConfig.MemorySwap, 1073741824);
  assert.equal(inspection.HostConfig.PidsLimit, 256);
  assert(
    JSON.parse(
      checked(['image', 'inspect', inspection.Image]),
    )[0].RepoDigests.includes(image),
  );
  checked(args(container, 'postgres'), roleStatements(globals, source));
  const restored = cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '--dbname=postgres',
    '--create',
    '--exit-on-error',
    '/seed/' + backupName,
  ]);
  await writeFile(
    artifact + '/' + container + '-restore.log',
    restored.stdout + '\n' + restored.stderr,
  );
  assert.deepEqual(
    normalized(snapshot(container)),
    normalized(source),
    'Populated restoration, all rows/sequences/schema/custom role passwords and memberships',
  );
  return {
    id: inspection.Id,
    image: inspection.Config.Image,
    network: 'none',
    ports: false,
    memory: inspection.HostConfig.Memory,
    pids: inspection.HostConfig.PidsLimit,
  };
}
const clusters = {};
clusters.preflight = await createCopy(
  names.preflight,
  'source-64.dump',
  globals64,
  original,
);
for (const migration of migrations.slice(0, 5)) {
  const result = cli(args(names.preflight), migration.body);
  await writeFile(
    artifact + '/' + migration.file + '.log',
    result.stdout + '\n' + result.stderr,
  );
}
const baseline69 = snapshot(names.preflight);
assert.deepEqual(baseline69.rows, original.rows);
assert.deepEqual(baseline69.sequences, original.sequences);
assert(
  !baseline69.metadata.roles.some(
    (role) => role.rolname === 'novlearn_active_version_reader',
  ),
);
await stored('baseline69.json', baseline69);
await phase('baseline69');
const failures = [];
for (const [label, mutation, message] of [
  [
    'role-exists',
    'CREATE ROLE novlearn_active_version_reader NOLOGIN NOINHERIT;',
    'Active-version reader already exists',
  ],
  [
    'insecure-baseline',
    'ALTER ROLE novlearn_pedagogy_reader LOGIN;',
    'Requires the reviewed SQL69 reader baseline',
  ],
  [
    'parent-rls-disabled',
    'ALTER TABLE public.exercises DISABLE ROW LEVEL SECURITY;',
    'Both catalogue relations require RLS',
  ],
  [
    'version-rls-disabled',
    'ALTER TABLE public.exercise_versions DISABLE ROW LEVEL SECURITY;',
    'Both catalogue relations require RLS',
  ],
  [
    'public-select-policy',
    'CREATE POLICY unexpected_public_select ON public.exercises FOR SELECT TO PUBLIC USING(true);',
    'Unexpected PUBLIC catalogue SELECT policy',
  ],
  [
    'column-missing',
    'ALTER TABLE public.exercises RENAME COLUMN publication_epoch TO unexpected_epoch;',
    'Unexpected catalogue metadata column exercises.publication_epoch',
  ],
  [
    'column-type',
    'ALTER TABLE public.exercises ALTER COLUMN publication_epoch TYPE integer;',
    'Unexpected catalogue metadata column exercises.publication_epoch',
  ],
  [
    'public-definition',
    'GRANT SELECT(definition) ON public.exercise_versions TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-column-write',
    'GRANT UPDATE(title) ON public.exercises TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-sequence',
    'GRANT USAGE ON SEQUENCE public.exercises_id_seq TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-schema-create',
    'GRANT CREATE ON SCHEMA public TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-database-create',
    'GRANT CREATE ON DATABASE admin_local TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-temporary',
    'GRANT TEMPORARY ON DATABASE admin_local TO PUBLIC;',
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'public-definer',
    "CREATE FUNCTION public.active_version_preflight_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT 1'; GRANT EXECUTE ON FUNCTION public.active_version_preflight_probe() TO PUBLIC;",
    'Unexpected effective read/write/creation/definer capability',
  ],
  [
    'reviewed-guest-drift',
    "CREATE OR REPLACE FUNCTION public.is_guest() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS 'SELECT true';",
    'Unexpected effective read/write/creation/definer capability',
  ],
]) {
  const injected = candidate.body.replace(
    '\nBEGIN;\n',
    "\nBEGIN;\nSET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';\n" +
      mutation +
      '\n',
  );
  const result = cli(
    args(names.preflight),
    '\\set VERBOSITY verbose\n' + injected,
    false,
    true,
  );
  await writeFile(
    artifact + '/preflight-' + label + '.log',
    result.stdout + '\n' + result.stderr,
  );
  assert.notEqual(result.status, 0, 'Unexpected accepted drift: ' + label);
  assert.match(result.stderr, /P0001/);
  assert(
    result.stderr.includes(message),
    'The candidate preflight, not fixture setup, must reject ' + label,
  );
  assert.deepEqual(
    snapshot(names.preflight),
    baseline69,
    'Every drift and failed migration must rollback exactly: ' + label,
  );
  failures.push({
    label,
    sqlstate: 'P0001',
    expected: message,
    allRowsSequencesMetadataExactAfterRollback: true,
  });
}
const dryRun = candidate.body.replace(/\nCOMMIT;\s*$/, '\nROLLBACK;\n');
const dry = cli(args(names.preflight), dryRun);
await writeFile(
  artifact + '/successful-rollback.log',
  dry.stdout + '\n' + dry.stderr,
);
assert.deepEqual(
  snapshot(names.preflight),
  baseline69,
  'Successful DDL body also rolls back completely',
);
await stored('preflight-proof.json', {
  result: 'PASS',
  failures,
  successfulDdlRolledBackExactly: true,
  canonicalCommitSubstitutedByRollbackOnlyForDryRun: true,
});
await phase('preflight-qualified');
const applied = cli(args(names.preflight), candidate.body);
await writeFile(
  artifact + '/canonical-70-commit.log',
  applied.stdout + '\n' + applied.stderr,
);
const baseline70 = snapshot(names.preflight);
await stored('baseline70.json', baseline70);
assert.deepEqual(baseline70.rows, baseline69.rows);
assert.deepEqual(baseline70.sequences, baseline69.sequences);
// The migration may add this reader, its column/schema ACL entries and exactly
// two policies. Existing roles, grants, functions and every other object remain.
const withoutReader = structuredClone(baseline70);
withoutReader.metadata.roles = withoutReader.metadata.roles.filter(
  (role) => role.rolname !== 'novlearn_active_version_reader',
);
const addedPolicies = withoutReader.policies.filter((p) =>
  [
    'novlearn_active_version_read_exercises',
    'novlearn_active_version_read_versions',
  ].includes(p.policyname),
);
assert.equal(addedPolicies.length, 2);
withoutReader.policies = withoutReader.policies.filter(
  (p) => !addedPolicies.includes(p),
);
const comparableAcls = (state) =>
  JSON.parse(
    JSON.stringify(state, (key, v) => {
      if (key !== 'acl' || typeof v !== 'string' || !v.startsWith('{'))
        return v;
      const entries = v
        .slice(1, -1)
        .split(',')
        .filter(
          (entry) => !entry.startsWith('novlearn_active_version_reader='),
        );
      return entries.length ? entries.sort() : null;
    }),
  );
assert.deepEqual(
  comparableAcls(withoutReader),
  comparableAcls(baseline69),
  'Existing roles/passwords/policies/grants/functions/schema objects remain exact after SQL70',
);
const replay = cli(
  args(names.preflight),
  '\\set VERBOSITY verbose\n' + candidate.body,
  false,
  true,
);
await writeFile(
  artifact + '/reapplication-refused.log',
  replay.stdout + '\n' + replay.stderr,
);
assert.notEqual(replay.status, 0);
assert.match(replay.stderr, /P0001/);
assert(replay.stderr.includes('Active-version reader already exists'));
assert.deepEqual(snapshot(names.preflight), baseline70);
await phase('sql70-applied');

const query = (await readFile('scripts/active-version-query.sql', 'utf8'))
  .trim()
  .replace(/;$/, '');
const audit = await readFile('scripts/active-version-reader-audit.sql', 'utf8');
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  build: {
    ssr: 'src/lib/active-version.ts',
    outDir: artifact + '/domain',
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'active-version.mjs' } },
  },
});
const domain = await import(
  pathToFileURL(artifact + '/domain/active-version.mjs').href
);
function observations(container) {
  const result = [];
  for (const expected of native.observations) {
    const raw = value(
      container,
      `BEGIN READ ONLY; SET SESSION AUTHORIZATION novlearn_active_version_reader; PREPARE current_version(uuid) AS ${query}; EXECUTE current_version('${expected.catalogId}'); RESET SESSION AUTHORIZATION; ROLLBACK;`,
    );
    const decoded = domain.decodeActiveVersionSnapshot(
      { ...raw, environment: 'local-copy', targetKey: 'local-http-fixture' },
      {
        environment: 'local-copy',
        targetKey: 'local-http-fixture',
        catalogId: expected.catalogId,
      },
    );
    assert(decoded);
    assert.deepEqual(decoded.parent, expected.snapshot.parent);
    assert.deepEqual(decoded.active, expected.snapshot.active);
    assert.equal(domain.activeVersionState(decoded).state, expected.state);
    result.push(decoded);
  }
  const capability = value(
    container,
    'BEGIN READ ONLY; SET SESSION AUTHORIZATION novlearn_active_version_reader;' +
      audit +
      'RESET SESSION AUTHORIZATION; ROLLBACK;',
  );
  assert.equal(capability.columns.length, 14);
  assert.equal(capability.policyScopeVerified, true);
  assert.equal(capability.rlsTables, 2);
  for (const key of [
    'databaseCreate',
    'temporary',
    'schemaCreate',
    'ownedObjects',
    'tableWrite',
    'sequenceAccess',
    'unexpectedDefinerAccess',
    'largeObjectCreate',
  ])
    assert.equal(capability[key], false, key);
  return { snapshots: result, capability };
}
const beforeRestore = observations(names.preflight);
await stored('observed-before-restore.json', beforeRestore);
const dump70 = cli(
  [
    'exec',
    names.preflight,
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
).stdout;
assert(dump70.subarray(0, 5).equals(Buffer.from('PGDMP')));
await writeFile(artifact + '/qualified-70.dump', dump70);
const globals70 = checked([
  'exec',
  names.preflight,
  'pg_dumpall',
  '-U',
  'supabase_admin',
  '--roles-only',
]);
await writeFile(artifact + '/roles70-private.sql', globals70, { mode: 0o600 });
assert.deepEqual(snapshot(names.preflight), baseline70);
await phase('restoring-qualified70');
clusters.restored = await createCopy(
  names.restored,
  'qualified-70.dump',
  globals70,
  baseline70,
);
const restored = observations(names.restored);
await stored('observed-after-restore.json', restored);
assert.deepEqual(normalized(snapshot(names.restored)), normalized(baseline70));
assert.deepEqual(snapshot(names.preflight), baseline70);
assert.equal(
  sha(await readFile(native.artifact + '/source-64.dump')),
  native.dumpSha256,
);
for (const migration of migrations)
  assert.equal(
    sha(await readFile(path.join(migrationsDirectory, migration.file))),
    migration.sha256,
  );
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  artifact,
  names,
  clusters,
  scope:
    'SQL70 migration preconditions and logical restoration on two new network-isolated populated copies. Native session authorization only; no physical login/TLS or application target upgrade.',
  sourceNativeProof: nativeMarker.proof,
  sourceDump64Sha256: native.dumpSha256,
  migrations: migrations.map(({ file, sha256 }) => ({ file, sha256 })),
  failures,
  successfulDdlRolledBackExactly: true,
  realCanonicalCommitExecuted: true,
  reapplicationRefusedWithoutMutation: true,
  restoredDumpSha256: sha(dump70),
  preservedTables: 62,
  preservedSequences: 11,
  restoredObservations: restored.snapshots.length,
  restoredReaderColumns: restored.capability.columns.length,
  allCustomRoleScramDigestsPreserved: true,
  builtinRolePasswordDigestsIntentionallyExcludedFromCrossClusterComparison: true,
  builtinRoleAttributesComparedExceptPasswords: true,
  existingMetadataPreservedWithOnlyNewReaderAdditions: true,
  aclArrayOrderNormalizedOnlyForCrossClusterComparison: true,
  originalsUnmodified: true,
  applicationTargetModified: false,
  physicalLoginTlsTested: false,
  remoteOperations: false,
};
await stored('proof.json', proof);
await writeFile(
  marker,
  JSON.stringify(
    { phase: 'qualified', artifact, names, proof: artifact + '/proof.json' },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    failedPreconditions: failures.length,
    restoredObservations: restored.snapshots.length,
    preservedTables: 62,
    preservedSequences: 11,
    artifact,
  }),
);
