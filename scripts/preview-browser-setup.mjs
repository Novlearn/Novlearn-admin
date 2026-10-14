import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
await writeFile(
  '/consumer/package.json',
  JSON.stringify({
    name: 'preview-local-fixture',
    private: true,
    type: 'module',
  }),
);
const result = spawnSync(
  process.execPath,
  [
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--cache',
    '/consumer/npm-cache',
    '/archives/engine.tgz',
    '/archives/cortex.tgz',
    '/archives/colors.tgz',
    '/archives/complex.tgz',
  ],
  { cwd: '/consumer', encoding: 'utf8', timeout: 120000, maxBuffer: 1048576 },
);
assert.equal(result.status, 0, result.stderr);
await cp('/inputs/server-only', '/consumer/node_modules/server-only', {
  recursive: true,
});
for (const name of [
  'engine-runtime.ts',
  'preview-server.ts',
  'preview-browser-worker.mjs',
]) {
  const original = await readFile('/inputs/' + name, 'utf8');
  await writeFile(
    '/consumer/' + name,
    original.replace("from './engine-runtime'", "from './engine-runtime.ts'"),
  );
}
const child = spawn(
  process.execPath,
  ['--conditions=react-server', '/consumer/preview-browser-worker.mjs'],
  { cwd: '/consumer', stdio: 'inherit' },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const name of ['SIGTERM', 'SIGINT'])
  process.on(name, () => child.kill(name));
