// Real HTTP/GoTrue/PostgREST/SQL integration. No browser automation or fake
// session transport. Mutations affect only synthetic accounts and new drafts.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
const artifact = path.resolve(process.argv[2] ?? '');
assert(
  artifact
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(artifact), /^local-admin-\d+$/);
const state = JSON.parse(
  await readFile(path.join(artifact, 'private.json'), 'utf8'),
);
assert.equal(state.pending, undefined);
assert.equal(state.artifact, artifact);
const origin = 'http://127.0.0.1:3150';
const withEngine = process.argv.includes('--engine');
assert.equal(state.authConfig.APP_BASE_URL, origin);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
const secrets = [
  ...Object.values(state.secrets),
  state.anonKey,
  state.serviceKey,
];
const safe = (text) =>
  secrets.reduce((s, key) => s.replaceAll(key, '[local secret]'), String(text));
const stamp = Date.now(),
  checks = [],
  details = {};
const cookieJar = new Map();
const request = async (
  url,
  options = {},
  jar = cookieJar,
  timeoutMs = 45000,
) => {
  const response = await fetch(origin + url, {
    ...options,
    headers: {
      ...(jar.size
        ? {
            cookie: [...jar]
              .map(([key, value]) => key + '=' + value)
              .join('; '),
          }
        : {}),
      ...options.headers,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(';')[0],
      split = first.indexOf('='),
      name = first.slice(0, split),
      value = first.slice(split + 1);
    if (!value || /max-age=0/i.test(cookie)) jar.delete(name);
    else {
      jar.set(name, value);
      secrets.push(value);
    }
  }
  return response;
};
const api = () =>
  createClient(state.authConfig.ADMIN_LOCAL_SUPABASE_URL, state.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const operator = (text) => {
  assert.equal(state.names.db, state.prefix + '-db');
  assert.match(state.prefix, /^novlearn-admin-local-\d+$/);
  const result = spawnSync(
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
      input: text,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1048576,
    },
  );
  assert.equal(result.status, 0, safe(result.stderr));
  return result.stdout.trim();
};
let revoked = false;
const admin = state.accounts.find((a) => a.kind === 'admin'),
  user = state.accounts.find((a) => a.kind === 'user');
assert.match(admin.id, /^[0-9a-f-]{36}$/);
assert.match(user.id, /^[0-9a-f-]{36}$/);
try {
  const applicationConfigText = await readFile(
    path.join(artifact, 'app-config.json'),
    'utf8',
  );
  const applicationConfig = JSON.parse(applicationConfigText);
  assert.deepEqual(Object.keys(applicationConfig).sort(), [
    'artifact',
    'authConfig',
    'schemaVersion',
  ]);
  assert.equal(applicationConfig.schemaVersion, 64);
  for (const secret of [...Object.values(state.secrets), state.serviceKey])
    assert(
      !applicationConfigText.includes(secret),
      'Privileged operator secret must not enter application configuration',
    );
  checks.push(
    'Application runtime configuration contains no privileged operator credential',
  );
  const anonymous = await request('/api/admin/session', {}, new Map());
  assert.equal(anonymous.status, 401);
  checks.push('Actual unauthenticated session endpoint refused');
  const sdk = api();
  const signed = await sdk.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  assert.equal(signed.error, null, signed.error?.message);
  assert.equal(signed.data.user.id, admin.id);
  secrets.push(
    signed.data.session.access_token,
    signed.data.session.refresh_token,
  );
  const verified = await sdk.auth.getUser();
  assert.equal(verified.error, null);
  assert.equal(verified.data.user.id, admin.id);
  const profile = await sdk
    .from('profiles')
    .select('role')
    .eq('id', admin.id)
    .single();
  assert.equal(profile.error, null, profile.error?.message);
  assert.equal(profile.data.role, 'admin');
  checks.push(
    'Real GoTrue password login/getUser and real PostgREST profile authorization',
  );
  const ordinary = api();
  const ordinaryLogin = await ordinary.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  assert.equal(ordinaryLogin.error, null);
  secrets.push(
    ordinaryLogin.data.session.access_token,
    ordinaryLogin.data.session.refresh_token,
  );
  const metadata = await ordinary.auth.updateUser({ data: { role: 'admin' } });
  assert.equal(metadata.error, null);
  const escalate = await ordinary
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);
  assert(escalate.error, 'Client role escalation must be rejected');
  const userRole = await ordinary
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  assert.equal(userRole.data.role, 'user');
  checks.push(
    'Real metadata spoof and PostgREST role escalation do not grant Admin',
  );
  const loginBody = (account) =>
    new URLSearchParams({ email: account.email, password: account.password });
  const foreign = await request(
    '/auth/login',
    {
      method: 'POST',
      headers: {
        origin: 'https://foreign.invalid',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: loginBody(admin),
    },
    new Map(),
  );
  assert.equal(foreign.status, 403);
  checks.push('Foreign origin actually refused before login');
  const deniedJar = new Map();
  const denied = await request(
    '/auth/login',
    {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: loginBody(user),
    },
    deniedJar,
  );
  assert.equal(denied.status, 303);
  assert.match(denied.headers.get('location'), /error=forbidden$/);
  checks.push('Real non-Admin login refused despite spoofed user metadata');
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: loginBody(admin),
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get('location'), origin + '/admin');
  assert(cookieJar.size > 0);
  const setCookies = login.headers.getSetCookie().join(';');
  assert.match(setCookies, /novlearn-admin-local-auth/);
  assert.match(setCookies, /HttpOnly/i);
  assert.match(setCookies, /SameSite=lax/i);
  assert.match(login.headers.get('cache-control'), /no-store/);
  checks.push('Real Next login returns isolated HttpOnly cookies and no-store');
  const dashboard = await request('/admin');
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Local.*données d’essai enregistrées/);
  checks.push(
    'Authenticated server-rendered dashboard uses real local session and RPC',
  );
  const definition = JSON.parse(
    await readFile('tests/fixtures/preview-definition.json', 'utf8'),
  );
  definition.title = 'Essai connecté local ' + stamp;
  const chapters = await sdk.from('chapters').select('id').limit(1);
  assert.equal(chapters.error, null);
  assert(chapters.data.length > 0);
  definition.catalogue = {
    ...definition.catalogue,
    chapter: chapters.data[0].id,
    skills: [],
  };
  const saveBody = {
    action: 'save',
    exerciseId: null,
    versionId: null,
    fingerprint: null,
    definition,
  };
  const saved = await request('/api/admin/exercises', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(saveBody),
  });
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.environment, 'staging');
  const result = body.result;
  assert.match(result.versionId, /^[0-9a-f-]{36}$/);
  assert.match(result.exerciseId, /^[1-9][0-9]*$/);
  details.created = result;
  const stored = await sdk
    .from('exercise_versions')
    .select('id,definition,approval_fingerprint_sha256')
    .eq('id', result.versionId)
    .single();
  assert.equal(stored.error, null);
  assert.equal(stored.data.definition.title, definition.title);
  checks.push(
    'Actual Next save persists a canonical draft through PostgREST RPC',
  );
  const page = await request(
    '/admin/exercises/' + result.exerciseId + '?version=' + result.versionId,
  );
  assert.equal(page.status, 200);
  assert((await page.text()).includes(definition.title));
  checks.push('Reloaded protected detail renders the saved database draft');
  const edited = { ...definition, title: definition.title + ' modifié' };
  const update = {
    action: 'save',
    exerciseId: result.exerciseId,
    versionId: result.versionId,
    fingerprint: result.fingerprint,
    definition: edited,
  };
  const updated = await request('/api/admin/exercises', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(update),
  });
  assert.equal(updated.status, 200);
  const stale = await request('/api/admin/exercises', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(update),
  });
  assert.equal(stale.status, 409);
  checks.push('Real stale-fingerprint save refused after successful update');
  const otherOrigin = await request('/api/admin/exercises', {
    method: 'POST',
    headers: {
      origin: 'https://foreign.invalid',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...update,
      definition: { ...edited, title: 'Forbidden' },
    }),
  });
  assert.equal(otherOrigin.status, 403);
  checks.push('Authenticated mutation with foreign origin refused');
  operator(`UPDATE public.profiles SET role='user' WHERE id='${admin.id}';`);
  revoked = true;
  const revokedSession = await request('/api/admin/session');
  assert.equal(revokedSession.status, 403);
  const revokedSave = await request('/api/admin/exercises', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(saveBody),
  });
  assert.equal(revokedSave.status, 403);
  if (withEngine) {
    const deniedEngine = await request('/api/admin/engine', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ definition }),
    });
    assert.equal(deniedEngine.status, 403);
    checks.push('Revoked real Admin session cannot execute Engine');
  }
  checks.push(
    'Real profile revocation blocks existing session and direct mutation',
  );
  operator(`UPDATE public.profiles SET role='admin' WHERE id='${admin.id}';`);
  revoked = false;
  const logout = await request('/auth/logout', {
    method: 'POST',
    headers: { origin },
  });
  assert.equal(logout.status, 303);
  assert.equal((await request('/api/admin/session')).status, 401);
  checks.push('Actual logout clears access to protected endpoints');
  const relogin = await request('/auth/login', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: loginBody(admin),
  });
  assert.equal(relogin.status, 303);
  const persisted = await request(
    '/admin/exercises/' + result.exerciseId + '?version=' + result.versionId,
  );
  assert.equal(persisted.status, 200);
  assert((await persisted.text()).includes(edited.title));
  checks.push('Saved update remains after logout and fresh real login');
  const publication = await request('/api/admin/publication', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(publication.status, 503);
  checks.push('Remote publication remains disabled in local workspace');
  const engine = await request('/api/admin/engine', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ definition }),
  });
  if (!withEngine) {
    assert.equal(engine.status, 503);
    checks.push(
      'Unavailable local Engine is refused, never presented as a successful calculation',
    );
  } else {
    const runtime = JSON.parse(
      await readFile(path.join(artifact, 'app-runtime.json'), 'utf8'),
    );
    assert.equal(runtime.engine, true);
    assert.equal(engine.status, 200);
    assert.equal((await engine.json()).valid, true);
    checks.push(
      'Authenticated real Next route validates with bounded native Linux Engine',
    );
    const post = (body) => ({
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const invalid = await request(
      '/api/admin/engine',
      post({ definition: { ...definition, schemaVersion: 999 } }),
    );
    assert.equal(invalid.status, 200);
    assert.equal((await invalid.json()).valid, false);
    checks.push(
      'Actual native invalid definition never returns successful validation',
    );
    const anonymousEngine = await request(
      '/api/admin/engine',
      post({ definition }),
      new Map(),
    );
    assert.equal(anonymousEngine.status, 401);
    const foreignEngine = await request('/api/admin/engine', {
      ...post({ definition }),
      headers: {
        origin: 'https://foreign.invalid',
        'content-type': 'application/json',
      },
    });
    assert.equal(foreignEngine.status, 403);
    checks.push(
      'Engine refuses missing session and foreign origin through real routes',
    );
    const generate = await request(
      '/api/admin/preview',
      post({ action: 'generate', definition: edited, seed: 42 }),
    );
    assert.equal(generate.status, 200);
    const preview = (await generate.json()).result;
    const publicText = JSON.stringify(preview.instance);
    assert(!publicText.includes('PRIVATE_'));
    assert(!publicText.includes('expected'));
    assert(!publicText.includes('policy'));
    checks.push(
      'Actual native generation exposes only the official public projection',
    );
    const inspected = await request(
      '/api/admin/preview',
      post({ action: 'inspect', previewId: preview.previewId }),
    );
    assert.equal(inspected.status, 200);
    const answer = (await inspected.json()).result.expected.find(
      (q) => q.questionId === 'q',
    ).answer;
    const correct = await request(
      '/api/admin/preview',
      post({
        action: 'grade',
        previewId: preview.previewId,
        questionId: 'q',
        answer,
      }),
    );
    assert.equal(correct.status, 200);
    assert.equal((await correct.json()).result.state, 'correct');
    const incorrect = await request(
      '/api/admin/preview',
      post({
        action: 'grade',
        previewId: preview.previewId,
        questionId: 'q',
        answer: { format: 'latex', source: '0' },
      }),
    );
    assert.equal(incorrect.status, 200);
    assert.equal((await incorrect.json()).result.state, 'incorrect');
    checks.push(
      'Authenticated preview inspection and true/false native corrections agree',
    );
    const forged = await request(
      '/api/admin/preview',
      post({
        action: 'grade',
        previewId: preview.previewId,
        questionId: 'q',
        answer,
        official: {},
      }),
    );
    assert.equal(forged.status, 400);
    checks.push(
      'Browser supplied official instance refused by actual protected route',
    );
    const current = await sdk
      .from('exercise_versions')
      .select('approval_fingerprint_sha256,test_epoch,editorial_status')
      .eq('id', result.versionId)
      .single();
    assert.equal(current.error, null);
    assert.equal(current.data.editorial_status, 'draft');
    const cases = [
      {
        questionId: 'q',
        expectedState: 'incorrect',
        answer: { format: 'latex', source: '0' },
      },
    ];
    const testSaved = {
      action: 'test_saved',
      versionId: result.versionId,
      fingerprint: current.data.approval_fingerprint_sha256,
      epoch: current.data.test_epoch,
      seeds: [0, 42],
      cases,
    };
    const tested = await request(
      '/api/admin/preview',
      post(testSaved),
      cookieJar,
      120000,
    );
    assert.equal(tested.status, 200);
    const receipt = (await tested.json()).result;
    assert.equal(receipt.report.complete, true);
    assert.equal(receipt.report.passed, true);
    assert.deepEqual(
      receipt.report.seeds.map((s) => s.seed),
      [0, 42],
    );
    assert(
      receipt.report.seeds.every(
        (s) => s.passed && s.reproducible && s.publicProjectionSafe,
      ),
    );
    checks.push(
      'Saved SQL revision passes actual reproducible native tests for two seeds',
    );
    const storedReceipt = await sdk
      .from('admin_exercise_test_runs')
      .select('id,version_id,passed,payload')
      .eq('id', receipt.receiptId)
      .single();
    assert.equal(storedReceipt.error, null);
    assert.equal(storedReceipt.data.version_id, result.versionId);
    assert.equal(storedReceipt.data.passed, true);
    const payload = JSON.parse(storedReceipt.data.payload);
    assert.equal(payload.actorId, admin.id);
    assert.equal(payload.fingerprint, current.data.approval_fingerprint_sha256);
    assert.deepEqual(payload.report, receipt.report);
    checks.push(
      'Server HMAC receipt verified and persisted by real PostgREST/SQL',
    );
    const history = await request(
      '/admin/exercises/' + result.exerciseId + '?version=' + result.versionId,
    );
    assert.equal(history.status, 200);
    assert((await history.text()).includes(receipt.receiptId));
    const stillDraft = await sdk
      .from('exercise_versions')
      .select('editorial_status')
      .eq('id', result.versionId)
      .single();
    assert.equal(stillDraft.data.editorial_status, 'draft');
    checks.push(
      'Reloaded protected detail displays persisted receipt without approving the draft',
    );
    const staleReceipt = await request(
      '/api/admin/preview',
      post({ ...testSaved, epoch: current.data.test_epoch + 1 }),
    );
    assert.equal(staleReceipt.status, 409);
    checks.push(
      'Stale saved-test state refused before calculation and signing',
    );
    const privateAccess = await sdk
      .schema('novlearn_admin_private')
      .from('test_signing_keys')
      .select('secret');
    assert(privateAccess.error);
    checks.push(
      'Actual API Admin cannot read the private receipt signing registry',
    );
    details.nativeEngine = {
      receiptId: receipt.receiptId,
      seeds: [0, 42],
      engineArtifact: runtime.engineArtifact,
      engineContainer: runtime.engineContainer,
    };
  }
  const actual = (
    await sdk
      .from('exercise_versions')
      .select('definition')
      .eq('id', result.versionId)
      .single()
  ).data;
  assert.equal(actual.definition.title, edited.title);
  const proof = {
    result:
      'PASS for real local Auth, HTTP authorization and draft persistence',
    date: new Date().toISOString(),
    checks,
    details,
    realAuth: true,
    realPostgrest: true,
    realNextRoutes: true,
    sessionsSynthetic: false,
    visualAcceptance: false,
    engineExecuted: withEngine,
    signedReceiptPersisted: withEngine,
    publicationEnabled: false,
    expiryTest: false,
    mfaTest: false,
    privateStateSha256: createHash('sha256')
      .update(await readFile(path.join(artifact, 'private.json')))
      .digest('hex'),
  };
  await writeFile(
    path.join(artifact, 'integration-' + stamp + '.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      artifact,
      proof: 'integration-' + stamp + '.json',
      engineExecuted: withEngine,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(artifact, 'integration-' + stamp + '-failure.txt'),
    safe(error?.stack ?? error),
  );
  throw Error(safe(error?.message ?? error));
} finally {
  if (revoked)
    operator(`UPDATE public.profiles SET role='admin' WHERE id='${admin.id}';`);
}
