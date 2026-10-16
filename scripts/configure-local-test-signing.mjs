// Provision only the existing private receipt registry in the isolated local copy.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const artifact = path.resolve(process.argv[2] ?? '');
assert(artifact.startsWith(path.resolve('.local') + path.sep));
assert.match(path.basename(artifact), /^local-admin-\d+$/);
const state = JSON.parse(
  await readFile(path.join(artifact, 'private.json'), 'utf8'),
);
assert.equal(state.artifact, artifact);
assert.equal(state.pending, undefined);
assert.match(state.prefix, /^novlearn-admin-local-\d+$/);
assert.equal(state.names.db, state.prefix + '-db');
assert.equal(state.database, 'admin_local');
const file = path.join(artifact, 'test-signing.json');
let signing;
try {
  signing = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const existing = !!signing;
signing ??= {
  artifact,
  id: randomUUID(),
  key: randomBytes(32).toString('hex'),
};
assert.equal(signing.artifact, artifact);
assert.match(
  signing.id,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
assert.match(signing.key, /^[0-9a-f]{64}$/);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const result = spawnSync(
  docker,
  [
    '--host',
    'npipe:////./pipe/dockerDesktopLinuxEngine',
    'exec',
    '-i',
    state.names.db,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'admin_local',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input:
      (existing
        ? ''
        : `INSERT INTO novlearn_admin_private.test_signing_keys(id,secret) VALUES('${signing.id}',decode('${signing.key}','hex'));\n`) +
      `SELECT count(*) FROM novlearn_admin_private.test_signing_keys WHERE id='${signing.id}' AND enabled AND secret=decode('${signing.key}','hex');`,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 1048576,
  },
);
assert.equal(
  result.status,
  0,
  'Local signing configuration failed; private SQL output withheld',
);
assert.equal(result.stdout.trim(), '1');
if (!existing)
  await writeFile(file, JSON.stringify(signing, null, 2) + '\n', {
    flag: 'wx',
  });
await writeFile(
  path.join(artifact, 'test-signing-proof.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      localOnly: true,
      registryMatch: true,
      existingKeyReused: existing,
      id: signing.id,
      noRemoteChange: true,
      noExistingDataDeleted: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'PASS: local receipt signing configured; private key retained only in ignored operator file.',
);
