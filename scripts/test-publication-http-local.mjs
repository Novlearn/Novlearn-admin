// Actual Next HTTP, GoTrue, PostgREST, bounded Linux Engine and TLS PostgreSQL.
// Only newly labelled fixtures are edited; no remote or ordinary publication.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import http from 'node:http';
import { createServerClient } from '@supabase/ssr';
import { instantiateExercise } from 'novlearn-exercise-engine';
import {
  LOCAL_AUTH_COOKIE,
  LOCAL_PUBLICATION_AUTH_COOKIE,
} from '../src/lib/auth/config.ts';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';
const root = path.resolve(process.argv[2] ?? '');
assert(
  root
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(root), /^local-admin-publication-\d+$/);
const state = JSON.parse(await readFile(root + '/private.json', 'utf8')),
  marker = JSON.parse(await readFile(root + '/publication-pg.json', 'utf8'));
assert.equal(state.artifact, root);
assert.equal(marker.target, state.prefix + '-target-db');
assert.match(state.prefix, /^novlearn-admin-publication-local-\d+$/);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55432',
);
const origin = 'http://127.0.0.1:3152',
  stamp = Date.now(),
  artifact = root + '/http-integration-' + stamp;
await mkdir(artifact);
const secrets = [
    state.serviceKey,
    state.anonKey,
    ...Object.values(state.secrets),
  ],
  checks = [],
  clients = [],
  accounts = [];
const safe = (text) =>
  secrets.reduce(
    (s, key) => s.replaceAll(key, '[fixture secret]'),
    String(text),
  );
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const sql = (container, text) => {
  assert([state.names.db, marker.target].includes(container));
  const r = spawnSync(
    docker,
    [
      '--host',
      'npipe:////./pipe/dockerDesktopLinuxEngine',
      'exec',
      '-i',
      container,
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
      timeout: 30000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(r.status, 0, 'Fixture SQL operation failed; output withheld');
  return r.stdout.trim();
};
const value = (container, text) =>
  JSON.parse(sql(container, text).split('\n').at(-1));
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text).toString('base64')}','base64'),'UTF8')`;
const snapshot = (container, withAuth = false) =>
  value(
    container,
    `CREATE FUNCTION pg_temp.rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; h jsonb; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private'${withAuth ? ",'auth'" : ''}) ORDER BY 1,2 LOOP EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,h);END LOOP;RETURN result;END;$$;SELECT pg_temp.rows();`,
  );
const preserve = (before, after, except = []) => {
  for (const [table, hashes] of Object.entries(before)) {
    if (except.includes(table)) continue;
    const counts = new Map();
    for (const h of after[table] ?? []) counts.set(h, (counts.get(h) ?? 0) + 1);
    for (const h of hashes) {
      assert((counts.get(h) ?? 0) > 0, 'Preexisting row changed in ' + table);
      counts.set(h, counts.get(h) - 1);
    }
  }
};
const cookieHeader = (jar) => [...jar].map(([k, v]) => k + '=' + v).join('; ');
async function request(url, body, jar, requestOrigin = origin, form = false) {
  const r = await fetch(origin + url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(jar ? { cookie: cookieHeader(jar) } : {}),
      ...(body === undefined
        ? {}
        : {
            origin: requestOrigin,
            'content-type': form
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
          }),
    },
    ...(body === undefined
      ? {}
      : { body: form ? new URLSearchParams(body) : JSON.stringify(body) }),
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  });
  if (jar)
    for (const c of r.headers.getSetCookie()) {
      const p = c.split(';')[0],
        i = p.indexOf('='),
        k = p.slice(0, i),
        v = p.slice(i + 1);
      if (!v || /max-age=0/i.test(c)) jar.delete(k);
      else {
        jar.set(k, v);
        secrets.push(v);
      }
    }
  return r;
}
function client(config, key, name) {
  const jar = new Map();
  const sdk = createServerClient(config, key, {
    cookieOptions: {
      name,
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
  clients.push(sdk);
  return { sdk, jar };
}
async function packet(url, body, jar, status = 200) {
  const r = await request(url, body, jar);
  assert.equal(r.status, status, 'Unexpected HTTP status for ' + url);
  assert(r.headers.get('cache-control')?.includes('no-store'));
  return r.json();
}
const note = async (label) => {
  checks.push(label);
  await writeFile(
    artifact + '/progress.json',
    JSON.stringify({ date: new Date().toISOString(), checks }, null, 2),
  );
};
let fixtureAdmin,
  revoked = false,
  admin;
const sourceBefore = snapshot(state.names.db);
try {
  const login = await request('/login');
  assert.equal(login.status, 200);
  assert((await login.text()).includes('type="password"'));
  for (const kind of ['admin', 'user']) {
    const password = randomBytes(24).toString('base64url');
    secrets.push(password);
    const email = `http-${kind}-${stamp}@novlearn-admin.local.invalid`;
    const r = await fetch('http://127.0.0.1:55432/auth/v1/admin/users', {
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
          first_name: 'TEST HTTP LOCAL',
          birth_date: '2000-01-01',
          ...(kind === 'user' ? { role: 'admin' } : {}),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(r.status, 200);
    const a = await r.json();
    assert.match(a.id, /^[0-9a-f-]{36}$/);
    accounts.push({ kind, email, password, id: a.id });
    await writeFile(
      artifact + '/accounts-private.json',
      JSON.stringify({ accounts }, null, 2),
    );
    if (kind === 'admin') {
      fixtureAdmin = a.id;
      sql(
        state.names.db,
        `UPDATE public.profiles SET role='admin' WHERE id='${a.id}';`,
      );
    }
  }
  admin = client(
    'http://127.0.0.1:55432',
    state.anonKey,
    LOCAL_PUBLICATION_AUTH_COOKIE,
  );
  const account = accounts.find((a) => a.kind === 'admin');
  const form = await request(
    '/auth/login',
    { email: account.email, password: account.password },
    admin.jar,
    origin,
    true,
  );
  assert.equal(form.status, 303);
  assert.equal(form.headers.get('location'), origin + '/admin');
  assert(
    [...admin.jar.keys()].some((k) =>
      k.startsWith(LOCAL_PUBLICATION_AUTH_COOKIE),
    ),
  );
  assert(![...admin.jar.keys()].some((k) => k.startsWith(LOCAL_AUTH_COOKIE)));
  assert.equal(
    (await request('/api/admin/session', undefined, admin.jar)).status,
    200,
  );
  await note(
    'Actual Next login form, dedicated HttpOnly session cookie and verified Admin session',
  );
  const ordinary = client(
      'http://127.0.0.1:55432',
      state.anonKey,
      LOCAL_PUBLICATION_AUTH_COOKIE,
    ),
    user = accounts.find((a) => a.kind === 'user');
  assert.equal(
    (
      await ordinary.sdk.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      })
    ).error,
    null,
  );
  const placeholder = {
    action: 'prepare',
    versionId: randomUUID(),
    fingerprint: 'a'.repeat(64),
    epoch: '0',
    mode: 'publish',
    batchId: randomUUID(),
  };
  assert.equal(
    (await request('/api/admin/publication', placeholder)).status,
    401,
  );
  assert.equal(
    (await request('/api/admin/publication', placeholder, ordinary.jar)).status,
    403,
  );
  assert.equal(
    (
      await request(
        '/api/admin/publication',
        placeholder,
        admin.jar,
        'https://foreign.invalid',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        '/api/admin/publication',
        { ...placeholder, targetUrl: 'https://foreign.invalid' },
        admin.jar,
      )
    ).status,
    400,
  );
  await note(
    'Real unauthenticated, metadata-spoofing non-Admin, foreign origin and injected target inputs refused',
  );
  const main = JSON.parse(
    await readFile('.local/local-admin-1792143739689/private.json', 'utf8'),
  );
  secrets.push(main.anonKey, ...Object.values(main.secrets));
  const primary = client(
      'http://127.0.0.1:55431',
      main.anonKey,
      LOCAL_AUTH_COOKIE,
    ),
    primaryAccount = main.accounts.find((a) => a.kind === 'admin');
  assert.equal(
    (
      await primary.sdk.auth.signInWithPassword({
        email: primaryAccount.email,
        password: primaryAccount.password,
      })
    ).error,
    null,
  );
  assert.equal(
    (await request('/api/admin/publication', placeholder, new Map(primary.jar)))
      .status,
    401,
  );
  const renamed = new Map(
    [...primary.jar].map(([k, v]) => [
      k.replace(LOCAL_AUTH_COOKIE, LOCAL_PUBLICATION_AUTH_COOKIE),
      v,
    ]),
  );
  assert.equal(
    (await request('/api/admin/publication', placeholder, renamed)).status,
    401,
  );
  const alive = await fetch('http://127.0.0.1:3150/api/admin/session', {
    headers: { cookie: cookieHeader(primary.jar) },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(alive.status, 200);
  await note(
    'Actual main application session cannot authorize the fixture, even after cookie renaming; the independent main session still works',
  );
  const chapterName = 'TEST HTTP CHAPTER ' + stamp,
    skillName = 'TEST HTTP SKILL ' + stamp,
    sourceChapter = randomUUID(),
    targetChapter = randomUUID(),
    skillSource = 'http-source-' + stamp,
    skillTarget = 'http-target-' + stamp;
  sql(
    state.names.db,
    `INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('${sourceChapter}',${literal(chapterName)},995,'{}'); INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('${skillSource}',${literal(skillName)},'${sourceChapter}',10);`,
  );
  const definition = JSON.parse(
    await readFile('tests/fixtures/preview-definition.json', 'utf8'),
  );
  definition.title = '[TEST AUTOMATISÉ LOCAL] Publication HTTP ' + stamp;
  definition.catalogue = {
    chapter: chapterName,
    skills: [skillName],
    appTitle: 'Essai local publication',
    difficulty: 2,
    exerciseType: 'classic',
    needsCalculator: false,
  };
  // Non-empty preexisting target histories, generated with the official portable
  // SDK only for fixture setup. New publication runs use the bounded native host.
  const legacyUsers = [randomUUID(), randomUUID()],
    legacyVersion = randomUUID(),
    round = randomUUID(),
    legacyDefinition = structuredClone(definition);
  legacyDefinition.id = randomUUID();
  legacyDefinition.title = '[HISTORIQUE SYNTHÉTIQUE] ' + stamp;
  const generated = instantiateExercise(legacyDefinition, {
    seed: 42,
    instanceId: 'historical-http-fixture-' + stamp,
  });
  assert.equal(generated.ok, true);
  const legacyInstance = JSON.stringify(generated.value);
  sql(
    marker.target,
    `DO $$ DECLARE e bigint; a bigint; d bigint; BEGIN INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"HTTP LEGACY FIXTURE","birth_date":"2000-01-01"}',now(),now() FROM unnest(ARRAY['${legacyUsers[0]}'::uuid,'${legacyUsers[1]}'::uuid]) id;
 INSERT INTO public.exercises(catalog_id,title,chapter,content) VALUES('${legacyDefinition.id}',${literal(legacyDefinition.title)},'Historical local fixture',${literal(JSON.stringify(legacyDefinition))}::jsonb) RETURNING id INTO e;
 INSERT INTO public.exercise_versions(id,exercise_id,revision,definition,engine_contract,generation_version,canonicalization_version,definition_sha256,approval_fingerprint_sha256,created_by) VALUES('${legacyVersion}',e,1,${literal(JSON.stringify(legacyDefinition))}::jsonb,'schema-5;engine-0.1.0','mulberry32-rejection-v1','pg-jsonb-text-v1',repeat('0',64),repeat('0',64),'${legacyUsers[0]}');
 UPDATE public.exercise_versions SET editorial_status='approved',approved_at=now(),approved_by='${legacyUsers[0]}' WHERE id='${legacyVersion}'; UPDATE public.exercise_versions SET editorial_status='published' WHERE id='${legacyVersion}'; UPDATE public.exercises SET active_version_id='${legacyVersion}' WHERE id=e;
 INSERT INTO public.exercise_attempts(user_id,exercise_id,exercise_version_id,is_correct) VALUES('${legacyUsers[1]}',e,'${legacyVersion}',false) RETURNING id INTO a; INSERT INTO public.exercise_attempt_instances(attempt_id,instance_seed,generation_version,instance_data) VALUES(a,'42','mulberry32-rejection-v1',${literal(legacyInstance)}::jsonb); INSERT INTO public.exercise_attempt_replay_artifacts(attempt_id,replay_data) VALUES(a,${literal(legacyInstance)}::jsonb);
 INSERT INTO public.duels(player1_id,player2_id,status) VALUES('${legacyUsers[0]}','${legacyUsers[1]}','active') RETURNING id INTO d; INSERT INTO public.duel_exercise_instances(id,duel_id,round_number,exercise_id,exercise_version_id,instance_seed,generation_version,replay_data) VALUES('${round}',d,1,e,'${legacyVersion}','42','mulberry32-rejection-v1',${literal(legacyInstance)}::jsonb); INSERT INTO public.duel_attempts(duel_id,player_id,element_id,is_correct,duel_exercise_instance_id) VALUES(d,'${legacyUsers[1]}',0,false,'${round}'); END; $$;`,
  );
  const readVersion = async (id) => {
    const r = await admin.sdk
      .from('exercise_versions')
      .select(
        'id,exercise_id,revision,definition,editorial_status,approval_fingerprint_sha256,test_epoch,approved_by',
      )
      .eq('id', id)
      .single();
    assert.equal(r.error, null);
    return r.data;
  };
  const save = async (exerciseId, title) => {
    const d = { ...definition, title };
    const body = await packet(
      '/api/admin/exercises',
      {
        action: 'save',
        exerciseId,
        versionId: null,
        fingerprint: null,
        definition: d,
      },
      admin.jar,
    );
    return body.result;
  };
  const receipts = [];
  const approve = async (created) => {
    const v = await readVersion(created.versionId);
    const tested = await packet(
      '/api/admin/preview',
      {
        action: 'test_saved',
        versionId: v.id,
        fingerprint: v.approval_fingerprint_sha256,
        epoch: v.test_epoch,
        seeds: [0, 42],
        cases: [
          {
            questionId: 'q',
            expectedState: 'incorrect',
            answer: { format: 'latex', source: '0' },
          },
        ],
      },
      admin.jar,
    );
    const r = tested.result;
    assert.equal(r.report.passed, true);
    assert.equal(r.report.complete, true);
    const stored = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('payload,signature')
      .eq('id', r.receiptId)
      .single();
    assert.equal(stored.error, null);
    assert.equal(
      JSON.parse(stored.data.payload).engineArchiveSha256,
      certifiedEngineIdentity.engineArchiveSha256,
    );
    receipts.push({ id: r.receiptId, ...stored.data });
    const base = {
      versionId: v.id,
      fingerprint: v.approval_fingerprint_sha256,
      epoch: v.test_epoch,
      receiptId: r.receiptId,
      comment: '[TEST AUTOMATISÉ LOCAL — NE VAUT PAS VALIDATION HUMAINE]',
    };
    await packet(
      '/api/admin/review',
      {
        ...base,
        action: 'request_review',
        expectedStatus: 'draft',
        checklist: {},
      },
      admin.jar,
    );
    await packet(
      '/api/admin/review',
      {
        ...base,
        action: 'approve',
        expectedStatus: 'in_review',
        checklist: {
          mathematicsCorrect: true,
          statementClear: true,
          gradingChecked: true,
          referencesChecked: true,
        },
      },
      admin.jar,
    );
    return readVersion(v.id);
  };
  const prepare = async (v, mode = 'publish') => {
    const p = await packet(
      '/api/admin/publication',
      {
        action: 'prepare',
        versionId: v.id,
        fingerprint: v.approval_fingerprint_sha256,
        epoch: String(v.test_epoch),
        mode,
        batchId: randomUUID(),
      },
      admin.jar,
    );
    assert.equal(p.sourceEnvironment, 'local-source');
    assert.equal(p.targetEnvironment, 'local-target');
    assert.equal(
      sql(
        state.names.db,
        `SELECT target_key FROM novlearn_admin_private.publication_operations WHERE id='${p.result.operation.id}';`,
      ),
      'local-http-fixture',
    );
    assert.match(p.result.confirmation, /^[\w-]+\.[a-f0-9]{64}$/);
    return p.result;
  };
  const first = await save(null, definition.title);
  const v1 = await approve(first);
  await note(
    'New canonical revision, complete native two-seed report, signed SQL receipt and explicitly labelled synthetic review through real HTTP/Auth/REST',
  );
  // Establish real references separately; the transfer may not create taxonomy.
  sql(
    marker.target,
    `INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('${targetChapter}',${literal(chapterName)},995,'{}'); INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('${skillTarget}',${literal(skillName)},'${targetChapter}',10);`,
  );
  const targetBefore = snapshot(marker.target, true);
  assert.equal(Object.keys(targetBefore).length, 62);
  assert(targetBefore['public.exercise_attempts'].length > 0);
  assert(targetBefore['public.duel_attempts'].length > 0);
  assert(targetBefore['auth.users'].length > 0);
  const plan = await prepare(v1);
  assert.equal(plan.plan.action, 'create_exercise');
  assert.deepEqual(snapshot(marker.target, true), targetBefore);
  await note(
    'Actual preparation reruns native Engine and returns a signed local diff without changing any target table',
  );
  const altered =
    plan.confirmation.slice(0, -1) +
    (plan.confirmation.endsWith('0') ? '1' : '0');
  assert.equal(
    (
      await request(
        '/api/admin/publication',
        {
          action: 'confirm',
          operationId: plan.operation.id,
          confirmation: altered,
        },
        admin.jar,
      )
    ).status,
    400,
  );
  assert.deepEqual(snapshot(marker.target, true), targetBefore);
  await note('Altered confirmation is refused with no target row change');
  // A real client socket is closed after headers, without consuming the body.
  // This is a lost browser result, not a lost PostgreSQL COMMIT acknowledgement.
  await new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      action: 'confirm',
      operationId: plan.operation.id,
      confirmation: plan.confirmation,
    });
    const req = http.request(
      origin + '/api/admin/publication',
      {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: cookieHeader(admin.jar),
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        try {
          assert.equal(res.statusCode, 200);
          res.destroy();
          req.destroy();
          resolve();
        } catch (e) {
          reject(e);
        }
      },
    );
    req.on('error', (e) => {
      if (e.code !== 'ECONNRESET') reject(e);
    });
    req.setTimeout(120000, () => {
      req.destroy();
      reject(Error('HTTP confirm deadline'));
    });
    req.end(payload);
  });
  const recovered = (
    await packet(
      '/api/admin/publication',
      { action: 'recover', operationId: plan.operation.id },
      admin.jar,
    )
  ).result;
  assert.equal(recovered.state, 'committed');
  assert.equal(recovered.outcome.result, 'published');
  assert.equal((await readVersion(v1.id)).editorial_status, 'published');
  await note(
    'Real target commit survives a client socket close after response headers; HTTP recovery reads the durable committed result',
  );
  const targetFirst = snapshot(marker.target, true);
  const replay = (
    await packet(
      '/api/admin/publication',
      {
        action: 'confirm',
        operationId: plan.operation.id,
        confirmation: plan.confirmation,
      },
      admin.jar,
    )
  ).result;
  assert.equal(replay.state, 'committed');
  assert.deepEqual(snapshot(marker.target, true), targetFirst);
  await note(
    'Repeated confirmation is idempotent and does not write target data again',
  );
  const second = await save(
    first.exerciseId,
    definition.title + ' — révision 2',
  );
  const v2 = await approve(second);
  const stalePlan = await prepare(v2);
  sql(
    state.names.db,
    `UPDATE public.profiles SET role='user' WHERE id='${fixtureAdmin}';`,
  );
  revoked = true;
  assert.equal(
    (
      await request(
        '/api/admin/publication',
        {
          action: 'confirm',
          operationId: stalePlan.operation.id,
          confirmation: stalePlan.confirmation,
        },
        admin.jar,
      )
    ).status,
    403,
  );
  assert.deepEqual(snapshot(marker.target, true), targetFirst);
  sql(
    state.names.db,
    `UPDATE public.profiles SET role='admin' WHERE id='${fixtureAdmin}';`,
  );
  revoked = false;
  const cancelled = (
    await packet(
      '/api/admin/publication',
      { action: 'cancel', operationId: stalePlan.operation.id },
      admin.jar,
    )
  ).result;
  assert.equal(cancelled.state, 'cancelled');
  assert.deepEqual(snapshot(marker.target, true), targetFirst);
  await note(
    'Revocation of only the new fixture Admin refuses confirmation; target remains unchanged and the old plan is explicitly cancelled',
  );
  const p2 = await prepare(v2);
  assert.equal(p2.plan.action, 'append_revision');
  const done2 = (
    await packet(
      '/api/admin/publication',
      {
        action: 'confirm',
        operationId: p2.operation.id,
        confirmation: p2.confirmation,
      },
      admin.jar,
    )
  ).result;
  assert.equal(done2.state, 'committed');
  assert.equal(done2.outcome.result, 'published');
  assert.equal((await readVersion(v2.id)).editorial_status, 'published');
  await note(
    'Second revision transfers through actual HTTP and finalizes its source status and active pointer',
  );
  const rollback = await prepare(await readVersion(v1.id), 'rollback');
  assert.equal(rollback.plan.action, 'rollback');
  const restored = (
    await packet(
      '/api/admin/publication',
      {
        action: 'confirm',
        operationId: rollback.operation.id,
        confirmation: rollback.confirmation,
      },
      admin.jar,
    )
  ).result;
  assert.equal(restored.state, 'committed');
  assert.equal(restored.outcome.result, 'rolled_back');
  const sourceParent = value(
      state.names.db,
      `SELECT to_jsonb(e) FROM public.exercises e WHERE id=${first.exerciseId};`,
    ),
    targetParent = value(
      marker.target,
      `SELECT to_jsonb(e) FROM public.exercises e WHERE catalog_id='${sourceParent.catalog_id}';`,
    );
  assert.equal(sourceParent.active_version_id, v1.id);
  const targetVersions = value(
    marker.target,
    `SELECT jsonb_agg(to_jsonb(v) ORDER BY revision) FROM public.exercise_versions v WHERE exercise_id=${targetParent.id};`,
  );
  assert.equal(targetVersions.length, 2);
  assert.equal(targetParent.active_version_id, targetVersions[0].id);
  assert.notEqual(targetVersions[0].id, v1.id);
  assert.equal(targetParent.competences[0], skillTarget);
  assert(
    targetVersions.every(
      (v) =>
        v.publication_origin === 'transfer' &&
        v.approved_by === null &&
        v.created_by === null &&
        v.editorial_status === 'published',
    ),
  );
  assert.deepEqual(
    targetVersions.map((v) => v.definition),
    [
      (await readVersion(v1.id)).definition,
      (await readVersion(v2.id)).definition,
    ],
  );
  await note(
    'HTTP rollback reactivates revision 1 in both copies, preserves revision 2 and resolves taxonomy to target identifiers without copying source actors',
  );
  const targetAfter = snapshot(marker.target, true);
  for (const table of Object.keys(targetBefore))
    if (!['public.exercises', 'public.exercise_versions'].includes(table))
      assert.deepEqual(
        targetAfter[table],
        targetBefore[table],
        table + ' changed during transfer',
      );
  preserve(targetBefore, targetAfter);
  preserve(sourceBefore, snapshot(state.names.db));
  await note(
    'All 60 non-publication target tables and every preexisting target/source business row remain exact, including non-empty attempts, replay artifacts, duels and Auth histories',
  );
  for (const receipt of receipts) {
    const r = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('payload,signature')
      .eq('id', receipt.id)
      .single();
    assert.equal(r.error, null);
    assert.deepEqual(r.data, {
      payload: receipt.payload,
      signature: receipt.signature,
    });
  }
  const history = await request('/admin/publication', undefined, admin.jar);
  assert.equal(history.status, 200);
  const historyHtml = await history.text();
  assert(historyHtml.includes('essai local'));
  assert(historyHtml.includes(plan.operation.id));
  const detail = await request(
    '/admin/exercises/' + first.exerciseId,
    undefined,
    admin.jar,
  );
  assert.equal(detail.status, 200);
  assert((await detail.text()).includes('Copie source'));
  await note(
    'Real authenticated history/detail pages show local results and retain original signed receipts; no browser execution claimed',
  );
  const mainClosed = await fetch(
    'http://127.0.0.1:3150/api/admin/publication',
    {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3150',
        'content-type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(10000),
    },
  );
  assert.equal(mainClosed.status, 503);
  const proof = {
    result: 'PASS for real local Next HTTP publication and rollback',
    date: new Date().toISOString(),
    artifact,
    checks,
    fixtureAdmin,
    accountsSynthetic: true,
    realNext: true,
    realAuth: true,
    realPostgrest: true,
    verifiedTLS: true,
    nativeLinuxEngine: true,
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
    seeds: [0, 42],
    sourceVersions: [v1.id, v2.id],
    receiptIds: receipts.map((r) => r.id),
    operations: [
      plan.operation.id,
      stalePlan.operation.id,
      p2.operation.id,
      rollback.operation.id,
    ],
    targetCatalogId: sourceParent.catalog_id,
    targetExerciseId: String(targetParent.id),
    targetVersions: targetVersions.map((v) => ({
      id: v.id,
      revision: v.revision,
    })),
    targetNonPublicationTablesPreserved: 60,
    sourcePreexistingBusinessTablesChecked: Object.keys(sourceBefore).length,
    sourcePreexistingRowsPreserved: true,
    targetPreexistingRowsPreserved: true,
    clientResponseClosedAfterHeaders: true,
    postgresCommitAcknowledgementLossSimulated: false,
    mainPublicationEnabled: false,
    remoteChanged: false,
    browserExecuted: false,
    humanAcceptance: false,
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
      realNext: true,
      nativeEngine: true,
      versions: 2,
      rollback: true,
      remoteChanged: false,
    }),
  );
} catch (e) {
  await writeFile(artifact + '/failure.txt', safe(e?.stack ?? e));
  throw Error(
    'Local HTTP publication integration failed; see retained private artifact ' +
      artifact,
  );
} finally {
  if (revoked)
    sql(
      state.names.db,
      `UPDATE public.profiles SET role='admin' WHERE id='${fixtureAdmin}';`,
    );
  for (const c of clients) await c.auth.signOut({ scope: 'local' });
}
