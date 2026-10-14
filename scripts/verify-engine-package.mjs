import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const archive = await readFile(
  new URL('../vendor/novlearn-exercise-engine-0.1.0.tgz', import.meta.url),
);
const sha256 = createHash('sha256').update(archive).digest('hex');
assert.equal(
  sha256,
  '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290',
  'Engine archive differs from the locally certified artifact',
);
const lock = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
);
const entry = lock.packages['node_modules/novlearn-exercise-engine'];
assert.equal(entry.version, '0.1.0');
assert.equal(entry.resolved, 'file:vendor/novlearn-exercise-engine-0.1.0.tgz');
assert.equal(
  entry.integrity,
  `sha512-${createHash('sha512').update(archive).digest('base64')}`,
  'Engine lockfile integrity mismatch',
);
assert.equal(
  lock.packages['node_modules/@cortex-js/compute-engine'].version,
  '0.151.0',
);
console.log(
  'PASS: certified Engine archive SHA256 and lockfile integrity; Cortex 0.151.0 pinned.',
);
