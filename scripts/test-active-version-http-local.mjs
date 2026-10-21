// Genuine Next/Auth/REST and metadata-only target read on the retained fixture.
// Only new labelled Auth accounts are provisioned. No target data is changed.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { LOCAL_PUBLICATION_AUTH_COOKIE } from '../src/lib/auth/config.ts';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
const [flag, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert(flag === undefined || flag === '--recheck');
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const markerFile = '.local/lot1a/active-version-http-current.json';
const marker = await json(markerFile);
assert.equal(
  marker.phase,
  flag === '--recheck' ? 'qualified-http' : 'qualified-pg',
);
const state = await json(
  '.local/local-admin-publication-1792259029889/private.json',
);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55432',
  'Only the retained local Auth fixture is permitted',
);
const runtime = await json(
  '.local/local-admin-publication-1792259029889/app-runtime.json',
);
assert.equal(runtime.activeVersion, true);
const reader = await json(marker.artifact + '/private.json');
assert.equal(reader.physicalConnectionQualified, true);
const artifact = path.resolve(marker.artifact + '/http-' + Date.now());
await mkdir(artifact);
const origin = 'http://127.0.0.1:3152',
  accounts = [],
  clients = [],
  checks = [];
const secrets = [
  state.serviceKey,
  state.anonKey,
  ...Object.values(state.secrets),
  decodeURIComponent(new URL(reader.config.url).password),
];
const redact = (v) =>
  secrets.reduce((s, k) => s.replaceAll(k, '[local secret]'), String(v));
const save = (name, v) =>
  writeFile(artifact + '/' + name, JSON.stringify(v, null, 2) + '\n');
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
  assert.equal(r.status, 0, 'Local fixture SQL failed; output withheld');
  return r.stdout.trim();
};
const value = (name, q) => JSON.parse(sql(name, q).split('\n').at(-1));
const snapshotSql =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const targetBefore = value(reader.target, snapshotSql),
  sourceBefore = value(state.names.db, snapshotSql);
const previous = await json(
  'docs/archives/active-version-target-local-proof.json',
);
const transfer = await json(previous.publicationHttp.rawProof);
const source = value(
  state.names.db,
  `SELECT jsonb_build_object('id',e.id::text,'catalogId',e.catalog_id,'versions',(SELECT jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'sha',v.definition_sha256) ORDER BY v.revision) FROM public.exercise_versions v WHERE v.exercise_id=e.id)) FROM public.exercises e WHERE e.catalog_id='${transfer.targetCatalogId}'::uuid;`,
);
assert.equal(source.versions.length, 2);
const parent = value(
  reader.target,
  `SELECT jsonb_build_object('id',e.id::text,'activeVersionId',e.active_version_id,'epoch',e.publication_epoch::text,'revision',v.revision,'sha',v.definition_sha256,'latest',(SELECT max(x.revision) FROM public.exercise_versions x WHERE x.exercise_id=e.id)) FROM public.exercises e JOIN public.exercise_versions v ON v.id=e.active_version_id WHERE e.catalog_id='${source.catalogId}'::uuid;`,
);
assert.equal(parent.revision, 1);
assert.equal(parent.latest, 2);
const route = '/api/admin/exercises/' + source.id + '/target-version';
const sdkFor = () => {
  const jar = new Map();
  const sdk = createServerClient(
    state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
    state.anonKey,
    {
      cookieOptions: {
        name: LOCAL_PUBLICATION_AUTH_COOKIE,
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
  clients.push(sdk);
  return { sdk, jar };
};
const request = async (url, jar) =>
  fetch(origin + url, {
    headers: jar
      ? { cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') }
      : {},
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
  });
const api = async (url, jar, status) => {
  const r = await request(url, jar);
  const text = await r.text();
  assert.equal(r.status, status, url);
  assert.match(r.headers.get('cache-control') ?? '', /private/);
  assert.match(r.headers.get('cache-control') ?? '', /no-store/);
  assert(!text.includes(new URL(reader.config.url).password));
  return JSON.parse(text);
};
let revoked = false,
  readerClosed = false;
try {
  assert.equal((await request('/login')).status, 200);
  for (const kind of ['admin', 'user']) {
    const password = randomBytes(24).toString('base64url');
    secrets.push(password);
    const email = `active-version-${kind}-${Date.now()}@novlearn-admin.local.invalid`;
    const r = await fetch(
      state.authConfig.ADMIN_LOCAL_SUPABASE_URL + '/auth/v1/admin/users',
      {
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
            first_name: 'TEST VERSION CIBLE LOCAL',
            birth_date: '2000-01-01',
            ...(kind === 'user' ? { role: 'admin' } : {}),
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.match(data.id, /^[a-f0-9-]{36}$/);
    accounts.push({ kind, id: data.id, email, password });
    await save('accounts-private.json', { accounts });
    if (kind === 'admin')
      sql(
        state.names.db,
        `UPDATE public.profiles SET role='admin' WHERE id='${data.id}';`,
      );
  }
  const admin = sdkFor(),
    user = sdkFor();
  for (const [entry, client] of [
    [accounts[0], admin],
    [accounts[1], user],
  ])
    assert.equal(
      (
        await client.sdk.auth.signInWithPassword({
          email: entry.email,
          password: entry.password,
        })
      ).error,
      null,
    );
  assert.equal((await request('/api/admin/session', admin.jar)).status, 200);
  checks.push(
    'fresh real Admin session using only a newly labelled synthetic account',
  );
  await api(route, undefined, 401);
  await api(route, user.jar, 403);
  checks.push(
    'unauthenticated and metadata-spoofing non-Admin requests refused with private no-store responses',
  );
  const first = await api(route, admin.jar, 200);
  assert.deepEqual(Object.keys(first).sort(), [
    'comparison',
    'snapshot',
    'state',
  ]);
  assert.equal(first.snapshot.catalogId, source.catalogId);
  assert.equal(first.snapshot.environment, 'local-copy');
  assert.equal(first.state.state, 'active');
  assert.equal(first.snapshot.active.revision, 1);
  assert.equal(first.snapshot.active.versionId, parent.activeVersionId);
  assert.equal(first.snapshot.parent.publicationEpoch, parent.epoch);
  assert.equal(first.snapshot.active.definitionSha256, parent.sha);
  assert.equal(first.comparison, 'not-comparable');
  for (const forbidden of [
    'definitionJson',
    'expectedLatex',
    'email',
    'actor_id',
    'payload',
    'signature',
  ])
    assert(!JSON.stringify(first).includes('"' + forbidden + '"'));
  checks.push(
    'actual target pointer metadata is minimal, labelled local, and revision 1 while MAX revision is 2',
  );
  const v1 = await api(
      route + '?version=' + source.versions[0].id,
      admin.jar,
      200,
    ),
    v2 = await api(route + '?version=' + source.versions[1].id, admin.jar, 200);
  assert.equal(v1.comparison, 'same-version');
  assert.equal(v2.comparison, 'different-revision');
  checks.push(
    'selected source versions compare by revision/content/contract without treating technical UUIDs as shared',
  );
  for (const query of [
    '?target=production',
    '?catalogId=' + source.catalogId,
    '?version=invalid',
    '?version=' + source.versions[0].id + '&version=' + source.versions[0].id,
  ])
    await api(route + query, admin.jar, 400);
  await api('/api/admin/exercises/not-an-id/target-version', admin.jar, 400);
  await api(
    '/api/admin/exercises/999999999999999/target-version',
    admin.jar,
    404,
  );
  const foreign = value(
    state.names.db,
    `SELECT to_jsonb(id) FROM public.exercise_versions WHERE exercise_id<>${source.id} ORDER BY exercise_id LIMIT 1;`,
  );
  assert(foreign);
  await api(route + '?version=' + foreign, admin.jar, 404);
  checks.push(
    'target/identity injection, invalid selections, missing parent and cross-parent source version refused',
  );
  const targetIds = new Set(
    value(
      reader.target,
      'SELECT jsonb_agg(catalog_id::text) FROM public.exercises WHERE catalog_id IS NOT NULL;',
    ),
  );
  const candidates = value(
    state.names.db,
    "SELECT jsonb_agg(jsonb_build_object('id',id::text,'catalogId',catalog_id)) FROM public.exercises;",
  );
  const absent = candidates.find(
    (p) => p.catalogId && !targetIds.has(p.catalogId),
  );
  assert(
    absent,
    'A genuine unpublished source parent must exist for the absence case',
  );
  const absentResponse = await api(
    '/api/admin/exercises/' + absent.id + '/target-version',
    admin.jar,
    200,
  );
  assert.equal(absentResponse.state.state, 'absent');
  assert.equal(absentResponse.snapshot.parent, null);
  checks.push(
    'actual source parent with no target catalogue is reported absent',
  );
  const legacy = candidates.find((p) => !p.catalogId);
  if (legacy)
    await api(
      '/api/admin/exercises/' + legacy.id + '/target-version',
      admin.jar,
      409,
    );
  const second = await api(route, admin.jar, 200);
  assert(second.snapshot.asOf > first.snapshot.asOf);
  assert.deepEqual(second.snapshot.active, first.snapshot.active);
  checks.push(
    'repeated GET refresh obtains a new observation time without reusing a publication receipt',
  );
  const pageUrl =
    '/admin/exercises/' +
    source.id +
    '?version=' +
    source.versions[0].id +
    '&compare=' +
    source.versions[1].id +
    '&history=1';
  const page = await request(pageUrl, admin.jar),
    html = await page.text();
  assert.equal(page.status, 200);
  const cardText = (markup) =>
    markup
      .match(
        /<section[^>]*aria-labelledby="active-target-title"[\s\S]*?<\/section>/,
      )?.[0]
      .replace(/<!--[\s\S]*?-->/g, '') ?? '';
  assert(cardText(html).includes('Version 1 active'));
  assert(html.includes('Version actuellement publiée'));
  assert(html.includes('copie locale'));
  assert(html.includes('name="version"'));
  assert(html.includes(source.versions[0].id));
  assert(html.includes('name="compare"'));
  assert(html.includes(source.versions[1].id));
  checks.push(
    'real SSR detail card displays rollback pointer, comparison and refresh selections',
  );
  const scripts = [
    ...new Set(
      [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) =>
        m[1].replaceAll('&amp;', '&'),
      ),
    ),
  ];
  assert(scripts.length);
  for (const url of scripts) {
    const u = new URL(url, origin);
    assert.equal(u.origin, origin);
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200);
    const js = await r.text();
    for (const secret of secrets.filter(
      (v) => typeof v === 'string' && v.length >= 16,
    ))
      assert(
        !js.includes(secret),
        'Private local value leaked in client script',
      );
  }
  for (const secret of secrets.filter(
    (v) => typeof v === 'string' && v.length >= 16,
  ))
    assert(!html.includes(secret), 'Private local value leaked in server HTML');
  for (const url of [
    '/scripts/active-version-query.sql',
    '/scripts/active-version-reader-audit.sql',
    '/.local/lot1a/' + path.basename(marker.artifact) + '/private.json',
  ]) {
    const r = await request(url);
    await r.arrayBuffer();
    assert.equal(r.status, 404);
  }
  checks.push(
    'served client bundles and SSR contain none of the tested secrets; private SQL/config paths return 404',
  );
  sql(
    reader.target,
    'ALTER ROLE novlearn_admin_active_version_service NOLOGIN;',
  );
  readerClosed = true;
  const unavailable = await api(route, admin.jar, 503);
  assert.deepEqual(unavailable, { error: 'Version publiée indisponible.' });
  assert(!JSON.stringify(unavailable).includes('absent'));
  const unavailablePage = await request(pageUrl, admin.jar);
  const unavailableHtml = await unavailablePage.text();
  assert.equal(unavailablePage.status, 200);
  assert(unavailableHtml.includes('La cible est indisponible.'));
  assert(!cardText(unavailableHtml).includes('Version 1 active'));
  sql(reader.target, 'ALTER ROLE novlearn_admin_active_version_service LOGIN;');
  readerClosed = false;
  assert.equal((await api(route, admin.jar, 200)).state.state, 'active');
  checks.push(
    'revoked reader login fails closed as unavailable, never absent, and recovers after restoration',
  );
  sql(
    state.names.db,
    `UPDATE public.profiles SET role='user' WHERE id='${accounts[0].id}';`,
  );
  revoked = true;
  await api(route, admin.jar, 403);
  const deniedPage = await request(pageUrl, admin.jar);
  await deniedPage.arrayBuffer();
  assert.equal(deniedPage.status, 307);
  assert(
    new URL(deniedPage.headers.get('location'), origin).pathname ===
      '/access-denied',
  );
  sql(
    state.names.db,
    `UPDATE public.profiles SET role='admin' WHERE id='${accounts[0].id}';`,
  );
  revoked = false;
  await api(route, admin.jar, 200);
  checks.push(
    'existing session loses API and page access immediately when only the new fixture Admin is revoked',
  );
  assert.deepEqual(
    value(reader.target, snapshotSql),
    targetBefore,
    'Every target row, sequence, permission and credential stays exact',
  );
  const after = value(state.names.db, snapshotSql);
  for (const [table, hashes] of Object.entries(sourceBefore.rows)) {
    if (table.startsWith('auth.')) continue;
    for (const hash of hashes)
      assert(
        after.rows[table].includes(hash),
        'Preexisting source business row changed: ' + table,
      );
  }
  checks.push(
    'all target rows/sequences/metadata exact and preexisting source business rows preserved',
  );
  for (const client of clients)
    assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
  const sourceHashes = {};
  for (const f of [
    'scripts/test-active-version-http-local.mjs',
    'scripts/local-active-version.mjs',
    'scripts/local-admin-options.mjs',
    'scripts/run-publication-http-workspace.mjs',
    'src/app/api/admin/exercises/[id]/target-version/route.ts',
    'src/app/admin/exercises/[id]/page.tsx',
    'src/components/active-version-card.tsx',
    'src/lib/active-version-server.ts',
  ])
    sourceHashes[f] = createHash('sha256')
      .update(await readFile(f))
      .digest('hex');
  const proof = {
    result: 'PASS',
    at: new Date().toISOString(),
    actualAdminAuth: true,
    target: reader.target,
    containerId: reader.containerId,
    artifact,
    checks,
    selectedSourceExerciseId: source.id,
    targetCatalogId: source.catalogId,
    activeRevision: 1,
    latestRevision: 2,
    privateClientScriptsScanned: scripts.length,
    legacyIdentityCaseExecuted: !!legacy,
    allTargetRowsSequencesAndMetadataExact: true,
    preexistingSourceBusinessRowsPreserved: true,
    newSyntheticAccountsOnly: true,
    sessionsClosed: true,
    sourceHashes,
    browserExecuted: false,
    remoteOperations: false,
  };
  await save('proof.json', proof);
  const publicProof = path.resolve(marker.artifact + '/http-proof.json');
  await writeFile(publicProof, JSON.stringify(proof, null, 2) + '\n');
  await writeFile(
    markerFile,
    JSON.stringify(
      {
        ...marker,
        phase: 'qualified-http',
        httpProof: publicProof,
        httpProofSha256: createHash('sha256')
          .update(await readFile(publicProof))
          .digest('hex'),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      checks: checks.length,
      activeRevision: 1,
      latestRevision: 2,
      artifact,
      phase: 'qualified-http',
    }),
  );
} catch (e) {
  await writeFile(artifact + '/failure.txt', redact(e.stack ?? e));
  throw Error('Active-version HTTP qualification failed; inspect ' + artifact);
} finally {
  if (readerClosed)
    sql(
      reader.target,
      'ALTER ROLE novlearn_admin_active_version_service LOGIN;',
    );
  if (revoked)
    sql(
      state.names.db,
      `UPDATE public.profiles SET role='admin' WHERE id='${accounts[0].id}';`,
    );
  for (const client of clients) await client.auth.signOut({ scope: 'local' });
}
