// Native Engine + actual SQL receipt path. Synthetic identity, not live Auth.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readTestSigningConfiguration,
  signTestReceipt,
} from '../src/lib/test-receipt.ts';
const container = process.argv[2];
assert(
  /^novlearn-admin-lot1a-replay-[0-9]{17}$/.test(container ?? ''),
  'Named local fixture required',
);
const root = fileURLToPath(new URL('../', import.meta.url));
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 16777216 },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
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
  database = 'admin_receipt_native_' + stamp;
const artifact = path.join(root, '.local/lot1a/receipt-native-flow-' + stamp);
await mkdir(artifact, { recursive: true });
cli([
  'exec',
  container,
  'pg_dump',
  '-U',
  'supabase_admin',
  '-d',
  'postgres',
  '--format=custom',
  '--file=/tmp/' + database + '.dump',
]);
cli([
  'exec',
  container,
  'createdb',
  '-U',
  'supabase_admin',
  '-T',
  'template0',
  database,
]);
cli([
  'exec',
  container,
  'pg_restore',
  '-U',
  'supabase_admin',
  '-d',
  database,
  '--exit-on-error',
  '/tmp/' + database + '.dump',
]);
const sql = (statement) =>
  cli([
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
    '-c',
    statement,
  ]);
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`;
const actor = '98500000-0000-4000-8000-000000000001',
  key = '10000000-0000-4000-8000-000000000001';
const definition = JSON.parse(
  await readFile(
    path.join(root, 'tests/fixtures/preview-definition.json'),
    'utf8',
  ),
);
// Resolve existing fixture taxonomy; no taxonomy is copied by approval.
assert(!process.argv[3] || process.argv[3] === '--publication-fixture');
if (process.argv[3] === '--publication-fixture') {
  sql(
    `INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('a5510000-0000-4000-8000-000000000001','LOCAL PUBLICATION CHAPTER',990,'{}'); INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('local-publication-source-skill','LOCAL PUBLICATION SKILL','a5510000-0000-4000-8000-000000000001',10);`,
  );
  definition.catalogue = {
    chapter: 'LOCAL PUBLICATION CHAPTER',
    skills: ['LOCAL PUBLICATION SKILL'],
    difficulty: 2,
    appTitle: 'Publication locale',
    exerciseType: 'classic',
    needsCalculator: false,
  };
} else {
  definition.catalogue = {
    chapter: sql('SELECT id::text FROM public.chapters ORDER BY name LIMIT 1;'),
    skills: [],
  };
}
const jwt = `SELECT set_config('request.jwt.claim.sub','${actor}',false);SELECT set_config('request.jwt.claims','{"sub":"${actor}","is_anonymous":false}',false);SET ROLE authenticated;`;
sql(
  `INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES('${actor}','authenticated','authenticated','native-receipt@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"NATIVE FIXTURE","birth_date":"2000-01-01"}',now(),now());UPDATE public.profiles SET role='admin' WHERE id='${actor}';INSERT INTO novlearn_admin_private.test_signing_keys(id,secret) VALUES('${key}',decode(repeat('42',32),'hex'));`,
);
const created = JSON.parse(
  sql(
    jwt +
      `SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,${literal(JSON.stringify(definition))}::jsonb);`,
  )
    .split('\n')
    .at(-1),
);
const version = JSON.parse(
  sql(
    `SELECT jsonb_build_object('id',id,'definition',definition,'fingerprint',approval_fingerprint_sha256,'epoch',test_epoch) FROM public.exercise_versions WHERE id='${created.versionId}';`,
  ),
);
const bridge = spawn(
  process.execPath,
  [path.join(root, 'scripts/preview-browser.mjs')],
  { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] },
);
let bridgeLog = '';
bridge.stderr.on('data', (b) => {
  bridgeLog += b;
});
try {
  await new Promise((resolve, reject) => {
    createInterface({ input: bridge.stdout }).on('line', (line) => {
      bridgeLog += line + '\n';
      if (line.includes('Synthetic browser owner')) resolve();
    });
    bridge.once('error', reject);
    bridge.once('exit', (code) =>
      reject(Error('Bridge ended ' + code + ' ' + bridgeLog)),
    );
  });
  const cases = [
    {
      questionId: 'q',
      answer: { format: 'latex', source: '0' },
      expectedState: 'incorrect',
    },
  ];
  const response = await fetch('http://127.0.0.1:3140/api/admin/preview', {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3140',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'test',
      definition: version.definition,
      seeds: [0, 42],
      cases,
    }),
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(response.status, 200);
  const report = (await response.json()).result;
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(report.complete, true);
  const config = readTestSigningConfiguration({
    ADMIN_TEST_SIGNING_KEY_ID: key,
    ADMIN_TEST_SIGNING_KEY: '42'.repeat(32),
  });
  const signed = signTestReceipt(config, {
    actorId: actor,
    versionId: version.id,
    fingerprint: version.fingerprint,
    epoch: version.epoch,
    report,
    cases,
  });
  const recorded = JSON.parse(
    sql(
      jwt +
        `SELECT public.admin_record_exercise_test(${literal(signed.payload)},'${signed.signature}');`,
    )
      .split('\n')
      .at(-1),
  );
  assert.equal(recorded.recorded, true);
  assert.equal(recorded.passed, true);
  const stored = JSON.parse(
    sql(
      `SELECT jsonb_build_object('count',count(*),'passed',bool_and(passed),'actor',min(actor_id::text),'epoch',min(test_epoch)) FROM public.admin_exercise_test_runs WHERE id='${recorded.receiptId}';`,
    ),
  );
  assert.equal(stored.count, 1);
  assert.equal(stored.actor, actor);
  assert.equal(stored.epoch, 0);
  assert.equal(
    sql(
      `SELECT editorial_status FROM public.exercise_versions WHERE id='${version.id}';`,
    ),
    'draft',
  );
  const checklist = {
    mathematicsCorrect: true,
    statementClear: true,
    gradingChecked: true,
    referencesChecked: true,
  };
  const reviewCommand = (status, action, checks) =>
    jwt +
    `SELECT public.admin_review_exercise_version('${version.id}','${version.fingerprint}',${version.epoch},'${status}','${action}','${recorded.receiptId}',${literal(JSON.stringify(checks))}::jsonb,'Synthetic fixture attestation only');`;
  const review = (status, action, checks) =>
    JSON.parse(
      sql(reviewCommand(status, action, checks))
        .split('\n')
        .at(-1),
    );
  assert.equal(review('draft', 'request_review', {}).status, 'in_review');
  // Two actual PostgreSQL sessions contend on the same status/fingerprint.
  const competingApproval = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        docker,
        [
          '--host',
          'npipe:////./pipe/dockerDesktopLinuxEngine',
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
          reviewCommand('in_review', 'approve', checklist),
        ],
        {
          windowsHide: true,
          timeout: 30000,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '',
        errors = '';
      child.stdout.on('data', (b) => {
        output += b;
      });
      child.stderr.on('data', (b) => {
        errors += b;
      });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, output, errors }));
    });
  const race = await Promise.all([competingApproval(), competingApproval()]);
  assert.equal(
    race.filter((r) => r.code === 0).length,
    1,
    JSON.stringify(race),
  );
  assert.equal(
    race.filter((r) => r.code !== 0 && r.errors.includes('40001')).length,
    1,
    JSON.stringify(race),
  );
  const approval = JSON.parse(
    sql(
      `SELECT jsonb_build_object('status',v.editorial_status,'actor',v.approved_by,'fingerprint',v.approved_fingerprint_sha256,'activeVersion',e.active_version_id,'reviews',(SELECT count(*) FROM public.admin_exercise_reviews WHERE version_id=v.id)) FROM public.exercise_versions v JOIN public.exercises e ON e.id=v.exercise_id WHERE v.id='${version.id}';`,
    ),
  );
  assert.equal(approval.status, 'approved');
  assert.equal(approval.actor, actor);
  assert.equal(approval.fingerprint, version.fingerprint);
  assert.equal(approval.activeVersion, null);
  assert.equal(approval.reviews, 2);
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(
      {
        result: 'PASS',
        scope:
          'Actual native Engine, Node signer, SQL receipt and review; synthetic Auth identity and fixture attestation',
        sourceContainer: container,
        database,
        versionId: version.id,
        fingerprint: version.fingerprint,
        receiptId: recorded.receiptId,
        report,
        stored,
        editorialStatus: 'approved',
        approval,
        concurrentApproval: { accepted: 1, conflict40001: 1, sessions: 2 },
        sourceDatabaseReset: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS: native Engine -> Node HMAC -> SQL receipt -> fixture review; retained fixture=' +
      database +
      '; proof=' +
      artifact,
  );
} finally {
  bridge.stdin.end();
  bridge.kill('SIGINT');
  await writeFile(path.join(artifact, 'bridge.log'), bridgeLog);
}
