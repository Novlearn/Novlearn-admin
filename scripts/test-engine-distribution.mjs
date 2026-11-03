import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './engine-distribution.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
assert(
  process.argv.slice(2).every((arg) => arg === '--offline'),
  'Only --offline is supported',
);
const npm =
  process.env.npm_execpath ??
  join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const run = (args, cwd = root) =>
  execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
await mkdir(join(root, '.local'), { recursive: true });
const workspace = await mkdtemp(join(root, '.local/engine-distribution-'));
const results = [];
for (const consumer of ['admin', 'novlearn']) {
  const target = join(workspace, consumer);
  run([join(root, 'scripts/prepare-engine-consumer.mjs'), target]);
  const lockBefore = digest(await readFile(join(target, 'package-lock.json')));
  run(
    [
      npm,
      'ci',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      join(root, '.npm-cache'),
      ...(process.argv.includes('--offline') ? ['--offline'] : []),
    ],
    target,
  );
  assert.equal(
    digest(await readFile(join(target, 'package-lock.json'))),
    lockBefore,
    'npm ci changed the consumer lock',
  );
  run(
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--project',
      'tsconfig.json',
    ],
    target,
  );
  const smoke = JSON.parse(run([join(target, 'smoke.mjs')], target));
  results.push({ consumer, lockSha256: lockBefore, ...smoke });
}
assert.equal(results[0].lockSha256, results[1].lockSha256);
assert.equal(results[0].artifact, results[1].artifact);
const proof = {
  recordedAt: new Date().toISOString(),
  result: 'PASS',
  node: process.version,
  isolatedConsumers: results,
  applicationIntegration: 'not-performed',
  nativeLinuxQualification: 'separate-lot',
};
await writeFile(
  join(workspace, 'proof.json'),
  JSON.stringify(proof, null, 2) + '\n',
);
console.log(
  JSON.stringify({ ...proof, proof: join(workspace, 'proof.json') }, null, 2),
);
