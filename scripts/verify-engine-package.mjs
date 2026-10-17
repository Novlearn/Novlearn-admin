import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const archive = await readFile(
  new URL('../vendor/novlearn-exercise-engine-0.1.0.tgz', import.meta.url),
);
const sha256 = createHash('sha256').update(archive).digest('hex');
assert.equal(
  sha256,
  'd4d3abc408ab37f2f8a5faa512964b48947828bae9209cb1460b47111ca582f9',
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
// A local tarball can change without changing its package version or path.
// Verify that node_modules actually contains the qualified implementation.
assert.equal(
  createHash('sha256')
    .update(
      await readFile(
        new URL(
          '../node_modules/novlearn-exercise-engine/dist/instantiation.js',
          import.meta.url,
        ),
      ),
    )
    .digest('hex'),
  '3c99dfbc8a5c08f53f9ec9ccd149a8c80930d38839704910c8342d0d80c8192b',
  'Installed Engine differs from the certified archive implementation',
);
console.log(
  'PASS: certified Engine archive, installed implementation and lockfile integrity; Cortex 0.151.0 pinned.',
);
