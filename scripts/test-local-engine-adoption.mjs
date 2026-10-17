// Real HTTP/Auth/PostgREST/native Engine checks. No browser automation,
// publication or alteration of an existing business row or account role.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';
const workspace = path.resolve(process.argv[2] ?? '');
assert(
  workspace
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(workspace), /^local-admin-\d+$/);
const state = JSON.parse(await readFile(workspace + '/private.json', 'utf8'));
assert.equal(state.schemaVersion, 64);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
const account = state.accounts.find((a) => a.kind === 'admin');
const artifact = path.join(workspace, 'engine-adoption-' + Date.now());
await mkdir(artifact);
const jar = new Map(),
  checks = [],
  origin = 'http://127.0.0.1:3150';
const sdk = createServerClient(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  state.anonKey,
  {
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
          else jar.set(name, value);
        }
      },
    },
  },
);
const request = (url, body) =>
  fetch(origin + url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      cookie: [...jar].map(([k, v]) => k + '=' + v).join('; '),
      ...(body === undefined
        ? {}
        : { origin, 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  });
const oldReports = async () => {
  const r = await sdk
    .from('admin_exercise_test_runs')
    .select('id,payload,signature')
    .order('id');
  assert.equal(r.error, null);
  assert(r.data.length < 1000, 'Do not silently certify a truncated history');
  return new Map(
    r.data.map((row) => [
      row.id,
      createHash('sha256').update(JSON.stringify(row)).digest('hex'),
    ]),
  );
};
try {
  assert.equal(
    (
      await sdk.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })
    ).error,
    null,
  );
  assert.equal((await request('/api/admin/session')).status, 200);
  checks.push('Actual local Admin session on schema 64');
  const before = await oldReports();
  for (const url of ['/admin', '/admin/exercises'])
    assert.equal((await request(url)).status, 200);
  checks.push('Authenticated dashboard and catalogue respond');
  const fixture = JSON.parse(
    await readFile('tests/fixtures/coordinate-definition.json', 'utf8'),
  );
  const projections = JSON.parse(
    await readFile('tests/fixtures/coordinate-projections.json', 'utf8'),
  );
  assert.equal(fixture.elements.length, 7);
  const elapsed = [];
  for (const seed of [0, 42]) {
    const started = performance.now();
    const r = await request('/api/admin/preview', {
      action: 'generate',
      definition: fixture,
      seed,
    });
    assert.equal(r.status, 200);
    const value = (await r.json()).result;
    assert.equal(value.seed, seed);
    assert.deepEqual(
      value.instance.elements,
      projections.find((p) => p.seed === seed).instance.elements,
    );
    assert(!JSON.stringify(value.instance).includes('expectedLatex'));
    elapsed.push({ seed, httpElapsedMs: performance.now() - started });
  }
  checks.push(
    'Full seven-element advanced definition generates through actual native worker for both seeds; public elements match historical captures exactly',
  );
  const chapters = await sdk.from('chapters').select('id').limit(1);
  assert.equal(chapters.error, null);
  assert(chapters.data.length);
  const definition = {
    ...fixture,
    title: '[ESSAI AUTOMATISÉ LOCAL] Adoption Engine ' + Date.now(),
    catalogue: {
      chapter: chapters.data[0].id,
      skills: [],
      difficulty: 2,
      appTitle: 'Qualification locale du moteur',
      exerciseType: 'classic',
      needsCalculator: false,
    },
  };
  const saved = await request('/api/admin/exercises', {
    action: 'save',
    exerciseId: null,
    versionId: null,
    fingerprint: null,
    definition,
  });
  assert.equal(saved.status, 200);
  const created = (await saved.json()).result;
  const version = await sdk
    .from('exercise_versions')
    .select(
      'approval_fingerprint_sha256,test_epoch,editorial_status,definition',
    )
    .eq('id', created.versionId)
    .single();
  assert.equal(version.error, null);
  assert.equal(version.data.editorial_status, 'draft');
  assert.equal(version.data.definition.elements.length, 7);
  checks.push(
    'New labelled seven-element draft persists via real Next/PostgREST',
  );
  const started = performance.now();
  const tested = await request('/api/admin/preview', {
    action: 'test_saved',
    versionId: created.versionId,
    fingerprint: version.data.approval_fingerprint_sha256,
    epoch: version.data.test_epoch,
    seeds: [0, 42],
    cases: [
      {
        questionId: 'q',
        expectedState: 'incorrect',
        answer: { format: 'latex', source: '0' },
      },
    ],
  });
  assert.equal(tested.status, 200);
  const result = (await tested.json()).result;
  assert.equal(result.report.passed, true);
  assert.equal(result.report.complete, true);
  assert.deepEqual(
    result.report.seeds.map((s) => s.seed),
    [0, 42],
  );
  for (const seed of result.report.seeds) {
    assert.equal(seed.passed, true);
    assert.equal(seed.reproducible, true);
    assert.equal(seed.publicProjectionSafe, true);
    for (const expectedState of ['correct', 'incorrect', 'invalid'])
      assert(
        seed.checks.some(
          (c) =>
            c.questionId === 'q' &&
            c.expectedState === expectedState &&
            c.passed &&
            c.result.state === expectedState,
        ),
      );
  }
  const receipt = await sdk
    .from('admin_exercise_test_runs')
    .select('id,payload,signature,passed')
    .eq('id', result.receiptId)
    .single();
  assert.equal(receipt.error, null);
  const envelope = JSON.parse(receipt.data.payload);
  assert.equal(
    envelope.engineArchiveSha256,
    certifiedEngineIdentity.engineArchiveSha256,
  );
  assert.deepEqual(envelope.report, result.report);
  assert.equal(receipt.data.passed, true);
  checks.push(
    'Actual full advanced multi-seed report covers correct/incorrect/invalid, reproducibility and public safety, signed and persisted under the new archive',
  );
  const detail = await request('/admin/exercises/' + created.exerciseId);
  assert.equal(detail.status, 200);
  const html = await detail.text();
  assert(html.includes(result.receiptId));
  assert(html.includes('état courant'));
  checks.push('New report appears as current in the authenticated detail page');
  const after = await oldReports();
  for (const [id, digest] of before) assert.equal(after.get(id), digest);
  checks.push(
    'Every preexisting readable receipt retains its exact payload and signature',
  );
  assert.equal((await request('/api/admin/publication', {})).status, 503);
  checks.push('Publication remains disabled');
  const proof = {
    result: 'PASS',
    date: new Date().toISOString(),
    artifact,
    checks,
    created,
    receiptId: result.receiptId,
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
    projections: elapsed,
    advancedReportHttpElapsedMs: performance.now() - started,
    retainedOldReceipts: before.size,
    realAuth: true,
    realPostgrest: true,
    realNextRoutes: true,
    nativeLinuxEngine: true,
    nativeLimitsChanged: false,
    definitionElements: 7,
    seeds: [0, 42],
    syntheticDraftOnly: true,
    existingRolesUntouched: true,
    oldReceiptsPreserved: true,
    browserExecution: false,
    humanAcceptance: false,
    publicationEnabled: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      artifact,
      receiptId: result.receiptId,
      projections: elapsed,
      advancedReportHttpElapsedMs: proof.advancedReportHttpElapsedMs,
    }),
  );
} catch (error) {
  let message = String(error?.stack ?? error);
  for (const secret of [
    account.password,
    state.anonKey,
    state.serviceKey,
    ...Object.values(state.secrets),
  ])
    message = message.replaceAll(secret, '[local secret]');
  await writeFile(artifact + '/failure.txt', message);
  throw Error(
    'Engine adoption integration failed; see retained private artifact',
  );
} finally {
  await sdk.auth.signOut({ scope: 'local' });
}
