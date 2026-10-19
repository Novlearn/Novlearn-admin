// Upgrade one explicit SQL-67 restoration, with an actual before/after RLS
// matrix. Never accepts a URL, an application database or a remote service.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [container, migrationPath, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-user-detail-restore-\d+$/);
const migrationFile = path.resolve(migrationPath ?? '');
assert.equal(
  path.dirname(migrationFile).toLowerCase(),
  path.resolve('../Novlearn/supabase/migrations').toLowerCase(),
);
assert.match(
  path.basename(migrationFile),
  /^\d{14}_consolidate_novlearn_admin_reader_policies\.sql$/,
);
const migration = await readFile(migrationFile, 'utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const marker = '.local/lot1a/reader-policies-upgrade-current.json';
await assert.rejects(access(marker), (error) => error.code === 'ENOENT');
const artifact = path.resolve(
  '.local/lot1a/reader-policies-upgrade-' + Date.now(),
);
await mkdir(artifact);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) =>
  spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 33554432,
    },
  );
const checked = (args, input) => {
  const result = cli(args, input);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const state = JSON.parse(checked(['inspect', container]))[0];
assert.equal(state.State.Running, true);
assert.equal(state.HostConfig.NetworkMode, 'none');
assert.deepEqual(state.HostConfig.PortBindings, {});
const digest =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(
    checked(['image', 'inspect', state.Image]),
  )[0].RepoDigests.includes(digest),
);
const args = [
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
];
const sql = (text) => checked(args, text);
const value = (text) => JSON.parse(sql(text).split('\n').at(-1));
const snapshotSource = await readFile(
  'scripts/reader-policies-snapshot.sql',
  'utf8',
);
const snapshot = () =>
  value(
    'BEGIN;\n' + detailRowsFunction + '\n' + snapshotSource + '\nROLLBACK;',
  );
const before = snapshot();
assert.equal(Object.keys(before.rows).length, 62);
assert.equal(before.rows['auth.users'].length, 4);
assert.equal(before.rows['public.exercise_attempts'].length, 7);
assert.equal(before.rows['public.duel_attempts'].length, 2);
assert.equal(before.rows['public.duels'].length, 3);
assert.equal(before.rows['public.user_progress'].length, 4);
assert.equal(before.rows['public.user_competence_scores'].length, 4);
assert.equal(Object.keys(before.sequences).length, 11);
const stored = async (name, data) =>
  writeFile(artifact + '/' + name, JSON.stringify(data, null, 2) + '\n');
await stored('before.json', before);
await stored('state.json', {
  phase: 'baseline',
  container,
  migrationFile,
  migrationSha256: sha(migration),
});
await writeFile(
  marker,
  JSON.stringify({ artifact, container, phase: 'baseline' }, null, 2) + '\n',
);
const tables = [
  'auth.users',
  'public.profiles',
  'public.exercises',
  'public.chapters',
  'public.competences',
  'public.exercise_attempts',
  'public.duel_attempts',
  'public.duels',
  'public.user_progress',
  'public.user_competence_scores',
];
const literal = (text) => "'" + text.replaceAll("'", "''") + "'";
const identifier = (text) => '"' + text.replaceAll('"', '""') + '"';
// Built-in pg_* administrative roles are not application identities. Every
// existing non-built-in role, including the actual API/logins, is exercised.
const roles = before.metadata.roles
  .map((role) => role.rolname)
  .filter((name) => !name.startsWith('pg_'))
  .sort();
for (const role of [
  'anon',
  'authenticated',
  'service_role',
  'novlearn_activity_reader',
  'novlearn_users_reader',
  'novlearn_user_detail_reader',
  'novlearn_admin_users_service',
  'novlearn_admin_user_detail_service',
])
  assert(roles.includes(role));
const uuid = (last) => 'a8100000-0000-4000-8000-00000000000' + last;
const contexts = [
  { name: 'no-claims', claims: {} },
  {
    name: 'permanent-A',
    claims: { sub: uuid(1), role: 'authenticated', is_anonymous: false },
  },
  {
    name: 'guest-B',
    claims: { sub: uuid(2), role: 'authenticated', is_anonymous: true },
  },
  {
    name: 'permanent-C',
    claims: { sub: uuid(3), role: 'authenticated', is_anonymous: false },
  },
  {
    name: 'permanent-D',
    claims: { sub: uuid(4), role: 'authenticated', is_anonymous: false },
  },
  {
    name: 'forged-admin-guest-A',
    claims: {
      sub: uuid(1),
      role: 'authenticated',
      is_anonymous: true,
      user_metadata: { role: 'admin' },
    },
  },
  {
    name: 'forged-service-guest-B',
    claims: { sub: uuid(2), role: 'service_role', is_anonymous: true },
  },
  {
    name: 'unknown-account',
    claims: { sub: uuid(9), role: 'authenticated', is_anonymous: false },
  },
];
const projections = value(`SELECT jsonb_object_agg(role_name,columns) FROM (
 SELECT r.rolname AS role_name,jsonb_object_agg(target,cols ORDER BY target) AS columns FROM pg_roles r CROSS JOIN
 unnest(ARRAY[${tables.map(literal).join(',')}]) target CROSS JOIN LATERAL
 (SELECT coalesce(jsonb_agg(a.attname ORDER BY a.attnum),'[]'::jsonb) AS cols FROM pg_attribute a
 WHERE a.attrelid=target::regclass AND a.attnum>0 AND NOT a.attisdropped
 AND has_column_privilege(r.oid,a.attrelid,a.attnum,'SELECT')) selected
 WHERE r.rolname !~ '^pg_' GROUP BY r.rolname) all_roles;`);
function matrix() {
  const parts = [
    `BEGIN; SET LOCAL timezone='UTC';
CREATE FUNCTION pg_temp.reader_policy_read(statement text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE result jsonb; BEGIN EXECUTE statement INTO result; RETURN result;
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('sqlstate',SQLSTATE,'error',SQLERRM); END; $$;
DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO PUBLIC',
 (SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema())); END; $$;`,
  ];
  for (const role of roles)
    for (const context of contexts) {
      const outputs = [];
      for (const table of tables) {
        const columns = projections[role][table];
        // A role without column grants must fail an actual query; an empty list
        // is never substituted for a permission error.
        const projected = columns.length
          ? columns.map(identifier).join(',')
          : table.endsWith('user_competence_scores')
            ? 'user_id'
            : 'id';
        const query = `SELECT jsonb_build_object('count',count(*)::text,'hashes',coalesce(jsonb_agg(md5(to_jsonb(row_value)::text) ORDER BY md5(to_jsonb(row_value)::text)),'[]'::jsonb)) FROM (SELECT ${projected} FROM ${table}) row_value`;
        outputs.push(
          literal(table),
          `pg_temp.reader_policy_read(${literal(query)})`,
        );
      }
      parts.push(`SET LOCAL ROLE ${identifier(role)};
SET LOCAL request.jwt.claim.sub=''; SET LOCAL request.jwt.claim.role='';
SET LOCAL request.jwt.claims=${literal(JSON.stringify(context.claims))};
SELECT jsonb_build_object('role',current_user,'context',${literal(context.name)},'tables',jsonb_build_object(${outputs.join(',')}));
RESET ROLE;`);
    }
  parts.push('ROLLBACK;');
  const result = sql(parts.join('\n'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(result.length, roles.length * contexts.length);
  for (const row of result) {
    assert.equal(Object.keys(row.tables).length, tables.length);
    for (const item of Object.values(row.tables))
      if (item.sqlstate)
        assert.equal(
          item.sqlstate,
          '42501',
          'Unexpected query failure in RLS matrix',
        );
  }
  const detailed = result.find(
    (row) =>
      row.role === 'novlearn_user_detail_reader' && row.context === 'no-claims',
  );
  for (const [table, count] of Object.entries({
    'auth.users': '4',
    'public.profiles': '4',
    'public.exercise_attempts': '7',
    'public.duel_attempts': '2',
    'public.duels': '3',
    'public.user_progress': '4',
    'public.user_competence_scores': '4',
  }))
    assert.equal(detailed.tables[table].count, count, table);
  const permanent = result.find(
    (row) => row.role === 'authenticated' && row.context === 'permanent-A',
  );
  const guest = result.find(
    (row) => row.role === 'authenticated' && row.context === 'guest-B',
  );
  assert.equal(permanent.tables['public.user_progress'].count, '3');
  assert.equal(guest.tables['public.user_progress'].count, '0');
  assert.equal(guest.tables['public.user_competence_scores'].count, '0');
  return result;
}
const matrixBefore = matrix();
await stored('matrix-before.json', matrixBefore);
assert.deepEqual(
  snapshot(),
  before,
  'Read matrix must not change persistent state',
);
assert.equal((migration.match(/^BEGIN;$/gm) ?? []).length, 1);
assert.equal((migration.match(/^COMMIT;$/gm) ?? []).length, 1);
const body = migration
  .replace(/^BEGIN;\r?\n/m, '')
  .replace(/^COMMIT;\r?\n?$/m, '');
const faults = [
  [
    'public-predicate',
    'ALTER POLICY "Public read chapters" ON public.chapters USING (false);',
    'Unexpected PUBLIC SELECT baseline',
  ],
  [
    'reader-predicate',
    'ALTER POLICY novlearn_detail_read ON public.chapters USING (false);',
    'Unexpected reader SELECT baseline',
  ],
  [
    'extra-public-policy',
    'CREATE POLICY reader_policy_unreviewed ON public.chapters FOR SELECT TO PUBLIC USING (true);',
    'Unexpected PUBLIC SELECT baseline',
  ],
  [
    'reader-login',
    'ALTER ROLE novlearn_user_detail_reader LOGIN;',
    'Expected the three SQL 65/66/67 isolated nominal readers',
  ],
];
for (const [name, fault, expected] of faults) {
  const result = cli(args, 'BEGIN;\n' + fault + '\n' + body + '\nROLLBACK;');
  await writeFile(
    artifact + '/negative-' + name + '.log',
    result.stdout + '\n' + result.stderr,
  );
  assert.equal(result.status, 3, name);
  assert(result.stderr.includes(expected), name);
  assert.deepEqual(
    snapshot(),
    before,
    'Failed preflight must roll back all injected changes',
  );
}
// First execute the real migration inside an explicit rollback, then compare
// the dry-run snapshot with the actual committed upgrade below.
const dryRun = value(
  'BEGIN;\n' +
    body +
    '\n' +
    detailRowsFunction +
    '\n' +
    snapshotSource +
    '\nROLLBACK;',
);
await stored('dry-run.json', dryRun);
assert.deepEqual(
  snapshot(),
  before,
  'Dry-run transaction must leave the source exact',
);
const application = cli(args, migration);
await writeFile(
  artifact + '/upgrade.log',
  application.stdout + '\n' + application.stderr,
);
assert.equal(application.status, 0, application.stderr);
await writeFile(
  marker,
  JSON.stringify({ artifact, container, phase: 'upgraded' }, null, 2) + '\n',
);
const after = snapshot();
await stored('after.json', after);
assert.deepEqual(after, dryRun);
assert.deepEqual(after.rows, before.rows);
assert.deepEqual(after.sequences, before.sequences);
assert.deepEqual(after.metadata, before.metadata);
const removed = before.policies.filter(
  (old) =>
    !after.policies.some(
      (p) =>
        p.schemaname === old.schemaname &&
        p.tablename === old.tablename &&
        p.policyname === old.policyname,
    ),
);
assert.equal(removed.length, 13);
assert(
  removed.every(
    (p) =>
      p.schemaname === 'public' &&
      p.cmd === 'SELECT' &&
      p.permissive === 'PERMISSIVE' &&
      p.qual === 'true' &&
      p.with_check === null &&
      p.roles.length === 1 &&
      [
        'novlearn_activity_reader',
        'novlearn_users_reader',
        'novlearn_user_detail_reader',
      ].includes(p.roles[0]),
  ),
);
const changed = [];
for (const p of after.policies) {
  const old = before.policies.find(
    (item) =>
      item.schemaname === p.schemaname &&
      item.tablename === p.tablename &&
      item.policyname === p.policyname,
  );
  assert(old, 'No new policy is expected');
  assert.deepEqual(
    { ...p, qual: old.qual },
    old,
    'Only the reviewed USING expression may change',
  );
  if (p.qual !== old.qual) {
    assert.equal(p.cmd, 'SELECT');
    assert.equal(p.permissive, 'PERMISSIVE');
    assert.deepEqual(p.roles, ['public']);
    changed.push(p.tablename);
  }
}
assert.deepEqual(changed.sort(), [
  'duel_attempts',
  'duels',
  'exercise_attempts',
  'user_competence_scores',
  'user_progress',
]);
const matrixAfter = matrix();
await stored('matrix-after.json', matrixAfter);
assert.deepEqual(
  matrixAfter,
  matrixBefore,
  'Every role/context must retain its exact row multiset or actual denial',
);
assert.deepEqual(snapshot(), after);
const repeated = cli(args, migration);
await writeFile(
  artifact + '/duplicate-application.log',
  repeated.stdout + '\n' + repeated.stderr,
);
assert.equal(repeated.status, 3);
assert(repeated.stderr.includes('Unexpected reader SELECT baseline'));
assert.deepEqual(snapshot(), after);
const sourceHashes = {};
for (const file of [
  'scripts/test-reader-policies-local.mjs',
  'scripts/reader-policies-snapshot.sql',
  'scripts/user-detail-local-fixture.mjs',
])
  sourceHashes[file] = sha(await readFile(file));
const proof = {
  result: 'PASS',
  date: new Date().toISOString(),
  artifact,
  container,
  migrationFile,
  migrationSha256: sha(migration),
  sourceHashes,
  rolesTested: roles.length,
  claimsContextsPerRole: contexts.length,
  tablesPerContext: tables.length,
  actualQueriesPerMatrix: matrixBefore.length * tables.length,
  exactBeforeAfterRoleMatrices: true,
  nonemptyNominalAndPermanentPositiveCases: true,
  actualGuestRestrictions: true,
  negativePreflights: faults.length,
  allNegativeFixturesRolledBack: true,
  dryRunExact: true,
  duplicateApplicationRefused: true,
  redundantSelectPoliciesRemoved: 13,
  publicSelectPredicatesConsolidated: 5,
  allOtherPoliciesExact: true,
  tableRowsCompared: Object.keys(after.rows).length,
  sequencesCompared: Object.keys(after.sequences).length,
  functionsCompared: after.metadata.functions.length,
  relationsCompared: after.metadata.relations.length,
  allMetadataAclRolesAndPasswordDigestsExact: true,
  allDataAndSequencesExact: true,
  snapshotTempHelperUsageGrantedOnlyInsideRollback: true,
  realLoginOrTlsExecuted: false,
  browserExecuted: false,
  remoteOperations: false,
};
await stored('proof.json', proof);
await writeFile(
  marker,
  JSON.stringify(
    {
      artifact,
      container,
      phase: 'qualified',
      proof: artifact + '/proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact,
    roles: roles.length,
    actualQueriesPerMatrix: proof.actualQueriesPerMatrix,
    removed: 13,
    tablesPreserved: 62,
  }),
);
