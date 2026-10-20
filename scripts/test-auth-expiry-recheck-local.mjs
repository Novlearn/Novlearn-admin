// Recheck the ORIGINAL naturally expired pair after the real 503 failure.
// This does not replace a full natural-expiry run or claim healthy renewal.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const marker = await json('.local/lot1a/auth-expiry-current.json');
const originalFailure =
  marker.previousFailure ?? (marker.phase === 'failed' ? marker.failure : null);
assert(originalFailure);
const original = path.dirname(originalFailure);
assert.equal(path.dirname(original), path.resolve('.local/lot1a'));
assert.match(path.basename(original), /^auth-expiry-\d+$/);
assert.match(await readFile(originalFailure, 'utf8'), /503 !== 401/);
const waiting = await json(original + '/waiting.json');
const sessions = await json(original + '/sessions-private.json');
assert.equal(sha(sessions.sessionA.access_token), waiting.accessA.tokenSha256);
assert.equal(waiting.accessA.exp - waiting.accessA.iat, 3600);
assert(Date.now() >= Date.parse(waiting.expiryObservationAfter));
const state = await json('.local/local-admin-1792143739689/private.json');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
assert.match(state.names.db, /^novlearn-admin-local-\d+-db$/);
const origin = 'http://127.0.0.1:3150',
  authOrigin = 'http://127.0.0.1:55431';
const artifact = path.resolve(original, 'recheck-' + Date.now());
await mkdir(artifact);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const snapshot = () => {
  const r = spawnSync(
    docker,
    [
      '--host',
      'npipe:////./pipe/dockerDesktopLinuxEngine',
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
    {
      input: snapshotSql,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
  assert.equal(r.status, 0, 'Local fixture snapshot failed');
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
};
const before = snapshot();
const oldA = new Map(sessions.oldA),
  jar = new Map();
const cookieHeader = (j) => [...j].map(([k, v]) => k + '=' + v).join('; ');
const observations = [];
const request = async (route, cookies, method = 'GET') => {
  const r = await fetch(origin + route, {
    method,
    headers: {
      cookie: cookieHeader(cookies),
      ...(method === 'POST'
        ? { origin, 'content-type': 'application/x-www-form-urlencoded' }
        : {}),
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
  await r.arrayBuffer();
  observations.push({
    route,
    status: r.status,
    cacheControl: r.headers.get('cache-control'),
    location: r.headers.get('location'),
    cookiesCleared: r.headers.getSetCookie().filter((c) => /max-age=0/i.test(c))
      .length,
  });
  const cacheControl = r.headers.get('cache-control') ?? '';
  assert.match(cacheControl, /no-store/);
  // Next 15's development server deliberately replaces SSR Cache-Control
  // with this exact no-store value (base-server.js), including redirects.
  // API/logout still require the application's explicit private directive.
  if (route === '/admin' && cacheControl === 'no-store, must-revalidate') {
    assert(!/public|s-maxage/i.test(cacheControl));
  } else assert.match(cacheControl, /private/);
  return r;
};
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
try {
  const raw = await fetch(authOrigin + '/auth/v1/user', {
    headers: {
      apikey: state.anonKey,
      authorization: 'Bearer ' + sessions.sessionA.access_token,
    },
    signal: AbortSignal.timeout(15000),
  });
  await raw.arrayBuffer();
  assert([401, 403].includes(raw.status));
  const refresh = await fetch(
    authOrigin + '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      headers: { apikey: state.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessions.sessionA.refresh_token }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const refreshBody = await refresh.json();
  assert.equal(refresh.status, 400);
  assert(
    [
      'refresh_token_not_found',
      'refresh_token_already_used',
      'session_not_found',
      'session_expired',
    ].includes(refreshBody.error_code),
  );
  const api = await request('/api/admin/session', oldA);
  assert.equal(api.status, 401);
  assert(api.headers.getSetCookie().some((c) => /max-age=0/i.test(c)));
  const page = await request('/admin', oldA);
  assert.equal(page.status, 307);
  assert.equal(
    new URL(page.headers.get('location'), origin).pathname,
    '/login',
  );
  // Use the unchanged original stale cookies directly, including on logout.
  const logout = await request('/auth/logout', oldA, 'POST');
  assert.equal(logout.status, 303);
  assert.equal(
    new URL(logout.headers.get('location'), origin).pathname,
    '/login',
  );
  assert(logout.headers.getSetCookie().some((c) => /max-age=0/i.test(c)));
  const account = await json(original + '/account-private.json');
  assert.match(
    account.email,
    /^expiry-admin-\d+@novlearn-admin\.local\.invalid$/,
  );
  const signed = await sdk.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(signed.error, null);
  assert.equal(signed.data.user.id, account.id);
  assert.equal((await request('/api/admin/session', jar)).status, 200);
  assert.equal((await request('/admin', jar)).status, 200);
  assert.equal((await sdk.auth.signOut({ scope: 'local' })).error, null);
  const after = snapshot();
  for (const [t, rows] of Object.entries(before.rows))
    if (!t.startsWith('auth.'))
      assert.deepEqual(after.rows[t], rows, 'Existing business rows: ' + t);
  for (const [sequence, previous] of Object.entries(before.sequences)) {
    if (sequence === 'auth.refresh_tokens_id_seq') {
      // The one real reconnect issues one new Auth refresh token. Its ID must
      // advance, while every existing business sequence remains exact.
      assert.equal(
        after.sequences[sequence].last_value,
        previous.last_value + 1,
      );
      assert.equal(after.sequences[sequence].is_called, true);
    } else assert.deepEqual(after.sequences[sequence], previous, sequence);
  }
  assert.deepEqual(after.metadata, before.metadata);
  assert.deepEqual(after.policies, before.policies);
  const proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    artifact,
    scope:
      'Correction of ended-session handling using the original naturally expired pair; not a complete new expiry/healthy-renewal run',
    originalFailure,
    originalJwtSha256: waiting.accessA.tokenSha256,
    originalCookieSha256: sha(cookieHeader(oldA)),
    originalPairBytesUnmodified: true,
    rawAuthStatus: raw.status,
    refreshErrorCode: refreshBody.error_code,
    observations,
    existingBusinessRowsSequencesMetadataExact: true,
    authRefreshTokenSequenceAdvancedByOneRealReconnect: true,
    clockAndAuthSettingsUnmodified: true,
    remoteOperations: false,
    browserExecuted: false,
    sourceHashes: Object.fromEntries(
      await Promise.all(
        [
          'src/lib/auth/supabase.ts',
          'tests/supabase-auth.test.ts',
          'scripts/test-auth-expiry-recheck-local.mjs',
        ].map(async (f) => [f, sha(await readFile(f))]),
      ),
    ),
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      observations: observations.length,
      artifact,
      fullNaturalExpiryRun: false,
    }),
  );
} catch (e) {
  await writeFile(
    artifact + '/partial-observations.json',
    JSON.stringify({ result: 'FAIL', observations }, null, 2) + '\n',
  );
  await writeFile(artifact + '/failure.txt', String(e.stack ?? e));
  throw Error('Expiry recheck failed; inspect ' + artifact);
} finally {
  await sdk.auth.signOut({ scope: 'local' }).catch(() => {});
}
