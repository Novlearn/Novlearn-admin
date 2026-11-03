import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkArchive, checkInstallation } from './engine-distribution.mjs';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';

const manifest = JSON.parse(
  await readFile(
    new URL('../vendor/engine-release.json', import.meta.url),
    'utf8',
  ),
);
const archive = await readFile(
  new URL('../vendor/' + manifest.archive, import.meta.url),
);
assert.equal(
  manifest.archiveSha256,
  certifiedEngineIdentity.engineArchiveSha256,
);
assert.equal(manifest.packageVersion, certifiedEngineIdentity.version);
assert.equal(manifest.pipelineVersion, certifiedEngineIdentity.pipelineVersion);
assert.equal(manifest.engineContract, certifiedEngineIdentity.engineContract);
assert.equal(
  manifest.generationVersion,
  certifiedEngineIdentity.generationVersion,
);
assert.equal(
  manifest.canonicalizationVersion,
  certifiedEngineIdentity.canonicalizationVersion,
);
checkArchive(archive, manifest);
const result = await checkInstallation(
  fileURLToPath(new URL('..', import.meta.url)),
  manifest,
);
console.log(
  `PASS: exact Engine archive, ${result.files} installed files, exports, dependency lock and ${result.coreModules} portable core modules; no framework or native-host import in core.`,
);
