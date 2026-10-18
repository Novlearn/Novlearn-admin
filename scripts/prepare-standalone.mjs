import { access, cp, mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const standalone = new URL('.next/standalone/', root);
await access(new URL('server.js', standalone));
await mkdir(new URL('.next/', standalone), { recursive: true });
await cp(
  fileURLToPath(new URL('.next/static/', root)),
  fileURLToPath(new URL('.next/static/', standalone)),
  { recursive: true },
);
let hasPublic = true;
try {
  await access(new URL('public/', root));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  hasPublic = false;
}
// public is optional in this repository; other filesystem errors must surface.
if (hasPublic) {
  await cp(
    fileURLToPath(new URL('public/', root)),
    fileURLToPath(new URL('public/', standalone)),
    { recursive: true },
  );
}
for (const name of [
  'activity-reader-audit.sql',
  'activity-statistics-query.sql',
]) {
  const source = await readFile(new URL('scripts/' + name, root));
  const traced = await readFile(new URL('scripts/' + name, standalone));
  assert(source.equals(traced), 'Standalone SQL source differs: ' + name);
}
console.log('Standalone assets and exact activity SQL sources prepared.');
