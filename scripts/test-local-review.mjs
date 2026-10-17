// Real local Auth/SSR cookies, Next routes, Linux Engine and SQL. Synthetic
// accounts and review attestations are labelled; no human acceptance is claimed.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const state = JSON.parse(
  await readFile(path.join(workspace, 'private.json'), 'utf8'),
);
assert.equal(state.artifact, workspace);
assert.equal(state.database, 'admin_local');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
);
const runtime = JSON.parse(
  await readFile(path.join(workspace, 'app-runtime.json'), 'utf8'),
);
assert.equal(runtime.engine, true);
assert.equal(runtime.review, true);
assert.match(state.prefix, /^novlearn-admin-local-\d+$/);
assert.equal(state.names.db, state.prefix + '-db');
const stamp = Date.now(),
  artifact = path.join(workspace, 'review-integration-' + stamp);
await mkdir(artifact);
const origin = 'http://127.0.0.1:3150',
  apiOrigin = 'http://127.0.0.1:55431';
const secrets = [
  ...Object.values(state.secrets),
  state.serviceKey,
  state.anonKey,
];
const safe = (value) =>
  secrets.reduce(
    (text, secret) => text.replaceAll(secret, '[local secret]'),
    String(value),
  );
const marker = '[TEST AUTOMATISÉ LOCAL — NE VAUT PAS VALIDATION HUMAINE]';
const accounts = [],
  checks = [];
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const operator = (text) => {
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
      input: text,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(
    r.status,
    0,
    'Local operator operation failed; SQL output withheld',
  );
  return r.stdout.trim();
};
const snapshot = () =>
  JSON.parse(
    operator(
      `CREATE FUNCTION pg_temp.review_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; hashes jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT COALESCE(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'')),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO hashes; result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,hashes);END LOOP;RETURN result;END;$$;SELECT pg_temp.review_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const clients = [],
  cookieJar = () => new Map();
async function session(account) {
  const jar = cookieJar();
  const sdk = createServerClient(apiOrigin, state.anonKey, {
    cookieOptions: {
      name: LOCAL_AUTH_COOKIE,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll(values) {
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
  const signed = await sdk.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(signed.error, null);
  assert.equal(signed.data.user.id, account.id);
  secrets.push(
    signed.data.session.access_token,
    signed.data.session.refresh_token,
  );
  clients.push(sdk);
  return { sdk, jar };
}
async function request(
  url,
  body,
  jar,
  requestOrigin = origin,
  deadline = 45000,
) {
  const headers = {
    ...(jar?.size
      ? {
          cookie: [...jar]
            .map(([name, value]) => name + '=' + value)
            .join('; '),
        }
      : {}),
    ...(body === undefined
      ? {}
      : { origin: requestOrigin, 'content-type': 'application/json' }),
  };
  const r = await fetch(origin + url, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
    signal: AbortSignal.timeout(deadline),
  });
  if (jar)
    for (const cookie of r.headers.getSetCookie()) {
      const first = cookie.split(';')[0],
        at = first.indexOf('='),
        name = first.slice(0, at),
        value = first.slice(at + 1);
      if (!value || /max-age=0/i.test(cookie)) jar.delete(name);
      else {
        jar.set(name, value);
        secrets.push(value);
      }
    }
  return r;
}
const checklist = {
  mathematicsCorrect: true,
  statementClear: true,
  gradingChecked: true,
  referencesChecked: true,
};
let fixtureAdmin,
  revoked = false;
const baseline = snapshot();
try {
  for (const kind of ['admin', 'user']) {
    const password = randomBytes(24).toString('base64url');
    secrets.push(password);
    const email = `review-${kind}-${stamp}@novlearn-admin.local.invalid`;
    const r = await fetch(apiOrigin + '/auth/v1/admin/users', {
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
          first_name: 'LOCAL AUTOMATED REVIEW',
          birth_date: '2000-01-01',
          ...(kind === 'user' ? { role: 'admin' } : {}),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(r.status, 200);
    const user = await r.json();
    assert.match(user.id, /^[0-9a-f-]{36}$/);
    assert(!state.accounts.some((a) => a.id === user.id));
    accounts.push({ kind, email, password, id: user.id });
    await writeFile(
      path.join(artifact, 'accounts-private.json'),
      JSON.stringify({ artifact, accounts }, null, 2) + '\n',
    );
    if (kind === 'admin') {
      fixtureAdmin = user.id;
      operator(
        `UPDATE public.profiles SET role='admin' WHERE id='${fixtureAdmin}'::uuid;`,
      );
    }
  }
  const admin = await session(accounts.find((a) => a.kind === 'admin')),
    ordinary = await session(accounts.find((a) => a.kind === 'user'));
  assert.equal(
    (await request('/api/admin/session', undefined, admin.jar)).status,
    200,
  );
  assert.equal(
    (await request('/api/admin/session', undefined, ordinary.jar)).status,
    403,
  );
  checks.push(
    'Genuine SSR cookie sessions identify the new local Admin and refuse the metadata-spoofing non-Admin',
  );
  const definition = JSON.parse(
    await readFile('tests/fixtures/preview-definition.json', 'utf8'),
  );
  definition.title = '[ESSAI AUTOMATISÉ LOCAL] Relecture ' + stamp;
  const chapters = await admin.sdk.from('chapters').select('id').limit(1);
  assert.equal(chapters.error, null);
  assert(chapters.data.length);
  definition.catalogue = {
    chapter: chapters.data[0].id,
    skills: [],
    appTitle: 'Relecture de test',
    difficulty: 2,
    exerciseType: 'classic',
    needsCalculator: false,
  };
  const save = async (value, previous = null) => {
    const r = await request(
      '/api/admin/exercises',
      {
        action: 'save',
        exerciseId: previous?.exerciseId ?? null,
        versionId: previous?.versionId ?? null,
        fingerprint: previous?.fingerprint ?? null,
        definition: value,
      },
      admin.jar,
    );
    assert.equal(r.status, 200);
    return (await r.json()).result;
  };
  const created = await save(definition);
  const readVersion = async () => {
    const r = await admin.sdk
      .from('exercise_versions')
      .select(
        'id,editorial_status,approval_fingerprint_sha256,test_epoch,approved_by,approved_at,definition',
      )
      .eq('id', created.versionId)
      .single();
    assert.equal(r.error, null);
    return r.data;
  };
  const readHistory = async () => {
    const r = await admin.sdk
      .from('admin_exercise_reviews')
      .select('id,action,actor_id,comment,fingerprint,test_epoch,receipt_id')
      .eq('version_id', created.versionId)
      .order('recorded_at');
    assert.equal(r.error, null);
    return r.data;
  };
  let current = await readVersion();
  const reviewBody = (action, status, receiptId, extra = {}) => ({
    action,
    versionId: created.versionId,
    fingerprint: current.approval_fingerprint_sha256,
    epoch: current.test_epoch,
    expectedStatus: status,
    receiptId,
    checklist: action === 'approve' ? checklist : {},
    comment: marker,
    ...extra,
  });
  const review = (body, jar = admin.jar) =>
    request('/api/admin/review', body, jar);
  const noReceipt = reviewBody('request_review', 'draft', null);
  assert.equal((await review(noReceipt)).status, 400);
  assert.equal(
    (
      await review({
        ...noReceipt,
        receiptId: 'a7600000-0000-4000-8000-000000000001',
      })
    ).status,
    400,
  );
  checks.push(
    'Actual review refuses a missing or nonexistent successful test receipt',
  );
  const validBody = {
    ...noReceipt,
    receiptId: 'a7600000-0000-4000-8000-000000000001',
  };
  assert.equal(
    (await request('/api/admin/review', validBody, null)).status,
    401,
  );
  assert.equal((await review(validBody, ordinary.jar)).status, 403);
  assert.equal(
    (
      await request(
        '/api/admin/review',
        validBody,
        admin.jar,
        'https://foreign.invalid',
      )
    ).status,
    403,
  );
  assert.equal(
    (await review({ ...validBody, actorId: fixtureAdmin })).status,
    400,
  );
  const forbidden = await ordinary.sdk
    .from('exercise_versions')
    .update({ editorial_status: 'approved' })
    .eq('id', created.versionId);
  assert(forbidden.error);
  assert.equal((await readHistory()).length, 0);
  checks.push(
    'Unauthenticated, real non-Admin, foreign-origin, forged-actor and direct table approval attempts leave no review',
  );
  const cases = [
    {
      questionId: 'q',
      expectedState: 'incorrect',
      answer: { format: 'latex', source: '0' },
    },
  ];
  const receipts = [];
  const testSaved = async (passing = true) => {
    const r = await request(
      '/api/admin/preview',
      {
        action: 'test_saved',
        versionId: created.versionId,
        fingerprint: current.approval_fingerprint_sha256,
        epoch: current.test_epoch,
        seeds: [0, 42],
        cases: passing ? cases : [],
      },
      admin.jar,
      origin,
      120000,
    );
    assert.equal(r.status, 200);
    const value = (await r.json()).result;
    assert.equal(value.report.passed, passing);
    // Completion means all seeds ran; missing negative coverage still fails.
    assert.equal(value.report.complete, true);
    if (!passing)
      assert(
        value.report.seeds.every((seed) =>
          seed.diagnostics.some((d) => d.code === 'negative-case-required'),
        ),
      );
    const stored = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('id,payload,passed')
      .eq('id', value.receiptId)
      .single();
    assert.equal(stored.error, null);
    assert.equal(stored.data.passed, passing);
    assert.equal(
      JSON.parse(stored.data.payload).engineArchiveSha256,
      certifiedEngineIdentity.engineArchiveSha256,
    );
    receipts.push({
      id: value.receiptId,
      payloadSha256: createHash('sha256')
        .update(stored.data.payload)
        .digest('hex'),
    });
    return value.receiptId;
  };
  const first = await testSaved();
  checks.push(
    'First complete two-seed report is produced by native Linux Engine, signed and persisted through real Next/PostgREST',
  );
  const requested = await review(reviewBody('request_review', 'draft', first));
  assert.equal(requested.status, 200);
  assert.match(requested.headers.get('cache-control'), /no-store/);
  assert.equal((await requested.json()).result.status, 'in_review');
  assert.equal((await readVersion()).editorial_status, 'in_review');
  checks.push(
    'Actual request-review transition and exact event metadata persist',
  );
  assert.equal(
    (await review(reviewBody('approve', 'in_review', first, { checklist: {} })))
      .status,
    400,
  );
  assert.equal(
    (
      await review(
        reviewBody('approve', 'in_review', first, {
          checklist: { ...checklist, gradingChecked: false },
        }),
      )
    ).status,
    400,
  );
  checks.push(
    'A real successful report never substitutes for four explicit review assertions',
  );
  const approval = reviewBody('approve', 'in_review', first);
  const approved = await review(approval);
  assert.equal(approved.status, 200);
  const approvalResult = (await approved.json()).result;
  assert.match(approvalResult.reviewId, /^[0-9a-f-]{36}$/);
  const stateApproved = await readVersion();
  assert.equal(stateApproved.editorial_status, 'approved');
  assert.equal(stateApproved.approved_by, fixtureAdmin);
  const parent = await admin.sdk
    .from('exercises')
    .select('active_version_id')
    .eq('id', created.exerciseId)
    .single();
  assert.equal(parent.error, null);
  assert.equal(parent.data.active_version_id, null);
  assert.equal((await review(approval)).status, 409);
  assert.equal((await readHistory()).length, 2);
  checks.push(
    'Synthetic local approval is persisted without publication; repeated stale confirmation creates no duplicate event',
  );
  const batch = await request(
    '/admin/publication/batch?version=' + created.versionId,
    undefined,
    admin.jar,
  );
  assert.equal(batch.status, 200);
  const batchHtml = await batch.text();
  assert(batchHtml.includes('Préparer 1 exercice'));
  assert(batchHtml.includes('Aucun transfert n’est disponible'));
  checks.push(
    'The approved fixture becomes batch-eligible while real publication stays disabled',
  );
  assert.equal(
    (
      await review(
        reviewBody('return_to_draft', 'approved', null, { comment: '' }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await review(reviewBody('return_to_draft', 'approved', null))).status,
    200,
  );
  assert.equal((await readHistory()).length, 3);
  checks.push(
    'Return-to-draft requires a reason and preserves the earlier review events',
  );
  const old = {
    fingerprint: current.approval_fingerprint_sha256,
    epoch: current.test_epoch,
  };
  const edited = { ...definition, title: definition.title + ' — modifié' };
  const changed = await save(edited, {
    ...created,
    fingerprint: old.fingerprint,
  });
  current = await readVersion();
  assert.notEqual(current.approval_fingerprint_sha256, old.fingerprint);
  assert(current.test_epoch > old.epoch);
  assert.equal(current.approved_by, null);
  assert.equal(
    (
      await review(
        reviewBody('request_review', 'draft', first, {
          fingerprint: old.fingerprint,
          epoch: old.epoch,
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await review(reviewBody('request_review', 'draft', first))).status,
    400,
  );
  checks.push(
    'Editing invalidates approval, fingerprint/epoch preconditions and the old successful receipt',
  );
  const second = await testSaved();
  const failed = await testSaved(false);
  assert.equal(
    (await review(reviewBody('request_review', 'draft', second))).status,
    400,
  );
  assert.equal(
    (await review(reviewBody('request_review', 'draft', failed))).status,
    400,
  );
  assert.equal((await readHistory()).length, 3);
  checks.push(
    'A newer failed native report with missing negative coverage blocks review even when an older successful report exists',
  );
  const latest = await testSaved();
  assert.equal(
    (await review(reviewBody('request_review', 'draft', latest))).status,
    200,
  );
  operator(
    `UPDATE public.profiles SET role='user' WHERE id='${fixtureAdmin}'::uuid;`,
  );
  revoked = true;
  assert.equal(
    (await review(reviewBody('approve', 'in_review', latest))).status,
    403,
  );
  operator(
    `UPDATE public.profiles SET role='admin' WHERE id='${fixtureAdmin}'::uuid;`,
  );
  revoked = false;
  assert.equal(
    (await review(reviewBody('approve', 'in_review', latest))).status,
    200,
  );
  checks.push(
    'Revocation of only the new fixture Admin blocks its existing real session before approval',
  );
  const archive = async (value, expected) => {
    const r = await request(
      '/api/admin/exercises',
      {
        action: 'archive',
        exerciseId: created.exerciseId,
        archived: value,
        expectedArchived: expected,
      },
      admin.jar,
    );
    assert.equal(r.status, 200);
  };
  await archive(true, false);
  assert.equal(
    (await review(reviewBody('return_to_draft', 'approved', null))).status,
    409,
  );
  await archive(false, true);
  checks.push(
    'Archived fixture refuses a review transition and remains restorable',
  );
  assert.equal(
    (await review(reviewBody('return_to_draft', 'approved', null))).status,
    200,
  );
  const finalDefinition = {
    ...edited,
    title: definition.title + ' — essai terminé',
  };
  await save(finalDefinition, { ...created, fingerprint: changed.fingerprint });
  current = await readVersion();
  assert.equal(current.editorial_status, 'draft');
  assert.equal(current.approved_by, null);
  const history = await readHistory();
  assert.equal(history.length, 6);
  assert(
    history.every(
      (r) => r.actor_id === fixtureAdmin && r.comment.startsWith(marker),
    ),
  );
  for (const receipt of receipts) {
    const r = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('payload')
      .eq('id', receipt.id)
      .single();
    assert.equal(r.error, null);
    assert.equal(
      createHash('sha256').update(r.data.payload).digest('hex'),
      receipt.payloadSha256,
    );
  }
  const detail = await request(
    '/admin/exercises/' + created.exerciseId,
    undefined,
    admin.jar,
  );
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert(detailHtml.includes(marker));
  assert(detailHtml.includes('Historique des relectures'));
  checks.push(
    'All six labelled synthetic reviews and all four original receipts survive edits and reload; the fixture finishes as a draft',
  );
  assert.equal(
    (await request('/api/admin/publication', {}, admin.jar)).status,
    503,
  );
  checks.push(
    'Publication remains disabled throughout the genuine local review workflow',
  );
  const after = snapshot();
  for (const [table, hashes] of Object.entries(baseline)) {
    const counts = new Map();
    for (const hash of after[table] ?? [])
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    for (const hash of hashes) {
      assert(
        (counts.get(hash) ?? 0) > 0,
        'Existing business row changed or missing in ' + table,
      );
      counts.set(hash, counts.get(hash) - 1);
    }
  }
  checks.push(
    'Every preexisting public/private business row hash is preserved; only new labelled fixtures are changed',
  );
  const proof = {
    result: 'PASS for actual local review integration',
    date: new Date().toISOString(),
    checks,
    artifact,
    created: { exerciseId: created.exerciseId, versionId: created.versionId },
    fixtureAdmin,
    accountsSynthetic: true,
    sessionsSynthetic: false,
    realAuth: true,
    realPostgrest: true,
    realNextRoutes: true,
    nativeEngine: true,
    nativeReports: 4,
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
    successfulReports: 3,
    failedReportsWithMissingNegativeCoverage: 1,
    seeds: [0, 42],
    syntheticReviewEvents: 6,
    humanAcceptance: false,
    fixtureFinalStatus: 'draft',
    oldReceiptsAndReviewEventsPreserved: true,
    preexistingBusinessTablesChecked: Object.keys(baseline).length,
    preexistingBusinessRowsPreserved: true,
    existingAccountRolesUntouched: true,
    publicationEnabled: false,
    visualAcceptance: false,
    fullEngineSourceSuiteRerun: false,
    MFA: false,
    expiry: false,
  };
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      nativeReports: 4,
      reviewEvents: 6,
      artifact,
      humanAcceptance: false,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(artifact, 'failure.txt'),
    safe(error?.stack ?? error),
  );
  throw Error(safe(error?.message ?? error));
} finally {
  if (revoked)
    operator(
      `UPDATE public.profiles SET role='admin' WHERE id='${fixtureAdmin}'::uuid;`,
    );
  for (const sdk of clients) await sdk.auth.signOut({ scope: 'local' });
}
