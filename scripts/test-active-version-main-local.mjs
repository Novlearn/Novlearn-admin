// Existing main Admin account and actual retained target, read-only throughout.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const root = '.local/local-admin-1792143739689';
const state = await json(root + '/private.json');
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55431',
  'Only the retained local Auth fixture is permitted',
);
const runtime = await json(root + '/app-runtime.json');
assert.equal(runtime.activeVersion, true);
assert.equal(runtime.pedagogy, true);
const marker = await json('.local/lot1a/active-version-http-current.json');
assert.equal(marker.phase, 'qualified-http');
const reader = await json(marker.artifact + '/private.json');
const account = state.accounts.find((a) => a.kind === 'admin');
assert(account);
const artifact = path.resolve(marker.artifact + '/main-' + Date.now());
await mkdir(artifact);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const sql = (name, input) => {
  assert([state.names.db, reader.target].includes(name));
  const r = spawnSync(
    docker,
    [
      '--host',
      'npipe:////./pipe/dockerDesktopLinuxEngine',
      'exec',
      '-i',
      name,
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
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 33554432,
    },
  );
  assert.equal(r.status, 0, 'Retained SQL observation failed');
  return r.stdout.trim();
};
const value = (name, input) => JSON.parse(sql(name, input).split('\n').at(-1));
const snap =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const before = value(reader.target, snap),
  businessBefore = value(state.names.db, snap).rows;
const targetRows = value(
  reader.target,
  "SELECT jsonb_agg(jsonb_build_object('catalogId',e.catalog_id,'parentId',e.id::text,'activeId',e.active_version_id,'epoch',e.publication_epoch::text,'revision',v.revision,'sha',v.definition_sha256)) FROM public.exercises e LEFT JOIN public.exercise_versions v ON v.id=e.active_version_id WHERE e.catalog_id IS NOT NULL;",
);
const targetById = new Map(targetRows.map((p) => [p.catalogId, p]));
const jar = new Map(),
  checks = [];
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
      setAll: (items) => {
        for (const { name, value, options } of items) {
          if (!value || options?.maxAge === 0) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  },
);
const origin = 'http://127.0.0.1:3150';
const request = (url, auth = true) =>
  fetch(origin + url, {
    headers: auth
      ? { cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') }
      : {},
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
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
  checks.push('actual existing main Admin credentials/session without reset');
  const parents = await sdk
    .from('exercises')
    .select('id,catalog_id')
    .order('id')
    .limit(100);
  assert.equal(parents.error, null);
  assert(
    parents.data.length < 100,
    'Do not certify a truncated local catalogue',
  );
  const canonical = parents.data.filter(
    (p) =>
      typeof p.catalog_id === 'string' && /^[a-f0-9-]{36}$/.test(p.catalog_id),
  );
  assert(canonical.length);
  const selected =
    canonical.find((p) => targetById.has(p.catalog_id)) ?? canonical[0];
  const route = '/api/admin/exercises/' + selected.id + '/target-version';
  const response = await request(route);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /private/);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const payload = await response.json();
  assert.equal(payload.snapshot.catalogId, selected.catalog_id);
  assert.equal(payload.snapshot.environment, 'local-copy');
  const actual = targetById.get(selected.catalog_id);
  const expectedState = !actual
    ? 'absent'
    : actual.activeId
      ? 'active'
      : 'unpublished';
  assert.equal(payload.state.state, expectedState);
  if (actual) {
    assert.equal(payload.snapshot.parent.exerciseId, actual.parentId);
    assert.equal(payload.snapshot.parent.publicationEpoch, actual.epoch);
    if (actual.activeId) {
      assert.equal(payload.snapshot.active.versionId, actual.activeId);
      assert.equal(payload.snapshot.active.revision, actual.revision);
      assert.equal(payload.snapshot.active.definitionSha256, actual.sha);
    }
  } else {
    assert.equal(payload.snapshot.parent, null);
    assert.equal(payload.snapshot.active, null);
  }
  checks.push(
    'main API independently matches actual target metadata or genuine absence',
  );
  const anonymous = await request(route, false);
  await anonymous.arrayBuffer();
  assert.equal(anonymous.status, 401);
  checks.push('anonymous main reader is refused');
  const pageUrl = '/admin/exercises/' + selected.id;
  const page = await request(pageUrl),
    html = await page.text();
  assert.equal(page.status, 200);
  const card =
    html
      .match(
        /<section[^>]*aria-labelledby="active-target-title"[\s\S]*?<\/section>/,
      )?.[0]
      .replace(/<!--[\s\S]*?-->/g, '') ?? '';
  assert(card.includes('Version actuellement publiée'));
  assert(!card.includes('n’est pas encore activée'));
  assert(!card.includes('La cible est indisponible.'));
  if (expectedState === 'active')
    assert(card.includes('Version ' + actual.revision + ' active'));
  else if (expectedState === 'absent')
    assert(card.includes('Cet exercice est absent de la cible locale.'));
  for (const secret of [
    account.password,
    state.serviceKey,
    ...Object.values(state.secrets),
    new URL(reader.config.url).password,
  ])
    if (typeof secret === 'string' && secret.length >= 16)
      assert(!html.includes(secret), 'Private credential in main SSR');
  checks.push(
    'actual main SSR card shows the correct local observation without credentials',
  );
  const publication = await fetch(origin + '/api/admin/publication', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  await publication.arrayBuffer();
  assert.equal(publication.status, 503);
  checks.push('enabling metadata reading does not enable ordinary publication');
  for (const url of [
    '/admin',
    '/admin/statistics',
    '/admin/statistics/pedagogy?from=2026-10-15&to=2026-10-17',
  ]) {
    const r = await request(url);
    await r.arrayBuffer();
    assert.equal(r.status, 200);
  }
  checks.push('dashboard and connected statistics remain available');
  assert.deepEqual(value(reader.target, snap), before);
  const businessAfter = value(state.names.db, snap).rows;
  for (const [t, rows] of Object.entries(businessBefore))
    if (!t.startsWith('auth.')) assert.deepEqual(businessAfter[t], rows, t);
  checks.push(
    'all target data/metadata and main business rows exact throughout the read-only test',
  );
  const configs = (
    await json('.local/lot1a/publication-http-restart-baseline.json')
  ).hashes;
  for (const [f, h] of Object.entries(configs))
    assert.equal(
      createHash('sha256')
        .update(await readFile(f))
        .digest('hex'),
      h,
      f,
    );
  assert.equal((await sdk.auth.signOut({ scope: 'local' })).error, null);
  const proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    artifact,
    actualExistingAdminAuth: true,
    origin,
    target: reader.target,
    containerId: reader.containerId,
    sourceExerciseId: String(selected.id),
    observedState: expectedState,
    activeRevision: payload.snapshot.active?.revision ?? null,
    page: origin + pageUrl,
    checks,
    privateConfigurationsExact: 8,
    currentProcessId: runtime.processId,
    currentEngineContainer: runtime.engineContainer,
    newSessionClosed: true,
    mainPublicationStatus: 503,
    allTargetRowsSequencesMetadataExact: true,
    mainBusinessRowsExact: true,
    browserExecuted: false,
    remoteOperations: false,
  };
  await writeFile(
    artifact + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    marker.artifact + '/main-proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      observedState: expectedState,
      page: proof.page,
      artifact,
    }),
  );
} catch (e) {
  let message = String(e.stack ?? e);
  for (const secret of [
    account.password,
    state.serviceKey,
    ...Object.values(state.secrets),
    new URL(reader.config.url).password,
  ])
    if (typeof secret === 'string' && secret.length)
      message = message.replaceAll(secret, '[local secret]');
  await writeFile(artifact + '/failure.txt', message);
  throw Error('Main reader qualification failed; inspect ' + artifact);
} finally {
  await sdk.auth.signOut({ scope: 'local' });
}
