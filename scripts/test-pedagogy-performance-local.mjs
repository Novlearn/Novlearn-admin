// Native performance evidence on a NEW isolated restoration, never an app DB.
// Resume reuses that exact seeded copy; failed measurements and plans are retained.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const flags = process.argv.slice(2);
assert(
  flags.length === 0 ||
    (flags[0] === '--resume' && [2, 4].includes(flags.length)) ||
    (flags[0] === '--resume-seed' && flags.length === 2),
);
if (flags.length === 4) assert.equal(flags[2], '--candidate');
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const marker = '.local/lot1a/pedagogy-performance-current.json';
const resume = flags.length > 0,
  resumeSeed = flags[0] === '--resume-seed',
  retained = resume ? await json(marker) : null;
if (!resume) await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
const stamp = Date.now(),
  artifact = resume
    ? path.resolve(flags[1])
    : path.resolve('.local/lot1a/pedagogy-performance-' + stamp);
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^pedagogy-performance-\d+$/);
if (resume) {
  assert.equal(retained.artifact, artifact);
  assert(
    (resumeSeed
      ? ['seeding']
      : ['seeded', 'measured', 'measurement-failed']
    ).includes(retained.phase),
    'Inspect this same partial copy; never blindly reseed',
  );
} else await mkdir(artifact);
const container =
  retained?.container ?? 'novlearn-admin-pedagogy-perf-' + stamp;
assert.match(container, /^novlearn-admin-pedagogy-perf-\d+$/);
const candidate = flags[3] ? path.resolve(flags[3]) : null;
if (candidate) {
  assert.equal(path.dirname(candidate).toLowerCase(), artifact.toLowerCase());
  assert.match(path.basename(candidate), /^candidate-[a-z0-9-]+\.sql$/);
}
const queryFile = candidate ?? 'scripts/pedagogy-statistics-query.sql';
const querySql = await readFile(queryFile, 'utf8'),
  auditSql = await readFile('scripts/pedagogy-reader-audit.sql', 'utf8');
const controlFiles = [
  'scripts/test-pedagogy-performance-local.mjs',
  'tests/fixtures/pedagogy-performance.sql',
  'src/lib/pedagogy-statistics.ts',
  'src/lib/activity-statistics.ts',
  'scripts/pedagogy-reader-audit.sql',
  queryFile,
];
const hashes = {};
for (const f of controlFiles) hashes[f] = sha(await readFile(f));
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, allowFailure = false) => {
  const r = spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 33554432,
    },
  );
  if (!allowFailure)
    assert.equal(
      r.status,
      0,
      'Inspect retained fixture logs; local command failed',
    );
  return r;
};
const checked = (args, input) => cli(args, input).stdout.trim();
const sql = (q, db = 'activity_copy', allowFailure = false) =>
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
      db,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
    allowFailure,
  );
const value = (q) => JSON.parse(sql(q).stdout.trim().split('\n').at(-1));
const snapQuery =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => value(snapQuery);
const phase = async (state) =>
  writeFile(
    marker,
    JSON.stringify({ artifact, container, phase: state }, null, 2) + '\n',
  );
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const source = await json('.local/lot1a/pedagogy-http-current.json');
assert.equal(source.phase, 'prepared');
const preparation = await json(source.proof);
assert(preparation.result.startsWith('PASS'));
const dump = source.artifact + '/source-69.dump';
assert.equal(sha(await readFile(dump)), preparation.sourceDumpSha256);
const originalSourceSnapshot = await json(
  source.artifact + '/source-snapshot.json',
);
const normalize = (s) => {
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
if (!resume) {
  await phase('starting');
  const owner = randomBytes(24).toString('hex');
  await writeFile(
    artifact + '/owner.env',
    'POSTGRES_PASSWORD=' + owner + '\nPOSTGRES_DB=postgres\n',
    { mode: 0o600 },
  );
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
    `type=bind,source=${path.resolve(dump)},target=/seed/source-69.dump,readonly`,
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
        true,
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await delay(500);
  }
  assert(ready, 'Inspect same retained container after observation timeout');
  const globals = await readFile(
    source.artifact + '/roles-private.sql',
    'utf8',
  );
  const roles = originalSourceSnapshot.metadata.roles.filter((r) =>
    r.rolname.startsWith('novlearn_'),
  );
  assert.equal(roles.length, 10);
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
  for (const m of originalSourceSnapshot.metadata.memberships.filter(
    (m) => m.role.startsWith('novlearn_') || m.member.startsWith('novlearn_'),
  )) {
    assert(
      roles.some((r) => r.rolname === m.role) &&
        roles.some((r) => r.rolname === m.member),
    );
    statements.push(
      `SET ROLE ${ident(m.grantor)};GRANT ${ident(m.role)} TO ${ident(m.member)} WITH ADMIN ${m.admin_option},INHERIT ${m.inherit_option},SET ${m.set_option};RESET ROLE;`,
    );
  }
  sql(statements.join('\n'), 'postgres');
  await phase('restoring');
  const restored = cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '--dbname=postgres',
    '--create',
    '--exit-on-error',
    '/seed/source-69.dump',
  ]);
  await writeFile(
    artifact + '/restore.log',
    restored.stdout + '\n' + restored.stderr,
  );
  assert.deepEqual(normalize(snapshot()), normalize(originalSourceSnapshot));
  await phase('restored');
}
const inspected = JSON.parse(checked(['inspect', container]))[0];
assert.equal(inspected.State.Running, true);
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
assert.equal(inspected.HostConfig.NanoCpus, 2000000000);
assert.equal(inspected.HostConfig.Memory, 1073741824);
assert.equal(inspected.HostConfig.MemorySwap, 1073741824);
assert.equal(inspected.HostConfig.PidsLimit, 256);
assert(
  JSON.parse(
    checked(['image', 'inspect', inspected.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const run = artifact + '/run-' + Date.now();
await mkdir(run);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  build: {
    ssr: path.resolve('src/lib/pedagogy-statistics.ts'),
    outDir: run + '/domain',
    emptyOutDir: false,
    rolldownOptions: { output: { entryFileNames: 'pedagogy.mjs' } },
  },
});
const { readPedagogyQuery, decodePedagogyStatistics } = await import(
  pathToFileURL(run + '/domain/pedagogy.mjs').href
);
const wide = { from: '2026-07-21', to: '2026-10-18' };
const cases = [
  ...['chapter', 'competence', 'exercise'].flatMap((groupBy) =>
    ['attempts', 'success'].map((sort) => ({
      name: 'wide-' + groupBy + '-' + sort,
      params: { ...wide, groupBy, sort },
    })),
  ),
  {
    name: 'narrow-three-days',
    params: { from: '2026-10-15', to: '2026-10-17', groupBy: 'exercise' },
  },
  {
    name: 'combined',
    params: {
      ...wide,
      chapter: 'ac100000-0000-4000-8000-000000000023',
      competence: 'perf_skill_23',
      difficulty: 'medium',
      exerciseType: 'classic',
      mode: 'exercise',
      groupBy: 'exercise',
    },
  },
  { name: 'duels', params: { ...wide, mode: 'duel', groupBy: 'competence' } },
  {
    name: 'unknown-metadata',
    params: {
      ...wide,
      difficulty: 'unknown',
      exerciseType: 'unknown',
      groupBy: 'chapter',
    },
  },
  {
    name: 'unknown-skill',
    params: { ...wide, competence: 'perf_missing', groupBy: 'competence' },
  },
  { name: 'empty-filter', params: { ...wide, competence: 'perf_nonexistent' } },
  { name: 'second-page', params: { ...wide, groupBy: 'exercise', page: '2' } },
  {
    name: 'bigint-page',
    params: { ...wide, groupBy: 'exercise', page: '9007199254740993' },
  },
].map((c) => {
  const p = readPedagogyQuery(new URLSearchParams(c.params));
  assert.equal(p.ok, true);
  return { ...c, query: p.query };
});
const literal = (v) =>
  v === null ? 'NULL' : "'" + String(v).replaceAll("'", "''") + "'";
const parameters = (q) =>
  [
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
  ]
    .map(literal)
    .join(',');
const prepared = `PREPARE pedagogy_perf(date,date,uuid,text,text,text,text,text,text,bigint) AS ${querySql}`;
const context =
  "SET SESSION AUTHORIZATION novlearn_admin_pedagogy_service;SET search_path='';SET statement_timeout='10s';SET lock_timeout='3s';SET idle_in_transaction_session_timeout='15s';BEGIN READ ONLY;";
const domainDecode = (data, q) => {
  const decoded = decodePedagogyStatistics(
    { ...data, environment: 'local-copy' },
    { environment: 'local-copy', query: q },
  );
  assert(decoded, 'Actual contract decoder refused response');
  return decoded;
};
await writeFile(
  run + '/source-hashes.json',
  JSON.stringify(hashes, null, 2) + '\n',
);
if (!resume) {
  const baseline = {};
  for (const c of cases) {
    const q = { ...c.query, page: '1' },
      r = sql(
        context +
          'SET LOCAL ROLE novlearn_pedagogy_reader;' +
          prepared +
          `EXECUTE pedagogy_perf(${parameters(q)});COMMIT;`,
      );
    const v = domainDecode(JSON.parse(r.stdout.trim()), q);
    assert.equal(
      v.groups.hasMore,
      false,
      'Baseline must be fully captured, never silently truncated',
    );
    baseline[c.name] = v;
  }
  await writeFile(
    artifact + '/baseline.json',
    JSON.stringify(baseline, null, 2) + '\n',
  );
  await writeFile(
    artifact + '/before-seed.json',
    JSON.stringify(snapshot(), null, 2) + '\n',
  );
}
if (resumeSeed) {
  const inspectedRollback = await json(
    artifact + '/seed-failure-inspection.json',
  );
  assert.equal(inspectedRollback.result, 'PASS for exact rollback inspection');
  assert.equal(inspectedRollback.noOtherClientBackend, true);
  assert.deepEqual(
    snapshot(),
    await json(artifact + '/before-seed.json'),
    'Never reseed changed data or reset advanced sequences',
  );
}
if (!resume || resumeSeed) {
  await phase('seeding');
  const seeded = sql(
    await readFile('tests/fixtures/pedagogy-performance.sql', 'utf8'),
    'activity_copy',
    true,
  );
  await writeFile(
    artifact +
      (resumeSeed ? '/seed-after-inspection-' + stamp + '.log' : '/seed.log'),
    seeded.stdout + '\n' + seeded.stderr,
  );
  assert.equal(
    seeded.status,
    0,
    'Inspect same seed job/container; do not retry or reset automatically',
  );
  const before = await json(artifact + '/before-seed.json'),
    after = snapshot();
  for (const [table, rows] of Object.entries(before.rows)) {
    const counts = new Map();
    for (const h of after.rows[table]) counts.set(h, (counts.get(h) ?? 0) + 1);
    for (const h of rows) {
      assert((counts.get(h) ?? 0) > 0, 'Preexisting row changed: ' + table);
      counts.set(h, counts.get(h) - 1);
    }
  }
  for (const [table, increment] of [
    ['auth.users', 500],
    ['public.chapters', 300],
    ['public.competences', 600],
    ['public.exercises', 2000],
    ['public.exercise_attempts', 50000],
    ['public.duels', 2000],
    ['public.duel_attempts', 50000],
  ])
    assert.equal(
      after.rows[table].length,
      before.rows[table].length + increment,
      table,
    );
  assert.deepEqual(after.metadata, before.metadata);
  assert.deepEqual(after.policies, before.policies);
  await writeFile(
    artifact + '/seeded-snapshot.json',
    JSON.stringify(after, null, 2) + '\n',
  );
  await phase('seeded');
  console.log(
    JSON.stringify({
      stage: 'seeded',
      artifact,
      container,
      responsesAdded: 100000,
      accountsAdded: 500,
      exercisesAdded: 2000,
    }),
  );
}
const baseline = await json(artifact + '/baseline.json'),
  seededSnapshot = await json(artifact + '/seeded-snapshot.json');
assert.deepEqual(snapshot(), seededSnapshot);
const counterKeys = [
  'exerciseAttempts',
  'duelAttempts',
  'completedDuels',
  'activeAccounts',
  'correct',
  'incorrect',
  'abandoned',
  'unclassified',
];
const zero = () => Object.fromEntries(counterKeys.map((k) => [k, 0]));
const chapterId = (n) =>
  'ac100000-0000-4000-8000-' + String(n).padStart(12, '0');
const exercise = (n) => {
  if (n === null) return null;
  const skills =
    n % 29 === 0
      ? []
      : n % 19 === 0
        ? ['perf_skill_' + (((n + 2) % 600) + 1)]
        : [
            'perf_skill_' + ((n % 600) + 1),
            'perf_skill_' + (((n + 1) % 600) + 1),
            ...(n % 23 === 0 ? ['perf_missing'] : []),
          ];
  return {
    id: String(983000000 + n),
    chapter: n % 41 === 0 || n % 37 === 0 ? null : chapterId((n % 300) + 1),
    difficulty: n % 7 === 0 ? 'unknown' : ['easy', 'medium', 'hard'][n % 3],
    exerciseType: n % 13 === 0 ? 'unknown' : n % 2 === 1 ? 'flash' : 'classic',
    skills,
  };
};
const events = [];
for (let i = 1; i <= 50000; i++) {
  if (i % 97 !== 0)
    events.push({
      kind: 'exercise',
      day: Math.floor(Date.UTC(2026, 9, 18) / 86400000) - (i % 90),
      e: exercise(i % 101 === 0 ? null : (i % 2000) + 1),
      user: ((i * 7 + Math.floor(i / 2000)) % 500) + 1,
      verdict:
        i % 11 === 0 ? 'abandoned' : i % 3 === 0 ? 'correct' : 'incorrect',
    });
  if (i % 103 !== 0)
    events.push({
      kind: 'duel',
      day: Math.floor(Date.UTC(2026, 9, 18) / 86400000) - (i % 90),
      e: exercise((i % 2000) + 1),
      user: (i % 500) + 1,
      verdict: i % 4 === 0 ? 'correct' : 'incorrect',
    });
}
for (let i = 1; i <= 2000; i++)
  if (i % 3 !== 0)
    events.push({
      kind: 'completion',
      day: Math.floor(Date.UTC(2026, 9, 18) / 86400000) - (i % 90),
      e: exercise(i),
      user: null,
      verdict: null,
    });
const expected = (c) => {
  const q = c.query,
    base = baseline[c.name],
    totals = zero(),
    quality = {
      missingExerciseAttempts: 0,
      unresolvedChapterAttempts: 0,
      noCompetenceAttempts: 0,
      unknownCompetenceLinks: 0,
    },
    users = new Set(),
    groups = new Map();
  for (const a of events) {
    const e = a.e;
    if (
      a.day < Date.parse(q.period.from) / 86400000 ||
      a.day >= Date.parse(q.period.until) / 86400000 ||
      (q.mode === 'exercise' && a.kind !== 'exercise') ||
      (q.mode === 'duel' && a.kind === 'exercise') ||
      (q.chapter !== null && e?.chapter !== q.chapter) ||
      (q.competence !== null && !e?.skills.includes(q.competence)) ||
      (q.difficulty !== null &&
        (e?.difficulty ?? 'unknown') !== q.difficulty) ||
      (q.exerciseType !== null &&
        (e?.exerciseType ?? 'unknown') !== q.exerciseType)
    )
      continue;
    const update = (counts, set) => {
      counts[
        a.kind === 'exercise'
          ? 'exerciseAttempts'
          : a.kind === 'duel'
            ? 'duelAttempts'
            : 'completedDuels'
      ]++;
      if (a.verdict) counts[a.verdict]++;
      if (a.user !== null) set.add(a.user);
    };
    update(totals, users);
    if (a.kind !== 'completion') {
      if (!e) quality.missingExerciseAttempts++;
      if (!e?.chapter) quality.unresolvedChapterAttempts++;
      if (!e?.skills.length) quality.noCompetenceAttempts++;
      quality.unknownCompetenceLinks += (e?.skills ?? []).filter(
        (s) => s === 'perf_missing',
      ).length;
    }
    const ids =
      q.groupBy === 'chapter'
        ? [e?.chapter ?? null]
        : q.groupBy === 'exercise'
          ? [e?.id ?? null]
          : [
              ...new Set(
                e?.skills.length
                  ? e.skills.map((s) => (s === 'perf_missing' ? null : s))
                  : [null],
              ),
            ];
    for (const id of ids) {
      if (!groups.has(id)) groups.set(id, { counts: zero(), users: new Set() });
      const g = groups.get(id);
      update(g.counts, g.users);
    }
  }
  totals.activeAccounts = users.size;
  const resultGroups = new Map(
    base.groups.rows.map((r) => [r.id, { id: r.id, counts: { ...r.counts } }]),
  );
  for (const [id, g] of groups) {
    g.counts.activeAccounts = g.users.size;
    const previous =
      resultGroups.get(id)?.counts ??
      Object.fromEntries(counterKeys.map((k) => [k, '0']));
    resultGroups.set(id, {
      id,
      counts: Object.fromEntries(
        counterKeys.map((k) => [
          k,
          String(BigInt(previous[k]) + BigInt(g.counts[k])),
        ]),
      ),
    });
  }
  const rows = [...resultGroups.values()].sort((a, b) => {
    const x = a.counts,
      y = b.counts,
      xd = BigInt(x.correct) + BigInt(x.incorrect),
      yd = BigInt(y.correct) + BigInt(y.incorrect);
    if (q.sort === 'success') {
      if (xd === 0n && yd !== 0n) return 1;
      if (yd === 0n && xd !== 0n) return -1;
      const delta = BigInt(x.correct) * yd - BigInt(y.correct) * xd;
      if (delta !== 0n) return delta < 0n ? -1 : 1;
    }
    const delta =
      BigInt(y.exerciseAttempts) +
      BigInt(y.duelAttempts) -
      BigInt(x.exerciseAttempts) -
      BigInt(x.duelAttempts);
    if (delta !== 0n) return delta < 0n ? -1 : 1;
    return a.id === null
      ? b.id === null
        ? 0
        : 1
      : b.id === null
        ? -1
        : Buffer.compare(Buffer.from(a.id), Buffer.from(b.id));
  });
  const offset = BigInt(q.page) - 1n;
  const page =
    offset > BigInt(rows.length)
      ? []
      : rows.slice(Number(offset) * 25, Number(offset) * 25 + 25);
  return {
    totals: Object.fromEntries(
      counterKeys.map((k) => [
        k,
        String(BigInt(base.totals[k]) + BigInt(totals[k])),
      ]),
    ),
    quality: Object.fromEntries(
      Object.entries(quality).map(([k, v]) => [
        k,
        String(BigInt(base.quality[k]) + BigInt(v)),
      ]),
    ),
    groups: { total: String(rows.length), rows: page },
  };
};
const results = [];
try {
  for (const c of cases) {
    const predicted = expected(c);
    for (let repetition = 1; repetition <= 2; repetition++) {
      const prefix = run + '/' + c.name + '-' + repetition;
      if (repetition === 1) {
        const plan = sql(
          context +
            'SET LOCAL ROLE novlearn_pedagogy_reader;' +
            prepared +
            `EXPLAIN(FORMAT JSON,SETTINGS) EXECUTE pedagogy_perf(${parameters(c.query)});COMMIT;`,
          'activity_copy',
          true,
        );
        await writeFile(
          prefix + '-estimated-plan.log',
          plan.stdout + '\n' + plan.stderr,
        );
        assert.equal(plan.status, 0, 'Estimated plan failed: ' + c.name);
      }
      const result = sql(
        context +
          auditSql +
          'SET LOCAL ROLE novlearn_pedagogy_reader;' +
          auditSql +
          prepared +
          `EXPLAIN(ANALYZE,BUFFERS,SETTINGS,FORMAT JSON) EXECUTE pedagogy_perf(${parameters(c.query)});SELECT 'NOVLEARN_PLAN_END';EXECUTE pedagogy_perf(${parameters(c.query)});COMMIT;`,
        'activity_copy',
        true,
      );
      await writeFile(prefix + '.log', result.stdout + '\n' + result.stderr);
      assert.equal(
        result.status,
        0,
        'Unchanged 10-second measurement/decoder query failed: ' + c.name,
      );
      const lines = result.stdout.trim().split('\n'),
        login = JSON.parse(lines.shift()),
        reader = JSON.parse(lines.shift());
      assert.equal(login.login, 'novlearn_admin_pedagogy_service');
      assert.equal(login.columns.length, 0);
      assert.equal(reader.role, 'novlearn_pedagogy_reader');
      assert.equal(reader.columns.length, 32);
      for (const a of [login, reader])
        for (const k of [
          'databaseCreate',
          'temporary',
          'schemaCreate',
          'ownedObjects',
          'tableWrite',
          'sequenceAccess',
          'unexpectedDefinerAccess',
          'largeObjectCreate',
        ])
          assert.equal(a[k], false, k);
      const parts = lines.join('\n').split('\nNOVLEARN_PLAN_END\n');
      assert.equal(parts.length, 2);
      const plan = JSON.parse(parts[0])[0],
        report = domainDecode(JSON.parse(parts[1]), c.query);
      assert.deepEqual(
        report.totals,
        predicted.totals,
        'Independent synthetic totals oracle: ' + c.name,
      );
      assert.deepEqual(report.quality, predicted.quality, c.name);
      assert.equal(report.groups.total, predicted.groups.total);
      assert.deepEqual(
        report.groups.rows.map((r) => ({ id: r.id, counts: r.counts })),
        predicted.groups.rows,
        'Independent grouping/order/page oracle: ' + c.name,
      );
      assert(plan['Execution Time'] < 10000);
      const nodes = [];
      const walk = (n) => {
        nodes.push({
          type: n['Node Type'],
          relation: n['Relation Name'],
          cte: n['CTE Name'],
          loops: n['Actual Loops'],
          rows: n['Actual Rows'],
          estimatedRows: n['Plan Rows'],
          totalMs: n['Actual Total Time'],
          sort: n['Sort Method'],
          diskKb: n['Sort Space Type'] === 'Disk' ? n['Sort Space Used'] : 0,
          tempRead: n['Temp Read Blocks'],
          tempWritten: n['Temp Written Blocks'],
        });
        for (const child of n.Plans ?? []) walk(child);
      };
      walk(plan.Plan);
      const measurement = {
        case: c.name,
        repetition,
        executionMs: plan['Execution Time'],
        planningMs: plan['Planning Time'],
        topPlan: plan.Plan['Node Type'],
        tempReadBlocks: plan.Plan['Temp Read Blocks'] ?? 0,
        tempWrittenBlocks: plan.Plan['Temp Written Blocks'] ?? 0,
        sharedHitBlocks: plan.Plan['Shared Hit Blocks'] ?? 0,
        sharedReadBlocks: plan.Plan['Shared Read Blocks'] ?? 0,
        parameters: c.query,
        oracleExact: true,
      };
      results.push(measurement);
      await writeFile(
        prefix + '-plan.json',
        JSON.stringify(plan, null, 2) + '\n',
      );
      await writeFile(
        prefix + '-nodes.json',
        JSON.stringify(nodes, null, 2) + '\n',
      );
      await writeFile(
        prefix + '-response.json',
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(
        JSON.stringify({
          stage: 'measured',
          case: c.name,
          repetition,
          executionMs: measurement.executionMs,
        }),
      );
    }
  }
  assert.deepEqual(
    snapshot(),
    seededSnapshot,
    'Every seeded row, sequence, ACL and role must remain exact after reads',
  );
  for (const [f, h] of Object.entries(hashes))
    assert.equal(
      sha(await readFile(f)),
      h,
      'Source changed during measurement: ' + f,
    );
  const proof = {
    result:
      'PASS for bounded native SQL performance on specified synthetic workload only',
    date: new Date().toISOString(),
    artifact,
    run,
    container,
    sourceDumpSha256: preparation.sourceDumpSha256,
    queryFile,
    sourceHashes: hashes,
    candidateQueryUsed: !!candidate,
    physicalLoginAndReaderAudited: true,
    roleColumnReads: 32,
    postgresImage: pgImage,
    limits: {
      cpus: 2,
      memoryBytes: 1073741824,
      swapBytes: 0,
      pids: 256,
      statementTimeoutMs: 10000,
      workMemUnmodified: true,
      jitUnmodified: true,
    },
    workload: {
      addedAccounts: 500,
      addedChapters: 300,
      addedCompetences: 600,
      addedExercises: 2000,
      addedDuels: 2000,
      addedExerciseAttempts: 50000,
      addedDuelAttempts: 50000,
      periodDays: 90,
      nullTimestamps: true,
      abandonment: true,
      ambiguousOrMissingMetadata: true,
      duplicateAndUnknownSkillLinks: true,
    },
    measurements: results,
    existingRestoredRowsPreservedAcrossTables: 62,
    allSeededRowsSequencesAndMetadataExact: true,
    applicationInstancesModified: false,
    remoteOperations: false,
    browserExecuted: false,
    coldCacheOrProductionSlaCertified: false,
  };
  await writeFile(run + '/proof.json', JSON.stringify(proof, null, 2) + '\n');
  await phase('measured');
  await writeFile(
    '.local/lot1a/pedagogy-performance-proof-current.json',
    JSON.stringify(
      { artifact, run, proof: run + '/proof.json', phase: 'qualified' },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: proof.result,
      artifact,
      run,
      measurements: results.length,
      worstMs: Math.max(...results.map((r) => r.executionMs)),
    }),
  );
} catch (error) {
  const preserved =
    JSON.stringify(snapshot()) === JSON.stringify(seededSnapshot);
  await writeFile(
    run + '/failure.json',
    JSON.stringify(
      {
        result: 'FAIL',
        date: new Date().toISOString(),
        reason: String(error.message),
        results,
        seededDataAndMetadataPreserved: preserved,
        queryFile,
        sourceHashes: hashes,
        criteriaUnchanged: true,
      },
      null,
      2,
    ) + '\n',
  );
  await phase('measurement-failed');
  throw error;
}
