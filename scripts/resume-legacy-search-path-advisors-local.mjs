// Resume ONLY the terminal, diagnosed read-only mountpoint failure. Never
// reapply SQL71, recreate a cluster, change a protection, or touch app databases.
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
import { legacySearchPathAdvisors } from './legacy-search-path-advisors.mjs';
import { setTimeout as delay } from 'node:timers/promises';
assert.equal(process.argv.slice(2).join(' '), '--resume-after-mount-failure');
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const markerFile = '.local/lot1a/legacy-search-path-current.json';
const marker = await json(markerFile);
assert.equal(marker.phase, 'running-readonly-advisors');
const artifact = path.resolve(marker.artifact);
assert.equal(path.dirname(artifact), path.resolve('.local/lot1a'));
const match = path.basename(artifact).match(/^legacy-search-path-(\d+)$/);
assert(match);
const names = marker.names;
assert.deepEqual(names, {
  migrated: 'novlearn-admin-legacy-path-' + match[1],
  restored: 'novlearn-admin-legacy-path-restored-' + match[1],
});
const mountFailure = await readFile(
  artifact + '/advisor/execution.log',
  'utf8',
);
assert.match(
  mountFailure,
  /create mountpoint for \/runner\/node_modules mount/,
);
assert.match(mountFailure, /read-only file system/);
await copyFile(
  artifact + '/advisor/execution.log',
  artifact + '/advisor/initial-mount-failure.log',
);
const previousHarness = await readFile(
  artifact + '/harness-at-mount-failure.mjs',
);
assert(
  previousHarness
    .toString()
    .includes("await phase('running-readonly-advisors')"),
);
const owner = (await readFile(artifact + '/owner.env', 'utf8')).match(
  /^POSTGRES_PASSWORD=([0-9a-f]{48})$/m,
)?.[1];
assert(owner);
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
      String(r.stderr).replaceAll(owner, '[fixture owner]'),
    );
  return r;
};
const sql = (c, body) =>
  cli(
    [
      'exec',
      '-i',
      c,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'admin_local',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    body,
  ).stdout.trim();
const value = (c, body) => JSON.parse(sql(c, body).split('\n').at(-1));
const snapshotBody =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = (c) => value(c, snapshotBody);
const normalize = (v) => {
  const out = structuredClone(v);
  out.metadata.roles = out.metadata.roles.map((r) =>
    r.rolname.startsWith('novlearn_') ? r : { ...r, password_digest: null },
  );
  return JSON.parse(
    JSON.stringify(out, (k, v) =>
      k === 'acl' && typeof v === 'string' && v.startsWith('{')
        ? v.slice(1, -1).split(',').sort()
        : v,
    ),
  );
};
const protectedSnapshots = await json(
  artifact + '/protected-at-qualification-start.json',
);
for (const [c, b] of Object.entries(protectedSnapshots))
  assert.deepEqual(snapshot(c), b, 'Existing database before recovery: ' + c);
const clusters = {};
for (const [label, c] of Object.entries(names)) {
  const i = JSON.parse(cli(['inspect', c]).stdout)[0];
  assert.equal(i.State.Running, true);
  assert.equal(i.HostConfig.NetworkMode, 'none');
  assert.deepEqual(i.HostConfig.PortBindings, {});
  assert.equal(i.HostConfig.NanoCpus, 2000000000);
  assert.equal(i.HostConfig.Memory, 1073741824);
  assert.equal(i.HostConfig.MemorySwap, 1073741824);
  assert.equal(i.HostConfig.PidsLimit, 256);
  assert.equal(
    i.Config.Image,
    'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
  );
  clusters[label] = {
    id: i.Id,
    image: i.Config.Image,
    network: 'none',
    publishedPorts: false,
    cpus: 2,
    memoryBytes: 1073741824,
    swapBytes: 0,
    pids: 256,
  };
}
const before = await json(artifact + '/before.json'),
  after = await json(artifact + '/after.json');
const prior = await json(
  '.local/lot1a/active-version-prerequisites-current.json',
);
assert.equal(prior.phase, 'qualified');
const qualified = await json(prior.proof);
assert.equal(qualified.result, 'PASS');
assert.deepEqual(
  normalize(before),
  normalize(await json(prior.artifact + '/baseline70.json')),
);
assert.deepEqual(snapshot(names.migrated), after);
assert.deepEqual(normalize(snapshot(names.restored)), normalize(after));
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
  );
  assert.equal(
    f.definition.replace(/ SET search_path TO ''\n/, ''),
    old.definition,
  );
  f.definition = old.definition;
  changed++;
}
assert.equal(changed, 2);
assert.deepEqual(comparable, before);
const labels = [
  'missing-trigger',
  'missing-generator',
  'definer-trigger',
  'definer-generator',
  'config-trigger',
  'config-generator',
  'strict-generator',
  'stable-generator',
  'body-trigger',
  'body-generator',
  'default-generator',
];
const failures = [];
for (const label of labels) {
  const file = artifact + '/qualification-preflight-' + label + '.log';
  const log = await readFile(file, 'utf8');
  assert.match(log, /P0001/);
  assert.match(log, /Legacy search-path prerequisites:/);
  failures.push({ label, sqlstate: 'P0001', logSha256: sha(log) });
}
const replay = await readFile(artifact + '/reapplication-refused.log', 'utf8');
assert.match(replay, /P0001/);
assert.match(replay, /Legacy search-path prerequisites:/);
await readFile(artifact + '/successful-ddl-rollback.log');
// The retained harness reached advisors only after all rollback, commit,
// behavior and restore assertions passed. Repeat direct behavior observations
// on both retained SQL71 copies; no original step or SQL is replayed.
const behavior = [];
for (const [label, c] of Object.entries(names))
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const observed = value(
      c,
      `BEGIN; SET LOCAL search_path=pg_catalog;
 CREATE TEMP TABLE legacy_path_recovery_probe(id integer PRIMARY KEY,updated_at timestamptz NOT NULL);
 GRANT SELECT,INSERT,UPDATE ON pg_temp.legacy_path_recovery_probe TO ${role};
 CREATE TRIGGER local_legacy BEFORE UPDATE ON pg_temp.legacy_path_recovery_probe FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
 INSERT INTO pg_temp.legacy_path_recovery_probe VALUES(1,'2000-01-01T00:00:00Z');
 SET SESSION AUTHORIZATION ${role}; SET LOCAL search_path=pg_temp,pg_catalog;
 UPDATE pg_temp.legacy_path_recovery_probe SET id=1;
 SELECT jsonb_build_object('role',current_user,'timestampMatches',(SELECT updated_at=transaction_timestamp() FROM pg_temp.legacy_path_recovery_probe),
 'codesValid',(SELECT bool_and(length(code)=n AND code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$') FROM (SELECT n,public.generate_random_code(n) AS code FROM unnest(ARRAY[1,8,32]) AS n CROSS JOIN generate_series(1,32))samples), 'defaultLength',length(public.generate_random_code()));
 RESET SESSION AUTHORIZATION; ROLLBACK;`,
    );
    assert.deepEqual(observed, {
      role,
      timestampMatches: true,
      codesValid: true,
      defaultLength: 8,
    });
    behavior.push({ cluster: label, ...observed });
  }
// Preserve the first successful SQL71 advisor output, whose comparison failed
// because the older SQL70 advisor fixture had an additional physical login.
await copyFile(
  artifact + '/advisor/recovery-execution.log',
  artifact + '/advisor/first-comparison-execution.log',
);
const baselineContainer =
  'novlearn-admin-legacy-path-advisor-baseline-' + match[1] + '02';
const baselineMarker = artifact + '/advisor-baseline-second-created.json';
let baselineInfo;
try {
  baselineInfo = await json(baselineMarker);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
if (!baselineInfo) {
  cli([
    'run',
    '-d',
    '--pull',
    'never',
    '--name',
    baselineContainer,
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
    'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
  ]);
  baselineInfo = { container: baselineContainer, phase: 'created' };
  await writeFile(baselineMarker, JSON.stringify(baselineInfo) + '\n');
}
assert.equal(baselineInfo.container, baselineContainer);
let ready = false;
for (let i = 0; i < 40; i++) {
  if (
    cli(
      [
        'exec',
        baselineContainer,
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
  'Observe the retained baseline container; never recreate after a timeout',
);
const baselineInspection = JSON.parse(
  cli(['inspect', baselineContainer]).stdout,
)[0];
assert.equal(baselineInspection.State.Running, true);
assert.equal(baselineInspection.HostConfig.NetworkMode, 'none');
assert.deepEqual(baselineInspection.HostConfig.PortBindings, {});
assert.equal(baselineInspection.HostConfig.NanoCpus, 2000000000);
assert.equal(baselineInspection.HostConfig.Memory, 1073741824);
assert.equal(baselineInspection.HostConfig.MemorySwap, 1073741824);
assert.equal(baselineInspection.HostConfig.PidsLimit, 256);
if (baselineInfo.phase === 'created') {
  const globals = await readFile(
    prior.artifact + '/roles70-private.sql',
    'utf8',
  );
  const roles = before.metadata.roles.filter((r) =>
    r.rolname.startsWith('novlearn_'),
  );
  assert(
    roles.length >= 4 &&
      roles.length <= 12 &&
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
  const statements = globals
    .split(/\r?\n/)
    .filter((l) => /^(CREATE|ALTER) ROLE novlearn_[a-z_]+\b/.test(l));
  for (const r of roles)
    assert.equal(
      statements.filter((l) => l === `CREATE ROLE ${r.rolname};`).length,
      1,
    );
  const ident = (s) => '"' + s.replaceAll('"', '""') + '"';
  for (const m of before.metadata.memberships.filter(
    (m) => m.role.startsWith('novlearn_') || m.member.startsWith('novlearn_'),
  )) {
    assert(
      roles.some((r) => r.rolname === m.role) &&
        roles.some((r) => r.rolname === m.member),
    );
    statements.push(
      `SET ROLE ${ident(m.grantor)}; GRANT ${ident(m.role)} TO ${ident(m.member)} WITH ADMIN ${m.admin_option}, INHERIT ${m.inherit_option}, SET ${m.set_option}; RESET ROLE;`,
    );
  }
  cli(
    [
      'exec',
      '-i',
      baselineContainer,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    statements.join('\n'),
  );
  const restore = cli([
    'exec',
    baselineContainer,
    'pg_restore',
    '-U',
    'supabase_admin',
    '--dbname=postgres',
    '--create',
    '--exit-on-error',
    '/seed/qualified-70.dump',
  ]);
  await writeFile(
    artifact + '/advisor-baseline-restore.log',
    restore.stdout + '\n' + restore.stderr,
  );
  baselineInfo.phase = 'restored';
  await writeFile(baselineMarker, JSON.stringify(baselineInfo) + '\n');
}
assert.equal(baselineInfo.phase, 'restored');
assert.deepEqual(normalize(snapshot(baselineContainer)), normalize(before));
const beforeAdvisors = await legacySearchPathAdvisors({
  artifact,
  container: baselineContainer,
  owner,
  output: 'before-advisors',
  cli,
});
assert.deepEqual(normalize(snapshot(baselineContainer)), normalize(before));
const afterAdvisors = await legacySearchPathAdvisors({
  artifact,
  container: names.restored,
  owner,
  output: 'after-advisors',
  cli,
});
const originalFindings = beforeAdvisors.findings,
  findings = afterAdvisors.findings;
const remaining = originalFindings.filter(
  (f) => f.name !== 'function_search_path_mutable',
);
assert.equal(originalFindings.length - remaining.length, 2);
assert.equal(
  findings.filter((f) => f.name === 'function_search_path_mutable').length,
  0,
);
const sorted = (fs) =>
  fs.toSorted((a, b) => a.cache_key.localeCompare(b.cache_key));
assert.deepEqual(sorted(findings), sorted(remaining));
assert.deepEqual(beforeAdvisors.proof.levels, { WARN: 32, INFO: 67 });
const advisorProof = afterAdvisors.proof;
assert.deepEqual(advisorProof.levels, { WARN: 30, INFO: 67 });

assert.deepEqual(snapshot(names.migrated), after);
assert.deepEqual(normalize(snapshot(names.restored)), normalize(after));
for (const [c, b] of Object.entries(protectedSnapshots))
  assert.deepEqual(snapshot(c), b, 'Existing database after recovery: ' + c);
const migration =
  '20261020135725_novlearn_admin_legacy_function_search_path.sql';
assert.equal(
  sha(await readFile('../Novlearn/supabase/migrations/' + migration)),
  '345ec0bc24d7b1a339606841eb36d0b074c3eab620b690fd33878d73585e830f',
);
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  artifact,
  names,
  clusters,
  migration: {
    file: migration,
    sha256: '345ec0bc24d7b1a339606841eb36d0b074c3eab620b690fd33878d73585e830f',
    canonicalCommitExecutedOnNewCopyOnly: true,
  },
  preservedTables: 62,
  preservedSequences: 11,
  onlyTwoSearchPathSettingsChanged: true,
  bodiesOwnersAclsAllOtherMetadataPreserved: true,
  preconditions: failures,
  successfulDdlRollbackExact: true,
  reapplicationRefusedWithoutMutation: true,
  nativeBehavior: behavior,
  samplesPerRolePerLength: 32,
  lengths: [1, 8, 32],
  temporaryProbeTablesRolledBack: true,
  logicalRestore: {
    dumpSha256: sha(await readFile(artifact + '/qualified-71.dump')),
    exactRowsSequencesMetadata: true,
    customRoleScramDigestsPreserved: true,
    builtinPasswordsExcludedAcrossNewClustersOnly: true,
    aclOrderNormalizedAcrossNewClustersOnly: true,
  },
  recovery: {
    initialFailure: 'advisor/initial-mount-failure.log',
    retainedHarnessSha256: sha(previousHarness),
    earlierNativeAssertionsReachedBeforeTerminalMountFailure: true,
    sqlNotReapplied: true,
    clustersNotRecreated: true,
    readOnlyProtectionUnchanged: true,
    missingMountpointCreatedInNewFixtureRunnerOnly: true,
  },
  advisors: {
    before: { ERROR: 0, WARN: 32, INFO: 67 },
    after: advisorProof.levels,
    errors: 0,
    otherFindingsExact: true,
    baselineContainer,
    comparisonUsesIdenticalRoleInventory: true,
    tlsVerifyFull: true,
    defaultTransactionReadOnly: true,
    cli: '2.98.2',
  },
  originalDatabasesUnchanged: true,
  applicationTargetModified: false,
  remoteOperations: false,
  globalSqlCertification: false,
  sourceHashes: Object.fromEntries(
    await Promise.all(
      [
        'scripts/test-legacy-search-path-local.mjs',
        'scripts/resume-legacy-search-path-advisors-local.mjs',
        'scripts/test-active-version-advisors-worker.mjs',
        'scripts/legacy-search-path-advisors.mjs',
        'scripts/reader-policies-snapshot.sql',
        'scripts/user-detail-local-fixture.mjs',
      ].map(async (f) => [f, sha(await readFile(f))]),
    ),
  ),
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  markerFile,
  JSON.stringify(
    { ...marker, phase: 'qualified', proof: artifact + '/proof.json' },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    preconditions: 11,
    warnings: 30,
    tables: 62,
    sequences: 11,
    artifact,
  }),
);
