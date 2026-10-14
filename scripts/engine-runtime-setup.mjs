import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, copyFile, writeFile } from 'node:fs/promises';

await writeFile(
  '/consumer/package.json',
  JSON.stringify({
    name: 'admin-runtime-fixture',
    private: true,
    type: 'module',
  }),
);
const installed = spawnSync(
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
assert.equal(installed.status, 0, installed.stderr || installed.stdout);
await cp('/inputs/server-only', '/consumer/node_modules/server-only', {
  recursive: true,
});
await copyFile('/inputs/engine-runtime.ts', '/consumer/engine-runtime.ts');
await copyFile('/inputs/runtime-test.mjs', '/consumer/runtime-test.mjs');
const tested = spawnSync(
  process.execPath,
  ['--conditions=react-server', '/consumer/runtime-test.mjs'],
  { cwd: '/consumer', encoding: 'utf8', timeout: 60000, maxBuffer: 1048576 },
);
process.stdout.write(tested.stdout);
process.stderr.write(tested.stderr);
assert.equal(tested.status, 0, tested.stderr);
