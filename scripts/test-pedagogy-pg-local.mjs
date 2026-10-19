// Qualifies a new identity only on the explicit, previously restored SQL69 copy.
// No URL, operational database, existing credential rotation or remote target.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [container, flag, resume, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-user-detail-restore-\d+$/);
assert(flag === undefined || (flag === '--resume' && resume));
const certified = JSON.parse(
  await readFile('docs/pedagogy-readonly-proof.json', 'utf8'),
);
assert.equal(certified.restoration.proof.restored, container);
assert.equal(
  certified.restoration.proof.result,
  'PASS for SQL-69 populated logical restoration',
);
const marker = '.local/lot1a/pedagogy-pg-current.json';
const retained = resume ? JSON.parse(await readFile(marker, 'utf8')) : null;
if (!resume) await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
if (retained) {
  assert.equal(retained.container, container);
  assert(
    ['provisioned', 'qualified'].includes(retained.phase),
    'Inspect partial provisioning; never silently rerun a seed or rotate credentials',
  );
}
const artifact = path.resolve(
  resume ?? '.local/lot1a/pedagogy-pg-' + Date.now(),
);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^pedagogy-pg-\d+$/);
if (!resume) await mkdir(artifact);
else assert.equal(retained.artifact, artifact);
const stored = async (name, data) =>
  writeFile(artifact + '/' + name, JSON.stringify(data, null, 2) + '\n');
const oldPrivate = resume
  ? JSON.parse(await readFile(artifact + '/private.json', 'utf8'))
  : null;
const password = oldPrivate
  ? decodeURIComponent(new URL(oldPrivate.config.url).password)
  : randomBytes(24).toString('hex');
const redact = (t) => String(t ?? '').replaceAll(password, '[fixture secret]');
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, expectedFailure = false) => {
  const r = spawnSync(
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
  if (!expectedFailure) assert.equal(r.status, 0, redact(r.stderr));
  return { ...r, stdout: redact(r.stdout), stderr: redact(r.stderr) };
};
const checked = (args, input) => cli(args, input).stdout.trim();
const inspection = JSON.parse(checked(['inspect', container]))[0];
assert.equal(
  inspection.State.Running,
  true,
  'Start this same retained qualified fixture explicitly',
);
assert.equal(inspection.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspection.HostConfig.PortBindings, {});
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(
    checked(['image', 'inspect', inspection.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
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
const sql = (q) => checked(args, q);
const value = (q) => JSON.parse(sql(q).split('\n').at(-1));
const snapshotSql = await readFile(
  'scripts/reader-policies-snapshot.sql',
  'utf8',
);
const snapshot = () =>
  value('BEGIN;' + detailRowsFunction + snapshotSql + 'ROLLBACK;');
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_pedagogy_reader' AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls;",
  ),
  '1',
);
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_admin_pedagogy_service';",
  ),
  resume ? '1' : '0',
  'Never silently reuse an existing identity',
);
if (!resume) {
  const before = snapshot();
  assert.equal(Object.keys(before.rows).length, 62);
  assert.equal(before.rows['auth.users'].length, 4);
  assert.equal(before.rows['public.exercises'].length, 0);
  const qualifiedRows = JSON.parse(
    await readFile(
      path.dirname(certified.restoration.artifact) +
        '/restore-source-rows.json',
      'utf8',
    ),
  );
  assert.deepEqual(before.rows, qualifiedRows);
  await stored('before-provision.json', before);
  checked([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '--dbname=activity_copy',
    '--format=custom',
    '--create',
    '--file=/tmp/pedagogy-before-provision.dump',
  ]);
  checked([
    'cp',
    container + ':/tmp/pedagogy-before-provision.dump',
    artifact + '/before-provision.dump',
  ]);
  for (const label of ['server', 'untrusted'])
    checked([
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'none',
      '--memory',
      '128m',
      '--memory-swap',
      '128m',
      '--pids-limit',
      '32',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--mount',
      `type=bind,source=${artifact},target=/certificates`,
      nodeImage,
      'openssl',
      'req',
      '-new',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      '/certificates/' + label + '.key',
      '-out',
      '/certificates/' + label + '.crt',
      '-subj',
      '/CN=pedagogy-local-fixture',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-days',
      '7',
    ]);
  const config = {
    url: `postgresql://novlearn_admin_pedagogy_service:${password}@127.0.0.1:55436/activity_copy`,
    ca: await readFile(artifact + '/server.crt', 'utf8'),
    environment: 'local-copy',
  };
  await stored('private.json', {
    artifact,
    container,
    config,
    untrustedCa: await readFile(artifact + '/untrusted.crt', 'utf8'),
  });
  await writeFile(
    marker,
    JSON.stringify({ artifact, container, phase: 'prepared' }, null, 2) + '\n',
  );
  const query = (
    await readFile('scripts/pedagogy-statistics-query.sql', 'utf8')
  )
    .trim()
    .replace(/;$/, '');
  const baseline = value(
    `BEGIN;SET SESSION AUTHORIZATION novlearn_pedagogy_reader;PREPARE pedagogy(date,date,uuid,text,text,text,text,text,text,bigint) AS ${query};EXECUTE pedagogy('2026-10-15','2026-10-18',NULL,NULL,NULL,NULL,'all','chapter','attempts',1);RESET SESSION AUTHORIZATION;ROLLBACK;`,
  );
  await stored('baseline-statistics.json', baseline);
  const activity = await readFile(
    'scripts/test-activity-readonly-local.sql',
    'utf8',
  );
  const start = activity.indexOf('INSERT INTO auth.users('),
    end = activity.indexOf('INSERT INTO public.exercise_attempts(', start);
  assert(start > 0 && end > start);
  const seed = (
    activity.slice(start, end) +
    (await readFile('tests/fixtures/pedagogy-local.sql', 'utf8'))
  )
    .replaceAll('a8100000-0000-4000-8000-', 'b8100000-0000-4000-8000-')
    .replaceAll(
      'activity-a@example.test',
      'pedagogy-a@novlearn-admin.local.invalid',
    )
    .replaceAll(
      'activity-b@example.test',
      'pedagogy-b@novlearn-admin.local.invalid',
    )
    .replaceAll(
      'activity-c@example.test',
      'pedagogy-c@novlearn-admin.local.invalid',
    )
    .replaceAll(
      'activity-d@example.test',
      'pedagogy-d@novlearn-admin.local.invalid',
    )
    .replaceAll('LOCAL ACTIVITY', 'LOCAL PEDAGOGY');
  const seeded =
    sql(`BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';${detailRowsFunction}
CREATE TEMP TABLE pedagogy_before AS SELECT pg_temp.detail_seed_rows() AS rows;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM auth.users WHERE id::text LIKE 'b8100000-0000-4000-8000-%') THEN RAISE EXCEPTION 'Never reseed existing synthetic identities';END IF;END;$$;
${seed}
DO $preservation$ DECLARE before_rows jsonb;after_rows jsonb;entry record;allowed bigint;actual bigint;BEGIN
SELECT rows INTO STRICT before_rows FROM pg_temp.pedagogy_before;after_rows:=pg_temp.detail_seed_rows();
IF (SELECT count(*) FROM jsonb_object_keys(after_rows))<>62 THEN RAISE EXCEPTION 'Unexpected table inventory';END IF;
FOR entry IN SELECT key,value FROM jsonb_each(before_rows) LOOP
 allowed:=CASE entry.key WHEN 'auth.users' THEN 4 WHEN 'public.profiles' THEN 4 WHEN 'public.friend_codes' THEN 4
 WHEN 'public.chapters' THEN 2 WHEN 'public.competences' THEN 2 WHEN 'public.exercises' THEN 5
 WHEN 'public.exercise_attempts' THEN 10 WHEN 'public.duels' THEN 4 WHEN 'public.duel_attempts' THEN 5 WHEN 'public.user_stats' THEN 4
 WHEN 'public.monthly_scores' THEN (SELECT count(*) FROM (SELECT DISTINCT user_id,date_trunc('month',attempted_at)::date FROM public.exercise_attempts WHERE user_id::text LIKE 'b8100000-0000-4000-8000-%' AND is_correct IS TRUE) x) ELSE 0 END;
 actual:=jsonb_array_length(after_rows->entry.key)-jsonb_array_length(entry.value);IF actual<>allowed THEN RAISE EXCEPTION 'Unexpected additive fixture effect on %: expected %, actual %',entry.key,allowed,actual;END IF;
 IF EXISTS(SELECT 1 FROM (SELECT value,count(*) n FROM jsonb_array_elements_text(entry.value) GROUP BY value) old LEFT JOIN (SELECT value,count(*) n FROM jsonb_array_elements_text(after_rows->entry.key) GROUP BY value) current USING(value) WHERE coalesce(current.n,0)<old.n) THEN RAISE EXCEPTION 'Preexisting row modified in %',entry.key;END IF;
END LOOP;END;$preservation$;
SELECT jsonb_build_object('result','PASS','allPreexistingRowsPreserved',62,'newAuthAccounts',4,'newExercises',5,'newExerciseAttempts',10,'newDuels',4,'newDuelAttempts',5,'profilesAndStatisticsOnlyForNewIdentities',true);COMMIT;`);
  await writeFile(artifact + '/seed.log', seeded + '\n');
  await stored('after-seed.json', snapshot());
  await writeFile(
    marker,
    JSON.stringify({ artifact, container, phase: 'seeded' }, null, 2) + '\n',
  );
  const serverName =
    '/tmp/admin-pedagogy-' + path.basename(artifact).split('-').at(-1);
  for (const ext of ['key', 'crt'])
    checked([
      'cp',
      artifact + '/server.' + ext,
      container + ':' + serverName + '.' + ext,
    ]);
  checked([
    'exec',
    container,
    'chown',
    'postgres:postgres',
    serverName + '.key',
    serverName + '.crt',
  ]);
  checked([
    'exec',
    '--user',
    'postgres',
    container,
    'chmod',
    '600',
    serverName + '.key',
  ]);
  sql(`ALTER SYSTEM SET ssl_cert_file='${serverName}.crt';`);
  sql(`ALTER SYSTEM SET ssl_key_file='${serverName}.key';`);
  sql('ALTER SYSTEM SET ssl=on;');
  const hba = sql('SHOW hba_file;');
  assert(hba.startsWith('/'));
  checked(['cp', container + ':' + hba, artifact + '/pg_hba.before.conf']);
  const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
  assert(!original.includes('novlearn_admin_pedagogy_service'));
  await writeFile(
    artifact + '/pg_hba.conf',
    [
      'hostssl activity_copy novlearn_admin_pedagogy_service 127.0.0.1/32 scram-sha-256',
      'host all novlearn_admin_pedagogy_service 0.0.0.0/0 reject',
      'host all novlearn_admin_pedagogy_service ::0/0 reject',
      'local all novlearn_admin_pedagogy_service reject',
      original,
    ].join('\n'),
  );
  checked(['cp', artifact + '/pg_hba.conf', container + ':' + hba]);
  checked(['exec', container, 'chown', 'postgres:postgres', hba]);
  sql(
    `SET password_encryption='scram-sha-256';CREATE ROLE novlearn_admin_pedagogy_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}';GRANT novlearn_pedagogy_reader TO novlearn_admin_pedagogy_service WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;`,
  );
  sql('SELECT pg_reload_conf();');
  assert.equal(
    sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;'),
    '0',
  );
  sql('ALTER ROLE novlearn_admin_pedagogy_service LOGIN;');
  await stored('provisioned-snapshot.json', snapshot());
  await writeFile(
    marker,
    JSON.stringify({ artifact, container, phase: 'provisioned' }, null, 2) +
      '\n',
  );
}
const beforeTests = snapshot();
assert.deepEqual(
  beforeTests,
  JSON.parse(await readFile(artifact + '/provisioned-snapshot.json', 'utf8')),
);
const run = artifact + '/run-' + Date.now();
await mkdir(run);
const runner = run + '/runner';
const files = [
  'src/lib/pedagogy-references.ts',
  'scripts/pedagogy-references-query.sql',
  'src/lib/pedagogy-pg.ts',
  'src/lib/pedagogy-config.ts',
  'src/lib/pedagogy-statistics.ts',
  'scripts/pedagogy-reader-audit.sql',
  'scripts/pedagogy-statistics-query.sql',
  'scripts/test-pedagogy-pg-local.mjs',
  'scripts/test-pedagogy-pg-worker.mjs',
  'tests/fixtures/pedagogy-local.sql',
];
const sourceHashes = {};
for (const file of files)
  sourceHashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
for (const [source, name] of [
  ['src/lib/pedagogy-pg.ts', 'pedagogy-reader.mjs'],
  ['src/lib/pedagogy-statistics.ts', 'pedagogy-domain.mjs'],
  ['src/lib/pedagogy-references.ts', 'pedagogy-references.mjs'],
])
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'error',
    build: {
      ssr: path.resolve(source),
      outDir: runner,
      emptyOutDir: false,
      rollupOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: name },
      },
    },
  });
await copyFile('scripts/test-pedagogy-pg-worker.mjs', runner + '/worker.mjs');
await mkdir(runner + '/node_modules', { recursive: true });
// Larger metadata sets exist only inside this rolled-back fixture transaction.
// Exact-ID lookup must work even when its substring matches more than 200 IDs.
const referenceSql = await readFile(
  'scripts/pedagogy-references-query.sql',
  'utf8',
);
const referenceCases = [
  { kind: 'competence', q: 'boundary_needle' },
  { kind: 'competence', q: '%_\\' },
  { kind: 'chapter', q: 'boundary alias' },
  { kind: 'chapter', q: 'past-unicode-boundary' },
];
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const boundaryRows = sql(`BEGIN;
 SET LOCAL standard_conforming_strings=on;
 INSERT INTO public.chapters(id,name,order_index,aliases) VALUES
 ('ab300000-0000-4000-8000-000000000001',repeat('😀',201)||'past-unicode-boundary',993,ARRAY['BOUNDARY ALIAS %_\\']);
 INSERT INTO public.competences(id,name,chapter_id,max_points)
 SELECT 'boundary_needle_'||i,'A boundary '||lpad(i::text,3,'0'),'ab300000-0000-4000-8000-000000000001',10 FROM generate_series(1,201) i;
 INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES
 ('boundary_needle','ZZZ exact match %_\\','ab300000-0000-4000-8000-000000000001',10);
 SET LOCAL ROLE novlearn_pedagogy_reader;
 PREPARE reference_boundary(text,text) AS ${referenceSql}
 ${referenceCases.map((q) => `EXECUTE reference_boundary(${quote(q.kind)},${quote(q.q)});`).join('\n')}
 ROLLBACK;`)
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse);
assert.equal(boundaryRows.length, referenceCases.length);
const { decodePedagogyReferences } = await import(
  pathToFileURL(runner + '/pedagogy-references.mjs').href
);
for (let i = 0; i < boundaryRows.length; i++)
  assert(
    decodePedagogyReferences(
      { ...boundaryRows[i], environment: 'local-copy' },
      { environment: 'local-copy', query: referenceCases[i] },
    ),
  );
assert.equal(boundaryRows[0].more, true);
assert.equal(boundaryRows[0].items.length, 200);
assert.equal(boundaryRows[0].items[0].id, 'boundary_needle');
assert.equal(boundaryRows[1].items.length, 1);
assert.equal(boundaryRows[1].items[0].id, 'boundary_needle');
assert.equal(boundaryRows[2].items.length, 1);
assert.equal(boundaryRows[3].items.length, 1);
assert.equal(boundaryRows[3].items[0].truncated, true);
assert.equal([...boundaryRows[3].items[0].label].length, 200);
assert.deepEqual(
  snapshot(),
  beforeTests,
  'Metadata boundary transaction must preserve every row, sequence and ACL',
);
await writeFile(
  run + '/reference-boundary-proof.json',
  JSON.stringify(
    {
      result: 'PASS',
      cases: referenceCases,
      results: boundaryRows,
      rolledBackAndSnapshotExact: true,
    },
    null,
    2,
  ) + '\n',
);
const workerArgs = [
  'run',
  '--rm',
  '--pull',
  'never',
  '--network',
  'container:' + container,
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
  `type=bind,source=${runner},target=/runner,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('node_modules')},target=/runner/node_modules,readonly`,
  '--mount',
  `type=bind,source=${path.resolve('scripts')},target=/app/scripts,readonly`,
  nodeImage,
  'node',
  '--conditions=react-server',
  '/runner/worker.mjs',
];
const positive = checked(workerArgs);
await writeFile(run + '/connection.log', positive + '\n');
const drifts = [];
for (const [label, grant, revoke] of [
  [
    'reader-email',
    'GRANT SELECT(email) ON auth.users TO novlearn_pedagogy_reader;',
    'REVOKE SELECT(email) ON auth.users FROM novlearn_pedagogy_reader;',
  ],
  [
    'login-temporary',
    'GRANT TEMPORARY ON DATABASE activity_copy TO novlearn_admin_pedagogy_service;',
    'REVOKE TEMPORARY ON DATABASE activity_copy FROM novlearn_admin_pedagogy_service;',
  ],
]) {
  sql(grant);
  try {
    const output = checked([...workerArgs, '--expect-drift']);
    assert(output.includes('PASS: effective privilege drift refused'));
    await writeFile(run + '/' + label + '.log', output + '\n');
    drifts.push(label);
  } finally {
    sql(revoke);
  }
}
await writeFile(run + '/after-drift.log', checked(workerArgs) + '\n');
const after = snapshot();
assert.deepEqual(
  after,
  beforeTests,
  'All seeded rows, sequences and permission metadata must remain exact after actual connection tests',
);
const connection = JSON.parse(
  await readFile(run + '/connection-proof.json', 'utf8'),
);
assert.equal(connection.result, 'PASS');
for (const file of files)
  assert.equal(
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex'),
    sourceHashes[file],
    'Source changed during qualification: ' + file,
  );
const proof = {
  ...connection,
  date: new Date().toISOString(),
  artifact,
  run,
  container,
  sourceHashes,
  effectivePrivilegeDriftsRejected: drifts,
  preexistingRowsPreservedAcrossSeedTables: 62,
  allRowsSequencesAndMetadataExactAfterTests: true,
  newSyntheticAuthAccounts: 4,
  oldCredentialsOrCertificatesRotated: false,
  mainApplicationModified: false,
  remoteOperations: false,
  newPedagogyHttpExecuted: false,
  browserExecuted: false,
  referenceBoundaryProof: run + '/reference-boundary-proof.json',
};
await writeFile(run + '/proof.json', JSON.stringify(proof, null, 2) + '\n');
await writeFile(
  marker,
  JSON.stringify(
    { artifact, container, phase: 'qualified', proof: run + '/proof.json' },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact,
    run,
    checks: proof.checks.length,
    writeAndPrivateReadDenials: proof.writeAndPrivateReadDenials,
  }),
);
