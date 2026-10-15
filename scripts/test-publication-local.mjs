// Retained, isolated local fixtures only. This is not an HTTP/Auth certification.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instantiateExercise } from 'novlearn-exercise-engine';
const container = process.argv[2];
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-[0-9]{17}$/);
const root = fileURLToPath(new URL('../', import.meta.url));
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const cli = (args) => {
  const result = spawnSync(docker, ['--host', endpoint, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
assert.equal(
  cli(['inspect', '--format', '{{.HostConfig.NetworkMode}}', container]),
  'none',
);
assert.equal(
  cli(['inspect', '--format', '{{.State.Running}}', container]),
  'true',
);
const stamp = Date.now(),
  target = 'admin_publication_target_' + stamp;
const artifact = path.join(root, '.local/lot1a/publication-' + stamp);
await mkdir(artifact, { recursive: true });
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '',
      errors = '';
    child.stdout.on('data', (b) => {
      output += b;
    });
    child.stderr.on('data', (b) => {
      errors += b;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(output);
      else reject(Error(errors + '\n' + output));
    });
  });
const nativeOutput = await run([
  '--conditions=react-server',
  'scripts/test-receipts-native.mjs',
  container,
  '--publication-fixture',
]);
await writeFile(path.join(artifact, 'native.log'), nativeOutput);
const nativeArtifact = nativeOutput.match(/; proof=(.+)/)?.[1]?.trim();
const nativeProofPath =
  nativeArtifact && path.join(nativeArtifact, 'proof.json');
assert(
  nativeProofPath &&
    path
      .resolve(nativeProofPath)
      .startsWith(path.resolve(root, '.local/lot1a/receipt-native-flow-')),
);
const native = JSON.parse(await readFile(nativeProofPath, 'utf8'));
assert.equal(native.result, 'PASS');
const source = native.database;
const sqlArgs = (database, statement) => [
  'exec',
  container,
  'psql',
  '-qAt',
  '-U',
  'supabase_admin',
  '-d',
  database,
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  'VERBOSITY=verbose',
  '-c',
  statement,
];
const sql = (database, statement) => cli(sqlArgs(database, statement));
const value = (database, statement) =>
  JSON.parse(sql(database, statement).split('\n').at(-1));
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`;
const obj = (value) => literal(JSON.stringify(value)) + '::jsonb';
// SET ROLE alone retains the superuser session identity and cannot test SET ROLE
// escalation. Set the session identity as well, without provisioning a login.
const asExecutor = 'SET SESSION AUTHORIZATION novlearn_publication_executor;';
const jwt = `SELECT set_config('request.jwt.claim.sub','${native.stored.actor}',false);SELECT set_config('request.jwt.claims','{"sub":"${native.stored.actor}","is_anonymous":false}',false);SET ROLE authenticated;`;
const sourceVersion = value(
  source,
  `SELECT jsonb_build_object('exerciseId',exercise_id::text,'definition',definition) FROM public.exercise_versions WHERE id='${native.versionId}';`,
);
const exportCall = `SELECT public.admin_export_exercise_publication('${native.versionId}','${native.fingerprint}',0,${obj(sourceVersion.definition)});`;
const exported = value(source, jwt + exportCall),
  payload = exported.payload;
assert.deepEqual(Object.keys(payload).sort(), [
  'businessDigest',
  'canonicalizationVersion',
  'catalogId',
  'definitionJson',
  'engineArchiveSha256',
  'engineContract',
  'generationVersion',
  'revision',
  'schemaVersion',
]);
assert(!JSON.stringify(payload).includes(native.stored.actor));
assert.deepEqual(JSON.parse(payload.definitionJson), sourceVersion.definition);
const checks = [];
const check = (ok, label) => {
  assert(ok, label);
  checks.push(label);
};
const denied = (database, statement, code, label, expectedMessage) => {
  const result = spawnSync(
    docker,
    ['--host', endpoint, ...sqlArgs(database, statement)],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 },
  );
  assert.notEqual(result.status, 0, label);
  assert.match(
    result.stderr,
    new RegExp('ERROR:\\s+' + code + ':'),
    label + '\n' + result.stderr,
  );
  if (expectedMessage)
    assert(result.stderr.includes(expectedMessage), result.stderr);
  checks.push(label);
};
denied(source, exportCall, '42501', 'export requires fresh Admin identity');
denied(
  source,
  jwt + exportCall.replace(native.fingerprint, '0'.repeat(64)),
  '40001',
  'source fingerprint is rechecked',
);
denied(
  source,
  jwt + exportCall.replace(obj(sourceVersion.definition), "'{}'::jsonb"),
  '22023',
  'lossy Engine JSON round trip is refused',
);
const rounded = JSON.parse('9007199254740993');
assert.notEqual(BigInt(rounded), 9007199254740993n);
const lossy = {
  ...sourceVersion.definition,
  catalogue: { ...sourceVersion.definition.catalogue, difficulty: rounded },
};
denied(
  source,
  `BEGIN; UPDATE public.exercise_versions SET definition=jsonb_set(definition,'{catalogue,difficulty}','9007199254740993') WHERE id='${native.versionId}';
UPDATE public.exercise_versions SET editorial_status='approved',approved_by='${native.stored.actor}',approved_at=now() WHERE id='${native.versionId}';` +
    jwt +
    `SELECT public.admin_export_exercise_publication('${native.versionId}',(SELECT approval_fingerprint_sha256 FROM public.exercise_versions WHERE id='${native.versionId}'),(SELECT test_epoch FROM public.exercise_versions WHERE id='${native.versionId}'),${obj(lossy)});COMMIT;`,
  '22023',
  'a SQL number rounded by JavaScript is refused before export',
  'canonical definition cannot round trip',
);
denied(
  source,
  jwt + exportCall.replace("',0,", "',1,"),
  '40001',
  'source test epoch is rechecked',
);
denied(
  source,
  `BEGIN; UPDATE public.profiles SET role='user' WHERE id='${native.stored.actor}';` +
    jwt +
    exportCall +
    'COMMIT;',
  '42501',
  'revoked source Admin is refused',
);
denied(
  source,
  `BEGIN; UPDATE novlearn_admin_private.test_signing_keys SET enabled=false WHERE id=(SELECT key_id FROM public.admin_exercise_test_runs WHERE id='${native.receiptId}');` +
    jwt +
    exportCall +
    'COMMIT;',
  '22023',
  'disabled source test key blocks export',
);
denied(
  source,
  jwt.replace('"is_anonymous":false', '"is_anonymous":true') + exportCall,
  '42501',
  'anonymous source identity cannot export',
);
// Clone the virgin 55-migration database, not the source containing Staging Auth.
cli([
  'exec',
  container,
  'pg_dump',
  '-U',
  'supabase_admin',
  '-d',
  'postgres',
  '--format=custom',
  '--file=/tmp/' + target + '.dump',
]);
cli([
  'exec',
  container,
  'createdb',
  '-U',
  'supabase_admin',
  '-T',
  'template0',
  target,
]);
cli([
  'exec',
  container,
  'pg_restore',
  '-U',
  'supabase_admin',
  '-d',
  target,
  '--exit-on-error',
  '/tmp/' + target + '.dump',
]);
// Existing history uses a fixed trusted fixture, independently of the bounded
// native Engine certification above. No ignored external helper is required.
const baseline = instantiateExercise(sourceVersion.definition, {
  seed: 42,
  instanceId: 'local-target-existing-history',
});
assert(baseline.ok, JSON.stringify(baseline));
const fixtureSql = `BEGIN; DO $fixture$
DECLARE exercise bigint; attempt bigint; duel bigint;
BEGIN
IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.exercises) THEN RAISE EXCEPTION 'target fixture requires an empty isolated clone'; END IF;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"TARGET FIXTURE","birth_date":"2000-01-01"}',now(),now()
FROM unnest(ARRAY['90000000-0000-0000-0000-000000000001'::uuid,'90000000-0000-0000-0000-000000000002'::uuid]) id;
UPDATE public.profiles SET role='admin' WHERE id='90000000-0000-0000-0000-000000000001';
INSERT INTO public.friends(user1_id,user2_id,status) VALUES('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','accepted');
INSERT INTO public.exercises(title,chapter,content) VALUES('LOCAL TARGET EXISTING HISTORY','Local history',${obj(sourceVersion.definition)}) RETURNING id INTO exercise;
INSERT INTO public.exercise_versions(id,exercise_id,revision,definition,engine_contract,generation_version,canonicalization_version,definition_sha256,approval_fingerprint_sha256,created_by)
VALUES('90000000-0000-0000-0000-000000000003',exercise,1,${obj(sourceVersion.definition)},'${payload.engineContract}','${payload.generationVersion}','${payload.canonicalizationVersion}',repeat('0',64),repeat('0',64),'90000000-0000-0000-0000-000000000001');
UPDATE public.exercise_versions SET editorial_status='approved',approved_at=now(),approved_by='90000000-0000-0000-0000-000000000001' WHERE id='90000000-0000-0000-0000-000000000003';
UPDATE public.exercise_versions SET editorial_status='published' WHERE id='90000000-0000-0000-0000-000000000003';
UPDATE public.exercises SET active_version_id='90000000-0000-0000-0000-000000000003' WHERE id=exercise;
INSERT INTO public.exercise_attempts(user_id,exercise_id,is_correct) VALUES('90000000-0000-0000-0000-000000000002',exercise,false);
INSERT INTO public.exercise_attempts(user_id,exercise_id,exercise_version_id,is_correct) VALUES('90000000-0000-0000-0000-000000000002',exercise,'90000000-0000-0000-0000-000000000003',true) RETURNING id INTO attempt;
INSERT INTO public.exercise_attempt_instances(attempt_id,instance_seed,generation_version,instance_data) VALUES(attempt,'42','${payload.generationVersion}',${obj(baseline.value)});
INSERT INTO public.exercise_attempt_replay_artifacts(attempt_id,replay_data) VALUES(attempt,${obj(baseline.value)});
INSERT INTO public.duels(player1_id,player2_id,status) VALUES('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','active') RETURNING id INTO duel;
INSERT INTO public.duel_exercise_instances(id,duel_id,round_number,exercise_id,exercise_version_id,instance_seed,generation_version,replay_data)
VALUES('90000000-0000-0000-0000-000000000004',duel,1,exercise,'90000000-0000-0000-0000-000000000003','42','${payload.generationVersion}',${obj(baseline.value)});
INSERT INTO public.duel_attempts(duel_id,player_id,element_id,is_correct,duel_exercise_instance_id) VALUES(duel,'90000000-0000-0000-0000-000000000002',0,true,'90000000-0000-0000-0000-000000000004');
END; $fixture$; COMMIT;`;
await writeFile(path.join(artifact, 'fixture.sql'), fixtureSql);
sql(target, fixtureSql);
sql(
  target,
  `INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('a5520000-0000-4000-8000-000000000001','LOCAL PUBLICATION CHAPTER',990,'{}'); INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('local-publication-target-skill','LOCAL PUBLICATION SKILL','a5520000-0000-4000-8000-000000000001',10);`,
);
const excludedSnapshot = () =>
  value(
    target,
    `CREATE FUNCTION pg_temp.excluded_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $snapshot$
DECLARE t record; count_rows bigint; digest text; result jsonb:='{}'; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') AND NOT(schemaname='public' AND tablename IN ('exercises','exercise_versions')) ORDER BY schemaname,tablename LOOP
EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO count_rows,digest;
result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('count',count_rows,'sha256',digest)); END LOOP; RETURN result; END; $snapshot$;
SELECT pg_temp.excluded_snapshot();`,
  );
const inspect = (p) =>
  value(
    target,
    asExecutor +
      `SELECT public.inspect_exercise_publication(${obj(p)},'publish');`,
  );
const apply = (p, token, mode = 'publish') =>
  value(
    target,
    asExecutor +
      `SELECT public.apply_exercise_publication(${obj(p)},'${token}','${mode}');`,
  );
denied(
  target,
  asExecutor +
    `SELECT public.inspect_exercise_publication(${obj(payload)},'publish');`,
  '55000',
  'target capability is disabled by default',
);
sql(
  target,
  'UPDATE novlearn_admin_private.publication_runtime SET enabled=true WHERE singleton;',
);
const before = excludedSnapshot();
check(
  value(
    target,
    asExecutor +
      `SELECT to_jsonb(session_user='novlearn_publication_executor' AND current_user='novlearn_publication_executor');`,
  ),
  'publisher tests run with an unprivileged session and effective identity',
);
const legacyBefore = value(
  target,
  'SELECT to_jsonb(e) FROM public.exercises e WHERE catalog_id IS NULL;',
);
check(
  legacyBefore.id.toString() === sourceVersion.exerciseId,
  'fixture collides on source and target bigint identities',
);
const firstPlan = inspect(payload);
await writeFile(
  path.join(artifact, 'inputs.json'),
  JSON.stringify({ payload, inspection: firstPlan }, null, 2) + '\n',
);
check(
  firstPlan.state.parent === null,
  'legacy bigint collision does not claim the canonical UUID',
);
check(
  firstPlan.desiredHeader.competences[0] === 'local-publication-target-skill',
  'references resolve to target IDs without taxonomy copy',
);
const originalTargetCount = value(target, 'SELECT count(*) FROM auth.users;');
const first = apply(payload, firstPlan.state.stateToken);
await writeFile(
  path.join(artifact, 'published.json'),
  JSON.stringify(
    {
      payload,
      inspection: {
        desiredHeader: firstPlan.desiredHeader,
        state: first.target,
      },
    },
    null,
    2,
  ) + '\n',
);
check(
  first.result === 'published' &&
    first.target.active.businessDigest === payload.businessDigest,
  'native approved source transfers exact canonical business content',
);
check(
  first.target.parent.id !== sourceVersion.exerciseId,
  'target allocates its own bigint parent ID',
);
check(
  first.target.active.id !== native.versionId,
  'target allocates its own revision UUID',
);
const transferred = value(
  target,
  `SELECT jsonb_build_object('origin',publication_origin,'actor',approved_by,'approvedAt',approved_at,'creator',created_by,'editor',updated_by,'fingerprint',approval_fingerprint_sha256,'definition',definition) FROM public.exercise_versions WHERE id='${first.target.active.id}';`,
);
check(
  transferred.origin === 'transfer' &&
    [
      transferred.actor,
      transferred.approvedAt,
      transferred.creator,
      transferred.editor,
    ].every((x) => x === null),
  'no Staging Auth or human approval fields are copied',
);
check(
  transferred.fingerprint !== native.fingerprint,
  'target recomputes its fingerprint with the local parent ID',
);
check(
  value(
    target,
    `SELECT count(*) FROM auth.users WHERE id='${native.stored.actor}';`,
  ) === 0 &&
    value(target, 'SELECT count(*) FROM auth.users;') === originalTargetCount,
  'target Auth identities are unchanged',
);
assert.deepEqual(excludedSnapshot(), before);
checks.push(
  'all excluded public/Auth/private table rows and hashes are unchanged',
);
assert.deepEqual(
  value(
    target,
    'SELECT to_jsonb(e) FROM public.exercises e WHERE catalog_id IS NULL;',
  ),
  legacyBefore,
);
checks.push('legacy exercise and active revision are unchanged');
const retry = apply(payload, firstPlan.state.stateToken);
check(
  retry.result === 'unchanged' &&
    retry.target.parent.publication_epoch ===
      first.target.parent.publication_epoch,
  'repetition after uncertain commit does not append or advance epoch',
);
for (const role of ['anon', 'authenticated', 'service_role']) {
  denied(
    target,
    `SET SESSION AUTHORIZATION ${role}; SELECT public.apply_exercise_publication(${obj(payload)},'${first.target.stateToken}','publish');`,
    '42501',
    role + ' cannot call publication directly',
  );
}
for (const statement of [
  'SELECT * FROM public.profiles',
  'SELECT * FROM auth.users',
  'SELECT * FROM novlearn_admin_private.test_signing_keys',
  "UPDATE public.exercise_versions SET editorial_status='published'",
  "UPDATE public.chapters SET name='forged'",
  'DELETE FROM public.exercises',
  'SET ROLE novlearn_publication_writer',
])
  denied(
    target,
    asExecutor + statement,
    '42501',
    'executor denies ' + statement,
  );
const flags = value(
  target,
  `SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'bypass',rolbypassrls,'createRole',rolcreaterole,'createDb',rolcreatedb)) FROM pg_roles WHERE rolname IN ('novlearn_publication_writer','novlearn_publication_executor');`,
);
check(
  flags.length === 2 &&
    flags.every(
      (r) => !r.login && !r.super && !r.bypass && !r.createRole && !r.createDb,
    ),
  'publication roles have no login, superuser, RLS bypass or role/database creation',
);
check(
  value(
    target,
    `SELECT to_jsonb(NOT pg_has_role('authenticator','novlearn_publication_executor','MEMBER') AND NOT pg_has_role('authenticated','novlearn_publication_writer','MEMBER'));`,
  ),
  'API roles receive no publisher membership',
);
const forbiddenWrites = value(
  target,
  `SELECT count(*) FROM pg_tables t WHERE schemaname IN ('public','auth','novlearn_admin_private') AND (
  (has_any_column_privilege('novlearn_publication_writer',format('%I.%I',schemaname,tablename),'INSERT') AND NOT(schemaname='public' AND tablename IN ('exercises','exercise_versions'))) OR
  (has_any_column_privilege('novlearn_publication_writer',format('%I.%I',schemaname,tablename),'UPDATE') AND NOT(schemaname='public' AND tablename='exercises')) OR
  has_table_privilege('novlearn_publication_writer',format('%I.%I',schemaname,tablename),'DELETE,TRUNCATE,TRIGGER'));`,
);
check(
  forbiddenWrites === 0,
  'writer has no writes outside the two approved tables or version updates/deletions',
);
denied(
  target,
  asExecutor +
    `SELECT public.apply_exercise_publication(${obj({ ...payload, actorId: native.stored.actor })},'${first.target.stateToken}','publish');`,
  '22023',
  'extra actor/environment fields are refused',
);
denied(
  target,
  asExecutor +
    `SELECT public.inspect_exercise_publication(${obj({ ...payload, engineArchiveSha256: '0'.repeat(64) })},'publish');`,
  '22023',
  'target Engine archive must match',
);
denied(
  target,
  asExecutor +
    `SELECT public.inspect_exercise_publication(${obj({ ...payload, businessDigest: '0'.repeat(64) })},'publish');`,
  '22023',
  'tampered business digest is refused',
);
// Remaining target-state cases use trusted synthetic payloads, not new Engine certificates.
const candidate = (title, revision = 2) => {
  const definition = {
    ...JSON.parse(payload.definitionJson),
    title,
    revision: String(revision),
  };
  const digest = value(
    target,
    `SELECT to_jsonb(public.exercise_publication_digest(${obj(definition)},'${payload.engineContract}','${payload.generationVersion}','${payload.canonicalizationVersion}'));`,
  );
  return {
    ...payload,
    revision,
    definitionJson: JSON.stringify(definition),
    businessDigest: digest,
  };
};
const a = candidate('CONCURRENT A'),
  b = candidate('CONCURRENT B');
const invalidReference = JSON.parse(a.definitionJson);
invalidReference.catalogue.chapter = 'ABSENT TARGET CHAPTER';
const invalidReferencePayload = {
  ...a,
  definitionJson: JSON.stringify(invalidReference),
  businessDigest: value(
    target,
    `SELECT to_jsonb(public.exercise_publication_digest(${obj(invalidReference)},'${payload.engineContract}','${payload.generationVersion}','${payload.canonicalizationVersion}'));`,
  ),
};
denied(
  target,
  asExecutor +
    `SELECT public.inspect_exercise_publication(${obj(invalidReferencePayload)},'publish');`,
  '22023',
  'missing target reference blocks preflight',
);
denied(
  target,
  `BEGIN; UPDATE public.chapters SET aliases=ARRAY['LOCAL PUBLICATION CHAPTER'] WHERE id=(SELECT id FROM public.chapters WHERE id<>'a5520000-0000-4000-8000-000000000001' ORDER BY id LIMIT 1);` +
    asExecutor +
    `SELECT public.inspect_exercise_publication(${obj(a)},'publish');COMMIT;`,
  '22023',
  'ambiguous target reference blocks preflight',
);
denied(
  target,
  `BEGIN; UPDATE public.exercises SET admin_archived_at=now() WHERE catalog_id='${payload.catalogId}';` +
    asExecutor +
    `SELECT public.apply_exercise_publication(${obj(a)},'${inspect(a).state.stateToken}','publish');COMMIT;`,
  '40001',
  'archived target is refused atomically',
);
const planned = inspect(a);
sql(
  target,
  `UPDATE public.exercises SET title='TEMPORARY ABA' WHERE catalog_id='${payload.catalogId}'; UPDATE public.exercises SET title=${literal(first.target.parent.title)} WHERE catalog_id='${payload.catalogId}';`,
);
denied(
  target,
  asExecutor +
    `SELECT public.apply_exercise_publication(${obj(a)},'${planned.state.stateToken}','publish');`,
  '40001',
  'target edit and revert invalidates the confirmed epoch',
);
const current = inspect(a);
const concurrent = (p) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      docker,
      [
        '--host',
        endpoint,
        ...sqlArgs(
          target,
          asExecutor +
            `SELECT public.apply_exercise_publication(${obj(p)},'${current.state.stateToken}','publish');`,
        ),
      ],
      { windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '',
      errors = '';
    child.stdout.on('data', (v) => {
      output += v;
    });
    child.stderr.on('data', (v) => {
      errors += v;
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, output, errors }));
  });
// Add an attempt that must stay attached to revision one when the active pointer moves.
sql(
  target,
  `INSERT INTO public.exercise_attempts(user_id,exercise_id,exercise_version_id,is_correct) VALUES('90000000-0000-0000-0000-000000000002',${first.target.parent.id},'${first.target.active.id}',true);`,
);
const attemptsBefore = excludedSnapshot();
const race = await Promise.all([concurrent(a), concurrent(b)]);
check(
  race.filter((r) => r.code === 0).length === 1 &&
    race.filter((r) => r.code !== 0 && r.errors.includes('40001')).length === 1,
  'two concurrent different definitions yield one publication and one conflict',
);
const afterRace = inspect(payload);
denied(
  target,
  asExecutor +
    `SELECT public.apply_exercise_publication(${obj(payload)},'${afterRace.state.stateToken}','publish');`,
  '40001',
  'ordinary publication cannot silently activate an older revision',
);
const rollback = apply(payload, afterRace.state.stateToken, 'rollback');
check(
  rollback.result === 'rolled_back' &&
    rollback.target.active.id === first.target.active.id,
  'explicit rollback reactivates the retained published revision',
);
check(
  value(
    target,
    `SELECT count(*) FROM public.exercise_versions WHERE exercise_id=${first.target.parent.id};`,
  ) === 2,
  'rollback retains both immutable revisions',
);
assert.deepEqual(excludedSnapshot(), attemptsBefore);
checks.push(
  'revision switch and rollback leave every attempt, duel, Auth row and private artifact unchanged',
);
const beforeFailure = value(
  target,
  `SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM public.exercise_versions v WHERE exercise_id=${first.target.parent.id};`,
);
const third = candidate('ATOMIC FAILURE', 3),
  thirdPlan = inspect(third);
denied(
  target,
  `BEGIN; CREATE FUNCTION public.publication_fixture_atomic_failure() RETURNS trigger LANGUAGE plpgsql AS $fail$ BEGIN RAISE EXCEPTION 'intentional fixture failure after revision insertion'; END; $fail$;
REVOKE ALL ON FUNCTION public.publication_fixture_atomic_failure() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER publication_fixture_atomic_failure BEFORE UPDATE OF active_version_id ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.publication_fixture_atomic_failure();
SET SESSION AUTHORIZATION novlearn_publication_executor; SELECT public.apply_exercise_publication(${obj(third)},'${thirdPlan.state.stateToken}','publish'); COMMIT;`,
  'P0001',
  'failure after revision insertion aborts the whole publication',
  'intentional fixture failure after revision insertion',
);
assert.deepEqual(
  value(
    target,
    `SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM public.exercise_versions v WHERE exercise_id=${first.target.parent.id};`,
  ),
  beforeFailure,
);
assert.deepEqual(excludedSnapshot(), attemptsBefore);
checks.push(
  'late failure leaves no new revision, side effect or changed historical data',
);
denied(
  target,
  `UPDATE public.exercise_versions SET definition='{}' WHERE id='${first.target.active.id}';`,
  'P0001',
  'transferred published definition is immutable even to ordinary owner UPDATE',
);
const proof = {
  result: 'PASS',
  scope:
    'Actual bounded Engine + Node HMAC + local source export and scoped target SQL capability; synthetic identities/attestation. Target concurrency payloads are synthetic.',
  container,
  source,
  target,
  nativeProof: nativeProofPath,
  sourceVersion: native.versionId,
  catalogId: payload.catalogId,
  businessDigest: payload.businessDigest,
  checks,
  assertionCount: checks.length,
  roleFlags: flags,
  excludedTableCount: Object.keys(before).length,
  beforeFirstPublication: before,
  afterAllOperations: excludedSnapshot(),
  snapshotComparisons: {
    firstPublicationMatched: true,
    revisionSwitchAndRollbackMatched: true,
    lateFailureMatched: true,
  },
  fixtureSetupBetweenComparisons:
    'One new synthetic attempt is deliberately attached to the first transferred revision before testing revision switching. Each operation is compared with its own immediate baseline.',
  targetAuthCount: originalTargetCount,
  concurrency: { accepted: 1, conflict40001: 1 },
  remoteWrites: false,
  existingDataDeleted: false,
  sourceDatabaseReset: false,
};
await writeFile(
  path.join(artifact, 'proof.json'),
  JSON.stringify(proof, null, 2) + '\n',
);
console.log(
  'PASS: ' +
    checks.length +
    ' publication checks; retained source=' +
    source +
    '; target=' +
    target +
    '; proof=' +
    artifact,
);
