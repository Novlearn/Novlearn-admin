// Only the dedicated, previously qualified synthetic fixture may be armed.
// This registers a test signing key and enables its local target runtime;
// it never approves content or applies a publication.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';
const artifact = path.resolve(process.argv[2] ?? '');
assert(
  artifact
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(artifact), /^local-admin-publication-\d+$/);
const state = JSON.parse(await readFile(artifact + '/private.json', 'utf8'));
const marker = JSON.parse(
  await readFile(artifact + '/publication-pg.json', 'utf8'),
);
assert.equal(state.artifact, artifact);
assert.equal(marker.artifact, artifact);
assert.match(state.prefix, /^novlearn-admin-publication-local-\d+$/);
assert.equal(state.names.db, state.prefix + '-db');
assert.equal(marker.target, state.prefix + '-target-db');
const preparation = JSON.parse(await readFile(marker.proof, 'utf8'));
assert.equal(preparation.connections.verifiedTLS, true);
assert.equal(preparation.sourceTablesPreserved, 62);
assert.equal(preparation.targetTablesPreserved, 62);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const sql = (name, input) => {
  const r = spawnSync(
    docker,
    [
      '--host',
      'npipe:////./pipe/dockerDesktopLinuxEngine',
      'exec',
      '-i',
      name,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'admin_local',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', windowsHide: true, timeout: 30000 },
  );
  assert.equal(
    r.status,
    0,
    'Fixture configuration SQL refused; output withheld',
  );
  return r.stdout.trim();
};
let signing, confirmation;
try {
  signing = JSON.parse(await readFile(artifact + '/test-signing.json', 'utf8'));
  assert.equal(signing.artifact, artifact);
  assert.match(signing.id, /^[0-9a-f-]{36}$/);
  assert.match(signing.key, /^[0-9a-f]{64}$/);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  signing = {
    artifact,
    id: randomUUID(),
    key: randomBytes(32).toString('hex'),
  };
  await writeFile(
    artifact + '/test-signing.json',
    JSON.stringify(signing, null, 2) + '\n',
  );
}
try {
  confirmation = JSON.parse(
    await readFile(artifact + '/publication-signing.json', 'utf8'),
  );
  assert.equal(confirmation.artifact, artifact);
  assert.match(confirmation.key, /^[0-9a-f]{64}$/);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  confirmation = { artifact, key: randomBytes(32).toString('hex') };
  await writeFile(
    artifact + '/publication-signing.json',
    JSON.stringify(confirmation, null, 2) + '\n',
  );
}
assert.notEqual(signing.key, confirmation.key);
const before = JSON.parse(
  sql(
    marker.target,
    'SELECT to_jsonb(r) FROM novlearn_admin_private.publication_runtime r WHERE singleton;',
  ),
);
assert.equal(
  before.engine_archive_sha256,
  certifiedEngineIdentity.engineArchiveSha256,
);
assert.equal(
  sql(
    state.names.db,
    `INSERT INTO novlearn_admin_private.test_signing_keys(id,secret) VALUES('${signing.id}',decode('${signing.key}','hex')) ON CONFLICT(id) DO NOTHING; SELECT count(*)=1 FROM novlearn_admin_private.test_signing_keys WHERE id='${signing.id}' AND secret=decode('${signing.key}','hex') AND enabled;`,
  )
    .split('\n')
    .at(-1),
  't',
);
sql(
  marker.target,
  `UPDATE novlearn_admin_private.publication_runtime SET enabled=true WHERE singleton AND engine_archive_sha256='${certifiedEngineIdentity.engineArchiveSha256}';`,
);
assert.equal(
  sql(
    marker.target,
    'SELECT enabled FROM novlearn_admin_private.publication_runtime WHERE singleton;',
  ),
  't',
);
await writeFile(
  artifact + '/publication-configuration-proof.json',
  JSON.stringify(
    {
      result: 'PASS for local fixture configuration only',
      date: new Date().toISOString(),
      artifact,
      sourceSigningKeyId: signing.id,
      sourceRuntimeEnabled:
        sql(
          state.names.db,
          'SELECT enabled FROM novlearn_admin_private.publication_runtime WHERE singleton;',
        ) === 't',
      targetBefore: before,
      targetRuntimeEnabled: true,
      targetApplyExecuted: false,
      remoteChanged: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    localTargetRuntimeEnabled: true,
    contentApproved: false,
    targetApplyExecuted: false,
  }),
);
