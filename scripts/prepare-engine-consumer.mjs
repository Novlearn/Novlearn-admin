import assert from 'node:assert/strict';
import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkArchive } from './engine-distribution.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [destination, ...extra] = process.argv.slice(2);
assert(
  destination && !extra.length,
  'Usage: node scripts/prepare-engine-consumer.mjs <new-directory>',
);
const target = resolve(destination);
const manifest = JSON.parse(
  await readFile(join(root, 'vendor/engine-release.json'), 'utf8'),
);
checkArchive(await readFile(join(root, 'vendor', manifest.archive)), manifest);
// Non-recursive creation refuses an existing destination; never overwrite a consumer.
await mkdir(target);
await mkdir(join(target, 'vendor'));
for (const file of [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'contract.ts',
  'smoke.mjs',
  'definition.json',
])
  await copyFile(
    join(root, 'examples/engine-consumer', file),
    join(target, file),
  );
await copyFile(
  join(root, 'scripts/engine-distribution.mjs'),
  join(target, 'verify.mjs'),
);
for (const file of [manifest.archive, 'engine-release.json'])
  await copyFile(join(root, 'vendor', file), join(target, 'vendor', file));
await copyFile(
  join(root, 'examples/admin-engine-pilots/definitions.json'),
  join(target, 'pilots.json'),
);
await copyFile(
  join(root, 'tests/fixtures/admin-engine-pilot-cases.json'),
  join(target, 'pilot-cases.json'),
);
console.log('Prepared independent consumer: ' + target);
