import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifact = path.join(
  root,
  '.local/lot1a/preview-runtime-' + new Date().toISOString().replace(/\D/g, ''),
);
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
server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  oxc: { jsx: { runtime: 'automatic' } },
  server: {
    host: '127.0.0.1',
    port: 3140,
    strictPort: true,
    open: false,
    cors: false,
    watch: {
      ignored: [
        '**/.next/**',
        '**/.npm-cache/**',
        '**/.local/**',
        '**/docs/**',
      ],
    },
  },
  plugins: [
    {
      name: 'native-synthetic-preview',
      configureServer(s) {
        s.middlewares.use('/api/admin/preview', async (req, res) => {
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          if (
            req.method !== 'POST' ||
            req.headers.origin !== 'http://127.0.0.1:3140' ||
            exited
          ) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Local fixture request refused' }));
            return;
          }
          try {
            let text = '';
            for await (const chunk of req) {
              text += chunk;
              if (Buffer.byteLength(text) > 262144) throw Error('Input limit');
            }
            const body = JSON.parse(text);
            if (!['generate', 'inspect', 'grade', 'test'].includes(body.action))
              throw Error('Action');
            const id = randomUUID();
            const result = await new Promise((resolve, reject) => {
              pending.set(id, { resolve, reject });
              child.stdin.write(JSON.stringify({ id, body }) + '\n');
            });
            res.statusCode = result.status;
            res.end(JSON.stringify(result.body));
          } catch {
            res.statusCode = 503;
            res.end(
              JSON.stringify({ error: 'Local fixture runtime unavailable' }),
            );
          }
        });
      },
    },
  ],
});
await server.listen();
console.log('PASS: native multi-seed preview qualification; proof=' + artifact);
console.log(
  'Synthetic browser owner, no Auth/database: http://127.0.0.1:3140/tests/browser/preview.html',
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
