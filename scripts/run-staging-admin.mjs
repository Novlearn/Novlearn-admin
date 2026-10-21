// Local frontend using genuine Staging Auth/data; no Docker dependency.
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, watch } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

async function runStagingAdmin() {
  const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  process.chdir(root);
  const config = JSON.parse(
    await readFile('.local/staging-admin-config.json', 'utf8'),
  );
  const artifact = path.resolve(config.artifact);
  assert(artifact.startsWith(path.resolve('.local') + path.sep));
  assert.match(path.basename(artifact), /^staging-admin-\d+$/);
  assert(
    process.argv.length === 2 ||
      (process.argv.length === 3 && process.argv[2] === '--stop'),
  );
  let runtime;
  try {
    runtime = JSON.parse(
      await readFile(path.join(artifact, 'app-runtime.json'), 'utf8'),
    );
    assert.equal(runtime.artifact, artifact);
    assert.equal(runtime.projectRef, 'tksvbkvfusrnxulpahky');
    process.kill(runtime.processId, 0);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
    runtime = null;
  }
  if (process.argv[2] === '--stop') {
    if (runtime)
      await writeFile(
        path.join(artifact, 'stop-app.json'),
        JSON.stringify({ nonce: runtime.controlNonce }) + '\n',
      );
    return;
  }
  if (runtime) {
    const health = await fetch('http://127.0.0.1:3150/login', {
      signal: AbortSignal.timeout(15000),
    });
    await health.arrayBuffer();
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('x-novlearn-environment'), 'staging');
    console.log(
      'NovLearn Admin disponible : http://127.0.0.1:3150/login — Supabase Staging.',
    );
    return;
  }
  const reviewPath = 'docs/archives/staging-sql-qualification-2026-10-21.json';
  const reviewBytes = await readFile(reviewPath);
  const digest = createHash('sha256').update(reviewBytes).digest('hex');
  assert.equal(
    config.reviewSha256,
    digest,
    'La qualification Staging a changé.',
  );
  const review = JSON.parse(reviewBytes);
  assert.equal(review.projectRef, 'tksvbkvfusrnxulpahky');
  assert.equal(review.migrationVersion, '20261021120707');
  assert.equal(review.sqlAssertions, 286);
  assert.equal(review.backupRoundTripVerified, true);
  assert.equal(review.remoteDataPreserved, true);
  assert.equal(review.applied, true);
  const env = parseEnv(await readFile('.env', 'utf8'));
  assert.equal(
    env.NEXT_PUBLIC_SUPABASE_URL,
    'https://tksvbkvfusrnxulpahky.supabase.co',
  );
  assert(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'),
  );
  for (const key of Object.keys(process.env))
    if (key.startsWith('ADMIN_')) process.env[key] = '';
  Object.assign(process.env, {
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_BASE_URL: 'http://127.0.0.1:3150',
    ADMIN_STAGING_AUTH_ENABLED: 'true',
    ADMIN_STAGING_SECURITY_REVIEW: reviewPath + '#sha256=' + digest,
    ADMIN_STAGING_LOCAL_ENGINE_ENABLED: 'false',
    ADMIN_ENGINE_ENABLED: 'false',
    ADMIN_PUBLICATION_ENABLED: 'false',
    ADMIN_EDITORIAL_REVIEW_ENABLED: 'false',
  });
  const { readAuthConfiguration } = await import('../src/lib/auth/config.ts');
  assert.equal(readAuthConfiguration(process.env)?.local, undefined);
  assert.equal(
    readAuthConfiguration(process.env)?.supabaseUrl,
    env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const response = await fetch(
    env.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/settings',
    {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    },
  );
  await response.arrayBuffer();
  assert.equal(response.status, 200, 'Supabase Staging ne répond pas.');
  const next = (await import('next')).default;
  const app = next({ dev: true, dir: root, hostname: '127.0.0.1', port: 3150 });
  let server;
  try {
    await app.prepare();
    const handle = app.getRequestHandler();
    server = createServer((request, result) => {
      result.setHeader('x-novlearn-environment', 'staging');
      void handle(request, result);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(3150, '127.0.0.1', resolve);
    });
  } catch (error) {
    await app.close();
    throw error;
  }
  const controlNonce = randomBytes(24).toString('hex');
  await writeFile(
    path.join(artifact, 'app-runtime.json'),
    JSON.stringify(
      {
        artifact,
        processId: process.pid,
        origin: 'http://127.0.0.1:3150',
        controlNonce,
        local: false,
        projectRef: review.projectRef,
        reviewSha256: digest,
        signedReports: false,
        engine: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'NovLearn Admin prêt : http://127.0.0.1:3150/login — comptes et données Supabase Staging.',
  );
  const controller = new AbortController();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    controller.abort();
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    process.exitCode = 0;
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

await runStagingAdmin();
