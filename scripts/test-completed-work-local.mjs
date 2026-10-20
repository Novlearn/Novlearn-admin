// Read-only qualification of D09 against the existing synthetic local source.
// Real Auth sessions are opened and closed; no accounts, grants or data are edited.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const marker = await json('.local/lot1a/pedagogy-http-current.json');
assert.equal(marker.phase, 'prepared');
const source = path.resolve(marker.artifact);
assert.equal(
  path.dirname(source).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(source), /^pedagogy-http-\d+$/);
const fixture = await json(source + '/private.json');
assert.equal(fixture.physicalConnectionQualified, true);
assert.match(fixture.names.db, /^novlearn-admin-pedagogy-http-\d+-db$/);
const state = await json('.local/local-admin-1792143739689/private.json');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
assert.match(state.names.db, /^novlearn-admin-local-\d+-db$/);
const accounts = (
  await json(
    '.local/lot1a/activity-http-1792344949001/http-1792345469942/accounts-private.json',
  )
).accounts;
const artifact = path.resolve('.local/lot1a/completed-work-' + Date.now());
await mkdir(artifact);
const secrets = [
  decodeURIComponent(new URL(fixture.config.url).password),
  ...accounts.map((a) => a.password),
  state.serviceKey,
  ...Object.values(state.secrets),
];
const safe = (value) =>
  secrets.reduce(
    (s, v) => (typeof v === 'string' && v ? s.replaceAll(v, '[secret]') : s),
    String(value ?? ''),
  );
const cli = (args, input) => {
  const r = spawnSync(
    path.join(
      process.env.LOCALAPPDATA,
      'Programs/DockerDesktop/resources/bin/docker.exe',
    ),
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
  assert.equal(r.status, 0, safe(r.stderr));
  return r.stdout.trim();
};
const sql = (container, database, q) =>
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
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  );
const snapshotQuery =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () =>
  JSON.parse(
    sql(fixture.names.db, 'activity_copy', snapshotQuery).split('\n').at(-1),
  );
const before = snapshot();
assert.equal(Object.keys(before.rows).length, 62);
assert.equal(Object.keys(before.sequences).length, 11);
const businessQuery =
  'BEGIN;' +
  detailRowsFunction +
  "SELECT pg_temp.detail_seed_rows() - ARRAY(SELECT key FROM jsonb_object_keys(pg_temp.detail_seed_rows()) key WHERE key LIKE 'auth.%');ROLLBACK;";
const mainRows = () =>
  JSON.parse(
    sql(state.names.db, 'admin_local', businessQuery).split('\n').at(-1),
  );
const mainBefore = mainRows();
const hashes = {};
for (const file of [
  'scripts/test-completed-work-local.mjs',
  'scripts/pedagogy-statistics-query.sql',
  'src/lib/pedagogy-statistics.ts',
  'src/lib/pedagogy-pg.ts',
  'src/components/pedagogy-statistics.tsx',
])
  hashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
for (const [file, name] of [
  ['src/lib/pedagogy-pg.ts', 'reader.mjs'],
  ['src/lib/pedagogy-statistics.ts', 'domain.mjs'],
])
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'error',
    build: {
      ssr: path.resolve(file),
      outDir: artifact,
      emptyOutDir: false,
      rollupOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: name },
      },
    },
  });
const { createLocalPedagogyReader } = await import(
  pathToFileURL(artifact + '/reader.mjs')
);
const { readPedagogyQuery } = await import(
  pathToFileURL(artifact + '/domain.mjs')
);
const reader = createLocalPedagogyReader(fixture.config);
const sessions = [];
const checks = [];
const period = 'from=2026-10-15&to=2026-10-17';
const endpoint = '/api/admin/statistics/pedagogy';
const observations = [];
const request = async (route, expected, session) => {
  const response = await fetch('http://127.0.0.1:3150' + route, {
    headers: {
      cookie: session
        ? [...session.jar].map(([k, v]) => k + '=' + v).join('; ')
        : '',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
  const body = await response.text();
  assert.equal(
    response.status,
    expected,
    route + ': ' + safe(body).slice(0, 150),
  );
  if (route.startsWith('/api/'))
    assert.match(response.headers.get('cache-control'), /private, no-store/);
  for (const cookie of response.headers.getSetCookie()) {
    if (!session) continue;
    const first = cookie.split(';')[0],
      i = first.indexOf('='),
      k = first.slice(0, i),
      v = first.slice(i + 1);
    if (!v || /max-age=0/i.test(cookie)) session.jar.delete(k);
    else {
      session.jar.set(k, v);
      secrets.push(v);
    }
  }
  return body;
};
const login = async (kind) => {
  const account = accounts.find((a) => a.kind === kind);
  assert(account);
  const jar = new Map();
  const sdk = createServerClient('http://127.0.0.1:55431', state.anonKey, {
    cookieOptions: {
      name: LOCAL_AUTH_COOKIE,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          if (!value || options?.maxAge === 0) jar.delete(name);
          else {
            jar.set(name, value);
            secrets.push(value);
          }
        }
      },
    },
  });
  const s = { sdk, jar, loggedIn: false };
  sessions.push(s);
  const result = await sdk.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(result.error, null, 'Existing local test credentials');
  assert.equal(result.data.user.id, account.id);
  s.loggedIn = true;
  return s;
};
// Independent aggregate: raw rows only, before metadata expansion, no reuse of the application SQL.
const oracle = (mode) => {
  const branches = [];
  if (mode !== 'duel')
    branches.push(
      "SELECT exercise_id FROM public.exercise_attempts WHERE attempted_at >= '2026-10-15T00:00:00Z' AND attempted_at < '2026-10-18T00:00:00Z' AND attempted_at <= statement_timestamp() AND is_abandoned IS NOT TRUE AND is_correct IS NOT NULL",
    );
  if (mode !== 'exercise')
    branches.push(
      "SELECT d.exercise_id FROM public.duel_attempts a LEFT JOIN public.duels d ON d.id=a.duel_id WHERE a.submitted_at >= '2026-10-15T00:00:00Z' AND a.submitted_at < '2026-10-18T00:00:00Z' AND a.submitted_at <= statement_timestamp() AND a.is_correct IS NOT NULL",
    );
  return JSON.parse(
    sql(
      fixture.names.db,
      'activity_copy',
      'BEGIN READ ONLY;WITH records AS (' +
        branches.join(' UNION ALL ') +
        ") SELECT jsonb_build_object('distinctExercises',count(DISTINCT exercise_id)::text,'completedResponses',count(*)::text) FROM records;ROLLBACK;",
    ),
  );
};
try {
  await request(endpoint + '?' + period, 401);
  await request('/admin/statistics/pedagogy', 307);
  const admin = await login('admin'),
    user = await login('user');
  const verified = await user.sdk.auth.getUser();
  assert.equal(verified.error, null);
  assert.equal(verified.data.user.user_metadata.role, 'admin');
  await request(endpoint + '?' + period, 403, user);
  await request(endpoint + '?' + period + '&source=production', 400, admin);
  checks.push(
    'Genuine anonymous/non-Admin refusal and source override rejection; private no-store API',
  );
  const expectedModes = {};
  for (const mode of ['all', 'exercise', 'duel'])
    expectedModes[mode] = oracle(mode);
  assert.deepEqual(expectedModes.all, {
    distinctExercises: '4',
    completedResponses: '14',
  });
  assert.deepEqual(expectedModes.exercise, {
    distinctExercises: '3',
    completedResponses: '9',
  });
  assert.deepEqual(expectedModes.duel, {
    distinctExercises: '2',
    completedResponses: '5',
  });
  for (const extra of [
    '',
    '&mode=exercise',
    '&mode=duel',
    '&groupBy=competence',
    '&groupBy=exercise&page=2',
    '&page=9007199254740993',
    '&chapter=ab100000-0000-4000-8000-000000000001&competence=skill_b&difficulty=easy&exerciseType=classic&mode=exercise&groupBy=exercise&sort=success',
    '&competence=nonexistent',
  ]) {
    const params = new URLSearchParams(period + extra),
      parsed = readPedagogyQuery(params);
    assert.equal(parsed.ok, true);
    const native = await reader.read(parsed.query);
    const http = JSON.parse(await request(endpoint + '?' + params, 200, admin));
    const strip = (v) => {
      const x = structuredClone(v);
      delete x.asOf;
      return x;
    };
    assert.deepEqual(strip(http), strip(native));
    const expected = extra.includes('nonexistent')
      ? { distinctExercises: '0', completedResponses: '0' }
      : extra.includes('&chapter=')
        ? { distinctExercises: '1', completedResponses: '2' }
        : expectedModes[parsed.query.mode];
    assert.deepEqual(native.completedWork, expected);
    assert.equal(
      BigInt(native.completedWork.completedResponses),
      BigInt(native.totals.correct) + BigInt(native.totals.incorrect),
    );
    for (const forbidden of [
      'postgresql://',
      'encrypted_password',
      '@example.test',
      'novlearn_admin_pedagogy_service',
    ])
      assert(!JSON.stringify(http).includes(forbidden));
    observations.push({
      query: params.toString(),
      completedWork: native.completedWork,
    });
  }
  checks.push(
    'Eight genuine TLS/HTTP reports match exactly; independent raw-row oracle for all three modes; filters, pagination and competence duplicates',
  );
  const html = await request(
    '/admin/statistics/pedagogy?' + period,
    200,
    admin,
  );
  for (const text of ['Exercices différents traités', 'Réponses terminées'])
    assert(html.includes(text));
  assert(!html.includes('postgresql://'));
  checks.push(
    'Real server-rendered page contains both labels; browser interaction not executed',
  );
  for (const s of sessions) {
    assert.equal((await s.sdk.auth.signOut({ scope: 'local' })).error, null);
    s.loggedIn = false;
  }
  assert.deepEqual(
    snapshot(),
    before,
    '62 source tables, 11 sequences and permission metadata unchanged',
  );
  assert.deepEqual(mainRows(), mainBefore, 'All main business rows unchanged');
  const proof = {
    result: 'PASS',
    date: new Date().toISOString(),
    artifact,
    checks,
    observations,
    sourceTablesExact: 62,
    sourceSequencesExact: 11,
    sourceMetadataExact: true,
    mainBusinessTablesExact: Object.keys(mainBefore).length,
    sourceHashes: hashes,
    noDataOrGrantEdits: true,
    remoteOperations: false,
    browserExecuted: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    '.local/lot1a/completed-work-current.json',
    JSON.stringify(
      { phase: 'qualified', artifact, proof: artifact + '/proof.json' },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      reports: observations.length,
      counters: expectedModes.all,
    }),
  );
} catch (error) {
  await writeFile(artifact + '/failure.txt', safe(error.stack ?? error));
  throw new Error(safe(error.stack ?? error));
} finally {
  await reader.close();
  for (const s of sessions)
    if (s.loggedIn) await s.sdk.auth.signOut({ scope: 'local' });
}
