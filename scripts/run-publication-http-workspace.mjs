// Full Next test instance in an ignored source copy. It cannot read a linked
// Supabase project or enable the ordinary/operational publication settings.
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  readFile,
  writeFile,
  mkdir,
  cp,
  symlink,
  access,
  watch,
  readdir,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, createHash, X509Certificate } from 'node:crypto';
import { startLocalEngine } from './local-engine.mjs';
import { readAuthConfiguration } from '../src/lib/auth/config.ts';
import { localPublicationOptions } from './local-admin-options.mjs';
import {
  disabledActiveVersionEnvironment,
  localActiveVersionEnvironment,
} from './local-active-version.mjs';
const options = localPublicationOptions(process.argv.slice(2));
const workspace = options.workspace;
const artifact = path.resolve(workspace ?? '');
assert(
  artifact
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(artifact), /^local-admin-publication-\d+$/);
const state = JSON.parse(await readFile(artifact + '/app-config.json', 'utf8'));
assert.equal(state.artifact, artifact);
assert.equal(state.publicationFixture, true);
assert.equal(state.schemaVersion, 64);
if (options.stop) {
  const runtime = JSON.parse(
    await readFile(artifact + '/app-runtime.json', 'utf8'),
  );
  assert.equal(runtime.artifact, artifact);
  assert.equal(runtime.origin, 'http://127.0.0.1:3152');
  await writeFile(
    artifact + '/stop-app.json',
    JSON.stringify({ nonce: runtime.controlNonce }) + '\n',
  );
  console.log(
    'Dedicated local application stop requested; all databases retained.',
  );
} else {
  for (const key of Object.keys(process.env))
    if (key.startsWith('ADMIN_')) process.env[key] = '';
  Object.assign(process.env, state.authConfig, {
    ...disabledActiveVersionEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    ADMIN_STAGING_AUTH_ENABLED: 'false',
    ADMIN_PUBLICATION_ENABLED: 'false',
  });
  if (options.activeVersion)
    Object.assign(process.env, await localActiveVersionEnvironment());
  assert.equal(
    readAuthConfiguration(process.env)?.localPublicationFixture,
    true,
  );
  const marker = JSON.parse(
    await readFile(artifact + '/publication-pg.json', 'utf8'),
  );
  assert.equal(marker.artifact, artifact);
  assert(
    path
      .resolve(marker.directory)
      .toLowerCase()
      .startsWith((artifact + path.sep).toLowerCase()),
  );
  const pg = JSON.parse(await readFile(marker.privateFile, 'utf8'));
  assert.equal(pg.artifact, artifact);
  for (const [side, port, login] of [
    ['source', '55433', 'novlearn_admin_journal_service'],
    ['target', '55434', 'novlearn_admin_publication_service'],
  ]) {
    const u = new URL(pg.config[side].url);
    assert.equal(u.hostname, '127.0.0.1');
    assert.equal(u.port, port);
    assert.equal(u.pathname, '/admin_local');
    assert.equal(u.username, login);
    assert.equal(u.search, '');
    assert.equal(u.hash, '');
    const cert = new X509Certificate(pg.config[side].ca);
    assert(Date.parse(cert.validTo) > Date.now());
    assert.equal(cert.checkIP('127.0.0.1'), '127.0.0.1');
  }
  const signing = JSON.parse(
      await readFile(artifact + '/test-signing.json', 'utf8'),
    ),
    confirmation = JSON.parse(
      await readFile(artifact + '/publication-signing.json', 'utf8'),
    );
  for (const s of [signing, confirmation]) {
    assert.equal(s.artifact, artifact);
    assert.match(s.key, /^[0-9a-f]{64}$/);
  }
  assert.match(signing.id, /^[0-9a-f-]{36}$/);
  assert.notEqual(signing.key, confirmation.key);
  Object.assign(process.env, {
    ADMIN_LOCAL_PUBLICATION_ENABLED: 'true',
    ADMIN_LOCAL_PUBLICATION_REVIEW: 'isolated-sql64-http-fixture-v1',
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_URL: pg.config.source.url,
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_CA: pg.config.source.ca,
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL: pg.config.target.url,
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_CA: pg.config.target.ca,
    ADMIN_LOCAL_PUBLICATION_CONFIRMATION_KEY: confirmation.key,
    ADMIN_TEST_SIGNING_KEY_ID: signing.id,
    ADMIN_TEST_SIGNING_KEY: signing.key,
    ADMIN_EDITORIAL_REVIEW_ENABLED: 'true',
  });
  const application = artifact + '/application-' + Date.now();
  await mkdir(application);
  const hashes = {};
  for (const name of [
    'src',
    'public',
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    'postcss.config.mjs',
    'tailwind.config.ts',
  ]) {
    try {
      await access(name);
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      throw e;
    }
    await cp(name, path.join(application, name), { recursive: true });
    if (name === 'src')
      for (const f of await readdir('src', { recursive: true })) {
        if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
        const a = await readFile(path.join('src', f)),
          b = await readFile(path.join(application, 'src', f));
        assert(a.equals(b));
        hashes['src/' + f.replaceAll('\\', '/')] = createHash('sha256')
          .update(a)
          .digest('hex');
      }
  }
  await symlink(
    path.resolve('node_modules'),
    application + '/node_modules',
    'junction',
  );
  await writeFile(
    application + '/next-env.d.ts',
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
  );
  await writeFile(
    artifact + '/application-source-hashes.json',
    JSON.stringify(
      { application, date: new Date().toISOString(), hashes },
      null,
      2,
    ) + '\n',
  );
  const engine = await startLocalEngine(artifact, { publicationFixture: true });
  Object.assign(process.env, engine.environment);
  const next = (await import('next')).default;
  const app = next({
    dev: true,
    dir: application,
    hostname: '127.0.0.1',
    port: 3152,
  });
  let server;
  try {
    await app.prepare();
    const handle = app.getRequestHandler();
    server = createServer((req, res) => void handle(req, res));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(3152, '127.0.0.1', resolve);
    });
  } catch (e) {
    await app.close();
    await engine.close();
    throw e;
  }
  const controlNonce = randomBytes(24).toString('hex');
  await writeFile(
    artifact + '/app-runtime.json',
    JSON.stringify(
      {
        artifact,
        application,
        processId: process.pid,
        origin: 'http://127.0.0.1:3152',
        controlNonce,
        local: true,
        publicationFixture: true,
        activeVersion: options.activeVersion,
        engine: true,
        engineContainer: engine.container,
        engineArtifact: engine.artifact,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Dedicated local publication application ready: http://127.0.0.1:3152/ ; synthetic source/target only.',
  );
  const controller = new AbortController();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    controller.abort();
    await new Promise((r) => server.close(r));
    await app.close();
    await engine.close();
    console.log('Dedicated application stopped; fixture databases retained.');
    setImmediate(() => process.exit(0));
  };
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
  try {
    for await (const event of watch(artifact, { signal: controller.signal }))
      if (event.filename === 'stop-app.json') {
        let c;
        try {
          c = JSON.parse(await readFile(artifact + '/stop-app.json', 'utf8'));
        } catch (e) {
          if (e.code === 'ENOENT' || e.name === 'SyntaxError') continue;
          throw e;
        }
        if (c.nonce === controlNonce) {
          await close();
          break;
        }
      }
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
}
