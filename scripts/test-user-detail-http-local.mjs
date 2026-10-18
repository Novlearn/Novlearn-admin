// Real sessions, Next HTTP and separate detailed user reader; never a browser or remote DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const marker = await json('.local/lot1a/user-detail-http-current.json');
assert.equal(marker.phase, 'prepared');
const root = path.resolve(marker.artifact);
assert.equal(
  path.dirname(root).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(root), /^user-detail-http-\d+$/);
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
assert.equal(runtime.userDetail, true);
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
const baseline = await json(root + '/rows-after-seed.json');
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
const uid = 'a8100000-0000-4000-8000-000000000001';
const period = 'from=2026-10-15&to=2026-10-17';
const endpoint = '/api/admin/users/' + uid + '?' + period;
const pageEndpoint = '/admin/users/' + uid + '?' + period;
await build({
  configFile: false,
  envDir: false,
  logLevel: 'warn',
  build: {
    ssr: path.resolve('src/lib/user-detail.ts'),
    outDir: artifact + '/domain',
    emptyOutDir: false,
    rolldownOptions: { output: { entryFileNames: 'user-detail.mjs' } },
  },
});
const { detailItemKey } = await import(
  pathToFileURL(artifact + '/domain/user-detail.mjs').href
);
const mainRows = () =>
  JSON.parse(
    operator(
      `CREATE FUNCTION pg_temp.detail_main_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; h jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,h);END LOOP;RETURN result;END;$$;SELECT pg_temp.detail_main_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const admin = accounts.find((a) => a.kind === 'admin'),
  user = accounts.find((a) => a.kind === 'user');
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
const mainBefore = mainRows(),
  profileBefore = profile(),
  profileHashBefore = profileHash();
assert.equal(Object.keys(mainBefore).length, 35);
assert.equal(profileBefore.role, 'admin');
assert.equal(
  mainBefore['public.profiles'].filter((h) => h === profileHashBefore).length,
  1,
);
await writeFile(
  artifact + '/main-before.json',
  JSON.stringify(mainBefore, null, 2) + '\n',
);
await writeFile(
  artifact + '/synthetic-admin-before.json',
  JSON.stringify(profileBefore, null, 2) + '\n',
);
let revoked = false,
  drift = false,
  proxyStopped = false;
try {
  let response = await request(endpoint);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  await response.arrayBuffer();
  response = await request(pageEndpoint);
  assert.equal(response.status, 307);
  assert.match(response.headers.get('location'), /\/login\?error=session$/);
  await response.arrayBuffer();
  checks.push(
    'Anonymous API and profile page are denied before any detail is returned',
  );
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
  assert.equal(verified.data.user.user_metadata.role, 'admin');
  response = await request(endpoint, userSession.jar);
  assert.equal(response.status, 403);
  await response.arrayBuffer();
  checks.push(
    'Actual non-Admin with a forged metadata admin claim remains forbidden',
  );
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const history = await response.json();
  assert.equal(history.userId, uid);
  assert.equal(history.user.name, 'LOCAL ACTIVITY A');
  assert.equal(history.user.email, 'activity-a@example.test');
  assert.equal(history.activity.exerciseAttempts, '3');
  assert.equal(history.activity.duelAttempts, '1');
  assert.equal(history.activity.undatedExerciseAttempts, '1');
  assert.equal(history.page.total, '4');
  assert.equal(history.items.length, 4);
  assert(
    history.items
      .filter((i) => i.kind === 'exercise')
      .every((i) => i.versionId === null),
  );
  assert.deepEqual(
    Object.keys(history.user).sort(),
    ['id', 'name', 'nameTruncated', 'email', 'anonymous'].sort(),
  );
  for (const forbidden of [
    'encrypted_password',
    'birth_date',
    'raw_user_meta_data',
    'novlearn_admin_user_detail_service',
  ])
    assert(!JSON.stringify(history).includes(forbidden));
  await writeFile(
    artifact + '/history.json',
    JSON.stringify(history, null, 2) + '\n',
  );
  checks.push(
    'Actual HTTP profile returns exact minimized identity and known historical attempts without guessed versions',
  );
  const views = { history };
  for (const view of ['chapters', 'competences']) {
    response = await request(endpoint + '&view=' + view, adminSession.jar);
    assert.equal(response.status, 200);
    views[view] = await response.json();
    assert.equal(views[view].items.length, 3);
    await writeFile(
      artifact + '/' + view + '.json',
      JSON.stringify(views[view], null, 2) + '\n',
    );
  }
  assert.equal(views.chapters.items[0].level, 40);
  assert.equal(views.chapters.items[0].completed, '3');
  assert.deepEqual(views.chapters.items[1].issues, [
    'missing-level',
    'missing-count',
    'missing-date',
  ]);
  assert.equal(views.chapters.items[2].completed, null);
  assert.deepEqual(views.chapters.items[2].issues, [
    'invalid-count',
    'future-date',
  ]);
  const above = views.competences.items.find(
    (i) => i.id === 'local_detail_progress_a',
  );
  assert.equal(above.points, '15');
  assert.equal(above.maximum, '10');
  assert.deepEqual(above.issues, ['points-above-current-maximum']);
  const orphan = views.competences.items.find(
    (i) => i.id === 'local_detail_progress_unmatched',
  );
  assert.equal(orphan.maximum, null);
  assert.deepEqual(orphan.issues, ['unknown-competence', 'missing-date']);
  checks.push(
    'Both nonempty current-progress views expose missing data, invalid legacy counts and current-scale warnings without invented zeros',
  );
  for (const [view, caption] of [
    ['history', 'Tentatives enregistrées'],
    ['chapters', 'Progression enregistrée par chapitre'],
    ['competences', 'Points enregistrés par compétence'],
  ]) {
    response = await request(pageEndpoint + '&view=' + view, adminSession.jar);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const html = await response.text();
    for (const text of [
      'Base locale synthétique',
      'activity-a@example.test',
      '<caption',
      caption,
      'aria-current="page"',
      'pas une certification par l’Engine',
    ])
      assert(html.includes(text), text);
    assert(!html.includes('Fiche utilisateur indisponible'));
    for (const secret of [
      fixture.config.url,
      decodeURIComponent(new URL(fixture.config.url).password),
      state.serviceKey,
    ])
      assert(!html.includes(secret));
  }
  response = await request('/admin/users?' + period, adminSession.jar);
  assert.equal(response.status, 200);
  const listing = await response.text();
  assert(listing.includes('/admin/users/' + uid + '?'));
  assert(listing.includes('activity-a@example.test'));
  checks.push(
    'Three authenticated server pages and list-to-profile links render actual data and clear source/certification labels without SQL secrets',
  );
  for (const suffix of [
    '&environment=production',
    '&view=history&view=chapters',
    '&view=invalid',
    '&limit=1000',
    '&after=invalid',
    '&view=competences&after=' + 'x'.repeat(1001),
  ]) {
    response = await request(endpoint + suffix, adminSession.jar);
    assert.equal(response.status, 400, suffix);
    await response.arrayBuffer();
  }
  response = await request(
    '/api/admin/users/invalid?' + period,
    adminSession.jar,
  );
  assert.equal(response.status, 400);
  await response.arrayBuffer();
  checks.push(
    'Seven invalid UUID, view, duplicate, oversized and source-override requests are rejected',
  );
  const after = detailItemKey(history.items[1]),
    before = detailItemKey(history.items[2]);
  response = await request(
    endpoint + '&after=' + encodeURIComponent(after),
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, history.items.slice(2));
  response = await request(
    endpoint + '&before=' + encodeURIComponent(before),
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, history.items.slice(0, 2));
  for (const view of ['chapters', 'competences']) {
    response = await request(
      endpoint +
        '&view=' +
        view +
        '&after=' +
        encodeURIComponent(detailItemKey(views[view].items[0])),
      adminSession.jar,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items, views[view].items.slice(1));
  }
  checks.push(
    'All three HTTP views apply their actual bounded cursor ordering; history supports both directions',
  );
  response = await request(
    '/api/admin/users/' + uid + '?from=2026-01-01&to=2026-01-01',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const empty = await response.json();
  assert.equal(empty.user.id, uid);
  assert.equal(empty.page.total, '0');
  assert.equal(empty.activity.exerciseAttempts, '0');
  response = await request(
    '/api/admin/users/' + uid + '?from=2026-01-01&to=2026-01-01&view=chapters',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, views.chapters.items);
  checks.push(
    'An empty historical period keeps the profile and leaves current progression unchanged',
  );
  response = await request(
    '/api/admin/users/ffffffff-ffff-ffff-ffff-ffffffffffff?' + period,
    adminSession.jar,
  );
  assert.equal(response.status, 404);
  assert.equal(await response.text(), '{"error":"Utilisateur introuvable."}');
  response = await request(
    '/admin/users/ffffffff-ffff-ffff-ffff-ffffffffffff?' + period,
    adminSession.jar,
  );
  assert([200, 404].includes(response.status));
  const missingPage = await response.text();
  assert(missingPage.includes('Utilisateur introuvable'));
  assert(!missingPage.includes('LOCAL ACTIVITY A'));
  checks.push(
    'Actual absence is an API 404 and a not-found page, never an empty or unavailable profile',
  );
  response = await request(
    '/api/admin/users/a8100000-0000-4000-8000-000000000002?' + period,
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const guest = await response.json();
  assert.equal(guest.user.name, 'Compte invité');
  assert.equal(guest.user.email, null);
  assert(!JSON.stringify(guest).includes('activity-b@example.test'));
  checks.push('Actual guest detail masks nominal identity');
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
  const profileAfter = profile();
  assert.deepEqual(
    { ...profileAfter, updated_at: profileBefore.updated_at },
    profileBefore,
  );
  assert(
    Date.parse(profileAfter.updated_at) >= mutationStarted - 1000 &&
      Date.parse(profileAfter.updated_at) <= Date.now() + 1000,
  );
  const finalProfileHash = profileHash(),
    expectedAfter = structuredClone(mainBefore);
  expectedAfter['public.profiles'] = expectedAfter['public.profiles'].map(
    (h) => (h === profileHashBefore ? finalProfileHash : h),
  );
  checks.push(
    'Fresh profile-role authorization revokes and restores the same session; only the synthetic account updated_at changes',
  );
  activitySql(
    'GRANT SELECT(birth_date) ON public.profiles TO novlearn_user_detail_reader;',
  );
  drift = true;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 503);
  assert.equal(
    await response.text(),
    '{"error":"Fiche utilisateur indisponible"}',
  );
  activitySql(
    'REVOKE SELECT(birth_date) ON public.profiles FROM novlearn_user_detail_reader;',
  );
  drift = false;
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  checks.push(
    'Warm reader detects unexpected birth-date privileges and recovers only after their removal',
  );
  cli(['stop', '--time', '2', fixture.names.proxy]);
  proxyStopped = true;
  assert.equal(
    JSON.parse(cli(['inspect', fixture.names.proxy]))[0].State.Running,
    false,
  );
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 503);
  assert.equal(
    await response.text(),
    '{"error":"Fiche utilisateur indisponible"}',
  );
  response = await request('/api/admin/exercises', adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  cli(['start', fixture.names.proxy]);
  proxyStopped = false;
  assert.equal(
    JSON.parse(cli(['inspect', fixture.names.proxy]))[0].State.Running,
    true,
  );
  response = await request(endpoint, adminSession.jar);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  checks.push(
    'Actual SQL transport loss fails explicitly while catalogue works, then the reader reconnects',
  );
  response = await request('/api/admin/users?' + period, adminSession.jar);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total, '4');
  response = await request('/api/admin/statistics?' + period, adminSession.jar);
  assert.equal(response.status, 200);
  const stats = await response.json();
  assert.equal(stats.accounts.total, '4');
  assert.equal(stats.totals.exerciseAttempts, '5');
  response = await request('/api/admin/publication', adminSession.jar, {
    method: 'POST',
    headers: { origin },
    body: '{}',
  });
  assert.equal(response.status, 503);
  await response.arrayBuffer();
  checks.push(
    'Existing users and statistics remain correct and the main publication capability stays disabled',
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
  for (const name of ['user-detail-query.sql', 'user-detail-reader-audit.sql'])
    assert.equal((await fetch(origin + '/scripts/' + name)).status, 404);
  checks.push(
    'Main cookie does not authenticate the publication app and both private SQL files remain unserved',
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
    'Logout clears this cookie session and its subsequent detail access',
  );
  assert.deepEqual(rows(), baseline);
  assert.deepEqual(mainRows(), expectedAfter);
  const files = [
    'src/lib/user-detail-config.ts',
    'src/lib/user-detail-pg.ts',
    'src/lib/user-detail-server.ts',
    'src/lib/user-detail.ts',
    'src/components/user-detail.tsx',
    'src/components/users-list.tsx',
    'src/app/admin/users/page.tsx',
    'src/app/admin/users/[userId]/page.tsx',
    'src/app/admin/users/[userId]/not-found.tsx',
    'src/app/api/admin/users/[userId]/route.ts',
    'scripts/user-detail-reader-audit.sql',
    'scripts/user-detail-query.sql',
    'scripts/test-user-detail-http-local.mjs',
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
    onlySyntheticAdminUpdatedAtChanged: true,
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
      'REVOKE SELECT(birth_date) ON public.profiles FROM novlearn_user_detail_reader;',
    );
  if (revoked)
    operator(
      "UPDATE public.profiles SET role='admin' WHERE id='" + admin.id + "';",
    );
  if (proxyStopped) cli(['start', fixture.names.proxy]);
  for (const jar of jars) jar.clear();
}
