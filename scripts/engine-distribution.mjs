import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

export function checkManifest(manifest) {
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.packageName, 'novlearn-exercise-engine');
  assert.match(manifest.archive, /^novlearn-exercise-engine-[\w.-]+\.tgz$/);
  assert.match(manifest.archiveSha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.archiveIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert(manifest.files && Object.keys(manifest.files).length > 0);
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert(
      file === 'package.json' ||
        file === 'README.md' ||
        file.startsWith('dist/'),
      'Unexpected package file: ' + file,
    );
    assert(
      !file.includes('\\') &&
        !file.split('/').some((p) => !p || p === '.' || p === '..'),
    );
    assert.match(hash, /^[a-f0-9]{64}$/);
  }
  return manifest;
}

export function checkArchive(bytes, manifest) {
  checkManifest(manifest);
  assert.equal(
    digest(bytes),
    manifest.archiveSha256,
    'Engine archive SHA256 mismatch',
  );
  assert.equal(
    'sha512-' + createHash('sha512').update(bytes).digest('base64'),
    manifest.archiveIntegrity,
    'Engine archive integrity mismatch',
  );
}

async function inventory(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    assert(!entry.isSymbolicLink(), 'Package symlink refused: ' + name);
    if (entry.isDirectory())
      result.push(
        ...(await inventory(join(directory, entry.name), name + '/')),
      );
    else {
      assert(entry.isFile(), 'Non-regular package entry');
      result.push(name);
    }
  }
  return result.sort();
}

/** Verify the installed artifact, not a neighboring source build with the same version. */
export async function checkInstallation(root, manifest) {
  checkManifest(manifest);
  const directory = join(resolve(root), 'node_modules', manifest.packageName);
  const actual = await inventory(directory);
  assert.deepEqual(
    actual,
    Object.keys(manifest.files).sort(),
    'Installed Engine file set mismatch',
  );
  for (const file of actual)
    assert.equal(
      digest(await readFile(join(directory, file))),
      manifest.files[file],
      'Installed Engine file mismatch: ' + file,
    );
  const pkg = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  assert.equal(pkg.version, manifest.packageVersion);
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.exports, manifest.exports);
  assert.deepEqual(pkg.dependencies, {
    '@cortex-js/compute-engine':
      manifest.dependencies['@cortex-js/compute-engine'],
  });
  const lock = JSON.parse(
    await readFile(join(root, 'package-lock.json'), 'utf8'),
  );
  const own = lock.packages['node_modules/' + manifest.packageName];
  assert.equal(own.version, manifest.packageVersion);
  assert.equal(own.resolved, 'file:vendor/' + manifest.archive);
  assert.equal(own.integrity, manifest.archiveIntegrity);
  assert.equal(
    lock.packages[''].dependencies[manifest.packageName],
    own.resolved,
  );
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    const entry = lock.packages['node_modules/' + name];
    assert.equal(entry.version, version, 'Dependency lock mismatch: ' + name);
    assert(
      entry.integrity?.startsWith('sha512-'),
      'Missing dependency integrity',
    );
    const installed = JSON.parse(
      await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'),
    );
    assert.equal(
      installed.version,
      version,
      'Installed dependency mismatch: ' + name,
    );
  }
  // Traverse only the portable root's actual imports. Native host and legacy
  // remain explicit subpaths and must not leak into the core dependency graph.
  const pending = ['dist/index.js'];
  const visited = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    assert(
      !file.includes('node-host/') && !file.includes('adapters/'),
      'Non-core import in portable graph',
    );
    const source = await readFile(join(directory, file), 'utf8');
    for (const match of source.matchAll(
      /^(?:import|export)\s+(?:[^;\r\n]*?\bfrom\s*)?['"]([^'"\r\n]+)['"]/gm,
    )) {
      const specifier = match[1];
      if (specifier.startsWith('.')) {
        const target = resolve(directory, file, '..', specifier);
        const local = relative(directory, target).replaceAll('\\', '/');
        assert(
          !local.startsWith('../') && Object.hasOwn(manifest.files, local),
          'Core import outside package',
        );
        pending.push(local);
      } else
        assert.equal(
          specifier,
          '@cortex-js/compute-engine',
          'Unexpected core dependency: ' + specifier,
        );
    }
  }
  return { files: actual.length, coreModules: visited.size };
}
