import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const archive = 'novlearn-exercise-engine-0.1.1.tgz';
const bytes = await readFile(new URL('../vendor/' + archive, import.meta.url));
const tar = gunzipSync(bytes, { maxOutputLength: 2 * 1024 * 1024 });
const files = {};
let pkg;
for (let offset = 0; offset + 512 <= tar.length; ) {
  const head = tar.subarray(offset, offset + 512);
  if (head.every((b) => b === 0)) break;
  const name = head.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
  const size = parseInt(
    head.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim(),
    8,
  );
  assert(
    Number.isSafeInteger(size) &&
      size >= 0 &&
      offset + 512 + size <= tar.length,
  );
  assert(
    name.startsWith('package/') && !name.includes('..') && !name.includes('\\'),
  );
  const file = name.slice(8),
    content = tar.subarray(offset + 512, offset + 512 + size);
  assert(!Object.hasOwn(files, file));
  files[file] = createHash('sha256').update(content).digest('hex');
  if (file === 'package.json') pkg = JSON.parse(content.toString('utf8'));
  offset += 512 + Math.ceil(size / 512) * 512;
}
assert.equal(pkg.version, '0.1.1');
const previous = JSON.parse(
  await readFile(
    new URL('../vendor/engine-release.json', import.meta.url),
    'utf8',
  ),
);
assert.equal(previous.packageVersion, '0.1.0');
const hash = createHash('sha256').update(bytes).digest('hex');
const manifest = {
  ...previous,
  artifactId: `novlearn-exercise-engine@0.1.1+sha256.${hash}`,
  packageVersion: pkg.version,
  archive,
  archiveSha256: hash,
  archiveIntegrity:
    'sha512-' + createHash('sha512').update(bytes).digest('base64'),
  exports: pkg.exports,
  files,
  provenance: {
    sourceCommit: 'baa48c45e27a5b94459feaae090f7b252df4791a',
    changes: [
      'src/math/substitution.ts: digitGroup=0',
      'src/math/numeric.ts: digitGroup=0',
      'package metadata: 0.1.1',
    ],
    excluded: 'Uncommitted 0.2.0 graph sampling',
    pipelineCompatibility:
      'schema 5 / engine 0.1.0 retained; numeric display bytes can differ; exact archive required for replay; new receipts required',
  },
};
await writeFile(
  new URL('../vendor/engine-release-0.1.1.json', import.meta.url),
  JSON.stringify(manifest, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    archive,
    sha256: hash,
    files: Object.keys(files).length,
    candidate: true,
  }),
);
