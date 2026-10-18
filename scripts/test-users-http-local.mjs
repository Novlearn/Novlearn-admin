// Real sessions, Next HTTP and separate nominal SQL reader; never a browser or remote DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const marker = await json('.local/lot1a/users-http-current.json');
assert.equal(marker.phase, 'prepared');
const root = path.resolve(marker.artifact);
assert.equal(
  path.dirname(root).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(root), /^users-http-\d+$/);
const fixture = await json(root + '/private.json');
assert.match(fixture.names.db, /^novlearn-admin-activity-http-\d+-db$/);
const workspace = path.resolve('.local/local-admin-1792143739689'),
  state = await json(workspace + '/private.json');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
assert.match(state.names.db, /^novlearn-admin-local-\d+-db$/);
const runtime = await json(workspace + '/app-runtime.json');
assert.equal(runtime.statistics, true);
assert.equal(runtime.users, true);
assert.equal(runtime.engine, true);
assert.equal(runtime.review, true);
const stamp = Date.now(),
  artifact = root + '/http-' + stamp;
await mkdir(artifact);
assert.equal(process.argv.length, 3);
const directory = path.resolve(process.argv[2]);
assert.equal(
  path.dirname(directory).toLowerCase(),
  path.resolve(fixture.sourceArtifact).toLowerCase(),
);
assert.match(path.basename(directory), /^http-\d+$/);
const accounts = (await json(directory + '/accounts-private.json')).accounts;
assert.equal(accounts.length, 2);
for (const a of accounts) {
  assert.match(a.id, /^[0-9a-f-]{36}$/);
  assert.match(a.email, /^activity-http-(?:admin|user)-\d+@example\.test$/);
}
const origin = 'http://127.0.0.1:3150',
  checks = [],
  secrets = [
    state.serviceKey,
    state.anonKey,
    ...Object.values(state.secrets),
    decodeURIComponent(new URL(fixture.config.url).password),
    ...accounts.map((a) => a.password),
  ];
const safe = (t) =>
  secrets.reduce(
    (s, v) => (typeof v === 'string' ? s.replaceAll(v, '[local secret]') : s),
    String(t),
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
      timeout: 15000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(r.status, 0, safe(r.stderr));
  return r.stdout.trim();
};
const sql = (container, db, text) =>
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
    text,
  );
const operator = (text) => sql(state.names.db, 'admin_local', text);
const activitySql = (text) => sql(fixture.names.db, 'activity_copy', text);
const rows = () =>
  JSON.parse(
    activitySql(
      `CREATE FUNCTION pg_temp.activity_http_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.activity_http_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const baseline = await json(root + '/rows-before.json');
assert.deepEqual(rows(), baseline);
const jars = [];
const session = () => {
  const jar = new Map();
  jars.push(jar);
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
      setAll: (values) => {
        for (const { name, value, options } of values) {
          if (!value || options?.maxAge === 0) jar.delete(name);
          else {
            jar.set(name, value);
            secrets.push(value);
          }
        }
      },
    },
  });
  return { jar, sdk };
};
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
      name = first.slice(0, i),
      value = first.slice(i + 1);
    if (!value || /max-age=0/i.test(cookie)) jar.delete(name);
    else {
      jar.set(name, value);
      secrets.push(value);
    }
  }
  return response;
};
const mainRows = () =>
  JSON.parse(
    operator(
      `CREATE FUNCTION pg_temp.users_main_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; h jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,h);END LOOP;RETURN result;END;$$;SELECT pg_temp.users_main_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const mainBefore = mainRows();
assert.equal(Object.keys(mainBefore).length, 35);
await writeFile(
  artifact + '/main-before.json',
  JSON.stringify(mainBefore, null, 2) + '\n',
);
const endpoint = '/api/admin/users?from=2026-10-15&to=2026-10-17';
const admin = accounts.find((a) => a.kind === 'admin');
const user = accounts.find((a) => a.kind === 'user');
assert(admin && user);
const profile = () =>
  JSON.parse(
    operator(
      "SELECT to_jsonb(p) FROM public.profiles p WHERE id='" + admin.id + "';",
    ),
  );
const profileHash = () =>
  operator(
    "SELECT encode(extensions.digest(to_jsonb(p)::text,'sha256'),'hex') FROM public.profiles p WHERE id='" +
      admin.id +
      "';",
  );
const profileBefore = profile(),
  profileHashBefore = profileHash();
assert.equal(profileBefore.role, 'admin');
assert.equal(
  mainBefore['public.profiles'].filter((h) => h === profileHashBefore).length,
  1,
);
await writeFile(
  artifact + '/synthetic-admin-profile-before.json',
  JSON.stringify(profileBefore, null, 2) + '\n',
);
let revoked = false,
  drift = false;
try {
  let response = await request(endpoint);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  await response.arrayBuffer();
  response = await request('/admin/users');
  assert.equal(response.status, 307);
  assert.match(response.headers.get('location'), /\/login\?error=session$/);
  await response.arrayBuffer();
  checks.push('Anonymous API and page denied before nominal data');
  const adminSession = session(),
    userSession = session();
  assert.equal(
    (await adminSession.sdk.auth.signInWithPassword(admin)).error,
    null,
  );
  assert.equal(
    (await userSession.sdk.auth.signInWithPassword(user)).error,
    null,
  );
  const verified = await userSession.sdk.auth.getUser();
  assert.equal(verified.error, null);
  assert.equal(
    verified.data.user.user_metadata.role,
    'admin',
    'Existing synthetic metadata-spoof fixture must be present',
  );
  response = await request(endpoint, userSession.jar);
  assert.equal(response.status, 403);
  await response.arrayBuffer();
  checks.push(
    'Real non-Admin with forged user_metadata admin claim remains forbidden',
  );
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const data = await response.json();
  assert.equal(data.environment, 'local-copy');
  assert.equal(data.total, '4');
  assert.equal(data.items.length, 4);
  assert.equal(data.items[0].name, 'LOCAL ACTIVITY A');
  assert.equal(data.items[0].email, 'activity-a@example.test');
  assert.equal(data.items[0].exerciseAttempts, '3');
  assert.equal(data.items[0].duelAttempts, '1');
  assert.equal(data.items[1].name, 'Compte invité');
  assert.equal(data.items[1].email, null);
  assert.equal(data.items[2].lastActivity, null);
  for (const row of data.items)
    assert.deepEqual(
      Object.keys(row).sort(),
      [
        'id',
        'name',
        'nameTruncated',
        'email',
        'anonymous',
        'exerciseAttempts',
        'duelAttempts',
        'lastActivity',
      ].sort(),
    );
  const serialized = JSON.stringify(data);
  assert(!serialized.includes('encrypted_password'));
  assert(!serialized.includes('birth_date'));
  assert(!serialized.includes('novlearn_admin_users_service'));
  await writeFile(
    artifact + '/users-page.json',
    JSON.stringify(data, null, 2) + '\n',
  );
  checks.push(
    'Admin receives exact minimized name/email/activity DTO and masked guest',
  );
  response = await request(
    '/admin/users?from=2026-10-15&to=2026-10-17',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const html = await response.text();
  for (const value of [
    'Base locale synthétique',
    '<caption',
    'action="/admin/users"',
    'activity-a@example.test',
    '/admin/statistics',
    'aria-current="page"',
  ])
    assert(html.includes(value), value);
  for (const secret of [
    fixture.config.url,
    decodeURIComponent(new URL(fixture.config.url).password),
    state.serviceKey,
  ])
    assert(!html.includes(secret));
  checks.push(
    'Authenticated server page renders source, nominal table, GET filters and navigation without secrets',
  );
  for (const q of [
    '&environment=production',
    '&q=a&q=b',
    '&limit=1000',
    '&after=invalid',
    '&before=' + data.items[2].id + '&after=' + data.items[0].id,
    '&q=' + 'a'.repeat(101),
  ]) {
    response = await request(endpoint + q, adminSession.jar);
    assert.equal(response.status, 400, q);
    await response.arrayBuffer();
  }
  checks.push(
    'Six invalid, duplicate, oversized and source-override queries rejected',
  );
  response = await request(endpoint + '&q=activity-c', adminSession.jar);
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).items[0].email,
    'activity-c@example.test',
  );
  for (const term of ['activity-b', 'no-such-synthetic-user']) {
    response = await request(endpoint + '&q=' + term, adminSession.jar);
    assert.equal(response.status, 200);
    const empty = await response.json();
    assert.equal(empty.total, '0');
    assert.deepEqual(empty.items, []);
  }
  checks.push(
    'Search works and hidden guest email does not become a search oracle',
  );
  response = await request(
    endpoint + '&after=' + data.items[1].id,
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, data.items.slice(2));
  response = await request(
    endpoint + '&before=' + data.items[2].id,
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, data.items.slice(0, 2));
  checks.push(
    'Both UUID cursor directions preserve order and row counts over HTTP',
  );
  response = await request(
    '/api/admin/users?from=2026-01-01&to=2026-01-01',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const emptyPeriod = await response.json();
  assert.equal(emptyPeriod.total, '4');
  assert(
    emptyPeriod.items.every(
      (u) =>
        u.exerciseAttempts === '0' &&
        u.duelAttempts === '0' &&
        u.lastActivity === null,
    ),
  );
  checks.push(
    'An empty activity period retains accounts and reports absence of activity',
  );
  // Require exact preservation for the read-only feature before the separately
  // intentional role-revocation test invokes the existing updated_at trigger.
  assert.deepEqual(rows(), baseline);
  assert.deepEqual(mainRows(), mainBefore);
  const mutationStarted = Date.now();
  operator(
    "UPDATE public.profiles SET role='user' WHERE id='" + admin.id + "';",
  );
  revoked = true;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 403);
  await response.arrayBuffer();
  operator(
    "UPDATE public.profiles SET role='admin' WHERE id='" + admin.id + "';",
  );
  revoked = false;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  checks.push(
    'Same session reflects revoked/restored profile role on the next request',
  );
  const profileAfter = profile();
  assert.deepEqual(
    { ...profileAfter, updated_at: profileBefore.updated_at },
    profileBefore,
  );
  assert(Date.parse(profileAfter.updated_at) >= mutationStarted - 1000);
  assert(Date.parse(profileAfter.updated_at) <= Date.now() + 1000);
  const profileHashAfter = profileHash();
  const expectedAfter = structuredClone(mainBefore);
  expectedAfter['public.profiles'] = expectedAfter['public.profiles'].map(
    (h) => (h === profileHashBefore ? profileHashAfter : h),
  );
  assert.deepEqual(mainRows(), expectedAfter);
  await writeFile(
    artifact + '/synthetic-admin-profile-after.json',
    JSON.stringify(profileAfter, null, 2) + '\n',
  );
  activitySql(
    'GRANT SELECT(birth_date) ON public.profiles TO novlearn_users_reader;',
  );
  drift = true;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '{"error":"Utilisateurs indisponibles"}');
  activitySql(
    'REVOKE SELECT(birth_date) ON public.profiles FROM novlearn_users_reader;',
  );
  drift = false;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  checks.push(
    'Unexpected birth-date privilege fails closed and recovers after exact grant removal',
  );
  response = await request(
    '/api/admin/statistics?from=2026-10-15&to=2026-10-17',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const aggregate = await response.json();
  assert.equal(aggregate.accounts.total, '4');
  assert.equal(aggregate.totals.exerciseAttempts, '5');
  assert(!JSON.stringify(aggregate).includes('activity-a@example.test'));
  response = await request('/api/admin/exercises', adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  // The main fixture must still refuse the publication capability.
  response = await request('/api/admin/publication', adminSession.jar, {
    method: 'POST',
    headers: { origin },
    body: '{}',
  });
  assert.equal(response.status, 503);
  await response.arrayBuffer();
  checks.push(
    'Existing statistics and catalogue still work; main publication remains disabled',
  );
  const isolated = await fetch('http://127.0.0.1:3152/api/admin/session', {
    headers: {
      cookie: [...adminSession.jar].map(([k, v]) => k + '=' + v).join('; '),
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
  assert.equal(isolated.status, 401);
  await isolated.arrayBuffer();
  checks.push(
    'Main session does not authenticate the separate publication app',
  );
  response = await request('/auth/logout', adminSession.jar, {
    method: 'POST',
    headers: { origin },
  });
  assert([303, 307].includes(response.status));
  await response.arrayBuffer();
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 401);
  await response.arrayBuffer();
  checks.push(
    'Logout clears this cookie session and its subsequent nominal access',
  );
  assert.deepEqual(rows(), baseline);
  assert.deepEqual(mainRows(), expectedAfter);
  const files = [
    'src/lib/users-config.ts',
    'src/lib/users-pg.ts',
    'src/lib/users-server.ts',
    'src/lib/users.ts',
    'src/components/users-list.tsx',
    'src/app/admin/users/page.tsx',
    'src/app/api/admin/users/route.ts',
    'scripts/users-reader-audit.sql',
    'scripts/users-list-query.sql',
    'scripts/test-users-http-local.mjs',
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
    result: 'PASS',
    date: new Date().toISOString(),
    artifact,
    checks,
    sourceHashes,
    realAuth: true,
    realHttp: true,
    realSql: true,
    activityTablesPreserved: 62,
    mainBusinessTablesExactBeforeIntentionalRoleTest: 35,
    mainBusinessTablesComparedAfterRoleTest: 35,
    intentionalSyntheticProfileChange: {
      id: admin.id,
      columns: ['updated_at'],
      roleRestored: true,
      allOtherProfileFieldsExact: true,
    },
    existingAccountsReused: true,
    newAccountsCreated: 0,
    strictStolenJwtRevocationTested: false,
    browserExecuted: false,
    remoteOperations: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    root + '/http-current.json',
    JSON.stringify({ artifact, proof: artifact + '/proof.json' }, null, 2) +
      '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      checks: checks.length,
      activityTablesPreserved: 62,
      mainBusinessTablesCompared: 35,
    }),
  );
} finally {
  if (drift)
    activitySql(
      'REVOKE SELECT(birth_date) ON public.profiles FROM novlearn_users_reader;',
    );
  if (revoked)
    operator(
      "UPDATE public.profiles SET role='admin' WHERE id='" + admin.id + "';",
    );
  for (const jar of jars) jar.clear();
}
