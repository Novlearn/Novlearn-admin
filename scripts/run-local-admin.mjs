// Development server for a previously verified, isolated local Auth workspace.
// Runtime state stays ignored. No .env file or operational project is edited.
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, watch } from 'node:fs/promises';
import { createServer } from 'node:http';
import { localAdminOptions } from './local-admin-options.mjs';
const options = localAdminOptions(process.argv.slice(2));
const artifact = path.resolve(options.workspace);
const localRoot = path.resolve('.local') + path.sep;
assert(artifact.toLowerCase().startsWith(localRoot.toLowerCase()));
assert.match(path.basename(artifact), /^local-admin-\d+$/);
const state = JSON.parse(
  await readFile(path.join(artifact, 'app-config.json'), 'utf8'),
);
assert.equal(state.artifact, artifact);
assert.equal(state.pending, undefined);
if (options.stop) {
  const runtime = JSON.parse(
    await readFile(path.join(artifact, 'app-runtime.json'), 'utf8'),
  );
  assert.equal(runtime.artifact, artifact);
  await writeFile(
    path.join(artifact, 'stop-app.json'),
    JSON.stringify({ nonce: runtime.controlNonce }) + '\n',
  );
  console.log('Local application stop requested; database retained.');
} else {
  // Clear public/operational Supabase settings only in this child process.
  // Next does not overwrite explicitly defined empty variables from .env files.
  for (const key of Object.keys(process.env))
    if (
      key.startsWith('ADMIN_PUBLICATION_') ||
      key.startsWith('ADMIN_LOCAL_PUBLICATION_') ||
      key.startsWith('ADMIN_STAGING_')
    )
      process.env[key] = '';
  Object.assign(process.env, state.authConfig, {
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    ADMIN_STAGING_AUTH_ENABLED: 'false',
    ADMIN_PUBLICATION_ENABLED: 'false',
    ADMIN_ENGINE_ENABLED: 'false',
    ADMIN_EDITORIAL_REVIEW_ENABLED: 'false',
  });
  const { readAuthConfiguration } = await import('../src/lib/auth/config.ts');
  assert.equal(readAuthConfiguration(process.env)?.local, true);
  // Clear inherited signing/transport settings; only explicit local files may enable them.
  for (const key of [
    'ADMIN_LOCAL_ENGINE_URL',
    'ADMIN_LOCAL_ENGINE_CAPABILITY',
    'ADMIN_TEST_SIGNING_KEY_ID',
    'ADMIN_TEST_SIGNING_KEY',
  ])
    process.env[key] = '';
  let engine;
  let signedReports = false;
  if (options.engine) {
    const { startLocalEngine } = await import('./local-engine.mjs');
    engine = await startLocalEngine(artifact);
    Object.assign(process.env, engine.environment);
    try {
      const signing = JSON.parse(
        await readFile(path.join(artifact, 'test-signing.json'), 'utf8'),
      );
      assert.equal(signing.artifact, artifact);
      const signingEnvironment = {
        ADMIN_TEST_SIGNING_KEY_ID: signing.id,
        ADMIN_TEST_SIGNING_KEY: signing.key,
      };
      assert.match(
        signing.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assert.match(signing.key, /^[0-9a-f]{64}$/);
      Object.assign(process.env, signingEnvironment);
      signedReports = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        await engine.close();
        throw error;
      }
    }
  }
  if (options.review) {
    if (!signedReports) {
      await engine.close();
      throw Error('Configure local receipt signing before enabling review');
    }
    process.env.ADMIN_EDITORIAL_REVIEW_ENABLED = 'true';
  }
  const next = (await import('next')).default;
  const app = next({
    dev: true,
    dir: process.cwd(),
    hostname: '127.0.0.1',
    port: 3150,
  });
  try {
    await app.prepare();
  } catch (error) {
    await engine?.close();
    throw error;
  }
  const handle = app.getRequestHandler();
  const server = createServer(
    (request, response) => void handle(request, response),
  );
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(3150, '127.0.0.1', resolve);
    });
  } catch (error) {
    await app.close();
    await engine?.close();
    throw error;
  }
  const { randomBytes } = await import('node:crypto');
  const controlNonce = randomBytes(24).toString('hex');
  await writeFile(
    path.join(artifact, 'app-runtime.json'),
    JSON.stringify(
      {
        artifact,
        processId: process.pid,
        origin: 'http://127.0.0.1:3150',
        controlNonce,
        local: true,
        database: true,
        engine: !!engine,
        review: options.review,
        ...(engine
          ? {
              engineContainer: engine.container,
              engineArtifact: engine.artifact,
            }
          : {}),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Local Admin ready: http://127.0.0.1:3150/ ; genuine Auth and local persistence; Linux Engine ' +
      (engine ? 'connected.' : 'disabled.'),
    'Local editorial review ' + (options.review ? 'enabled.' : 'disabled.'),
  );
  const controller = new AbortController();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    controller.abort();
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    await engine?.close();
    console.log('Local application stopped; database retained.');
    setImmediate(() => process.exit(0));
  };
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
  try {
    for await (const event of watch(artifact, { signal: controller.signal }))
      if (event.filename === 'stop-app.json') {
        let command;
        try {
          command = JSON.parse(
            await readFile(path.join(artifact, 'stop-app.json'), 'utf8'),
          );
        } catch (error) {
          if (error.name === 'SyntaxError' || error.code === 'ENOENT') continue;
          throw error;
        }
        if (command.nonce === controlNonce) {
          await close();
          break;
        }
      }
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  }
}
