// Natural 3600-second expiry on NEW local synthetic sessions only. No JWT
// signing, clock override, TTL change, existing account or configuration edit.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const newRun = process.argv.slice(2).join(' ') === '--new-run-after-failure';
assert(process.argv.length === 2 || newRun);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const root = '.local/local-admin-1792143739689';
const state = await json(root + '/private.json');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
const origin = 'http://127.0.0.1:3150',
  authOrigin = state.authConfig.ADMIN_LOCAL_SUPABASE_URL;
const markerFile = '.local/lot1a/auth-expiry-current.json';
let previousFailure = null;
if (newRun) {
  const previous = await json(markerFile);
  assert.equal(previous.phase, 'failed', 'Never restart a live observation');
  assert.equal(path.dirname(previous.artifact), path.resolve('.local/lot1a'));
  assert.match(path.basename(previous.artifact), /^auth-expiry-\d+$/);
  assert.equal(previous.failure, previous.artifact + '/failure.txt');
  await access(previous.failure);
  previousFailure = previous.failure;
} else await assert.rejects(access(markerFile), (e) => e.code === 'ENOENT');
const artifact = path.resolve('.local/lot1a/auth-expiry-' + Date.now());
await mkdir(artifact);
await copyFile('scripts/test-auth-expiry-local.mjs', artifact + '/harness.mjs');
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
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
  assert.equal(r.status, 0, 'Local fixture observation failed');
  return r.stdout.trim();
};
const authInfo = JSON.parse(cli(['inspect', state.names.auth]))[0];
assert.equal(authInfo.State.Running, true);
assert(authInfo.Config.Env.includes('GOTRUE_JWT_EXP=3600'));
const sql = (q) =>
  cli(
    [
      'exec',
      '-i',
      state.names.db,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'admin_local',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  );
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const before = JSON.parse(sql(snapshotSql).split('\n').at(-1));
const stored = (name, value) =>
  writeFile(artifact + '/' + name, JSON.stringify(value, null, 2) + '\n');
const startedAt = new Date().toISOString(),
  startedMonotonic = process.hrtime.bigint();
const checks = [],
  observations = [],
  secrets = [state.serviceKey, state.anonKey, ...Object.values(state.secrets)];
const fingerprint = (s) => createHash('sha256').update(s).digest('hex');
const phase = async (step, extra = {}) => {
  await writeFile(
    markerFile,
    JSON.stringify(
      {
        phase: step,
        artifact,
        processId: process.pid,
        startedAt,
        previousFailure,
        ...extra,
      },
      null,
      2,
    ) + '\n',
  );
};
await phase('preparing');
const cookieHeader = (jar) => [...jar].map(([k, v]) => k + '=' + v).join('; ');
const request = async (route, jar, method = 'GET') =>
  fetch(origin + route, {
    method,
    headers: {
      cookie: cookieHeader(jar),
      ...(method === 'POST'
        ? { origin, 'content-type': 'application/x-www-form-urlencoded' }
        : {}),
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
const consumeCookies = (jar, r) => {
  for (const cookie of r.headers.getSetCookie()) {
    const first = cookie.split(';')[0],
      i = first.indexOf('='),
      name = first.slice(0, i),
      value = first.slice(i + 1);
    if (!value || /max-age=0/i.test(cookie)) jar.delete(name);
    else jar.set(name, value);
  }
};
const authRequest = async (route, { token, body } = {}) =>
  fetch(authOrigin + '/auth/v1/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: state.anonKey,
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
let account, healthy, stale, latestA;
function client() {
  const jar = new Map();
  const sdk = createServerClient(authOrigin, state.anonKey, {
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
          else jar.set(name, value);
        }
      },
    },
  });
  sdk.auth.stopAutoRefresh();
  return { jar, sdk };
}
const jwtMeta = (token) => {
  const data = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  );
  assert.equal(data.role, 'authenticated');
  assert.equal(data.sub, account.id);
  assert.equal(data.exp - data.iat, 3600);
  return {
    iat: data.iat,
    exp: data.exp,
    sessionId: data.session_id,
    tokenSha256: fingerprint(token),
  };
};
try {
  const password = randomBytes(24).toString('base64url'),
    email = 'expiry-admin-' + Date.now() + '@novlearn-admin.local.invalid';
  secrets.push(password);
  const created = await fetch(authOrigin + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: state.serviceKey,
      authorization: 'Bearer ' + state.serviceKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: 'TEST EXPIRATION NATURELLE LOCAL',
        birth_date: '2000-01-01',
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(created.status, 200);
  const user = await created.json();
  assert.match(user.id, /^[a-f0-9-]{36}$/);
  account = { id: user.id, email, password };
  await stored('account-private.json', account);
  sql(`UPDATE public.profiles SET role='admin' WHERE id='${account.id}';`);
  stale = client();
  healthy = client();
  const staleSign = await stale.sdk.auth.signInWithPassword({
      email,
      password,
    }),
    healthySign = await healthy.sdk.auth.signInWithPassword({
      email,
      password,
    });
  assert.equal(staleSign.error, null);
  assert.equal(healthySign.error, null);
  const sessionA = staleSign.data.session,
    sessionB = healthySign.data.session;
  assert(sessionA && sessionB);
  secrets.push(
    sessionA.access_token,
    sessionA.refresh_token,
    sessionB.access_token,
    sessionB.refresh_token,
  );
  const metadataA = jwtMeta(sessionA.access_token),
    metadataB = jwtMeta(sessionB.access_token);
  assert.notEqual(metadataA.sessionId, metadataB.sessionId);
  const oldA = new Map(stale.jar),
    oldB = new Map(healthy.jar);
  for (const [label, jar, token] of [
    ['stale-client-before-rotation', oldA, sessionA.access_token],
    ['healthy-client', oldB, sessionB.access_token],
  ]) {
    const direct = await authRequest('user', { token });
    await direct.arrayBuffer();
    assert.equal(direct.status, 200);
    const r = await request('/api/admin/session', jar);
    await r.arrayBuffer();
    assert.equal(r.status, 200);
    observations.push({
      label,
      at: new Date().toISOString(),
      authUserStatus: 200,
      adminSessionStatus: 200,
    });
  }
  checks.push(
    'two real independent Admin sessions initially valid, JWT TTL exactly 3600 seconds',
  );
  let refresh = sessionA.refresh_token;
  for (let i = 0; i < 2; i++) {
    const r = await authRequest('token?grant_type=refresh_token', {
      body: { refresh_token: refresh },
    });
    assert.equal(r.status, 200);
    latestA = await r.json();
    secrets.push(latestA.access_token, latestA.refresh_token);
    refresh = latestA.refresh_token;
    jwtMeta(latestA.access_token);
  }
  // Preserve the actually issued original pair. It becomes a stale grandparent
  // after two real rotations, outside the normal 10-second reuse interval.
  const baseline = await request('/api/admin/session', oldA);
  await baseline.arrayBuffer();
  assert.equal(baseline.status, 200);
  checks.push(
    'genuine original client cookie remains valid before expiry after two real refresh rotations; no token/expiry edits',
  );
  await stored('sessions-private.json', {
    sessionA,
    sessionB,
    latestA,
    oldA: [...oldA],
    oldB: [...oldB],
  });
  const deadline = Math.max(metadataA.exp, metadataB.exp) * 1000 + 70000;
  assert(deadline - Date.now() > 3500000);
  const waiting = {
    result: 'WAITING — no expiry success claimed',
    at: new Date().toISOString(),
    artifact,
    processId: process.pid,
    startedAt,
    accessA: metadataA,
    accessB: metadataB,
    expiryObservationAfter: new Date(deadline).toISOString(),
    jwtExpirationSeconds: 3600,
    clockChanged: false,
    configurationChanged: false,
    realExpirationTested: false,
    remoteOperations: false,
  };
  await stored('waiting.json', waiting);
  await phase('waiting-natural-expiry', {
    expiresAt: waiting.expiryObservationAfter,
  });
  console.log(JSON.stringify(waiting));
  while (Date.now() < deadline) {
    await delay(Math.min(30000, deadline - Date.now()));
    const monotonicMs =
      Number(process.hrtime.bigint() - startedMonotonic) / 1e6;
    assert(
      Math.abs(Date.now() - Date.parse(startedAt) - monotonicMs) < 5000,
      'Clock discontinuity invalidates natural-expiry proof',
    );
    await stored('heartbeat.json', {
      at: new Date().toISOString(),
      processId: process.pid,
      phase: 'waiting-natural-expiry',
      remainingSeconds: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    });
  }
  await phase('checking-expired-sessions');
  for (const [label, session, meta] of [
    ['stale-access', sessionA, metadataA],
    ['healthy-original-access', sessionB, metadataB],
  ]) {
    assert(Date.now() > meta.exp * 1000);
    const r = await authRequest('user', { token: session.access_token });
    const body = await r.json();
    assert(
      [401, 403].includes(r.status),
      'Actual expired access token must be rejected by real Auth',
    );
    observations.push({
      label,
      at: new Date().toISOString(),
      authStatus: r.status,
      code: body.code ?? body.error_code ?? null,
      accessExpiredAt: new Date(meta.exp * 1000).toISOString(),
    });
  }
  checks.push(
    'real Auth rejects both unmodified access JWTs only after their natural expiry',
  );
  const healthyResponse = await request('/api/admin/session', oldB);
  const healthyBody = await healthyResponse.json();
  assert.equal(healthyResponse.status, 200);
  assert(healthyBody);
  consumeCookies(healthy.jar, healthyResponse);
  assert.notEqual(
    cookieHeader(healthy.jar),
    cookieHeader(oldB),
    'Refreshed session must be returned to the caller',
  );
  assert.match(healthyResponse.headers.get('cache-control') ?? '', /private/);
  assert.match(healthyResponse.headers.get('cache-control') ?? '', /no-store/);
  assert(
    healthyResponse.headers.getSetCookie().some((c) => /httponly/i.test(c)),
  );
  const page = await request('/admin', healthy.jar);
  await page.arrayBuffer();
  assert.equal(page.status, 200);
  consumeCookies(healthy.jar, page);
  checks.push(
    'healthy expired access renews through real SSR/API with fresh HttpOnly cookies and private no-store response',
  );
  const staleResponse = await request('/api/admin/session', oldA);
  const staleBody = await staleResponse.json();
  observations.push({
    label: 'naturally-expired-stale-client',
    at: new Date().toISOString(),
    adminStatus: staleResponse.status,
    error: staleBody.error ?? null,
  });
  assert.equal(
    staleResponse.status,
    401,
    'Non-refreshable naturally expired session is unauthenticated, not an Auth outage',
  );
  consumeCookies(stale.jar, staleResponse);
  checks.push(
    'naturally expired, superseded client pair is refused as unauthenticated after real refresh-token reuse rejection',
  );
  const stalePage = await request('/admin', oldA);
  await stalePage.arrayBuffer();
  assert.equal(stalePage.status, 307);
  assert.equal(
    new URL(stalePage.headers.get('location'), origin).pathname,
    '/login',
  );
  checks.push(
    'expired non-refreshable session redirects private pages to login',
  );
  const logout = await request('/auth/logout', stale.jar, 'POST');
  await logout.arrayBuffer();
  assert.equal(logout.status, 303);
  consumeCookies(stale.jar, logout);
  checks.push('logout remains possible for the expired client');
  const reconnected = client();
  const signed = await reconnected.sdk.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(signed.error, null);
  const validAgain = await request('/api/admin/session', reconnected.jar);
  await validAgain.arrayBuffer();
  assert.equal(validAgain.status, 200);
  assert.equal(
    (await reconnected.sdk.auth.signOut({ scope: 'local' })).error,
    null,
  );
  checks.push(
    'same newly created account can authenticate again without role/password reset',
  );
  const after = JSON.parse(sql(snapshotSql).split('\n').at(-1));
  for (const [t, hashes] of Object.entries(before.rows))
    if (!t.startsWith('auth.'))
      for (const hash of hashes)
        assert(
          after.rows[t].includes(hash),
          'Preexisting business row changed during expiry observation: ' + t,
        );
  const proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    artifact,
    checks,
    observations,
    waitedElapsedSeconds:
      Number(process.hrtime.bigint() - startedMonotonic) / 1e9,
    jwtExpirationSeconds: 3600,
    naturalExpiry: true,
    jwtBytesUnmodified: true,
    clockUnmodified: true,
    authSettingsUnmodified: true,
    onlyNewSyntheticAccount: true,
    existingBusinessRowsPreserved: true,
    browserExecuted: false,
    remoteOperations: false,
    sourceSha256: fingerprint(
      await readFile('scripts/test-auth-expiry-local.mjs'),
    ),
  };
  await stored('proof.json', proof);
  await phase('qualified', { proof: artifact + '/proof.json' });
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      artifact,
      realExpiry: true,
    }),
  );
} catch (e) {
  let message = String(e.stack ?? e);
  for (const secret of secrets.filter((s) => typeof s === 'string' && s.length))
    message = message.replaceAll(secret, '[local secret]');
  await writeFile(artifact + '/failure.txt', message);
  await stored('partial-observations.json', {
    result: 'FAIL',
    at: new Date().toISOString(),
    checksCompletedBeforeFailure: checks,
    observations,
    previousFailure,
    harnessSha256: fingerprint(await readFile(artifact + '/harness.mjs')),
    elapsedSeconds: Number(process.hrtime.bigint() - startedMonotonic) / 1e9,
  });
  await phase('failed', { failure: artifact + '/failure.txt' });
  throw Error('Natural session-expiry test failed; inspect ' + artifact);
} finally {
  for (const entry of [healthy, stale])
    if (entry) await entry.sdk.auth.signOut({ scope: 'local' }).catch(() => {});
}
