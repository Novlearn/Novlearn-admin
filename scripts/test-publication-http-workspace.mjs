// Genuine Auth/REST checks for the isolated preparation workspace. This does
// not start Next, configure a target or execute a publication.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { readAuthConfiguration } from '../src/lib/auth/config.ts';

const artifact = path.resolve(process.argv[2] ?? '');
assert(
  artifact
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(artifact), /^local-admin-publication-\d+$/);
const state = JSON.parse(await readFile(artifact + '/private.json', 'utf8'));
const app = JSON.parse(await readFile(artifact + '/app-config.json', 'utf8'));
const bootstrap = JSON.parse(
  await readFile(artifact + '/bootstrap-proof.json', 'utf8'),
);
assert.equal(state.artifact, artifact);
assert.equal(app.publicationFixture, true);
assert.equal(app.schemaVersion, 64);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55432',
);
assert.equal(state.authConfig.APP_BASE_URL, 'http://127.0.0.1:3152');
assert.equal(state.authConfig.ADMIN_PUBLICATION_ENABLED, 'false');
assert.equal(state.authConfig.ADMIN_STAGING_AUTH_ENABLED, 'false');
assert.equal(bootstrap.sourceRowsUnchanged, true);
assert.equal(bootstrap.clonedRowsMatch, true);
assert.equal(bootstrap.sourceAccounts, 0);
const main = JSON.parse(
  await readFile('.local/local-admin-1792143739689/private.json', 'utf8'),
);
for (const key of ['db', 'auth', 'rest', 'api'])
  assert.notEqual(state.names[key], main.names[key]);
for (const key of ['jwt', 'adminPassword', 'userPassword'])
  assert.notEqual(state.secrets[key], main.secrets[key]);
const appText = await readFile(artifact + '/app-config.json', 'utf8');
for (const secret of [...Object.values(state.secrets), state.serviceKey])
  assert(!appText.includes(secret));
const checks = [
  'Separate containers, account secrets, API/app origins and a pristine SQL 64 clone; no privileged secret in app configuration',
];
const clients = [];
try {
  const ids = [];
  for (const kind of ['admin', 'user']) {
    const account = state.accounts.find((a) => a.kind === kind);
    assert(!main.accounts.some((a) => a.id === account.id));
    const sdk = createClient(
      state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
      state.anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    clients.push(sdk);
    const signed = await sdk.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    assert.equal(signed.error, null);
    assert.equal(signed.data.user.id, account.id);
    const profile = await sdk
      .from('profiles')
      .select('id,role')
      .eq('id', account.id)
      .single();
    assert.equal(profile.error, null);
    assert.equal(profile.data.role, kind === 'admin' ? 'admin' : 'user');
    ids.push(account.id);
    if (kind === 'user') {
      const denied = await sdk
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', account.id);
      assert(denied.error, 'Ordinary account must not change its role');
      const stillUser = await sdk
        .from('profiles')
        .select('role')
        .eq('id', account.id)
        .single();
      assert.equal(stillUser.error, null);
      assert.equal(stillUser.data.role, 'user');
      checks.push(
        'Real ordinary account cannot promote itself through PostgREST',
      );
    }
    checks.push(
      'Genuine isolated ' + kind + ' sign-in and server-owned profile role',
    );
  }
  assert.notEqual(ids[0], ids[1]);
  const login = await fetch('http://127.0.0.1:3150/login', {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(login.status, 200);
  const html = await login.text();
  assert(html.includes('type="password"'));
  assert(!html.includes('Connexion en attente d’activation'));
  const closed = await fetch('http://127.0.0.1:3150/api/admin/publication', {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3150',
      'content-type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(closed.status, 503);
  checks.push(
    'Main application login stays available and its publication endpoint stays closed',
  );
  const proof = {
    result: 'PASS for isolated source Auth/REST preparation only',
    date: new Date().toISOString(),
    artifact,
    checks,
    schemaVersion: 64,
    realAuth: true,
    realPostgrest: true,
    sourceCloneMatchesPristineReplay: true,
    privilegedSecretsAbsentFromAppConfig: true,
    primaryServicesInterrupted: false,
    primaryCredentialsChanged: false,
    primaryPublicationEnabled: false,
    publicationEnabled: false,
    targetConfigured: false,
    applicationStarted: false,
    applicationConfigurationAccepted:
      readAuthConfiguration(app.authConfig) !== null,
    publicationHttpExecuted: false,
    browserExecuted: false,
    remaining: [
      'Dedicated local application profile and cookie isolation',
      'Separate TLS target and least-privilege PostgreSQL capabilities',
      'Actual Next publication HTTP/Auth/Engine transfer and recovery verification',
    ],
  };
  await writeFile(
    artifact + '/source-auth-proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: proof.result,
      checks: checks.length,
      artifact,
      applicationConfigurationAccepted: proof.applicationConfigurationAccepted,
      publicationHttpExecuted: false,
    }),
  );
} finally {
  for (const client of clients) await client.auth.signOut({ scope: 'local' });
}
