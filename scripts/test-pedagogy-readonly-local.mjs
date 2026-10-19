// Native SQL qualification on a pristine, explicitly named isolated replay.
// No endpoint, application database, login, or remote target is accepted.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [container, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-\d{17}$/);
const artifact = path.resolve('.local/lot1a/pedagogy-readonly-' + Date.now());
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
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
const checked = (args, input) => {
  const r = cli(args, input);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const state = JSON.parse(checked(['inspect', container]))[0];
assert.equal(state.State.Running, true);
assert.equal(state.HostConfig.NetworkMode, 'none');
assert.deepEqual(state.HostConfig.PortBindings, {});
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(
    checked(['image', 'inspect', state.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const replayManifest = JSON.parse(
  await readFile(
    path.resolve(
      '../Novlearn/.local/admin-sql-replay',
      container,
      'manifest.json',
    ),
    'utf8',
  ),
);
assert.equal(replayManifest.length, 69);
const migrationEntry = replayManifest.find((m) =>
  m.name.endsWith('_novlearn_admin_pedagogy_readonly.sql'),
);
assert(migrationEntry);
assert.equal(
  createHash('sha256')
    .update(
      await readFile(
        path.resolve('../Novlearn/supabase/migrations', migrationEntry.name),
      ),
    )
    .digest('hex'),
  migrationEntry.sha256,
  'The replay must contain the current candidate',
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
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
];
const sql = (q) => checked(args, q);
assert.equal(
  sql('SELECT count(*) FROM auth.users;'),
  '0',
  'Never use existing accounts',
);
const snapshotSql = await readFile(
  'scripts/reader-policies-snapshot.sql',
  'utf8',
);
const snapshot = () =>
  JSON.parse(
    sql('BEGIN;' + detailRowsFunction + snapshotSql + 'ROLLBACK;')
      .split('\n')
      .at(-1),
  );
const before = snapshot();
assert.equal(Object.keys(before.rows).length, 62);
assert(
  before.metadata.roles.some((r) => r.rolname === 'novlearn_pedagogy_reader'),
);
await writeFile(artifact + '/before.json', JSON.stringify(before, null, 2));
const activitySeed = await readFile(
  'scripts/test-activity-readonly-local.sql',
  'utf8',
);
const first = activitySeed.indexOf('INSERT INTO auth.users('),
  last = activitySeed.indexOf('INSERT INTO public.exercise_attempts(', first);
assert(first > 0 && last > first);
const seed =
  activitySeed.slice(first, last) +
  (await readFile('tests/fixtures/pedagogy-local.sql', 'utf8'));
const query = (await readFile('scripts/pedagogy-statistics-query.sql', 'utf8'))
  .trim()
  .replace(/;$/, '');
const audit = await readFile('scripts/pedagogy-reader-audit.sql', 'utf8');
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  build: {
    ssr: 'src/lib/pedagogy-statistics.ts',
    outDir: artifact + '/domain',
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'pedagogy.mjs' } },
  },
});
const domain = await import(
  pathToFileURL(artifact + '/domain/pedagogy.mjs').href
);
const literal = (v) =>
  v === null ? 'NULL' : "'" + String(v).replaceAll("'", "''") + "'";
const parameters = (q) => [
  q.period.from,
  q.period.until,
  q.chapter,
  q.competence,
  q.difficulty,
  q.exerciseType,
  q.mode,
  q.groupBy,
  q.sort,
  q.page,
];
const prepare = `PREPARE pedagogy(date,date,uuid,text,text,text,text,text,text,bigint) AS ${query};`;
const fromParams = (extra) => {
  const p = new URLSearchParams('from=2026-10-15&to=2026-10-17' + extra);
  const v = domain.readPedagogyQuery(p);
  assert.equal(v.ok, true);
  return v.query;
};
const cases = [];
async function run(label, extra = '', additional = '', timezone = 'UTC') {
  const requested = fromParams(extra);
  const text = `BEGIN;SET LOCAL timezone=${literal(timezone)};${seed}${additional}SET SESSION AUTHORIZATION novlearn_pedagogy_reader;${prepare}EXECUTE pedagogy(${parameters(requested).map(literal).join(',')});RESET SESSION AUTHORIZATION;ROLLBACK;`;
  const result = cli(args, text);
  await writeFile(
    artifact + '/' + label + '.log',
    result.stdout + '\n' + result.stderr,
  );
  assert.equal(
    result.status,
    0,
    'Inspect native query: ' + artifact + '/' + label + '.log',
  );
  const packets = result.stdout
    .split(/\r?\n/)
    .filter((s) => s.startsWith('{'))
    .map((s) => JSON.parse(s));
  assert.equal(packets.length, 1);
  const raw = packets[0];
  assert.equal(Object.hasOwn(raw, 'environment'), false);
  const value = domain.decodePedagogyStatistics(
    { ...raw, environment: 'local-copy' },
    { environment: 'local-copy', query: requested },
  );
  assert(value, 'Actual SQL response failed the real decoder: ' + label);
  await writeFile(
    artifact + '/' + label + '.json',
    JSON.stringify(value, null, 2),
  );
  cases.push(label);
  return value;
}
const base = await run('all-chapters');
assert.deepEqual(base.totals, {
  exerciseAttempts: '7',
  duelAttempts: '3',
  completedDuels: '2',
  activeAccounts: '3',
  correct: '3',
  incorrect: '5',
  abandoned: '2',
  unclassified: '0',
});
assert.deepEqual(base.quality, {
  missingExerciseAttempts: '1',
  unresolvedChapterAttempts: '3',
  noCompetenceAttempts: '2',
  unknownCompetenceLinks: '2',
});
assert.equal(base.groups.total, '3');
assert.equal(base.groups.rows[0].id, 'ab100000-0000-4000-8000-000000000001');
assert.equal(base.groups.rows[0].counts.exerciseAttempts, '3');
assert.equal(base.groups.rows[1].id, null);
const competences = await run('overlapping-competences', '&groupBy=competence');
assert.equal(competences.groups.total, '3');
assert.equal(
  competences.groups.rows.find((r) => r.id === 'skill_a').counts
    .exerciseAttempts,
  '3',
);
assert.equal(
  competences.groups.rows.find((r) => r.id === 'skill_b').counts
    .exerciseAttempts,
  '3',
);
assert.equal(
  competences.groups.rows.find((r) => r.id === null).counts.exerciseAttempts,
  '3',
);
assert.deepEqual(competences.totals, base.totals);
const exercise = await run('exercise-ranking', '&groupBy=exercise');
assert.equal(exercise.groups.total, '6');
assert.equal(exercise.groups.rows[0].id, '982000001');
assert.equal(exercise.groups.rows[0].counts.duelAttempts, '2');
const success = await run(
  'recorded-success-ranking',
  '&groupBy=exercise&sort=success',
);
assert.deepEqual(
  success.groups.rows.map((r) => r.id),
  ['982000002', '982000003', '982000004', '982000001', null, '982000005'],
);
const chapter = await run(
  'chapter-alias',
  '&chapter=ab100000-0000-4000-8000-000000000001',
);
assert.equal(chapter.totals.exerciseAttempts, '3');
assert.equal(chapter.totals.duelAttempts, '3');
const skill = await run('competence-fallback', '&competence=skill_a');
assert.deepEqual(skill.totals, chapter.totals);
const combined = await run(
  'combined-filters',
  '&chapter=ab100000-0000-4000-8000-000000000001&competence=skill_b&difficulty=easy&exerciseType=classic&mode=exercise&groupBy=exercise&sort=success',
);
assert.equal(combined.totals.exerciseAttempts, '2');
assert.equal(combined.totals.duelAttempts, '0');
assert.equal(combined.groups.rows.length, 1);
for (const [label, extra, attempts] of [
  ['hard', '&difficulty=hard', '2'],
  ['flash', '&exerciseType=flash', '2'],
  ['unknown-difficulty', '&difficulty=unknown', '2'],
  ['unknown-type', '&exerciseType=unknown', '2'],
])
  assert.equal((await run(label, extra)).totals.exerciseAttempts, attempts);
const ea = await run('exercise-mode', '&mode=exercise');
assert.equal(ea.totals.exerciseAttempts, '7');
assert.equal(ea.totals.duelAttempts, '0');
assert.equal(ea.totals.completedDuels, '0');
const da = await run('duel-mode', '&mode=duel');
assert.equal(da.totals.exerciseAttempts, '0');
assert.equal(da.totals.duelAttempts, '3');
assert.equal(da.totals.completedDuels, '2');
assert.equal(da.totals.abandoned, '0');
const empty = await run(
  'missing-filter-reference',
  '&competence=does-not-exist',
);
assert.equal(empty.totals.exerciseAttempts, '0');
assert.equal(empty.groups.total, '0');
const tz = await run('utc-invariance', '', '', 'Pacific/Auckland');
const timeNeutral = (v) => {
  const c = structuredClone(v);
  delete c.asOf;
  return c;
};
assert.deepEqual(timeNeutral(tz), timeNeutral(base));
const pageSeed = `INSERT INTO public.exercises(id,title,app_title,chapter,difficulty,"Is_Flash",competences,content) SELECT 982300000+i,'LOCAL PAGE '||i,repeat('😀',201),'Analyse','easy',false,ARRAY['skill_a'],'{}'::jsonb FROM generate_series(1,31) g(i);INSERT INTO public.exercise_attempts(id,user_id,exercise_id,is_correct,is_abandoned,attempted_at) SELECT 982500000+i,'a8100000-0000-4000-8000-000000000001',982300000+i,true,false,'2026-10-16T12:00:00Z' FROM generate_series(1,31) g(i);`;
const page1 = await run('page-one', '&groupBy=exercise', pageSeed),
  page2 = await run('page-two', '&groupBy=exercise&page=2', pageSeed),
  page3 = await run('page-beyond', '&groupBy=exercise&page=3', pageSeed);
assert.equal(page1.groups.total, '37');
assert.equal(page1.groups.rows.length, 25);
assert.equal(page1.groups.hasMore, true);
assert.equal(page2.groups.rows.length, 12);
assert.equal(page2.groups.hasMore, false);
assert.equal(page3.groups.rows.length, 0);
assert.equal(
  new Set([...page1.groups.rows, ...page2.groups.rows].map((r) => r.id)).size,
  37,
);
assert(
  page1.groups.rows.some((r) => r.truncated && [...r.label].length === 200),
);
const expectedColumns = [
  'auth.users.id',
  'public.exercise_attempts.id',
  'public.exercise_attempts.exercise_id',
  'public.exercise_attempts.user_id',
  'public.exercise_attempts.attempted_at',
  'public.exercise_attempts.is_correct',
  'public.exercise_attempts.is_abandoned',
  'public.duel_attempts.id',
  'public.duel_attempts.duel_id',
  'public.duel_attempts.player_id',
  'public.duel_attempts.submitted_at',
  'public.duel_attempts.is_correct',
  'public.duels.id',
  'public.duels.exercise_id',
  'public.duels.player1_id',
  'public.duels.player2_id',
  'public.duels.status',
  'public.duels.finished_at',
  'public.exercises.id',
  'public.exercises.title',
  'public.exercises.app_title',
  'public.exercises.chapter',
  'public.exercises.difficulty',
  'public.exercises.competences',
  'public.exercises.competence_id',
  'public.exercises.Is_Flash',
  'public.chapters.id',
  'public.chapters.name',
  'public.chapters.aliases',
  'public.competences.id',
  'public.competences.name',
  'public.competences.chapter_id',
].sort();
const actual = JSON.parse(
  sql(
    'BEGIN;SET SESSION AUTHORIZATION novlearn_pedagogy_reader;' +
      audit +
      'RESET SESSION AUTHORIZATION;ROLLBACK;',
  )
    .split('\n')
    .at(-1),
);
assert.deepEqual(actual.columns, expectedColumns);
assert.deepEqual(actual.flags, {
  login: false,
  inherit: false,
  super: false,
  createdb: false,
  createrole: false,
  replication: false,
  bypassrls: false,
});
assert.deepEqual(actual.memberships, []);
assert.equal(actual.rlsTables, 7);
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
  assert.equal(actual[key], false, key);
const denials = [
  'SELECT email FROM auth.users',
  'SELECT is_anonymous FROM auth.users',
  'SELECT id FROM public.profiles',
  'SELECT content FROM public.exercises',
  'SELECT active_version_id FROM public.exercises',
  'SELECT definition FROM public.exercise_versions',
  'SELECT answer FROM public.duel_attempts',
  'SELECT time_spent FROM public.exercise_attempts',
  'SELECT score FROM public.exercise_attempts',
  'SELECT * FROM public.admin_exercise_test_runs',
  'SELECT * FROM novlearn_admin_private.publication_operations',
  'UPDATE public.exercise_attempts SET is_correct=true',
  'DELETE FROM public.exercise_attempts',
  'TRUNCATE public.exercise_attempts',
  "INSERT INTO public.exercise_attempts(id,user_id,is_correct) VALUES(982900001,'a8100000-0000-4000-8000-000000000001',true)",
  "SELECT nextval('public.exercise_attempts_id_seq')",
  'CREATE TABLE public.pedagogy_denied(id integer)',
  'CREATE TEMP TABLE pedagogy_denied(id integer)',
  'CREATE SEQUENCE public.pedagogy_denied',
  'SELECT pg_catalog.lo_create(982900001)',
  'SET ROLE authenticated',
  'SET ROLE novlearn_activity_reader',
  'SELECT public.get_monthly_leaderboard(now(),1,NULL::text)',
];
const permissions = cli(
  args,
  `BEGIN;${seed}SET SESSION AUTHORIZATION novlearn_pedagogy_reader;DO $checks$ DECLARE q text; denied boolean; BEGIN FOREACH q IN ARRAY ARRAY[${denials.map(literal).join(',')}] LOOP denied:=false;BEGIN EXECUTE q;EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'Expected actual 42501 denial: %',q;END IF;RAISE NOTICE 'PASS: actual 42501 denial';END LOOP;END;$checks$;RESET SESSION AUTHORIZATION;ROLLBACK;`,
);
await writeFile(
  artifact + '/permissions.log',
  permissions.stdout + '\n' + permissions.stderr,
);
assert.equal(permissions.status, 0, 'Inspect permissions.log');
assert.equal(
  (permissions.stderr.match(/PASS: actual 42501 denial/g) ?? []).length,
  denials.length,
);
const bounds = [];
for (const [label, change] of [
  ['reverse', { 0: '2026-10-18', 1: '2026-10-15' }],
  ['too-long', { 0: '2026-01-01', 1: '2026-05-01' }],
  ['future', { 0: '2099-01-01', 1: '2099-01-02' }],
  ['bad-difficulty', { 4: 'extreme' }],
  ['bad-type', { 5: 'qcm' }],
  ['bad-mode', { 6: 'metadata' }],
  ['bad-group', { 7: 'users' }],
  ['bad-sort', { 8: 'email' }],
  ['zero-page', { 9: '0' }],
  ['oversized-page', { 9: '368934881474191033' }],
  ['oversized-competence', { 3: 'x'.repeat(201) }],
]) {
  const values = parameters(fromParams(''));
  for (const [k, v] of Object.entries(change)) values[Number(k)] = v;
  const text = sql(
    `BEGIN;SET SESSION AUTHORIZATION novlearn_pedagogy_reader;${prepare}EXECUTE pedagogy(${values.map(literal).join(',')});RESET SESSION AUTHORIZATION;ROLLBACK;`,
  );
  assert.equal(text, '', label);
  bounds.push(label);
}
const ratioExpression = query.match(
  /CASE WHEN b\.ordering='success' THEN ([\s\S]*?) END ASC NULLS LAST/,
)[1];
const precision = JSON.parse(
  sql(`BEGIN;SET SESSION AUTHORIZATION novlearn_pedagogy_reader;
WITH g(id,correct,incorrect) AS (VALUES
 ('z',4503599627370497::bigint,4503599627370496::bigint),
 ('a',4503599627370496::bigint,4503599627370495::bigint)),b(ordering) AS (VALUES('success'))
SELECT jsonb_agg(g.id ORDER BY ${ratioExpression},g.id COLLATE "C") FROM g CROSS JOIN b;
RESET SESSION AUTHORIZATION;ROLLBACK;`)
    .split('\n')
    .at(-1),
);
assert.deepEqual(
  precision,
  ['z', 'a'],
  'The exact production ordering expression must distinguish close bigint ratios',
);
await writeFile(
  artifact + '/precise-rate-ranking.json',
  JSON.stringify(
    { order: precision, ratioExpression, reusesActualQueryExpression: true },
    null,
    2,
  ),
);
for (const [sub, guest, wanted] of [
  ['a8100000-0000-4000-8000-000000000001', false, 4],
  ['a8100000-0000-4000-8000-000000000002', true, 0],
]) {
  const claims = JSON.stringify({
    sub,
    role: 'novlearn_pedagogy_reader',
    is_anonymous: guest,
  });
  const observed = sql(`BEGIN;${seed}
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',${literal(sub)},true);PERFORM set_config('request.jwt.claims',${literal(claims)},true);END;$$;
SET SESSION AUTHORIZATION authenticated;
SELECT count(id) FROM public.exercise_attempts WHERE attempted_at>='2026-10-15T00:00:00Z' AND attempted_at<'2026-10-18T00:00:00Z';
DO $$ DECLARE denied boolean:=false;BEGIN BEGIN EXECUTE 'SET ROLE novlearn_pedagogy_reader';EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;IF NOT denied THEN RAISE EXCEPTION 'API client assumed reader';END IF;END;$$;
RESET SESSION AUTHORIZATION;ROLLBACK;`);
  assert.equal(
    observed,
    String(wanted),
    'A forged JWT role must not acquire the physical capability',
  );
}
const after = snapshot();
await writeFile(artifact + '/after.json', JSON.stringify(after, null, 2));
assert.deepEqual(after, before);
const sourceHashes = {};
for (const f of [
  'scripts/pedagogy-statistics-query.sql',
  'scripts/pedagogy-reader-audit.sql',
  'scripts/test-pedagogy-readonly-local.mjs',
  'tests/fixtures/pedagogy-local.sql',
  'src/lib/pedagogy-statistics.ts',
])
  sourceHashes[f] = createHash('sha256')
    .update(await readFile(f))
    .digest('hex');
const proof = {
  result: 'PASS for native pedagogy SQL, permissions and actual decoder',
  date: new Date().toISOString(),
  artifact,
  container,
  migrationFile: migrationEntry.name,
  migrationSha256: migrationEntry.sha256,
  sourceHashes,
  nativeCases: cases,
  invalidBounds: bounds,
  actualWriteAndPrivateReadDenials: denials.length,
  sourceColumns: expectedColumns.length,
  rlsTables: 7,
  overlappingCompetencesDoNotInflateTotals: true,
  ambiguousChapterNotInvented: true,
  missingAndUnknownMetadataVisible: true,
  currentMetadataOnly: true,
  utcInvariance: true,
  paginationExact: true,
  closeBigintSuccessRatiosOrderedExactly: true,
  forgedApiRoleContexts: 2,
  apiCannotAssumePhysicalReader: true,
  schemaRecordedVerdictsNonNull: true,
  nullRecordedVerdictPositiveFixtureExecuted: false,
  fullRowsAclPoliciesFunctionsRolesAndSequencesExactAfterRollback: true,
  tableRowsCompared: 62,
  sequencesCompared: 11,
  realLoginOrTlsExecuted: false,
  browserExecuted: false,
  remoteOperations: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/pedagogy-native-current.json',
  JSON.stringify(
    {
      artifact,
      container,
      phase: 'qualified',
      proof: artifact + '/proof.json',
      migrationSha256: migrationEntry.sha256,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact,
    cases: cases.length,
    denials: denials.length,
    bounds: bounds.length,
  }),
);
