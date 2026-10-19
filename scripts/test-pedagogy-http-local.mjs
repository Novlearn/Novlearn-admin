// Genuine local Auth sessions and HTTP requests against the explicitly enabled app.
// Does not create accounts, edit passwords, use a browser or contact remote projects.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
assert.equal(process.argv.length, 2);
const marker = await json('.local/lot1a/pedagogy-http-current.json');
assert.equal(marker.phase, 'prepared');
const root = path.resolve(marker.artifact);
assert.equal(
  path.dirname(root).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(root), /^pedagogy-http-\d+$/);
const fixture = await json(root + '/private.json');
assert.equal(fixture.physicalConnectionQualified, true);
assert.match(fixture.names.db, /^novlearn-admin-pedagogy-http-\d+-db$/);
const workspace = '.local/local-admin-1792143739689',
  state = await json(workspace + '/private.json'),
  runtime = await json(workspace + '/app-runtime.json');
assert.equal(runtime.pedagogy, true);
assert.equal(runtime.statistics, true);
assert.equal(runtime.users, true);
assert.equal(runtime.userDetail, true);
assert.equal(runtime.engine, true);
assert.equal(runtime.review, true);
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
const admin = accounts.find((a) => a.kind === 'admin'),
  user = accounts.find((a) => a.kind === 'user');
assert(admin && user);
for (const a of [admin, user]) assert.match(a.id, /^[0-9a-f-]{36}$/);
const artifact = root + '/http-' + Date.now();
await mkdir(artifact);
const secrets = [
  decodeURIComponent(new URL(fixture.config.url).password),
  admin.password,
  user.password,
  state.serviceKey,
  ...Object.values(state.secrets),
];
const safe = (t) =>
  secrets.reduce(
    (s, v) => (typeof v === 'string' ? s.replaceAll(v, '[fixture secret]') : s),
    String(t ?? ''),
  );
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
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
const pedagogy = (q) => sql(fixture.names.db, 'activity_copy', q),
  operator = (q) => sql(state.names.db, 'admin_local', q);
const snapQuery =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const sourceSnapshot = () => JSON.parse(pedagogy(snapQuery).split('\n').at(-1));
const before = sourceSnapshot();
const mainSnapshot = () =>
  JSON.parse(
    operator(
      `CREATE FUNCTION pg_temp.pedagogy_main_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; h jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO h; result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,h); END LOOP;RETURN result;END;$$; SELECT pg_temp.pedagogy_main_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const mainBefore = mainSnapshot();
assert.equal(Object.keys(mainBefore).length, 35);
const profile = () =>
  JSON.parse(
    operator(
      `SELECT to_jsonb(p) FROM public.profiles p WHERE id='${admin.id}';`,
    ),
  );
const profileHash = () =>
  operator(
    `SELECT encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex') FROM public.profiles p WHERE id='${admin.id}';`,
  );
const profileBefore = profile(),
  profileHashBefore = profileHash();
assert.equal(profileBefore.role, 'admin');
await writeFile(
  artifact + '/before.json',
  JSON.stringify(
    { source: before, main: mainBefore, syntheticAdmin: profileBefore },
    null,
    2,
  ) + '\n',
);
const sessions = [];
const session = () => {
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
  const s = { jar, sdk, loggedIn: false };
  sessions.push(s);
  return s;
};
const origin = 'http://127.0.0.1:3150',
  period = 'from=2026-10-15&to=2026-10-17',
  endpoint = '/api/admin/statistics/pedagogy',
  refs = endpoint + '/references',
  page = '/admin/statistics/pedagogy';
const request = async (route, jar = new Map(), options = {}) => {
  const response = await fetch(origin + route, {
    ...options,
    headers: {
      cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '),
      ...options.headers,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(';')[0],
      i = first.indexOf('='),
      k = first.slice(0, i),
      v = first.slice(i + 1);
    if (!v || /max-age=0/i.test(cookie)) jar.delete(k);
    else {
      jar.set(k, v);
      secrets.push(v);
    }
  }
  return response;
};
const status = async (route, expected, jar, options) => {
  const r = await request(route, jar, options);
  const body = await r.text();
  assert.equal(r.status, expected, route + ' ' + safe(body).slice(0, 150));
  return { response: r, body };
};
const checks = [];
let revoked = false,
  drift = false,
  stopped = false;
try {
  for (const route of [endpoint + '?' + period, refs + '?kind=chapter']) {
    const { response } = await status(route, 401);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
  }
  const anonymous = await status(page, 307);
  assert.match(anonymous.response.headers.get('location'), /\/login/);
  checks.push('Anonymous page and both APIs refuse access');
  const a = session(),
    u = session();
  for (const [s, account] of [
    [a, admin],
    [u, user],
  ]) {
    const login = await s.sdk.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    assert.equal(
      login.error,
      null,
      'Existing credentials must work without reset',
    );
    assert.equal(login.data.user.id, account.id);
    s.loggedIn = true;
  }
  const verified = await u.sdk.auth.getUser();
  assert.equal(verified.error, null);
  assert.equal(verified.data.user.user_metadata.role, 'admin');
  for (const route of [endpoint + '?' + period, refs + '?kind=chapter'])
    await status(route, 403, u.jar);
  checks.push(
    'Real non-Admin with editable metadata admin claim remains forbidden',
  );
  const reportResponse = await status(endpoint + '?' + period, 200, a.jar);
  assert.match(
    reportResponse.response.headers.get('cache-control'),
    /private, no-store/,
  );
  const report = JSON.parse(reportResponse.body);
  const known = await json(root + '/physical-results.json');
  const strip = (v) => {
    const x = structuredClone(v);
    delete x.asOf;
    return x;
  };
  assert.deepEqual(strip(report), strip(known.statistics));
  for (const forbidden of [
    'encrypted_password',
    'raw_user_meta_data',
    '@example.test',
    'novlearn_admin_pedagogy_service',
    'definition',
  ])
    assert(!reportResponse.body.includes(forbidden));
  checks.push(
    'HTTP report matches physical SQL aggregates exactly with no identity or definitions',
  );
  await writeFile(
    artifact + '/report.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  const combined = JSON.parse(
    (
      await status(
        endpoint +
          '?' +
          period +
          '&chapter=ab100000-0000-4000-8000-000000000001&competence=skill_b&difficulty=easy&exerciseType=classic&mode=exercise&groupBy=exercise&sort=success',
        200,
        a.jar,
      )
    ).body,
  );
  assert.equal(combined.totals.exerciseAttempts, '2');
  assert.equal(combined.totals.duelAttempts, '0');
  assert.equal(combined.groups.rows.length, 1);
  checks.push('Combined pedagogical filters execute through real HTTP and SQL');
  const empty = JSON.parse(
    (
      await status(
        endpoint + '?' + period + '&competence=nonexistent',
        200,
        a.jar,
      )
    ).body,
  );
  assert.equal(empty.groups.total, '0');
  const distant = JSON.parse(
    (
      await status(
        endpoint + '?' + period + '&page=9007199254740993',
        200,
        a.jar,
      )
    ).body,
  );
  assert.equal(distant.groups.page, '9007199254740993');
  assert.equal(distant.groups.rows.length, 0);
  checks.push(
    'Successful empty filters and exact bigint pages remain distinct from failures',
  );
  for (const [kind, q] of [
    ['chapter', 'Ancien'],
    ['competence', 'sKiLl_B'],
    ['competence', '%_\\'],
  ]) {
    const r = JSON.parse(
      (await status(refs + '?' + new URLSearchParams({ kind, q }), 200, a.jar))
        .body,
    );
    assert.equal(r.q, q);
    assert.equal(r.environment, 'local-copy');
    if (q === 'Ancien')
      assert(
        r.items.some((i) => i.id === 'ab100000-0000-4000-8000-000000000001'),
      );
    else if (q === 'sKiLl_B') assert.equal(r.items[0].id, 'skill_b');
    else assert.equal(r.items.length, 0);
  }
  checks.push(
    'Literal and case-insensitive metadata searches pass through audited SQL reader',
  );
  for (const route of [
    endpoint + '?' + period + '&source=production',
    endpoint + '?' + period + '&page=1&page=2',
    refs + '?kind=chapter&q=a&q=b',
    refs + '?kind=user',
  ])
    await status(route, 400, a.jar);
  checks.push(
    'Source overrides and duplicate or private query fields are refused',
  );
  const rendered = await status(
    page + '?' + period + '&chapterSearch=Ancien',
    200,
    a.jar,
  );
  for (const text of [
    'données synthétiques',
    '<caption',
    'name="competence"',
    'pas une certification',
  ])
    assert(rendered.body.includes(text), text);
  assert(!rendered.body.includes('postgresql://'));
  checks.push(
    'Actual server-rendered page exposes filters and truthful source and Engine limitations',
  );
  operator(`UPDATE public.profiles SET role='user' WHERE id='${admin.id}';`);
  revoked = true;
  for (const route of [endpoint + '?' + period, refs + '?kind=chapter'])
    await status(route, 403, a.jar);
  checks.push(
    'Same valid cookie is refused after actual profile-role revocation',
  );
  operator(`UPDATE public.profiles SET role='admin' WHERE id='${admin.id}';`);
  revoked = false;
  await status(endpoint + '?' + period, 200, a.jar);
  pedagogy('GRANT SELECT(email) ON auth.users TO novlearn_pedagogy_reader;');
  drift = true;
  for (const route of [endpoint + '?' + period, refs + '?kind=chapter']) {
    const r = await status(route, 503, a.jar);
    assert(!r.body.includes('totals'));
    assert(!r.body.includes('postgresql'));
  }
  pedagogy('REVOKE SELECT(email) ON auth.users FROM novlearn_pedagogy_reader;');
  drift = false;
  await status(endpoint + '?' + period, 200, a.jar);
  checks.push(
    'Warm report and reference pools refuse actual excess rights then recover after exact restoration',
  );
  cli(['stop', '--time', '10', fixture.names.proxy]);
  stopped = true;
  for (const route of [endpoint + '?' + period, refs + '?kind=chapter'])
    await status(route, 503, a.jar);
  cli(['start', fixture.names.proxy]);
  stopped = false;
  await status(endpoint + '?' + period, 200, a.jar);
  checks.push(
    'Source proxy outage yields 503 and reconnects without fake zero statistics',
  );
  for (const route of [
    '/api/admin/statistics?' + period,
    '/api/admin/users?' + period,
    '/api/admin/users/a8100000-0000-4000-8000-000000000001?' + period,
  ])
    await status(route, 200, a.jar);
  await status('/api/admin/publication', 503, a.jar, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
  });
  checks.push(
    'Existing general statistics, users and profile reads work and main publication stays disabled',
  );
  for (const s of sessions) {
    assert.equal((await s.sdk.auth.signOut({ scope: 'local' })).error, null);
    s.loggedIn = false;
  }
  checks.push('Only newly opened test sessions were signed out');
  assert.deepEqual(
    sourceSnapshot(),
    before,
    'All 62 source tables, sequences and permission metadata must remain exact',
  );
  const after = mainSnapshot(),
    profileAfter = profile(),
    hashAfter = profileHash();
  const p0 = { ...profileBefore },
    p1 = { ...profileAfter };
  delete p0.updated_at;
  delete p1.updated_at;
  assert.deepEqual(p1, p0);
  const oldRows = mainBefore['public.profiles'].filter(
      (h) => h !== profileHashBefore,
    ),
    newRows = after['public.profiles'].filter((h) => h !== hashAfter);
  assert.deepEqual(newRows, oldRows);
  const oldMain = { ...mainBefore },
    newMain = { ...after };
  delete oldMain['public.profiles'];
  delete newMain['public.profiles'];
  assert.deepEqual(newMain, oldMain);
  checks.push(
    'All source rows and 35 main business tables preserved except known synthetic Admin update timestamp',
  );
  const proof = {
    result: 'PASS',
    date: new Date().toISOString(),
    artifact,
    checks,
    actualAuthSessions: true,
    accountsCreated: false,
    sourceTablesExact: 62,
    sourceSequencesAndMetadataExact: true,
    mainBusinessTablesCompared: 35,
    onlyPermittedMainDifference:
      'Existing synthetic Admin updated_at after role revocation/restoration',
    newTestSessionsClosed: true,
    browserExecuted: false,
    remoteOperations: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    '.local/lot1a/pedagogy-http-proof-current.json',
    JSON.stringify(
      { artifact, proof: artifact + '/proof.json', phase: 'qualified' },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      checks: checks.length,
      actualAuthSessions: true,
    }),
  );
} finally {
  if (revoked)
    operator(`UPDATE public.profiles SET role='admin' WHERE id='${admin.id}';`);
  if (drift)
    pedagogy(
      'REVOKE SELECT(email) ON auth.users FROM novlearn_pedagogy_reader;',
    );
  if (stopped) cli(['start', fixture.names.proxy]);
  for (const s of sessions)
    if (s.loggedIn) await s.sdk.auth.signOut({ scope: 'local' });
}
