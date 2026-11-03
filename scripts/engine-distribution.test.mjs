import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  mkdir,
  mkdtemp,
  writeFile,
  copyFile,
  cp,
} from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkManifest,
  checkArchive,
  checkInstallation,
} from './engine-distribution.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(
  await readFile(
    new URL('../vendor/engine-release.json', import.meta.url),
    'utf8',
  ),
);
const archive = await readFile(
  new URL('../vendor/' + manifest.archive, import.meta.url),
);

test('reject a changed archive even when its filename and package version remain identical', () => {
  const changed = Buffer.from(archive);
  changed[100] ^= 1;
  assert.throws(() => checkArchive(changed, manifest), /SHA256 mismatch/);
});
test('reject a lock integrity that disagrees with the artifact', () => {
  assert.throws(
    () =>
      checkArchive(archive, { ...manifest, archiveIntegrity: 'sha512-AA==' }),
    /integrity mismatch/,
  );
});
test('refuse traversal and non-package files in the installed inventory', () => {
  for (const file of [
    'dist/../../escape',
    'dist/./index.js',
    'dist//index.js',
    'dist\\index.js',
    '.env',
  ])
    assert.throws(() =>
      checkManifest({ ...manifest, files: { [file]: 'a'.repeat(64) } }),
    );
});
test('all installed files are compared, not only instantiation.js', async () => {
  await mkdir(join(root, '.local'), { recursive: true });
  const target = await mkdtemp(join(root, '.local/engine-corruption-'));
  const directory = join(target, 'node_modules', manifest.packageName);
  // Construct a tiny synthetic package so this negative test never edits node_modules.
  await mkdir(join(directory, 'dist'), { recursive: true });
  await copyFile(
    join(root, 'node_modules', manifest.packageName, 'package.json'),
    join(directory, 'package.json'),
  );
  await writeFile(join(directory, 'dist/index.js'), 'altered');
  const subset = {
    ...manifest,
    files: {
      'package.json': manifest.files['package.json'],
      'dist/index.js': manifest.files['dist/index.js'],
    },
  };
  await assert.rejects(
    checkInstallation(target, subset),
    /file mismatch: dist\/index.js/,
  );
  await writeFile(join(directory, 'dist/extra.js'), 'unexpected');
  await assert.rejects(checkInstallation(target, subset), /file set mismatch/);
});
test('current Admin installation matches every file and its dependency lock', async () => {
  assert.deepEqual(await checkInstallation(root, manifest), {
    files: 157,
    coreModules: 27,
  });
});
test('refuse a consumer lock with a substituted artifact or dependency version', async () => {
  await mkdir(join(root, '.local'), { recursive: true });
  const target = await mkdtemp(join(root, '.local/engine-lock-drift-'));
  await cp(
    join(root, 'node_modules', manifest.packageName),
    join(target, 'node_modules', manifest.packageName),
    { recursive: true },
  );
  const original = JSON.parse(
    await readFile(join(root, 'package-lock.json'), 'utf8'),
  );
  const changed = structuredClone(original);
  changed.packages['node_modules/' + manifest.packageName].integrity =
    'sha512-AA==';
  await writeFile(join(target, 'package-lock.json'), JSON.stringify(changed));
  await assert.rejects(checkInstallation(target, manifest), {
    code: 'ERR_ASSERTION',
  });
  changed.packages['node_modules/' + manifest.packageName].integrity =
    manifest.archiveIntegrity;
  changed.packages['node_modules/@cortex-js/compute-engine'].version =
    '0.999.0';
  await writeFile(join(target, 'package-lock.json'), JSON.stringify(changed));
  await assert.rejects(
    checkInstallation(target, manifest),
    /Dependency lock mismatch/,
  );
});
