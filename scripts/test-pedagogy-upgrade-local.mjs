// Upgrade one explicit SQL-68 restoration, with an actual before/after RLS
// matrix. Never accepts a URL, an application database or a remote service.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [container, migrationPath, nativeProofArgument, ...extra] =
  process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-user-detail-restore-\d+$/);
const migrationFile = path.resolve(migrationPath ?? '');
assert.equal(
  path.dirname(migrationFile).toLowerCase(),
  path.resolve('../Novlearn/supabase/migrations').toLowerCase(),
);
assert.match(
  path.basename(migrationFile),
  /^\d{14}_novlearn_admin_pedagogy_readonly\.sql$/,
);
const migration = await readFile(migrationFile, 'utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const marker = '.local/lot1a/pedagogy-upgrade-current.json';
await assert.rejects(access(marker), (error) => error.code === 'ENOENT');
const artifact = path.resolve('.local/lot1a/pedagogy-upgrade-' + Date.now());
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
const nominal = 'novlearn_pedagogy_reader';
assert.equal(
  before.metadata.roles.some((r) => r.rolname === nominal),
  false,
);
const nativeProofPath = path.resolve(nativeProofArgument ?? '');
assert.equal(
  path.dirname(path.dirname(nativeProofPath)).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(
  path.basename(path.dirname(nativeProofPath)),
  /^pedagogy-readonly-\d+$/,
);
assert.equal(path.basename(nativeProofPath), 'proof.json');
const native = JSON.parse(await readFile(nativeProofPath, 'utf8'));
assert(native.result.startsWith('PASS'));
assert.equal(native.sourceColumns, 32);
assert.equal(native.migrationSha256, sha(migration));
for (const [file, h] of Object.entries(native.sourceHashes))
  assert.equal(
    sha(await readFile(file)),
    h,
    'Native-tested input changed: ' + file,
  );
const nativeSnapshot = JSON.parse(
  await readFile(native.artifact + '/before.json', 'utf8'),
);
const body = migration
  .replace(/^BEGIN;\r?\n/m, '')
  .replace(/^COMMIT;\r?\n?$/m, '');
assert.notEqual(body, migration);
const faults = [
  [
    'public-profile-read',
    'GRANT SELECT(id) ON public.profiles TO PUBLIC;',
    'Pedagogy reader effective confinement is missing',
  ],
  [
    'public-auth-email',
    'GRANT SELECT(email) ON auth.users TO PUBLIC;',
    'Pedagogy reader effective confinement is missing',
  ],
  [
    'public-column-write',
    'GRANT UPDATE(is_correct) ON public.exercise_attempts TO PUBLIC;',
    'Pedagogy reader effective confinement is missing',
  ],
  [
    'public-sequence-read',
    'GRANT SELECT ON SEQUENCE public.exercise_attempts_id_seq TO PUBLIC;',
    'Pedagogy reader effective confinement is missing',
  ],
  [
    'existing-reader',
    `CREATE ROLE ${nominal} NOLOGIN;`,
    'Pedagogy reader already exists',
  ],
  [
    'public-predicate',
    'ALTER POLICY "L\'utilisateur voit ses tentatives" ON public.exercise_attempts USING (false);',
    'Expected SQL68 policy',
  ],
  [
    'restrictive-predicate',
    'ALTER POLICY novlearn_activity_identity_select ON public.duels USING (false);',
    'Expected SQL68 policy',
  ],
  [
    'alternative-public',
    'CREATE POLICY local_pedagogy_extra ON public.exercise_attempts FOR SELECT TO PUBLIC USING (true);',
    'Unexpected alternative PUBLIC SELECT policy',
  ],
  [
    'taxonomy-predicate',
    'ALTER POLICY "Public read chapters" ON public.chapters USING (false);',
    'Expected public taxonomy SELECT policies',
  ],
];
for (const [label, fault, wanted] of faults) {
  const r = cli(args, 'BEGIN;' + fault + body + 'ROLLBACK;');
  await stored('negative-' + label + '.json', {
    stdout: r.stdout,
    stderr: r.stderr,
    exitCode: r.status,
  });
  assert.notEqual(r.status, 0);
  assert(r.stderr.includes(wanted), r.stderr);
  assert.deepEqual(
    snapshot(),
    before,
    'Negative preflight must roll back completely',
  );
}
const dryRun = value(
  'BEGIN;' + body + detailRowsFunction + snapshotSource + 'ROLLBACK;',
);
await stored('dry-run.json', dryRun);
assert.deepEqual(snapshot(), before);
function stripAcl(acl, expected) {
  if (acl === null) return { acl, removed: false };
  assert(acl.startsWith('{') && acl.endsWith('}'));
  const entries = acl.slice(1, -1).split(',');
  const added = entries.filter((s) => s.startsWith(nominal + '='));
  assert(added.length <= 1);
  if (!added.length) return { acl, removed: false };
  assert.equal(added[0], nominal + '=' + expected);
  const remaining = entries.filter((s) => s !== added[0]);
  return {
    acl: remaining.length ? '{' + remaining.join(',') + '}' : null,
    removed: true,
  };
}
function checkUpgrade(after) {
  assert.deepEqual(after.rows, before.rows);
  assert.deepEqual(after.sequences, before.sequences);
  assert.deepEqual(
    after.policies,
    nativeSnapshot.policies,
    'Policies must match the actually replayed and natively tested SQL69 baseline',
  );
  assert.equal(after.policies.length, before.policies.length + 2);
  const metadata = structuredClone(after.metadata);
  const addedRole = metadata.roles.filter((r) => r.rolname === nominal);
  assert.equal(addedRole.length, 1);
  assert.deepEqual(
    addedRole[0],
    nativeSnapshot.metadata.roles.find((r) => r.rolname === nominal),
  );
  metadata.roles = metadata.roles.filter((r) => r.rolname !== nominal);
  const allowed = nativeSnapshot.metadata.columns.filter((c) =>
    (c.acl ?? '').includes(nominal + '='),
  );
  assert.equal(allowed.length, 32);
  let columns = 0;
  for (const c of metadata.columns) {
    const relation = metadata.relations.find(
      (r) => r.schema === c.schema && r.name === c.table_name,
    );
    const changed = stripAcl(c.acl, 'r/' + relation.owner);
    if (changed.removed) {
      assert(
        allowed.some(
          (x) =>
            x.schema === c.schema &&
            x.table_name === c.table_name &&
            x.attname === c.attname,
        ),
        'Unexpected column grant',
      );
      columns++;
      c.acl = changed.acl;
    }
  }
  assert.equal(columns, 32);
  let schemas = 0;
  for (const s of metadata.schemas) {
    const changed = stripAcl(s.acl, 'U/' + s.owner);
    if (changed.removed) {
      assert(['auth', 'public'].includes(s.name));
      s.acl = changed.acl;
      schemas++;
    }
  }
  assert.equal(schemas, 2);
  assert.deepEqual(
    metadata,
    before.metadata,
    'Every preexisting ACL, role, credential digest and object must remain exact after subtracting only the enumerated new grants',
  );
}
checkUpgrade(dryRun);
const applied = cli(args, migration);
await stored('apply.json', {
  stdout: applied.stdout,
  stderr: applied.stderr,
  exitCode: applied.status,
});
assert.equal(applied.status, 0, applied.stderr);
await writeFile(
  marker,
  JSON.stringify({ artifact, container, phase: 'upgraded' }, null, 2) + '\n',
);
const after = snapshot();
await stored('after.json', after);
assert.deepEqual(after, dryRun);
checkUpgrade(after);
const matrixAfter = matrix();
await stored('matrix-after.json', matrixAfter);
assert.deepEqual(
  matrixAfter,
  matrixBefore,
  'All old physical roles and claim contexts must retain their exact readable rows and denials',
);
assert.deepEqual(snapshot(), after);
const duplicate = cli(args, migration);
await stored('duplicate.json', {
  stdout: duplicate.stdout,
  stderr: duplicate.stderr,
  exitCode: duplicate.status,
});
assert.notEqual(duplicate.status, 0);
assert(duplicate.stderr.includes('Pedagogy reader already exists'));
assert.deepEqual(snapshot(), after);
const proof = {
  result: 'PASS for populated SQL69 upgrade and unchanged prior-role access',
  date: new Date().toISOString(),
  artifact,
  container,
  migrationFile,
  migrationSha256: sha(migration),
  sourceHashes: {
    'scripts/test-pedagogy-upgrade-local.mjs': sha(
      await readFile('scripts/test-pedagogy-upgrade-local.mjs'),
    ),
    'scripts/reader-policies-snapshot.sql': sha(
      await readFile('scripts/reader-policies-snapshot.sql'),
    ),
  },
  nativeQueryProof: nativeProofPath,
  oldPhysicalRoles: roles.length,
  claimContexts: contexts.length,
  tablesPerContext: tables.length,
  actualQueriesPerMatrix: roles.length * contexts.length * tables.length,
  oldRoleMatricesExact: true,
  negativePreflights: faults.length,
  allNegativeFixturesRolledBack: true,
  dryRunExact: true,
  duplicateApplicationRefused: true,
  newPhysicalRoleUnprivileged: true,
  only32ColumnSelectAndTwoSchemaUsageGrantsAdded: true,
  noMembershipOrLoginAdded: true,
  preexistingMetadataAclRolesAndCredentialDigestsExact: true,
  tableRowsCompared: 62,
  sequencesCompared: 11,
  allRowsAndSequencesExact: true,
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
    queriesPerMatrix: proof.actualQueriesPerMatrix,
    oldDataTables: 62,
  }),
);
