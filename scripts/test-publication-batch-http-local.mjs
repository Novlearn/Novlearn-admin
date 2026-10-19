// One explicit, durable batch run on the previously qualified local publication
// fixture. Real Auth/Next/Engine/PG only; never a browser or a remote target.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import { build } from 'vite';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_PUBLICATION_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';

const [rootArgument, accountArgument, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert(
  rootArgument && accountArgument,
  'Explicit retained publication workspace and account file are required',
);
const root = path.resolve(rootArgument),
  accountFile = path.resolve(accountArgument);
assert.equal(
  path.dirname(root).toLowerCase(),
  path.resolve('.local').toLowerCase(),
);
assert.match(path.basename(root), /^local-admin-publication-\d+$/);
assert.equal(
  path.dirname(path.dirname(accountFile)).toLowerCase(),
  root.toLowerCase(),
);
assert.match(
  path.basename(path.dirname(accountFile)),
  /^http-integration-\d+$/,
);
assert.equal(path.basename(accountFile), 'accounts-private.json');
const json = async (file) => {
  const contents = await readFile(file, 'utf8');
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error('Invalid local fixture state; contents withheld');
  }
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const state = await json(root + '/private.json'),
  marker = await json(root + '/publication-pg.json');
assert.equal(state.artifact, root);
assert.match(state.prefix, /^novlearn-admin-publication-local-\d+$/);
assert.equal(state.names.db, state.prefix + '-db');
assert.equal(marker.target, state.prefix + '-target-db');
// Provisioning stays disabled on disk. The dedicated launcher alone opts its
// child process into the explicitly isolated HTTP publication fixture.
assert.equal(marker.publicationEnabled, false);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55432',
);
assert.equal(
  state.images.db,
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
);
assert(
  path
    .resolve(marker.privateFile)
    .toLowerCase()
    .startsWith((root + path.sep).toLowerCase()),
);
const pg = await json(marker.privateFile);
assert.equal(pg.publicationEnabled, false);
for (const [side, port, login] of [
  ['source', '55433', 'novlearn_admin_journal_service'],
  ['target', '55434', 'novlearn_admin_publication_service'],
]) {
  let url;
  try {
    url = new URL(pg.config[side].url);
  } catch {
    throw new Error('Malformed local SQL endpoint; value withheld');
  }
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, port);
  assert.equal(url.pathname, '/admin_local');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(decodeURIComponent(url.username), login);
  assert(decodeURIComponent(url.password).length >= 16);
  assert(pg.config[side].ca.includes('-----BEGIN CERTIFICATE-----'));
}
const runtime = await json(root + '/app-runtime.json');
assert.equal(runtime.origin, 'http://127.0.0.1:3152');
assert.equal(runtime.local, true);
assert.equal(runtime.publicationFixture, true);
assert.equal(runtime.engine, true);
assert.match(runtime.engineContainer, /^novlearn-admin-engine-\d+$/);
const accounts = (await json(accountFile)).accounts;
assert.equal(accounts.length, 2);
const adminAccount = accounts.find((account) => account.kind === 'admin'),
  userAccount = accounts.find((account) => account.kind === 'user');
assert(adminAccount && userAccount);
for (const account of accounts) {
  assert.match(account.id, /^[0-9a-f-]{36}$/);
  assert.match(
    account.email,
    /^http-(admin|user)-\d+@novlearn-admin\.local\.invalid$/,
  );
}
const baseline = await json(path.dirname(accountFile) + '/proof.json');
assert.equal(baseline.realNext, true);
assert.equal(baseline.realAuth, true);
assert.equal(baseline.nativeLinuxEngine, true);
assert.equal(
  baseline.engineArchiveSha256,
  certifiedEngineIdentity.engineArchiveSha256,
);
assert.match(baseline.sourceVersions[0], /^[0-9a-f-]{36}$/);
const nativeMarker = root + '/batch-http-current.json';
await assert.rejects(access(nativeMarker), (error) => error.code === 'ENOENT');
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const result = spawnSync(
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
  assert.equal(
    result.status,
    0,
    'Local Docker/SQL operation failed; inspect its retained fixture without restarting blindly',
  );
  return result.stdout.trim();
};
// Readiness is established before any account sign-in, SQL fixture write or
// current-run marker. A missing daemon never becomes a simulated success.
for (const name of [state.names.db, marker.target]) {
  const inspected = JSON.parse(cli(['inspect', name]))[0];
  assert.equal(inspected.State.Running, true);
  assert.deepEqual(inspected.HostConfig.PortBindings, {});
  assert(
    JSON.parse(
      cli(['image', 'inspect', inspected.Image]),
    )[0].RepoDigests.includes(state.images.db),
  );
  const networks = Object.keys(inspected.NetworkSettings.Networks);
  assert(networks.length > 0);
  for (const network of networks)
    assert.equal(
      JSON.parse(cli(['network', 'inspect', network]))[0].Internal,
      true,
    );
}
const worker = JSON.parse(cli(['inspect', runtime.engineContainer]))[0];
assert.equal(worker.State.Running, true);
assert.equal(worker.HostConfig.NetworkMode, 'none');
assert.deepEqual(Object.keys(worker.NetworkSettings.Networks), ['none']);
assert.equal(worker.HostConfig.ReadonlyRootfs, true);
assert.deepEqual(worker.HostConfig.CapDrop, ['ALL']);
assert.deepEqual(worker.HostConfig.SecurityOpt, ['no-new-privileges']);
assert.equal(worker.Config.User, '65534:65534');
assert.match(
  cli(['exec', runtime.engineContainer, 'cat', '/proc/1/status']),
  /^NoNewPrivs:\s+1$/m,
);
assert.deepEqual(
  cli([
    'exec',
    runtime.engineContainer,
    'sh',
    '-c',
    'id -u; cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.swap.max /sys/fs/cgroup/pids.max',
  ]).split(/\r?\n/),
  ['65534', '402653184', '0', '64'],
);

const stamp = Date.now(),
  artifact = root + '/batch-http-' + stamp,
  origin = 'http://127.0.0.1:3152';
await mkdir(artifact);
await writeFile(
  nativeMarker,
  JSON.stringify({ artifact, phase: 'running' }, null, 2) + '\n',
);
const store = (name, value) =>
  writeFile(artifact + '/' + name, JSON.stringify(value, null, 2) + '\n');
const nativeFetch = globalThis.fetch,
  secrets = new Set(),
  checks = [],
  clients = [],
  commands = [],
  receipts = [],
  created = [];
function collect(value, key = '') {
  if (typeof value === 'string') {
    if (/secret|password|servicekey|key$/i.test(key) && value.length >= 12)
      secrets.add(value);
    if (/^postgres(?:ql)?:/.test(value))
      secrets.add(decodeURIComponent(new URL(value).password));
  } else if (value && typeof value === 'object')
    for (const [name, item] of Object.entries(value))
      collect(item, key + '.' + name);
}
collect(state);
collect(pg);
collect(accounts);
const safe = (text) =>
  [...secrets]
    .filter(Boolean)
    .reduce(
      (result, value) => result.replaceAll(value, '[fixture secret]'),
      String(text),
    );
const note = async (label) => {
  checks.push(label);
  await store('progress.json', {
    date: new Date().toISOString(),
    checks,
    created,
    receiptIds: receipts.map((r) => r.id),
    commands,
  });
};
const sql = (container, text) => {
  assert([state.names.db, marker.target].includes(container));
  return cli(
    [
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
    text,
  );
};
const value = (container, text) =>
  JSON.parse(sql(container, text).split('\n').at(-1));
const snapshot = (container, withAuth = false) =>
  value(
    container,
    `CREATE FUNCTION pg_temp.batch_http_rows() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item record; rows jsonb; result jsonb:='{}'; BEGIN
FOR item IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','novlearn_admin_private'${withAuth ? ",'auth'" : ''}) ORDER BY 1,2 LOOP
EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',item.schemaname,item.tablename) INTO rows;
result:=result||jsonb_build_object(item.schemaname||'.'||item.tablename,rows);END LOOP;RETURN result;END;$$; SELECT pg_temp.batch_http_rows();`,
  );
const preserve = (before, after) => {
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const [table, hashes] of Object.entries(before)) {
    const available = new Map();
    for (const h of after[table]) available.set(h, (available.get(h) ?? 0) + 1);
    for (const h of hashes) {
      assert(
        (available.get(h) ?? 0) > 0,
        'Preexisting row changed in ' + table,
      );
      available.set(h, available.get(h) - 1);
    }
  }
};
const cookieHeader = (jar) =>
  [...jar].map(([key, value]) => key + '=' + value).join('; ');
function captureCookies(values, jar) {
  for (const raw of values) {
    const pair = raw.split(';')[0],
      split = pair.indexOf('='),
      name = pair.slice(0, split),
      value = pair.slice(split + 1);
    if (!value || /max-age=0/i.test(raw)) jar.delete(name);
    else {
      jar.set(name, value);
      secrets.add(value);
    }
  }
}
const client = () => {
  const jar = new Map(),
    sdk = createServerClient('http://127.0.0.1:55432', state.anonKey, {
      cookieOptions: {
        name: LOCAL_PUBLICATION_AUTH_COOKIE,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const { name, value, options } of values) {
            if (!value || options?.maxAge === 0) jar.delete(name);
            else {
              jar.set(name, value);
              secrets.add(value);
            }
          }
        },
      },
    });
  clients.push(sdk);
  return { jar, sdk };
};
async function request(url, body, jar, options = {}) {
  assert(url.startsWith('/') && !url.startsWith('//'));
  const result = await nativeFetch(origin + url, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
    headers: {
      ...(jar ? { cookie: cookieHeader(jar) } : {}),
      ...(body === undefined
        ? {}
        : {
            origin: options.origin ?? origin,
            'content-type': options.form
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
          }),
    },
    ...(body === undefined
      ? {}
      : {
          body: options.form ? new URLSearchParams(body) : JSON.stringify(body),
        }),
  });
  if (jar) captureCookies(result.headers.getSetCookie(), jar);
  return result;
}
async function packet(url, body, jar) {
  const result = await request(url, body, jar);
  assert.equal(result.status, 200, url);
  assert.match(result.headers.get('cache-control') ?? '', /no-store/);
  return result.json();
}
async function signIn(account) {
  const result = client(),
    response = await request(
      '/auth/login',
      { email: account.email, password: account.password },
      result.jar,
      { form: true },
    );
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get('location'),
    origin + (account.kind === 'admin' ? '/admin' : '/login?error=forbidden'),
  );
  await response.arrayBuffer();
  if (account.kind !== 'admin') {
    const login = await result.sdk.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    assert.equal(login.error, null);
  }
  const identity = await result.sdk.auth.getUser();
  assert.equal(identity.error, null);
  assert.equal(identity.data.user.id, account.id);
  return result;
}
async function closedAfterHeaders(command, jar, signal) {
  signal?.throwIfAborted();
  const body = JSON.stringify(command);
  await new Promise((resolve, reject) => {
    let closed = false;
    const req = http.request(
      origin + '/api/admin/publication',
      {
        method: 'POST',
        headers: {
          origin,
          cookie: cookieHeader(jar),
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        try {
          assert.equal(res.statusCode, 200);
          assert.match(res.headers['cache-control'] ?? '', /no-store/);
          captureCookies(res.headers['set-cookie'] ?? [], jar);
          closed = true;
          res.destroy();
          req.destroy();
          resolve();
        } catch (error) {
          res.destroy();
          req.destroy();
          reject(error);
        }
      },
    );
    const abort = () => req.destroy(new Error('Batch request aborted'));
    signal?.addEventListener('abort', abort, { once: true });
    req.on('close', () => signal?.removeEventListener('abort', abort));
    req.on('error', (error) => {
      if (!closed) reject(error);
    });
    req.setTimeout(120000, () => req.destroy(new Error('Batch HTTP deadline')));
    req.end(body);
  });
}
let sourceBefore,
  targetBefore,
  cleanupComplete = false;
async function closeClients() {
  const results = [];
  for (const sdk of clients) {
    try {
      const closed = await sdk.auth.signOut({ scope: 'local' });
      results.push({ sessionClosed: closed.error === null });
    } catch {
      results.push({ sessionClosed: false });
    }
  }
  await store('cleanup.json', {
    date: new Date().toISOString(),
    scope: 'Only the new cookie sessions of retained synthetic accounts',
    results,
    strictJwtRevocationClaimed: false,
  });
  return results.every((item) => item.sessionClosed);
}
let admin;
try {
  sourceBefore = snapshot(state.names.db);
  targetBefore = snapshot(marker.target, true);
  assert.equal(Object.keys(sourceBefore).length, 35);
  assert.equal(Object.keys(targetBefore).length, 62);
  for (const table of [
    'auth.users',
    'public.exercise_attempts',
    'public.duel_attempts',
    'public.exercise_attempt_replay_artifacts',
    'public.duel_exercise_instances',
  ])
    assert(
      targetBefore[table].length > 0,
      'Qualified nonempty target history is required: ' + table,
    );
  await store('source-before.json', sourceBefore);
  await store('target-before.json', targetBefore);
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
      ssr: 'src/lib/publication-batch.ts',
      outDir: artifact + '/domain',
      emptyOutDir: false,
      rollupOptions: { output: { entryFileNames: 'batch.mjs' } },
    },
  });
  const domain = await import(
    pathToFileURL(artifact + '/domain/batch.mjs').href
  );
  // requestPublication is bundled with the exact controller. Only the fetch
  // boundary adds a fixed local origin/cookie; its validation is not replaced.
  const viewBundle = artifact + '/view';
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
      ssr: 'src/lib/publication-view.ts',
      outDir: viewBundle,
      emptyOutDir: false,
      rollupOptions: { output: { entryFileNames: 'view.mjs' } },
    },
  });
  const view = await import(pathToFileURL(viewBundle + '/view.mjs').href);
  admin = await signIn(adminAccount);
  const ordinary = await signIn(userAccount);
  const deniedCommand = {
    action: 'prepare',
    versionId: baseline.sourceVersions[0],
    fingerprint: 'a'.repeat(64),
    epoch: '1',
    mode: 'publish',
    batchId: randomUUID(),
  };
  for (const [jar, wanted, requestOrigin] of [
    [undefined, 401, origin],
    [ordinary.jar, 403, origin],
    [admin.jar, 403, 'https://not-the-local-origin.invalid'],
  ]) {
    const response = await request(
      '/api/admin/publication',
      deniedCommand,
      jar,
      { origin: requestOrigin },
    );
    assert.equal(response.status, wanted);
    await response.arrayBuffer();
  }
  assert.deepEqual(snapshot(marker.target, true), targetBefore);
  await note(
    'Retained synthetic accounts sign in; anonymous, non-Admin and foreign-origin publication requests are refused without target writes',
  );
  const readVersion = async (id) => {
    const result = await admin.sdk
      .from('exercise_versions')
      .select(
        'id,exercise_id::text,revision,definition,editorial_status,approval_fingerprint_sha256,test_epoch::text',
      )
      .eq('id', id)
      .single();
    assert.equal(result.error, null);
    assert.equal(typeof result.data.exercise_id, 'string');
    assert.equal(typeof result.data.test_epoch, 'string');
    return result.data;
  };
  const established = await readVersion(baseline.sourceVersions[0]);
  assert.equal(established.editorial_status, 'published');
  assert(
    established.definition.catalogue?.chapter &&
      established.definition.catalogue.skills.length,
  );
  for (let index = 1; index <= 3; index++) {
    const definition = JSON.parse(
      await readFile('tests/fixtures/preview-definition.json', 'utf8'),
    );
    definition.id = randomUUID();
    definition.title = `[TEST AUTOMATISÉ LOCAL] Lot HTTP ${stamp} · ${index}`;
    definition.catalogue = structuredClone(established.definition.catalogue);
    const saved = (
      await packet(
        '/api/admin/exercises',
        {
          action: 'save',
          exerciseId: null,
          versionId: null,
          fingerprint: null,
          definition,
        },
        admin.jar,
      )
    ).result;
    assert.match(saved.versionId, /^[0-9a-f-]{36}$/);
    assert.equal(typeof saved.exerciseId, 'string');
    assert.match(saved.exerciseId, /^[1-9]\d{0,18}$/);
    created.push({
      versionId: saved.versionId,
      exerciseId: saved.exerciseId,
    });
    await store('created.json', created);
    const version = await readVersion(saved.versionId);
    assert.equal(version.exercise_id, saved.exerciseId);
    const reviewEpoch = Number(version.test_epoch);
    assert(Number.isSafeInteger(reviewEpoch) && reviewEpoch >= 0);
    assert.equal(String(reviewEpoch), version.test_epoch);
    const tested = (
      await packet(
        '/api/admin/preview',
        {
          action: 'test_saved',
          versionId: version.id,
          fingerprint: version.approval_fingerprint_sha256,
          epoch: reviewEpoch,
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
      )
    ).result;
    assert.equal(tested.report.passed, true);
    assert.equal(tested.report.complete, true);
    const receipt = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('payload,signature')
      .eq('id', tested.receiptId)
      .single();
    assert.equal(receipt.error, null);
    assert.equal(
      JSON.parse(receipt.data.payload).engineArchiveSha256,
      certifiedEngineIdentity.engineArchiveSha256,
    );
    receipts.push({ id: tested.receiptId, ...receipt.data });
    const review = {
      versionId: version.id,
      fingerprint: version.approval_fingerprint_sha256,
      epoch: reviewEpoch,
      receiptId: tested.receiptId,
      comment:
        '[TEST AUTOMATISÉ LOCAL — NE VAUT PAS VALIDATION PÉDAGOGIQUE HUMAINE]',
    };
    await packet(
      '/api/admin/review',
      {
        ...review,
        action: 'request_review',
        expectedStatus: 'draft',
        checklist: {},
      },
      admin.jar,
    );
    await packet(
      '/api/admin/review',
      {
        ...review,
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
    assert.equal((await readVersion(version.id)).editorial_status, 'approved');
  }
  assert.deepEqual(snapshot(marker.target, true), targetBefore);
  await note(
    'Three new canonical fixtures acquire real bounded-Engine reports and explicitly synthetic review through Next/Auth/REST; no target fixture or taxonomy is inserted',
  );
  const candidates = [];
  for (const item of created) {
    const version = await readVersion(item.versionId),
      parent = await admin.sdk
        .from('exercises')
        .select('id::text,catalog_id,admin_archived_at')
        .eq('id', item.exerciseId)
        .single();
    assert.equal(parent.error, null);
    const candidate = {
      versionId: version.id,
      exerciseId: version.exercise_id,
      catalogId: parent.data.catalog_id,
      title: version.definition.title,
      revision: version.revision,
      fingerprint: version.approval_fingerprint_sha256,
      epoch: version.test_epoch,
      status: version.editorial_status,
      archived: parent.data.admin_archived_at !== null,
    };
    assert.equal(domain.batchCandidate(candidate), true);
    candidates.push(candidate);
  }
  const batchId = randomUUID(),
    tokens = new Map();
  let confirmations = 0,
    lostResponse = false;
  globalThis.fetch = async (input, options = {}) => {
    if (input !== '/api/admin/publication') {
      const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
      );
      assert.equal(url.origin, 'http://127.0.0.1:55432');
      return nativeFetch(input, options);
    }
    assert.equal(options.method, 'POST');
    const command = JSON.parse(options.body);
    commands.push({
      action: command.action,
      operationId: command.operationId ?? null,
      versionId: command.versionId ?? null,
    });
    if (command.action === 'confirm' && ++confirmations === 2) {
      await closedAfterHeaders(command, admin.jar, options.signal);
      lostResponse = true;
      throw new TypeError(
        'Test-only client body loss after real HTTP 200 headers',
      );
    }
    const headers = new Headers(options.headers);
    headers.set('origin', origin);
    headers.set('cookie', cookieHeader(admin.jar));
    const response = await nativeFetch(origin + input, {
      ...options,
      headers,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(120000),
    });
    captureCookies(response.headers.getSetCookie(), admin.jar);
    return response;
  };
  const transport = async (command, signal) => {
    const result = await view.requestPublication(
      command,
      signal,
      'local-fixture',
    );
    if (command.action === 'prepare')
      tokens.set(result.operation.id, result.confirmation);
    return result;
  };
  let runner = new domain.PublicationBatch(
    batchId,
    created.map((item) => ({ versionId: item.versionId, operationId: null })),
    candidates,
    true,
    transport,
  );
  await runner.run('prepare');
  const prepared = runner.snapshot();
  assert(
    prepared.rows.every(
      (row) =>
        row.phase === 'ready' &&
        row.prepared?.plan.action === 'create_exercise',
    ),
  );
  const originalOperations = prepared.rows.map((row) => row.operationId);
  assert.equal(new Set(originalOperations).size, 3);
  assert.deepEqual(snapshot(marker.target, true), targetBefore);
  const page = await request(runner.checkpoint(), undefined, admin.jar);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert(html.includes('Copie source'));
  for (const candidate of candidates) assert(html.includes(candidate.title));
  for (const token of tokens.values()) assert(!html.includes(token));
  for (const candidate of candidates) runner.review(candidate.versionId, true);
  await note(
    'Actual controller and transport prepare three independent local diffs; authenticated batch SSR carries the selected identities without confirmation tokens or target writes',
  );
  await runner.run('confirm');
  const partial = runner.snapshot();
  assert.equal(lostResponse, true);
  assert.equal(partial.rows[0].operation?.state, 'committed');
  assert.equal(partial.rows[1].phase, 'verify');
  assert.equal(partial.rows[2].phase, 'ready');
  assert.equal(
    commands.filter((command) => command.action === 'confirm').length,
    2,
  );
  assert(partial.rows.every((row) => !row.reviewed));
  const afterTwo = snapshot(marker.target, true);
  assert.equal(
    afterTwo['public.exercises'].length,
    targetBefore['public.exercises'].length + 2,
  );
  assert.equal(
    afterTwo['public.exercise_versions'].length,
    targetBefore['public.exercise_versions'].length + 2,
  );
  const beforeRepeat = commands.length;
  await runner.run('confirm');
  assert.equal(commands.length, beforeRepeat);
  await note(
    'Closing the second real HTTP response after headers halts the batch before the third send; two target exercises exist and no unchecked automatic retry occurs',
  );
  const replay = await view.requestPublication(
    {
      action: 'confirm',
      operationId: originalOperations[0],
      confirmation: tokens.get(originalOperations[0]),
    },
    undefined,
    'local-fixture',
  );
  assert.equal(replay.state, 'committed');
  assert.deepEqual(snapshot(marker.target, true), afterTwo);
  const checkpoint = runner.checkpoint(),
    parsed = domain.parseBatchQuery(new URL(origin + checkpoint).searchParams);
  assert(parsed);
  assert.equal(parsed.batchId, batchId);
  assert.deepEqual(
    [...new Set(new URL(origin + checkpoint).searchParams.keys())].sort(),
    ['batch', 'version'],
  );
  runner.dispose();
  runner = new domain.PublicationBatch(
    parsed.batchId,
    parsed.items,
    candidates,
    true,
    transport,
  );
  assert(
    runner
      .snapshot()
      .rows.every((row) => row.prepared === null && !row.reviewed),
  );
  const beforeRecovery = commands.length;
  await runner.run('recover');
  assert.equal(commands.length - beforeRecovery, 3);
  assert(
    commands
      .slice(beforeRecovery)
      .every((command) => command.action === 'recover'),
  );
  const recovered = runner.snapshot();
  assert.equal(recovered.rows[0].operation?.state, 'committed');
  assert.equal(recovered.rows[1].operation?.state, 'committed');
  assert.equal(recovered.rows[2].operation?.state, 'planned');
  assert.deepEqual(snapshot(marker.target, true), afterTwo);
  await note(
    'A fresh controller reconstructed only from the URL observes all three durable operations without confirmation capabilities or target writes; repeated confirmation is idempotent',
  );
  await runner.run('cancel');
  assert.equal(runner.snapshot().rows[2].operation?.state, 'cancelled');
  assert.deepEqual(snapshot(marker.target, true), afterTwo);
  runner.replan(created[2].versionId);
  await runner.run('prepare');
  assert.equal(runner.snapshot().rows[2].phase, 'ready');
  assert.notEqual(runner.snapshot().rows[2].operationId, originalOperations[2]);
  assert.deepEqual(snapshot(marker.target, true), afterTwo);
  runner.review(created[2].versionId, true);
  await runner.run('confirm');
  const final = runner.snapshot();
  assert(final.rows.every((row) => row.operation?.state === 'committed'));
  await note(
    'Only the remaining plan is explicitly cancelled, freshly prepared, reviewed and confirmed; all three per-exercise outcomes are durable',
  );
  globalThis.fetch = nativeFetch;
  const targetAfter = snapshot(marker.target, true);
  preserve(targetBefore, targetAfter);
  preserve(sourceBefore, snapshot(state.names.db));
  for (const table of Object.keys(targetBefore))
    if (!['public.exercises', 'public.exercise_versions'].includes(table))
      assert.deepEqual(targetAfter[table], targetBefore[table], table);
  assert.equal(
    targetAfter['public.exercises'].length,
    targetBefore['public.exercises'].length + 3,
  );
  assert.equal(
    targetAfter['public.exercise_versions'].length,
    targetBefore['public.exercise_versions'].length + 3,
  );
  const projected = value(
    marker.target,
    `SELECT jsonb_agg(jsonb_build_object('catalogId',e.catalog_id::text,'exerciseId',e.id::text,'activeVersionId',e.active_version_id::text,
    'versionId',v.id::text,'revision',v.revision,'definition',v.definition,'origin',v.publication_origin,'createdBy',v.created_by,'approvedBy',v.approved_by,'status',v.editorial_status) ORDER BY e.catalog_id)
    FROM public.exercises e JOIN public.exercise_versions v ON v.exercise_id=e.id WHERE e.catalog_id IN (${candidates.map((candidate) => "'" + candidate.catalogId + "'::uuid").join(',')});`,
  );
  assert.equal(projected.length, 3);
  for (const candidate of candidates) {
    const imported = projected.find(
        (item) => item.catalogId === candidate.catalogId,
      ),
      result = final.rows.find(
        (row) => row.versionId === candidate.versionId,
      ).operation;
    const version = await readVersion(candidate.versionId);
    assert.equal(version.editorial_status, 'published');
    assert.equal(imported.exerciseId, result.outcome.exerciseId);
    assert.equal(imported.versionId, result.outcome.versionId);
    assert.equal(imported.activeVersionId, imported.versionId);
    assert.notEqual(imported.versionId, candidate.versionId);
    assert.equal(imported.revision, 1);
    assert.equal(imported.origin, 'transfer');
    assert.equal(imported.createdBy, null);
    assert.equal(imported.approvedBy, null);
    assert.equal(imported.status, 'published');
    assert.deepEqual(imported.definition, version.definition);
  }
  for (const receipt of receipts) {
    const retained = await admin.sdk
      .from('admin_exercise_test_runs')
      .select('payload,signature')
      .eq('id', receipt.id)
      .single();
    assert.equal(retained.error, null);
    assert.deepEqual(retained.data, {
      payload: receipt.payload,
      signature: receipt.signature,
    });
  }
  await store('target-after.json', targetAfter);
  const journal = await request('/admin/publication', undefined, admin.jar);
  assert.equal(journal.status, 200);
  const journalHtml = await journal.text();
  for (const row of final.rows) assert(journalHtml.includes(row.operationId));
  await note(
    'Exactly three new target exercises/revisions are published by stable catalogue identity; all 60 excluded tables, old rows, Auth histories and signed receipts retain their exact contents',
  );
  cleanupComplete = await closeClients();
  assert.equal(
    cleanupComplete,
    true,
    'Synthetic session cleanup was not confirmed',
  );
  const hashes = {};
  for (const file of [
    'scripts/test-publication-batch-http-local.mjs',
    'src/lib/publication-batch.ts',
    'src/lib/publication-view.ts',
    'src/app/admin/publication/batch/page.tsx',
    'src/components/publication-batch-panel.tsx',
    'tests/fixtures/preview-definition.json',
  ])
    hashes[file] = hash(await readFile(file));
  const proof = {
    result: 'PASS for local multi-exercise HTTP publication',
    date: new Date().toISOString(),
    artifact,
    checks,
    sourceHashes: hashes,
    sourceFixturesCreated: 3,
    accountsReused: true,
    newAccountsCreated: 0,
    realNext: true,
    realAuth: true,
    realPostgrest: true,
    nativeLinuxEngine: true,
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
    controllerAndTransportActualSources: true,
    batchId,
    sourceVersions: created.map((item) => item.versionId),
    receiptIds: receipts.map((item) => item.id),
    initialOperations: originalOperations,
    finalOperations: final.rows.map((row) => row.operationId),
    secondClientResponseClosedAfterHeaders: true,
    postgresCommitAcknowledgementLossSimulated: false,
    targetNewExercises: 3,
    targetNewVersions: 3,
    targetExcludedTablesExact: 60,
    preexistingSourceBusinessRowsPreserved: true,
    preexistingTargetRowsPreserved: true,
    confirmationsAbsentFromCheckpoint: true,
    runtimeLimitsChanged: false,
    sourceFixtureReviewSynthetic: true,
    syntheticCurrentCookieSessionsClosed: true,
    browserExecuted: false,
    humanAcceptance: false,
    strictStolenJwtRevocationTested: false,
    publicationOutsideLocalFixtureTested: false,
    remoteOperations: false,
  };
  await store('proof.json', proof);
  await writeFile(
    nativeMarker,
    JSON.stringify(
      { artifact, phase: 'qualified', proof: artifact + '/proof.json' },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact,
      checks: checks.length,
      targetExercisesAdded: 3,
      browserExecuted: false,
      remoteOperations: false,
    }),
  );
} catch (error) {
  await writeFile(artifact + '/failure.txt', safe(error?.stack ?? error));
  throw new Error(
    'Batch HTTP qualification failed; inspect retained operations and artifacts before another attempt: ' +
      artifact,
  );
} finally {
  globalThis.fetch = nativeFetch;
  if (!cleanupComplete) await closeClients();
}
