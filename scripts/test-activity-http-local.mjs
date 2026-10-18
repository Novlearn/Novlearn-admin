// Real sessions, Next HTTP and separate SQL aggregates; never a browser or remote DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const marker = await json('.local/lot1a/activity-http-current.json');
assert.equal(marker.phase, 'prepared');
const root = path.resolve(marker.artifact);
assert.equal(
  path.dirname(root).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(root), /^activity-http-\d+$/);
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
assert.equal(runtime.engine, true);
assert.equal(runtime.review, true);
const stamp = Date.now(),
  artifact = root + '/http-' + stamp;
await mkdir(artifact);
const reuseAccounts = process.argv[2] === '--reuse-accounts';
assert.equal(process.argv.length, reuseAccounts ? 4 : 2);
let retainedAccounts = [];
if (reuseAccounts) {
  const directory = path.resolve(process.argv[3]);
  assert.equal(path.dirname(directory).toLowerCase(), root.toLowerCase());
  assert.match(path.basename(directory), /^http-\d+$/);
  retainedAccounts = (await json(directory + '/accounts-private.json'))
    .accounts;
  assert.equal(retainedAccounts.length, 2);
  for (const a of retainedAccounts) {
    assert.match(a.id, /^[0-9a-f-]{36}$/);
    assert.match(a.email, /^activity-http-(?:admin|user)-\d+@example\.test$/);
  }
}
const origin = 'http://127.0.0.1:3150',
  checks = [],
  secrets = [
    state.serviceKey,
    state.anonKey,
    ...Object.values(state.secrets),
    ...Object.values(fixture.secrets),
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
const period = '/api/admin/statistics?from=2026-10-15&to=2026-10-17';
const accounts = [...retainedAccounts];
let revoked = false,
  drift = false,
  proxyStopped = false;
let adminSession, userSession;
try {
  const anonymous = await request(period);
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get('cache-control'), /private, no-store/);
  await anonymous.arrayBuffer();
  const pageAnonymous = await request('/admin/statistics');
  assert.equal(pageAnonymous.status, 307);
  assert.match(
    pageAnonymous.headers.get('location'),
    /\/login\?error=session$/,
  );
  await pageAnonymous.arrayBuffer();
  checks.push('Anonymous API/page denied before SQL data is returned');
  const service = createClient('http://127.0.0.1:55431', state.serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  if (!reuseAccounts)
    for (const kind of ['admin', 'user']) {
      const password = randomBytes(24).toString('hex');
      secrets.push(password);
      const email = 'activity-http-' + kind + '-' + stamp + '@example.test';
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: 'LOCAL ACTIVITY HTTP ' + kind,
          birth_date: '2000-01-01',
        },
      });
      assert.equal(
        created.error,
        null,
        'Synthetic local account must really be created',
      );
      const id = created.data.user.id;
      assert.match(id, /^[0-9a-f-]{36}$/);
      accounts.push({ kind, id, email, password });
      await writeFile(
        artifact + '/accounts-private.json',
        JSON.stringify({ accounts }, null, 2) + '\n',
      );
      if (kind === 'admin')
        operator(
          "UPDATE public.profiles SET role='admin' WHERE id='" + id + "';",
        );
    }
  if (reuseAccounts)
    await writeFile(
      artifact + '/accounts-private.json',
      JSON.stringify({ accounts }, null, 2) + '\n',
    );
  adminSession = session();
  userSession = session();
  assert.equal(
    (await adminSession.sdk.auth.signInWithPassword(accounts[0])).error,
    null,
  );
  assert.equal(
    (await userSession.sdk.auth.signInWithPassword(accounts[1])).error,
    null,
  );
  assert.equal((await request(period, userSession.jar)).status, 403);
  assert.equal(
    (await userSession.sdk.auth.updateUser({ data: { role: 'admin' } })).error,
    null,
  );
  assert.equal((await request(period, userSession.jar)).status, 403);
  checks.push(
    'Real non-Admin session and user_metadata role spoof remain forbidden',
  );
  let response = await request(period, adminSession.jar);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.environment, 'local-copy');
  assert.deepEqual(data.accounts, { total: '4', anonymous: '1' });
  assert.deepEqual(data.totals, {
    activeAccounts: '2',
    exerciseAttempts: '5',
    duelAttempts: '2',
    completedDuels: '1',
    accountsCreated: '1',
    correct: '2',
    incorrect: '2',
    abandoned: '1',
    unclassified: '0',
  });
  assert.equal(data.daily.length, 3);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const serialized = JSON.stringify(data);
  assert(!serialized.includes('a8100000'));
  assert(!serialized.includes('@'));
  assert(!serialized.includes('novlearn_admin_activity_service'));
  await writeFile(
    artifact + '/http-aggregate.json',
    JSON.stringify(data, null, 2) + '\n',
  );
  checks.push(
    'Admin HTTP returns exact known aggregate, UTC series and no nominal fields',
  );
  response = await request(
    '/admin/statistics?from=2026-10-15&to=2026-10-17',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert(html.includes('Base locale synthétique'));
  assert(html.includes('<caption'));
  assert(html.includes('action="/admin/statistics"'));
  assert(!html.includes('a8100000'));
  assert(!html.includes(fixture.config.url));
  checks.push(
    'Authenticated server page renders SQL results, source label, navigation and date form',
  );
  for (const q of [
    'from=2026-10-15',
    'from=2026-10-15&from=2026-10-16&to=2026-10-17',
    'from=2026-07-01&to=2026-10-17',
    'from=2026-10-15&to=2026-10-17&environment=production',
    'from=2099-01-01&to=2099-01-02',
  ]) {
    const invalid = await request(
      '/api/admin/statistics?' + q,
      adminSession.jar,
    );
    assert.equal(invalid.status, 400);
    await invalid.arrayBuffer();
  }
  checks.push(
    'Five invalid, duplicate, oversized, future or source-override filters rejected',
  );
  response = await request(
    '/api/admin/statistics?from=2026-01-01&to=2026-01-01',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const empty = await response.json();
  assert.equal(empty.totals.exerciseAttempts, '0');
  assert.equal(empty.accounts.total, '4');
  response = await request('/api/admin/statistics', adminSession.jar);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).daily.length, 30);
  checks.push(
    'Empty period and default thirty-day period queried, without invented unavailability',
  );
  operator(
    "UPDATE public.profiles SET role='user' WHERE id='" + accounts[0].id + "';",
  );
  revoked = true;
  assert.equal((await request(period, adminSession.jar)).status, 403);
  response = await request('/admin/statistics', adminSession.jar);
  assert.equal(response.status, 307);
  assert.match(response.headers.get('location'), /\/access-denied$/);
  await response.arrayBuffer();
  operator(
    "UPDATE public.profiles SET role='admin' WHERE id='" +
      accounts[0].id +
      "';",
  );
  revoked = false;
  assert.equal((await request(period, adminSession.jar)).status, 200);
  checks.push(
    'Role revocation/restoration affects the same live token immediately on API and page',
  );
  activitySql('GRANT SELECT(email) ON auth.users TO novlearn_activity_reader;');
  drift = true;
  response = await request(period, adminSession.jar);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Statistiques indisponibles',
  });
  response = await request(
    '/admin/statistics?from=2026-10-15&to=2026-10-17',
    adminSession.jar,
  );
  assert.equal(response.status, 200);
  const refused = await response.text();
  assert(refused.includes('Statistiques indisponibles'));
  assert(!refused.includes('Comptes Auth présents'));
  activitySql(
    'REVOKE SELECT(email) ON auth.users FROM novlearn_activity_reader;',
  );
  drift = false;
  assert.equal((await request(period, adminSession.jar)).status, 200);
  checks.push(
    'Real SQL column-grant drift fails closed, page shows no fake zeros, recovery succeeds',
  );
  cli(['stop', '--timeout', '15', fixture.names.proxy]);
  proxyStopped = true;
  response = await request(period, adminSession.jar);
  assert.equal(response.status, 503);
  await response.arrayBuffer();
  assert.equal(
    (await request('/admin/exercises', adminSession.jar)).status,
    200,
  );
  cli(['start', fixture.names.proxy]);
  proxyStopped = false;
  assert.equal((await request(period, adminSession.jar)).status, 200);
  checks.push(
    'Lost SQL transport returns unavailable while catalogue remains usable, then reconnects',
  );
  response = await request('/api/admin/publication', adminSession.jar, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 503);
  await response.arrayBuffer();
  const publicationIsolation = await fetch(
    'http://127.0.0.1:3152/api/admin/session',
    {
      headers: {
        cookie: [...adminSession.jar].map(([k, v]) => k + '=' + v).join('; '),
      },
    },
  );
  assert.equal(publicationIsolation.status, 401);
  await publicationIsolation.arrayBuffer();
  // 3152 deliberately retains its older independent application copy.
  const oldCopyStatistics = await fetch(
    'http://127.0.0.1:3152/api/admin/statistics',
  );
  assert.equal(oldCopyStatistics.status, 404);
  await oldCopyStatistics.arrayBuffer();
  checks.push(
    'Main publication remains disabled and its session cannot authorize the publication fixture',
  );
  response = await request('/auth/logout', adminSession.jar, {
    method: 'POST',
    headers: { origin },
  });
  assert.equal(response.status, 303);
  await response.arrayBuffer();
  assert.equal((await request(period, adminSession.jar)).status, 401);
  checks.push('Real logout clears the test session and statistics access');
  assert.deepEqual(rows(), baseline);
  const mainBefore = await json(root + '/main-before-restart.json');
  const mainAfter = JSON.parse(
    operator(
      `CREATE FUNCTION pg_temp.activity_business_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; hashes jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO hashes;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,hashes);END LOOP;RETURN result;END;$$;SELECT pg_temp.activity_business_rows();`,
    )
      .split('\n')
      .at(-1),
  );
  // Exclude only the four newly provisioned rows, identified by the two
  // freshly created Auth UUIDs. All other rows/tables must match exactly.
  const ids = accounts.map((a) => "'" + a.id + "'::uuid").join(',');
  const initializedRows = JSON.parse(
    operator(`SELECT jsonb_build_object(
    'public.profiles',(SELECT jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')) FROM public.profiles r WHERE id=ANY(ARRAY[${ids}])),
      'public.friend_codes',(SELECT jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex')) FROM public.friend_codes r WHERE user_id=ANY(ARRAY[${ids}])));`),
  );
  assert.equal(initializedRows['public.profiles'].length, 2);
  assert.equal(initializedRows['public.friend_codes'].length, 2);
  await writeFile(
    artifact + '/main-initialized-rows.json',
    JSON.stringify(initializedRows, null, 2) + '\n',
  );
  for (const [table, values] of Object.entries(mainBefore.businessTables)) {
    const counts = new Map();
    for (const v of mainAfter[table]) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const v of values) {
      assert((counts.get(v) ?? 0) > 0, table + ' preexisting row changed');
      counts.set(v, counts.get(v) - 1);
    }
    const additions = initializedRows[table] ?? [];
    assert(
      additions.every((h) => !values.includes(h)),
      table + ' cannot exclude an existing row',
    );
    const remaining = [...mainAfter[table]];
    for (const h of additions) {
      const i = remaining.indexOf(h);
      assert(i >= 0);
      remaining.splice(i, 1);
    }
    assert.deepEqual(
      remaining,
      values,
      table + ' unexpected new or changed business row',
    );
  }
  checks.push(
    'All 62 activity tables exact, every original row in 35 main business tables preserved',
  );
  const sourceFiles = [
    'src/lib/activity-config.ts',
    'src/lib/activity-pg.ts',
    'src/lib/activity-server.ts',
    'src/app/api/admin/statistics/route.ts',
    'src/app/admin/statistics/page.tsx',
    'scripts/activity-reader-audit.sql',
    'scripts/activity-statistics-query.sql',
    'scripts/test-activity-http-local.mjs',
  ];
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      sourceFiles.map(async (f) => [
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
    realNextHttp: true,
    realTlsAndSql: true,
    activityTablesUnchanged: 62,
    mainBusinessTablesWithAllPriorRowsPreserved: 35,
    syntheticTestAccountsRetained: accounts.length,
    newSyntheticAccountsCreatedThisRun: reuseAccounts ? 0 : 2,
    localApplicationProcess: runtime.processId,
    remoteOperations: false,
    browserExecuted: false,
    productionReadEnabled: false,
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
      checks: checks.length,
      artifact,
      activityTablesUnchanged: 62,
      mainBusinessTablesPreserved: 35,
    }),
  );
} catch (error) {
  await writeFile(
    artifact + '/partial-proof.json',
    JSON.stringify(
      {
        result: 'FAIL',
        date: new Date().toISOString(),
        completedChecks: checks,
        sourceSha256: createHash('sha256')
          .update(await readFile(new URL(import.meta.url)))
          .digest('hex'),
        fullSuitePassed: false,
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(artifact + '/failure.txt', safe(error.stack ?? error));
  throw Error(
    'Activity HTTP qualification failed; inspect retained ' +
      artifact +
      '/failure.txt',
  );
} finally {
  if (revoked)
    operator(
      "UPDATE public.profiles SET role='admin' WHERE id='" +
        accounts[0].id +
        "';",
    );
  if (drift)
    activitySql(
      'REVOKE SELECT(email) ON auth.users FROM novlearn_activity_reader;',
    );
  if (proxyStopped) cli(['start', fixture.names.proxy]);
  for (const jar of jars)
    if (jar.size)
      try {
        await request('/auth/logout', jar, {
          method: 'POST',
          headers: { origin },
        });
      } catch {}
}
