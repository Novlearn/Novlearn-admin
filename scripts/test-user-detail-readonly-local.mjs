// Real SQL and actual DTO decoder, on one explicit empty SQL-67 fixture only.
// All synthetic data/metadata changes are rolled back. No remote or app DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
const [container, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-\d{17}$/);
const artifact = path.resolve(
  '.local/lot1a/user-detail-readonly-' + Date.now(),
);
await mkdir(artifact);
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) =>
  spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
const checked = (args, input) => {
  const r = cli(args, input);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const inspected = JSON.parse(checked(['inspect', container]))[0];
assert.equal(inspected.State.Running, true);
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(
    checked(['image', 'inspect', inspected.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const sql = (text) =>
  cli(
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
    text,
  );
const scalar = (text) => {
  const r = sql(text);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
assert.equal(
  scalar('SELECT count(*) FROM auth.users;'),
  '0',
  'Never run this fixture on existing accounts',
);
assert.equal(
  scalar(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_user_detail_reader' AND NOT rolcanlogin;",
  ),
  '1',
);
const snapshot = () =>
  JSON.parse(
    scalar(
      `CREATE FUNCTION pg_temp.detail_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.detail_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const before = snapshot();
assert.equal(Object.keys(before).length, 62);
await writeFile(
  artifact + '/before.json',
  JSON.stringify(before, null, 2) + '\n',
);
const activity = await readFile(
  'scripts/test-activity-readonly-local.sql',
  'utf8',
);
const first = activity.indexOf('INSERT INTO auth.users('),
  last = activity.indexOf(
    'SET SESSION AUTHORIZATION novlearn_activity_reader;',
    first,
  );
assert(first >= 0 && last > first);
const definition = JSON.stringify(
  JSON.parse(await readFile('tests/fixtures/preview-definition.json', 'utf8')),
).replaceAll("'", "''");
let seed = await readFile('tests/fixtures/user-detail-local.sql', 'utf8');
assert.equal(seed.split('__DEFINITION__').length, 2);
seed = seed.replace('__DEFINITION__', "'" + definition + "'");
const query = (await readFile('scripts/user-detail-query.sql', 'utf8'))
  .trim()
  .replace(/;$/, '');
const permissions = await readFile(
  'scripts/test-user-detail-readonly-local.sql',
  'utf8',
);
const uid = 'a8100000-0000-4000-8000-000000000001';
const today = new Date().toISOString().slice(0, 10),
  tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
const literal = (s) =>
  s === null ? 'NULL' : "'" + s.replaceAll("'", "''") + "'";
const call = (
  view = 'history',
  limit = 25,
  after = 'NULL',
  before = 'NULL',
  user = uid,
  from = '2026-10-15',
  until = '2026-10-18',
) =>
  `pg_temp.read_detail(${literal(user)},${literal(from)},${literal(until)},${literal(view)},${after},${before},${limit})`;
const cases = [
  ['history', call()],
  ['chapters', call('chapters')],
  ['competences', call('competences')],
  [
    'guest',
    call('history', 25, 'NULL', 'NULL', 'a8100000-0000-4000-8000-000000000002'),
  ],
  [
    'missing',
    call('history', 25, 'NULL', 'NULL', 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  ],
  [
    'empty-period',
    call('history', 25, 'NULL', 'NULL', uid, '2026-01-01', '2026-01-02'),
  ],
  [
    'chapters-empty-period',
    call('chapters', 25, 'NULL', 'NULL', uid, '2026-01-01', '2026-01-02'),
  ],
  ['stale-chapter-page', call('chapters', 2, literal('9223372036854775807'))],
  ['title-and-version-reference', call('history', 25)],
  [
    'today-with-future-excluded',
    call('history', 25, 'NULL', 'NULL', uid, today, tomorrow),
  ],
];
let body =
  'BEGIN;\n' +
  activity.slice(first, last) +
  '\n' +
  seed +
  '\n' +
  permissions +
  `\nSELECT set_config('request.jwt.claims','{}',true);SELECT set_config('request.jwt.claim.sub','',true);
CREATE FUNCTION pg_temp.read_detail(uuid,date,date,text,text,text,integer) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fixed_query$\n${query}\n$fixed_query$;
SET SESSION AUTHORIZATION novlearn_user_detail_reader;\n`;
for (const [name, expression] of cases)
  body += `SELECT jsonb_build_object('case',${literal(name)},'result',${expression});\n`;
for (const view of ['history', 'chapters', 'competences']) {
  body += `WITH RECURSIVE walk(n,p) AS (
    SELECT 1,${call(view, 2)} UNION ALL
    SELECT n+1,${call(view, 2, "w.p#>>'{page,next}'")} FROM walk w WHERE w.n<10 AND w.p#>>'{page,next}' IS NOT NULL
  ) SELECT jsonb_build_object('case',${literal(view + '-walk')},'pages',jsonb_agg(p ORDER BY n)) FROM walk;\n`;
  const second = call(view, 2, `${call(view, 2)}#>>'{page,next}'`);
  body += `SELECT jsonb_build_object('case',${literal(view + '-back')},'result',${call(view, 2, 'NULL', `${second}#>>'{page,previous}'`)});\n`;
}
body += `SET TIME ZONE 'America/New_York';SELECT jsonb_build_object('case','timezone','result',${call()});\n`;
for (const [name, expression] of [
  ['bad-size-zero', call('history', 0)],
  ['bad-size-large', call('history', 26)],
  ['bad-view', call('invalid')],
  [
    'bad-long-period',
    call('history', 25, 'NULL', 'NULL', uid, '2026-01-01', '2026-10-18'),
  ],
  [
    'bad-reversed-period',
    call('history', 25, 'NULL', 'NULL', uid, '2026-10-18', '2026-10-15'),
  ],
  [
    'bad-two-cursors',
    call(
      'chapters',
      2,
      literal('0000000000981100001'),
      literal('0000000000981100003'),
    ),
  ],
  ['bad-oversized-cursor', call('competences', 2, "repeat('x',1001)")],
])
  body += `SELECT jsonb_build_object('case',${literal(name)},'result',${expression});\n`;
body += 'RESET SESSION AUTHORIZATION;ROLLBACK;';
await writeFile(artifact + '/executed.sql', body);
const result = sql(body);
await writeFile(artifact + '/native.log', result.stdout + '\n' + result.stderr);
assert.equal(
  result.status,
  0,
  'Native detail SQL failed; inspect retained native.log',
);
assert.equal((result.stderr.match(/^NOTICE:.*PASS:/gm) ?? []).length, 48);
const outputs = Object.fromEntries(
  result.stdout.split(/\r?\n/).flatMap((line) => {
    try {
      const p = JSON.parse(line);
      return typeof p.case === 'string' ? [[p.case, p]] : [];
    } catch {
      return [];
    }
  }),
);
assert.equal(Object.keys(outputs).length, 24);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'warn',
  build: {
    ssr: path.resolve('src/lib/user-detail.ts'),
    outDir: artifact + '/bundle',
    emptyOutDir: false,
    rolldownOptions: { output: { entryFileNames: 'user-detail.mjs' } },
  },
});
const { decodeUserDetail, detailItemKey, readUserDetailQuery } = await import(
  pathToFileURL(artifact + '/bundle/user-detail.mjs').href
);
const decode = (raw, limit = 25) => {
  const params = new URLSearchParams({
    from: raw.period.from,
    to: new Date(Date.parse(raw.period.until + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10),
    view: raw.view,
  });
  if (raw.cursor.after !== null) params.set('after', raw.cursor.after);
  if (raw.cursor.before !== null) params.set('before', raw.cursor.before);
  const q = readUserDetailQuery(raw.userId, params);
  assert(q.ok);
  const p = decodeUserDetail(
    { ...raw, environment: 'local-copy' },
    q.value,
    limit,
  );
  assert(p !== null, 'Actual decoder rejected native detail');
  return p;
};
for (const [name, out] of Object.entries(outputs)) {
  if (name.startsWith('bad-')) assert.equal(out.result, null, name);
  else if (out.pages) for (const p of out.pages) decode(p, 2);
  else
    decode(
      out.result,
      name.endsWith('-back') || name === 'stale-chapter-page' ? 2 : 25,
    );
}
const history = outputs.history.result;
assert.deepEqual(history.activity, {
  exerciseAttempts: '5',
  exerciseCorrect: '1',
  exerciseIncorrect: '2',
  exerciseAbandoned: '2',
  duelAttempts: '2',
  duelCorrect: '2',
  duelIncorrect: '0',
  undatedExerciseAttempts: '1',
  undatedDuelAttempts: '1',
  lastActivity: '2026-10-17T23:59:59.000000Z',
});
assert.equal(history.items.length, 7);
assert.equal(history.page.total, '7');
const collision = history.items.filter(
  (i) => i.occurredAt === '2026-10-16T12:00:00.123456Z',
);
assert.deepEqual(
  collision.map((i) => i.kind + ':' + i.id),
  ['exercise:981100002', 'duel:981100002', 'exercise:981100001'],
);
assert.equal(collision[0].versionId, 'a8200000-0000-4000-8000-000000000001');
assert.equal(collision[0].outcome, 'abandoned');
assert.equal(collision[0].titleTruncated, true);
assert.equal(Array.from(collision[0].currentTitle).length, 201);
assert(
  history.items.some((i) => i.kind === 'exercise' && i.versionId === null),
  'Legacy references remain unknown',
);
for (const view of ['history', 'chapters', 'competences']) {
  const full = outputs[view].result,
    walk = outputs[view + '-walk'].pages;
  assert.deepEqual(
    walk.flatMap((p) => p.items),
    full.items,
  );
  assert.equal(walk[0].page.previous, null);
  assert.equal(walk.at(-1).page.next, null);
  for (let i = 1; i < walk.length; i++)
    assert.equal(walk[i].cursor.after, detailItemKey(walk[i - 1].items.at(-1)));
  assert.deepEqual(outputs[view + '-back'].result.items, walk[0].items);
}
assert.deepEqual(outputs.timezone.result.items, history.items);
assert.equal(
  outputs['today-with-future-excluded'].result.activity.exerciseAttempts,
  today === '2026-10-18' ? '1' : '0',
);
assert.equal(outputs.guest.result.user.name, 'Compte invité');
assert.equal(outputs.guest.result.user.email, null);
assert.equal(decode(outputs.missing.result), 'not-found');
assert.equal(outputs['empty-period'].result.page.total, '0');
assert.deepEqual(
  outputs['chapters-empty-period'].result.items,
  outputs.chapters.result.items,
);
assert.equal(outputs['stale-chapter-page'].result.items.length, 0);
assert.equal(outputs['stale-chapter-page'].result.page.total, '3');
assert.deepEqual(outputs.chapters.result.items[1].issues, [
  'missing-level',
  'missing-count',
  'missing-date',
]);
assert.deepEqual(outputs.chapters.result.items[2].issues, [
  'invalid-count',
  'future-date',
]);
assert.equal(outputs.chapters.result.items[2].completed, null);
const competences = outputs.competences.result.items;
assert.deepEqual(
  competences.map((c) => c.id),
  ['local_detail_unmatched', 'local_detail_￿', 'local_detail_😀'],
);
assert.deepEqual(competences[0].issues, ['unknown-competence', 'missing-date']);
assert.deepEqual(competences[2].issues, ['points-above-current-maximum']);
assert.equal(competences[2].points, '15');
assert.equal(competences[2].maximum, '10');
assert.deepEqual(snapshot(), before);
const files = [
  'scripts/user-detail-query.sql',
  'scripts/test-user-detail-readonly-local.sql',
  'scripts/test-user-detail-readonly-local.mjs',
  'tests/fixtures/user-detail-local.sql',
  'tests/fixtures/preview-definition.json',
  'src/lib/user-detail.ts',
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      createHash('sha256')
        .update(await readFile(f))
        .digest('hex'),
    ]),
  ),
);
const proof = {
  result: 'PASS for native user detail SQL, permissions and actual decoder',
  date: new Date().toISOString(),
  artifact,
  container,
  sourceHashes,
  permissionAssertions: 48,
  nativeCases: Object.keys(outputs).length,
  bounds: 7,
  threeViewsPagedInBothDirections: true,
  microsecondTiesPreserved: true,
  unicodeCursorOrderMatchesPostgres: true,
  currentProgressIndependentOfPeriod: true,
  knownAndUnknownVersionReferences: true,
  syntheticVersionCertificationClaimed: false,
  invalidLegacyValuesNotTurnedIntoZeros: true,
  guestIdentityMasked: true,
  missingUserDistinguishedFromFailure: true,
  tableRowsPreserved: 62,
  fixtureRolledBack: true,
  sequencesCompared: false,
  realLoginOrTlsExecuted: false,
  browserExecuted: false,
  remoteOperations: false,
};
await writeFile(
  artifact + '/outputs.json',
  JSON.stringify(outputs, null, 2) + '\n',
);
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/user-detail-readonly-current.json',
  JSON.stringify({ artifact, proof: artifact + '/proof.json' }, null, 2) + '\n',
);
console.log(JSON.stringify(proof));
