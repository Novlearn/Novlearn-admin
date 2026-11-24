import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalEngine } from './local-engine.mjs';

const host = '127.0.0.1';
const port = 3150;
const origin = `http://${host}:${port}`;
const root = fileURLToPath(new URL('../', import.meta.url));
const checkOnly = process.argv[2] === '--check';

async function verifyEngine(environment) {
  const run = async (operation, payload) => {
    const requestId = randomUUID();
    const response = await fetch(environment.ADMIN_LOCAL_ENGINE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${environment.ADMIN_LOCAL_ENGINE_CAPABILITY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        protocolVersion: 1,
        requestId,
        operation,
        payload,
      }),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.requestId, requestId);
    assert.equal(result.ok, true, `Échec Engine local : ${operation}`);
    return result.value;
  };
  const definition = JSON.parse(
    await readFile('examples/engine-consumer/definition.json', 'utf8'),
  );
  const official = await run('instantiateExercise', {
    definition,
    seed: 42,
    instanceId: 'local-engine-preflight',
  });
  assert.equal(official.ok, true, 'Instanciation locale invalide.');
  const view = await run('projectPublicInstance', { official: official.value });
  assert.equal(view.instanceId, 'local-engine-preflight');
  assert.ok(view.elements.length);
  console.log('Engine local vérifié : validation, génération et aperçu élève.');
}

async function main() {
  assert.equal(
    process.platform,
    'win32',
    'Ce lanceur utilise Docker Desktop sur Windows.',
  );
  assert.notEqual(process.env.VERCEL, '1');
  assert.ok(
    process.argv.length === 2 || (checkOnly && process.argv.length === 3),
  );
  process.chdir(root);
  const artifact = path.resolve('.local', `engine-dev-${Date.now()}`);
  await mkdir(artifact, { recursive: true });
  const engine = await startLocalEngine(artifact);
  let app, server;
  try {
    await verifyEngine(engine.environment);
    if (checkOnly) return;

    Object.assign(process.env, engine.environment, {
      NODE_ENV: 'development',
      APP_BASE_URL: origin,
      ADMIN_STAGING_LOCAL_ENGINE_ENABLED: 'true',
      ENGINE_URL: '',
    });
    const { default: next } = await import('next');
    const { default: config } = await import('../next.config.ts');
    const nextDir = '.local/engine-next';
    await mkdir(nextDir, { recursive: true });
    const tsconfigPath = `${nextDir}/tsconfig.json`;
    await writeFile(
      tsconfigPath,
      JSON.stringify({ extends: '../../tsconfig.json' }),
    );
    app = next({
      dev: true,
      dir: root,
      hostname: host,
      port,
      conf: {
        ...config,
        distDir: `${nextDir}/build`,
        typescript: { tsconfigPath },
      },
    });
    await app.prepare();
    const handler = app.getRequestHandler();
    server = createServer(
      (request, response) => void handler(request, response),
    );
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
    console.log(`NovLearn Admin avec Engine local : ${origin}/login`);
    await new Promise((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await app?.close().catch(() => {});
    await engine.close();
  }
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
