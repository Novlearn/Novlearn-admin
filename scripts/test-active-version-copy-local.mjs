// Clone only the existing synthetic publication target. Never migrate it here.
// Retain the dump, new cluster, volumes and all proof/failed-run artifacts.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const source = 'novlearn-admin-publication-local-1792259029889-target-db';
const stamp = Date.now(),
  container = 'novlearn-admin-active-version-copy-' + stamp;
const artifact = path.resolve('.local/lot1a/active-version-copy-' + stamp);
await mkdir(artifact);
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const owner = randomBytes(24).toString('hex');
const cli = (args, input, binary = false, allowFailure = false) => {
  const r = spawnSync(
    exe,
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
      r.status,
      0,
      String(r.stderr).replaceAll(owner, '[fixture owner]'),
    );
  return r;
};
const checked = (args, input) => cli(args, input).stdout.trim();
const args = (db) => [
  'exec',
  '-i',
  db,
  'psql',
  '-qAt',
  '-U',
  'supabase_admin',
  '-d',
  'admin_local',
  '-v',
  'ON_ERROR_STOP=1',
];
const sql = (db, q) => checked(args(db), q);
const value = (db, q) => JSON.parse(sql(db, q).split('\n').at(-1));
const stored = (name, v) =>
  writeFile(artifact + '/' + name, JSON.stringify(v, null, 2) + '\n');
const snapSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snap = (db) => value(db, snapSql);
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const inspected = JSON.parse(checked(['inspect', source]))[0];
assert.equal(inspected.State.Running, true);
assert(
  JSON.parse(
    checked(['image', 'inspect', inspected.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const before = snap(source);
await stored('source-before.json', before);
assert.equal(Object.keys(before.rows).length, 62);
assert.equal(Object.keys(before.sequences).length, 11);
assert(
  !before.metadata.roles.some((r) => r.rolname === 'novlearn_activity_reader'),
);
const globals = checked([
  'exec',
  source,
  'pg_dumpall',
  '-U',
  'supabase_admin',
  '--roles-only',
]);
await writeFile(artifact + '/roles-private.sql', globals, { mode: 0o600 });
const roles = before.metadata.roles.filter((r) =>
  r.rolname.startsWith('novlearn_'),
);
assert(roles.length >= 3 && roles.length <= 12);
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
const dump = cli(
  [
    'exec',
    source,
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
assert(dump.subarray(0, 5).equals(Buffer.from('PGDMP')));
await writeFile(artifact + '/source-64.dump', dump);
assert.deepEqual(
  snap(source),
  before,
  'Source may not change during qualification',
);
await writeFile(
  artifact + '/owner.env',
  'POSTGRES_PASSWORD=' + owner + '\nPOSTGRES_DB=postgres\n',
  { mode: 0o600 },
);
await stored('state.json', {
  phase: 'creating',
  container,
  source,
  dumpSha256: sha(dump),
});
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
  pgImage,
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
  'Inspect this retained container; do not recreate after observation timeout',
);
checked(
  [
    'exec',
    '-i',
    container,
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
const restored = cli([
  'exec',
  container,
  'pg_restore',
  '-U',
  'supabase_admin',
  '--dbname=postgres',
  '--create',
  '--exit-on-error',
  '/seed/source-64.dump',
]);
await writeFile(
  artifact + '/restore.log',
  restored.stdout + '\n' + restored.stderr,
);
const normalized = (s) => {
  const x = structuredClone(s);
  x.metadata.roles = x.metadata.roles.filter((r) =>
    r.rolname.startsWith('novlearn_'),
  );
  return JSON.parse(
    JSON.stringify(x, (k, v) =>
      k === 'acl' && typeof v === 'string' && v.startsWith('{')
        ? v.slice(1, -1).split(',').sort()
        : v,
    ),
  );
};
assert.deepEqual(
  normalized(snap(container)),
  normalized(before),
  'Rows/sequences/schema/ACL/custom SCRAM identities restored exactly',
);
const files = (await readdir('../Novlearn/supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
assert.equal(files.length, 70);
const migrations = [];
for (const file of files.slice(64)) {
  const body = await readFile(
    path.resolve('../Novlearn/supabase/migrations', file),
    'utf8',
  );
  const r = cli(args(container), body);
  await writeFile(artifact + '/' + file + '.log', r.stdout + '\n' + r.stderr);
  migrations.push({ file, sha256: sha(body) });
}
const upgraded = snap(container);
await stored('upgraded.json', upgraded);
assert.deepEqual(upgraded.rows, before.rows, 'All 62 tables preserved exactly');
assert.deepEqual(
  upgraded.sequences,
  before.sequences,
  'All 11 sequences preserved exactly',
);
const baseline = snap(container);
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
const observations = [];
const parents = value(
  container,
  "SELECT coalesce(jsonb_agg(jsonb_build_object('catalogId',catalog_id,'parent',to_jsonb(e),'active',(SELECT to_jsonb(v) FROM public.exercise_versions v WHERE v.id=e.active_version_id),'latest',(SELECT max(revision) FROM public.exercise_versions v WHERE v.exercise_id=e.id))),'[]'::jsonb) FROM public.exercises e WHERE catalog_id IS NOT NULL;",
);
assert(
  parents.length >= 4,
  'Require genuine previously published synthetic examples',
);
for (const p of [
  ...parents,
  {
    catalogId: 'ad700000-0000-4000-8000-000000000099',
    parent: null,
    active: null,
    latest: null,
  },
]) {
  const raw = value(
    container,
    `BEGIN READ ONLY; SET SESSION AUTHORIZATION novlearn_active_version_reader; PREPARE observe(uuid) AS ${query}; EXECUTE observe('${p.catalogId}'); RESET SESSION AUTHORIZATION;ROLLBACK;`,
  );
  const decoded = domain.decodeActiveVersionSnapshot(
    { ...raw, environment: 'local-copy', targetKey: 'local-http-fixture' },
    {
      environment: 'local-copy',
      targetKey: 'local-http-fixture',
      catalogId: p.catalogId,
    },
  );
  assert(decoded);
  const state = domain.activeVersionState(decoded);
  if (!p.parent) assert.equal(state.state, 'absent');
  else if (!p.active) assert.equal(state.state, 'unpublished');
  else {
    assert.equal(state.state, 'active');
    assert.equal(decoded.active.versionId, p.active.id);
    assert.equal(decoded.active.revision, p.active.revision);
    assert.equal(decoded.active.definitionSha256, p.active.definition_sha256);
  }
  observations.push({
    catalogId: p.catalogId,
    state: state.state,
    activeRevision: decoded.active?.revision ?? null,
    latestRevision: p.latest,
    snapshot: decoded,
  });
}
assert(
  observations.some(
    (o) => o.activeRevision !== null && o.latestRevision > o.activeRevision,
  ),
  'Existing rollback must prove active revision differs from MAX(revision)',
);
const actualAudit = value(
  container,
  'BEGIN READ ONLY;SET SESSION AUTHORIZATION novlearn_active_version_reader;' +
    audit +
    'RESET SESSION AUTHORIZATION;ROLLBACK;',
);
assert.equal(actualAudit.columns.length, 14);
assert.equal(actualAudit.policyScopeVerified, true);
assert.equal(actualAudit.rlsTables, 2);
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
  assert.equal(actualAudit[key], false, key);
await stored('reader-audit.json', actualAudit);
const denials = [];
for (const statement of [
  'SELECT definition FROM public.exercise_versions',
  'SELECT * FROM public.exercise_versions',
  'SELECT title FROM public.exercises',
  'SELECT email FROM auth.users',
  'SELECT * FROM public.profiles',
  'SELECT * FROM public.exercise_attempts',
  'SELECT * FROM public.duel_attempts',
  'SELECT * FROM novlearn_admin_private.publication_operations',
  'UPDATE public.exercises SET publication_epoch=publication_epoch',
  'DELETE FROM public.exercise_versions WHERE false',
  'INSERT INTO public.exercises(id) VALUES(-70001)',
  'TRUNCATE public.exercises',
  'CREATE TEMP TABLE attempted_write(i int)',
  'CREATE TABLE public.attempted_write(i int)',
  "SELECT nextval('public.exercises_id_seq')",
  'SET ROLE novlearn_publication_executor',
]) {
  const r = cli(
    args(container),
    `\\set VERBOSITY verbose\nBEGIN;SET SESSION AUTHORIZATION novlearn_active_version_reader;${statement};ROLLBACK;`,
    false,
    true,
  );
  await writeFile(
    artifact + '/denial-' + (denials.length + 1) + '.log',
    r.stdout + '\n' + r.stderr,
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /42501/);
  denials.push(statement);
}
// A restrictive policy would hide an existing target. The audit must detect it.
const drift = value(
  container,
  'BEGIN;CREATE POLICY unexpected_active_filter ON public.exercises AS RESTRICTIVE FOR SELECT TO novlearn_active_version_reader USING(false);SET SESSION AUTHORIZATION novlearn_active_version_reader;' +
    audit +
    'RESET SESSION AUTHORIZATION;ROLLBACK;',
);
assert.equal(drift.policyScopeVerified, false);
assert.deepEqual(
  snap(container),
  baseline,
  'Reads, denied writes and policy-drift transaction preserve the complete copy',
);
assert.deepEqual(
  snap(source),
  before,
  'The live synthetic target remains entirely unchanged',
);
const sourceHashes = {};
for (const f of [
  'scripts/active-version-query.sql',
  'scripts/active-version-reader-audit.sql',
  'src/lib/active-version.ts',
])
  sourceHashes[f] = sha(await readFile(f));
const proof = {
  result: 'PASS',
  at: new Date().toISOString(),
  scope:
    'isolated populated SQL64 target copy upgraded through SQL70; native session authorization only',
  source,
  container,
  artifact,
  dumpSha256: sha(dump),
  migrations,
  sourceHashes,
  observations,
  denials,
  denialSqlstate: '42501',
  restrictivePolicyDetected: true,
  sourceUnchanged: true,
  copyUnchangedByTests: true,
  preservedTables: 62,
  preservedSequences: 11,
  realTls: false,
  physicalLoginProvisioned: false,
};
await stored('proof.json', proof);
await stored('state.json', {
  phase: 'qualified-native',
  container,
  source,
  proof: artifact + '/proof.json',
});
await writeFile(
  '.local/lot1a/active-version-copy-current.json',
  JSON.stringify(
    {
      phase: 'qualified-native',
      container,
      artifact,
      proof: artifact + '/proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    container,
    observations: observations.length,
    denials: denials.length,
    artifact,
  }),
);
