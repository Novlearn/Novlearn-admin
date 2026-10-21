// Resume existing local services only. Never creates a database or a volume.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

try {
  assert.equal(
    process.platform,
    'win32',
    'Ce lanceur utilise Docker Desktop Windows.',
  );
  assert(
    process.argv.length === 2 ||
      (process.argv.length === 3 && process.argv[2] === '--check'),
    'Option inconnue.',
  );
  const checkOnly = process.argv[2] === '--check';
  const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  process.chdir(root);
  const workspace = path.join(root, '.local/local-admin-1792143739689');
  const state = JSON.parse(await readFile(workspace + '/private.json', 'utf8'));
  const names = ['db', 'auth', 'rest', 'api'].map((kind) => {
    const name = state.names[kind];
    assert.equal(name, `novlearn-admin-local-1792143739689-${kind}`);
    return name;
  });
  const docker = path.join(
    process.env.LOCALAPPDATA,
    'Programs/DockerDesktop/resources/bin/docker.exe',
  );
  const cli = (args) => {
    const result = spawnSync(
      docker,
      ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    assert.equal(
      result.status,
      0,
      'Démarre Docker Desktop. Si un service local manque, conserve les sauvegardes et demande sa restauration ; ce lanceur ne le recrée pas.',
    );
    return result.stdout;
  };
  // Inspect every service before starting any of them.
  const services = JSON.parse(cli(['inspect', ...names]));
  assert.equal(services.length, 4);
  const db = services.find((service) => service.Name === '/' + names[0]);
  assert(
    db.Mounts.some(
      (mount) =>
        mount.Type === 'volume' &&
        mount.Name ===
          'novlearn-admin-cleanup-main-recovery-1792577428923-data' &&
        mount.Destination === '/var/lib/postgresql/data',
    ),
    'Le volume récupéré attendu manque ; aucun autre volume ne sera utilisé.',
  );
  for (const service of services) {
    if (!service.State.Running) {
      assert(!checkOnly, 'Un service local est arrêté. Relance sans --check.');
      cli(['start', service.Id]);
    }
  }
  let authReady = false;
  for (let i = 0; i < (checkOnly ? 1 : 30); i++) {
    try {
      const response = await fetch('http://127.0.0.1:55431/auth/v1/health', {
        headers: { apikey: state.anonKey },
        signal: AbortSignal.timeout(3000),
      });
      await response.arrayBuffer();
      if (response.status === 200) {
        authReady = true;
        break;
      }
    } catch {
      // Wait for this retained service; no alternate endpoint is tried.
    }
    if (!checkOnly) await delay(1000);
  }
  assert(authReady, 'Le service local de connexion ne répond pas encore.');
  let runtime;
  try {
    runtime = JSON.parse(
      await readFile(workspace + '/app-runtime.json', 'utf8'),
    );
    assert.equal(runtime.artifact, workspace);
    assert.equal(runtime.origin, 'http://127.0.0.1:3150');
    process.kill(runtime.processId, 0);
  } catch {
    runtime = null;
  }
  if (runtime) {
    assert(
      runtime.engine && runtime.review,
      'Le serveur actif utilise un autre profil.',
    );
    const response = await fetch('http://127.0.0.1:3150/login', {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(
      response.status,
      200,
      'Le serveur local ne répond pas correctement.',
    );
    assert((await response.text()).includes('NovLearn'));
    console.log('Application disponible : http://127.0.0.1:3150/login');
    console.log(
      'Version locale essentielle ; copie restaurée du 17 octobre 2026.',
    );
  } else {
    assert(!checkOnly, 'Serveur arrêté. Relance sans --check.');
    console.log('Démarrage : http://127.0.0.1:3150/login');
    const launched = spawnSync(
      process.execPath,
      ['scripts/run-local-admin.mjs', workspace, '--engine', '--review'],
      {
        cwd: root,
        env: { ...process.env, ADMIN_LOCAL_RECOVERY_DATE: '2026-10-17' },
        windowsHide: true,
        stdio: 'inherit',
      },
    );
    process.exitCode = launched.status ?? 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
