// Explicit local launcher opt-in only; never contacts PostgreSQL or edits state.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, X509Certificate } from 'node:crypto';
import path from 'node:path';
export const disabledActiveVersionEnvironment = {
  ADMIN_ACTIVE_VERSION_ENABLED: 'false',
  ADMIN_LOCAL_ACTIVE_VERSION_ENABLED: 'false',
  ADMIN_LOCAL_ACTIVE_VERSION_REVIEW: '',
  ADMIN_LOCAL_ACTIVE_VERSION_PG_URL: '',
  ADMIN_LOCAL_ACTIVE_VERSION_PG_CA: '',
};
export async function localActiveVersionEnvironment({
  requireHttp = false,
} = {}) {
  const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
  const marker = await json('.local/lot1a/active-version-http-current.json');
  assert(
    (requireHttp
      ? ['qualified-http']
      : ['qualified-pg', 'qualified-http']
    ).includes(marker.phase),
    'Reader qualification is required before this launcher opt-in',
  );
  const artifact = path.resolve(marker.artifact);
  assert.equal(
    path.dirname(artifact).toLowerCase(),
    path.resolve('.local/lot1a').toLowerCase(),
  );
  assert.match(path.basename(artifact), /^active-version-http-\d+$/);
  const privateState = await json(artifact + '/private.json');
  const qualified = await json(artifact + '/pg-proof.json');
  assert.equal(qualified.result, 'PASS');
  assert.equal(privateState.physicalConnectionQualified, true);
  const upgrade = await json(
    '.local/lot1a/active-version-target-upgrade-current.json',
  );
  assert.equal(upgrade.phase, 'upgraded');
  for (const value of [marker, privateState, qualified]) {
    assert.equal(
      value.target,
      'novlearn-admin-publication-local-1792259029889-target-db',
    );
    assert.equal(
      value.containerId,
      upgrade.containerId ?? (await json(upgrade.proof)).containerId,
    );
    assert.equal(
      path.resolve(value.artifact).toLowerCase(),
      artifact.toLowerCase(),
    );
  }
  for (const file of [
    'src/lib/active-version-pg.ts',
    'src/lib/active-version-config.ts',
    'src/lib/active-version.ts',
    'scripts/active-version-query.sql',
    'scripts/active-version-reader-audit.sql',
  ]) {
    assert.match(qualified.sourceHashes[file], /^[0-9a-f]{64}$/);
    assert.equal(
      createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
      qualified.sourceHashes[file],
      'Reader code differs from qualified copy: ' + file,
    );
  }
  if (requireHttp) {
    assert.equal(
      path.dirname(path.resolve(marker.httpProof)).toLowerCase(),
      artifact.toLowerCase(),
    );
    const bytes = await readFile(marker.httpProof);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      marker.httpProofSha256,
    );
    const http = JSON.parse(bytes.toString('utf8'));
    assert.equal(http.result, 'PASS');
    assert.equal(http.actualAdminAuth, true);
    assert.equal(http.target, privateState.target);
    assert.equal(http.containerId, privateState.containerId);
  }
  const config = privateState.config,
    url = new URL(config.url);
  assert.equal(config.environment, 'local-copy');
  assert.equal(config.targetKey, 'local-http-fixture');
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55434');
  assert.equal(url.pathname, '/admin_local');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  assert.equal(
    decodeURIComponent(url.username),
    'novlearn_admin_active_version_service',
  );
  const password = decodeURIComponent(url.password);
  assert(password.length >= 16 && password.length <= 512);
  const cert = new X509Certificate(config.ca);
  assert(Date.parse(cert.validTo) > Date.now());
  assert.equal(cert.checkIP('127.0.0.1'), '127.0.0.1');
  return {
    ...disabledActiveVersionEnvironment,
    ADMIN_LOCAL_ACTIVE_VERSION_ENABLED: 'true',
    ADMIN_LOCAL_ACTIVE_VERSION_REVIEW: 'isolated-sql70-active-version-http-v1',
    ADMIN_LOCAL_ACTIVE_VERSION_PG_URL: config.url,
    ADMIN_LOCAL_ACTIVE_VERSION_PG_CA: config.ca,
  };
}
