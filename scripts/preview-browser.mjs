import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { localWorkspaceConfig } from './local-workspace.mjs';
import './prepare-mathlive.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifact = path.join(
  root,
  '.local/lot1a/preview-runtime-' + new Date().toISOString().replace(/\D/g, ''),
);
const runtimeContainer =
  'novlearn-admin-workspace-' +
  path.basename(artifact).replace('preview-runtime-', '');
await mkdir(artifact, { recursive: true });
const engine = path.join(root, 'vendor/novlearn-exercise-engine-0.1.0.tgz');
if (
  createHash('sha256')
    .update(await readFile(engine))
    .digest('hex') !==
  '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290'
)
  throw Error('Engine archive differs');
const packed = spawnSync(
  process.execPath,
  [
    path.join(
      path.dirname(process.execPath),
      'node_modules/npm/bin/npm-cli.js',
    ),
    'pack',
    './node_modules/@cortex-js/compute-engine',
    './node_modules/@arnog/colors',
    './node_modules/complex.js',
    '--ignore-scripts',
    '--cache',
    path.join(root, '.npm-cache'),
    '--pack-destination',
    artifact,
    '--json',
  ],
  { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1048576 },
);
if (packed.status !== 0)
  throw Error('Offline packaging failed: ' + packed.stderr);
const archives = {
  '@cortex-js/compute-engine': 'cortex',
  '@arnog/colors': 'colors',
  'complex.js': 'complex',
};
const args = [
  '--host',
  'npipe:////./pipe/dockerDesktopLinuxEngine',
  'run',
  '--name',
  runtimeContainer,
  '--pull',
  'never',
  '--rm',
  '--init',
  '--interactive',
  '--network',
  'none',
  '--memory',
  '384m',
  '--memory-swap',
  '384m',
  '--pids-limit',
  '64',
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--user',
  '65534:65534',
  '--workdir',
  '/consumer',
  '--tmpfs',
  '/consumer:rw,nosuid,nodev,noexec,size=192m,mode=1777',
];
const mounts = [
  [engine, '/archives/engine.tgz'],
  [path.join(root, 'node_modules/server-only'), '/inputs/server-only'],
  [
    path.join(root, 'tests/fixtures/preview-definition.json'),
    '/inputs/preview-definition.json',
  ],
  ...[
    ['src/lib/engine-runtime.ts', 'engine-runtime.ts'],
    ['src/lib/preview-server.ts', 'preview-server.ts'],
    ['scripts/preview-browser-worker.mjs', 'preview-browser-worker.mjs'],
    ['scripts/preview-browser-setup.mjs', 'setup.mjs'],
  ].map(([p, n]) => [path.join(root, p), '/inputs/' + n]),
];
for (const p of JSON.parse(packed.stdout)) {
  if (!Object.hasOwn(archives, p.name)) throw Error('Unexpected package');
  mounts.push([
    path.join(artifact, p.filename),
    '/archives/' + archives[p.name] + '.tgz',
  ]);
}
for (const [source, target] of mounts)
  args.push('--mount', `type=bind,source=${source},target=${target},readonly`);
args.push(
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
  'node',
  '/inputs/setup.mjs',
);
const child = spawn(
  path.join(
    process.env.LOCALAPPDATA,
    'Programs/DockerDesktop/resources/bin/docker.exe',
  ),
  args,
  { stdio: ['pipe', 'pipe', 'pipe'] },
);
const pending = new Map();
let exited = false,
  server;
child.stderr.on('data', (data) => process.stderr.write(data));
const ready = new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', (code) => {
    exited = true;
    for (const p of pending.values()) p.reject(Error('Runtime stopped'));
    pending.clear();
    reject(Error('Docker exited ' + code));
    void server?.close();
  });
  createInterface({ input: child.stdout }).on('line', async (line) => {
    try {
      const result = JSON.parse(line);
      if (result.ready) {
        await writeFile(
          path.join(artifact, 'proof.json'),
          JSON.stringify(result.proof, null, 2) + '\n',
        );
        resolve();
      } else if (pending.has(result.id)) {
        const p = pending.get(result.id);
        pending.delete(result.id);
        p.resolve(result);
      }
    } catch (e) {
      reject(e);
    }
  });
});
await ready;
try {
  server = await createServer(
    localWorkspaceConfig({
      engine: async (body) => {
        if (exited || pending.size >= 5)
          throw Error('Runtime unavailable or busy');
        const id = randomUUID();
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(Error('Runtime timeout'));
          }, 125000);
          pending.set(id, {
            resolve: (value) => {
              clearTimeout(timer);
              resolve(value);
            },
            reject: (error) => {
              clearTimeout(timer);
              reject(error);
            },
          });
          child.stdin.write(JSON.stringify({ id, body }) + '\n');
        });
      },
    }),
  );
  await server.listen();
  await writeFile(
    path.join(artifact, 'runtime.json'),
    JSON.stringify(
      {
        processId: process.pid,
        container: runtimeContainer,
        origin: 'http://127.0.0.1:3140',
        synthetic: true,
        database: false,
      },
      null,
      2,
    ) + '\n',
  );
} catch (error) {
  await server?.close();
  child.stdin.end();
  throw error;
}
console.log('PASS: native multi-seed preview qualification; proof=' + artifact);
console.log(
  'Local workspace, real Linux Engine, no Auth/database: http://127.0.0.1:3140/',
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
  child.stdin.end();
}
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
process.stdin.on('data', (value) => {
  if (String(value).trim() === 'stop') void close();
});
