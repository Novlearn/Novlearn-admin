// Qualify SQL71 on two NEW bounded, network-isolated populated copies.
// Existing app/fixture databases and original migration files are read-only.
import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  access,
  readdir,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
import { legacySearchPathAdvisors } from './legacy-search-path-advisors.mjs';

const resume = process.argv.slice(2).join(' ') === '--resume-preconditions';
assert(
  process.argv.length === 2 || resume,
  'Only --resume-preconditions is accepted',
);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const marker = '.local/lot1a/legacy-search-path-current.json';
const retained = resume ? await json(marker) : null;
if (resume) assert.equal(retained.phase, 'testing-preconditions');
else await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
const prior = await json(
  '.local/lot1a/active-version-prerequisites-current.json',
);
assert.equal(prior.phase, 'qualified');
const qualified = await json(prior.proof);
assert.equal(qualified.result, 'PASS');
const baseline70 = await json(prior.artifact + '/baseline70.json');
assert.equal(Object.keys(baseline70.rows).length, 62);
assert.equal(Object.keys(baseline70.sequences).length, 11);
const originalDump = prior.artifact + '/qualified-70.dump';
assert.equal(sha(await readFile(originalDump)), qualified.restoredDumpSha256);
const globals70 = await readFile(
  prior.artifact + '/roles70-private.sql',
  'utf8',
);
const migrationDirectory = path.resolve('../Novlearn/supabase/migrations');
const files = (await readdir(migrationDirectory))
  .filter((f) => f.endsWith('.sql'))
  .sort();
assert.equal(files.length, 71);
const candidateName =
  '20261020135725_novlearn_admin_legacy_function_search_path.sql';
assert.equal(files.at(-1), candidateName);
const migrations = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      sha(await readFile(path.join(migrationDirectory, f))),
    ]),
  ),
);
const candidate = await readFile(
  path.join(migrationDirectory, candidateName),
  'utf8',
);
assert.equal(candidate.split('\nBEGIN;\n').length, 2);
assert.match(candidate, /\nCOMMIT;\s*$/);
const stamp = resume
  ? Number(path.basename(retained.artifact).replace('legacy-search-path-', ''))
  : Date.now();
assert(Number.isSafeInteger(stamp) && stamp > 0);
const artifact = path.resolve('.local/lot1a/legacy-search-path-' + stamp);
if (resume) assert.equal(artifact, retained.artifact);
else await mkdir(artifact);
const names = {
  migrated: 'novlearn-admin-legacy-path-' + stamp,
  restored: 'novlearn-admin-legacy-path-restored-' + stamp,
};
const stored = (f, value) =>
  writeFile(artifact + '/' + f, JSON.stringify(value, null, 2) + '\n');
const phase = (step) =>
  writeFile(
    marker,
    JSON.stringify({ phase: step, artifact, names }, null, 2) + '\n',
  );
if (!resume) await phase('preparing');
const owner = resume
  ? (await readFile(artifact + '/owner.env', 'utf8')).match(
      /^POSTGRES_PASSWORD=([0-9a-f]{48})$/m,
    )?.[1]
  : randomBytes(24).toString('hex');
assert(owner);
if (!resume)
  await writeFile(
    artifact + '/owner.env',
    'POSTGRES_PASSWORD=' + owner + '\nPOSTGRES_DB=postgres\n',
    { mode: 0o600 },
  );
if (!resume) await copyFile(originalDump, artifact + '/qualified-70.dump');
assert.equal(
  sha(await readFile(artifact + '/qualified-70.dump')),
  qualified.restoredDumpSha256,
);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, allowFailure = false, binary = false) => {
  const result = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: binary ? undefined : 'utf8',
      windowsHide: true,
      timeout: 120000,
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
checked(['version', '--format', '{{.Server.Version}}']);
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
const sql = (container, body) => checked(args(container), body);
const value = (container, body) =>
  JSON.parse(sql(container, body).split('\n').at(-1));
const snapshotBody =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = (container) => value(container, snapshotBody);
const normalize = (input) => {
  const result = structuredClone(input);
  result.metadata.roles = result.metadata.roles.map((r) =>
    r.rolname.startsWith('novlearn_') ? r : { ...r, password_digest: null },
  );
  return JSON.parse(
    JSON.stringify(result, (key, v) =>
      key === 'acl' && typeof v === 'string' && v.startsWith('{')
        ? v.slice(1, -1).split(',').sort()
        : v,
    ),
  );
};
const ident = (s) => '"' + s.replaceAll('"', '""') + '"';
function roleStatements(globals, source) {
  const roles = source.metadata.roles.filter((r) =>
    r.rolname.startsWith('novlearn_'),
  );
  assert(roles.length >= 4 && roles.length <= 12);
  assert(
    roles.every(
      (r) =>
        !r.rolsuper &&
        !r.rolcreatedb &&
        !r.rolcreaterole &&
        !r.rolreplication &&
        !r.rolbypassrls &&
        r.rolconfig === null,
    ),
  );
  const result = globals
    .split(/\r?\n/)
    .filter((s) => /^(CREATE|ALTER) ROLE novlearn_[a-z_]+\b/.test(s));
  for (const role of roles)
    assert.equal(
      result.filter((s) => s === `CREATE ROLE ${role.rolname};`).length,
      1,
    );
  for (const m of source.metadata.memberships.filter(
    (m) => m.role.startsWith('novlearn_') || m.member.startsWith('novlearn_'),
  )) {
    assert(
      roles.some((r) => r.rolname === m.role) &&
        roles.some((r) => r.rolname === m.member),
    );
    result.push(
      `SET ROLE ${ident(m.grantor)}; GRANT ${ident(m.role)} TO ${ident(m.member)} WITH ADMIN ${m.admin_option}, INHERIT ${m.inherit_option}, SET ${m.set_option}; RESET ROLE;`,
    );
  }
  return result.join('\n');
}
const image =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const existing = [
  prior.names.preflight,
  prior.names.restored,
  'novlearn-admin-publication-local-1792259029889-target-db',
];
const protectedSnapshots = Object.fromEntries(
  existing.map((c) => [c, snapshot(c)]),
);
await stored('protected-at-qualification-start.json', protectedSnapshots);
async function createCopy(container, backup, globals, source) {
  if (!(resume && container === names.migrated))
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
  for (let i = 0; i < 40; i++) {
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
  const state = JSON.parse(checked(['inspect', container]))[0];
  assert.equal(state.State.Running, true);
  assert.equal(state.HostConfig.NetworkMode, 'none');
  assert.deepEqual(state.HostConfig.PortBindings, {});
  assert.equal(state.HostConfig.NanoCpus, 2000000000);
  assert.equal(state.HostConfig.Memory, 1073741824);
  assert.equal(state.HostConfig.MemorySwap, 1073741824);
  assert.equal(state.HostConfig.PidsLimit, 256);
  assert(
    JSON.parse(
      checked(['image', 'inspect', state.Image]),
    )[0].RepoDigests.includes(image),
  );
  if (!(resume && container === names.migrated)) {
    checked(args(container, 'postgres'), roleStatements(globals, source));
    const restore = cli([
      'exec',
      container,
      'pg_restore',
      '-U',
      'supabase_admin',
      '--dbname=postgres',
      '--create',
      '--exit-on-error',
      '/seed/' + backup,
    ]);
    await writeFile(
      artifact + '/' + container + '-restore.log',
      restore.stdout + '\n' + restore.stderr,
    );
  }
  assert.deepEqual(
    normalize(snapshot(container)),
    normalize(source),
    'All restored rows, sequences and metadata; only builtin passwords/ACL ordering normalized',
  );
  return {
    id: state.Id,
    image,
    network: 'none',
    publishedPorts: false,
    cpus: 2,
    memoryBytes: state.HostConfig.Memory,
    swapBytes: 0,
    pids: state.HostConfig.PidsLimit,
  };
}
const clusters = {};
clusters.migrated = await createCopy(
  names.migrated,
  'qualified-70.dump',
  globals70,
  baseline70,
);
const before = snapshot(names.migrated);
if (resume)
  assert.deepEqual(
    before,
    await json(artifact + '/before.json'),
    'Retained terminal fixture is still exactly SQL70 before resuming',
  );
else await stored('before.json', before);
await phase('testing-preconditions');
const failures = [];
const mutations = [
  [
    'missing-trigger',
    'ALTER FUNCTION public.handle_updated_at() RENAME TO local_legacy_trigger_probe;',
  ],
  [
    'missing-generator',
    'ALTER FUNCTION public.generate_random_code(integer) RENAME TO local_legacy_generator_probe;',
  ],
  [
    'definer-trigger',
    'ALTER FUNCTION public.handle_updated_at() SECURITY DEFINER;',
  ],
  [
    'definer-generator',
    'ALTER FUNCTION public.generate_random_code(integer) SECURITY DEFINER;',
  ],
  [
    'config-trigger',
    "ALTER FUNCTION public.handle_updated_at() SET search_path='public';",
  ],
  [
    'config-generator',
    "ALTER FUNCTION public.generate_random_code(integer) SET search_path='public';",
  ],
  [
    'strict-generator',
    'ALTER FUNCTION public.generate_random_code(integer) STRICT;',
  ],
  [
    'stable-generator',
    'ALTER FUNCTION public.generate_random_code(integer) STABLE;',
  ],
  [
    'body-trigger',
    "DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.handle_updated_at()'::regprocedure),'RETURN NEW;', 'RETURN NULL;'); END $$;",
  ],
  [
    'body-generator',
    "DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.generate_random_code(integer)'::regprocedure),'ABCDEFGHJKLMNPQRSTUVWXYZ23456789','ABC'); END $$;",
  ],
  [
    'default-generator',
    "DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public.generate_random_code(integer)'::regprocedure),'DEFAULT 8','DEFAULT 9'); END $$;",
  ],
];
for (const [label, mutation] of mutations) {
  const body = candidate.replace(
    '\nBEGIN;\n',
    () => '\nBEGIN;\n' + mutation + '\n',
  );
  const result = cli(
    args(names.migrated),
    '\\set VERBOSITY verbose\n' + body,
    true,
  );
  await writeFile(
    artifact + '/qualification-preflight-' + label + '.log',
    result.stdout + '\n' + result.stderr,
  );
  assert.notEqual(result.status, 0, 'Must refuse ' + label);
  assert.match(result.stderr, /P0001/);
  assert.match(result.stderr, /Legacy search-path prerequisites:/);
  assert.deepEqual(
    snapshot(names.migrated),
    before,
    'Failed precondition rolls back both migration and drift: ' + label,
  );
  failures.push({ label, sqlstate: 'P0001', exactRollback: true });
}
const dry = cli(
  args(names.migrated),
  candidate.replace(/\nCOMMIT;\s*$/, '\nROLLBACK;\n'),
);
await writeFile(
  artifact + '/successful-ddl-rollback.log',
  dry.stdout + '\n' + dry.stderr,
);
assert.deepEqual(snapshot(names.migrated), before);
function behavior(container) {
  // Temporary test table belongs only to this new copy/session; all DML rolls back.
  // The real legacy trigger executes as each effective API role, never as definer.
  const results = [];
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const result = value(
      container,
      `BEGIN; SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE legacy_path_trigger_probe (id integer PRIMARY KEY, updated_at timestamptz NOT NULL);
GRANT SELECT,INSERT,UPDATE ON pg_temp.legacy_path_trigger_probe TO ${ident(role)};
CREATE TRIGGER local_legacy_trigger BEFORE UPDATE ON pg_temp.legacy_path_trigger_probe FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
INSERT INTO pg_temp.legacy_path_trigger_probe VALUES(1,'2000-01-01T00:00:00Z');
SET SESSION AUTHORIZATION ${ident(role)};
SET LOCAL search_path=pg_temp,pg_catalog;
UPDATE pg_temp.legacy_path_trigger_probe SET id=1;
SELECT jsonb_build_object('role',current_user,'timestampMatches', (SELECT updated_at=transaction_timestamp() FROM pg_temp.legacy_path_trigger_probe),
'codesValid', (SELECT bool_and(length(code)=n AND code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$') FROM (SELECT n,public.generate_random_code(n) AS code FROM unnest(ARRAY[1,8,32]) AS n CROSS JOIN generate_series(1,32)) samples),
'defaultLength',length(public.generate_random_code()));
RESET SESSION AUTHORIZATION; ROLLBACK;`,
    );
    assert.deepEqual(result, {
      role,
      timestampMatches: true,
      codesValid: true,
      defaultLength: 8,
    });
    results.push(result);
  }
  return results;
}
const oldBehavior = behavior(names.migrated);
assert.deepEqual(snapshot(names.migrated), before);
const beforeAdvisors = await legacySearchPathAdvisors({
  artifact,
  container: names.migrated,
  owner,
  output: 'before-advisors',
  cli,
});
assert.deepEqual(snapshot(names.migrated), before);
await phase('applying-canonical-sql71');
const applied = cli(args(names.migrated), candidate);
await writeFile(
  artifact + '/canonical-71-commit.log',
  applied.stdout + '\n' + applied.stderr,
);
const after = snapshot(names.migrated);
await stored('after.json', after);
const comparable = structuredClone(after);
let changed = 0;
for (const f of comparable.metadata.functions) {
  const old = before.metadata.functions.find(
    (p) => p.signature === f.signature,
  );
  assert(old);
  if (f.definition === old.definition) continue;
  assert(
    [
      'public.handle_updated_at()',
      'public.generate_random_code(integer)',
    ].includes(f.signature),
    f.signature,
  );
  assert.equal(
    f.definition.replace(/ SET search_path TO ''\n/, ''),
    old.definition,
  );
  f.definition = old.definition;
  changed++;
}
assert.equal(changed, 2);
assert.deepEqual(
  comparable,
  before,
  'Only the two function search_path settings may change',
);
assert.deepEqual(behavior(names.migrated), oldBehavior);
assert.deepEqual(snapshot(names.migrated), after);
const replay = cli(
  args(names.migrated),
  '\\set VERBOSITY verbose\n' + candidate,
  true,
);
await writeFile(
  artifact + '/reapplication-refused.log',
  replay.stdout + '\n' + replay.stderr,
);
assert.notEqual(replay.status, 0);
assert.match(replay.stderr, /P0001/);
assert.match(replay.stderr, /Legacy search-path prerequisites:/);
assert.deepEqual(snapshot(names.migrated), after);
await phase('restoring-sql71');
const dump = cli(
  [
    'exec',
    names.migrated,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'admin_local',
    '--format=custom',
    '--create',
  ],
  undefined,
  false,
  true,
).stdout;
assert(dump.subarray(0, 5).equals(Buffer.from('PGDMP')));
await writeFile(artifact + '/qualified-71.dump', dump);
const globals71 = checked([
  'exec',
  names.migrated,
  'pg_dumpall',
  '-U',
  'supabase_admin',
  '--roles-only',
]);
await writeFile(artifact + '/roles71-private.sql', globals71, { mode: 0o600 });
clusters.restored = await createCopy(
  names.restored,
  'qualified-71.dump',
  globals71,
  after,
);
assert.deepEqual(behavior(names.restored), oldBehavior);
assert.deepEqual(normalize(snapshot(names.restored)), normalize(after));
await phase('running-readonly-advisors');
const afterAdvisors = await legacySearchPathAdvisors({
  artifact,
  container: names.restored,
  owner,
  output: 'after-advisors',
  cli,
});
const findings = afterAdvisors.findings;
const oldFindings = beforeAdvisors.findings;
const withoutPath = oldFindings.filter(
  (f) => f.name !== 'function_search_path_mutable',
);
assert.equal(oldFindings.length - withoutPath.length, 2);
assert.equal(
  findings.filter((f) => f.name === 'function_search_path_mutable').length,
  0,
);
const sorted = (fs) =>
  fs.toSorted((a, b) => a.cache_key.localeCompare(b.cache_key));
assert.deepEqual(sorted(findings), sorted(withoutPath));
const advisorProof = afterAdvisors.proof;
assert.deepEqual(beforeAdvisors.proof.levels, { WARN: 32, INFO: 67 });
assert.deepEqual(advisorProof.levels, { WARN: 30, INFO: 67 });
assert.deepEqual(normalize(snapshot(names.restored)), normalize(after));
assert.deepEqual(snapshot(names.migrated), after);
for (const c of existing)
  assert.deepEqual(
    snapshot(c),
    protectedSnapshots[c],
    'Existing database unchanged: ' + c,
  );
for (const [f, h] of Object.entries(migrations))
  assert.equal(sha(await readFile(path.join(migrationDirectory, f))), h, f);
assert.equal(sha(await readFile(originalDump)), qualified.restoredDumpSha256);
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  artifact,
  names,
  clusters,
  migration: {
    file: candidateName,
    sha256: migrations[candidateName],
    canonicalLocalCommitExecuted: true,
  },
  sourceDump: { path: originalDump, sha256: qualified.restoredDumpSha256 },
  preconditions: failures,
  successfulDdlRollbackExact: true,
  reapplicationRefusedWithoutMutation: true,
  preservedTables: 62,
  preservedSequences: 11,
  onlyTwoSearchPathSettingsChanged: true,
  bodiesOwnersAclsAllOtherMetadataPreserved: true,
  nativeBehavior: {
    beforeMigration: oldBehavior,
    afterMigration: oldBehavior,
    afterRestore: oldBehavior,
    samplesPerRolePerLength: 32,
    lengths: [1, 8, 32],
    triggerUsedTemporaryTableOnly: true,
  },
  logicalRestore: {
    sha256: sha(dump),
    exactRowsSequencesMetadata: true,
    customRoleScramDigestsPreserved: true,
    builtinPasswordsExcludedAcrossNewClustersOnly: true,
    aclOrderNormalizedAcrossNewClustersOnly: true,
  },
  advisors: {
    before: { ERROR: 0, WARN: 32, INFO: 67 },
    after: advisorProof.levels,
    removed: [
      'public.handle_updated_at()',
      'public.generate_random_code(integer)',
    ],
    otherFindingsExact: true,
    tlsVerifyFull: true,
    defaultTransactionReadOnly: true,
    cli: '2.98.2',
  },
  originalDatabasesUnchanged: true,
  oldMigrationsUnchanged: true,
  applicationTargetModified: false,
  remoteOperations: false,
  globalSqlCertification: false,
  sourceHashes: Object.fromEntries(
    await Promise.all(
      [
        'scripts/test-legacy-search-path-local.mjs',
        'scripts/test-active-version-advisors-worker.mjs',
        'scripts/legacy-search-path-advisors.mjs',
        'scripts/reader-policies-snapshot.sql',
        'scripts/user-detail-local-fixture.mjs',
      ].map(async (f) => [f, sha(await readFile(f))]),
    ),
  ),
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
    artifact,
    preconditions: failures.length,
    warnings: 30,
    tables: 62,
    sequences: 11,
  }),
);
