import { expect, it } from 'vitest';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const helper = pathToFileURL(
  path.resolve('scripts/local-active-version.mjs'),
).href;
const files = [
  'src/lib/active-version-pg.ts',
  'src/lib/active-version-config.ts',
  'src/lib/active-version.ts',
  'scripts/active-version-query.sql',
  'scripts/active-version-reader-audit.sql',
];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'novlearn-reader-launcher-'));
  const artifact = path.join(root, '.local/lot1a/active-version-http-12345');
  await mkdir(artifact, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const f of files) {
    const data = await readFile(f);
    await mkdir(path.dirname(path.join(root, f)), { recursive: true });
    await writeFile(path.join(root, f), data);
    hashes[f] = createHash('sha256').update(data).digest('hex');
  }
  const base = {
    artifact,
    target: 'novlearn-admin-publication-local-1792259029889-target-db',
    containerId: '1'.repeat(64),
  };
  const marker = {
    ...base,
    phase: 'qualified-pg',
    httpProof: path.join(artifact, 'http-proof.json'),
    httpProofSha256: '',
  };
  const privateState = {
    ...base,
    physicalConnectionQualified: true,
    config: {
      url: 'postgresql://novlearn_admin_active_version_service:synthetic-fixture-password@127.0.0.1:55434/admin_local',
      ca: await readFile('tests/fixtures/local-active-version-ca.pem', 'utf8'),
      environment: 'local-copy',
      targetKey: 'local-http-fixture',
    },
  };
  const http = {
    result: 'PASS',
    actualAdminAuth: true,
    target: base.target,
    containerId: base.containerId,
  };
  const save = async () => {
    const bytes = JSON.stringify(http);
    marker.httpProofSha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(path.join(artifact, 'http-proof.json'), bytes);
    await writeFile(
      path.join(root, '.local/lot1a/active-version-http-current.json'),
      JSON.stringify(marker),
    );
    await writeFile(
      path.join(artifact, 'private.json'),
      JSON.stringify(privateState),
    );
    await writeFile(
      path.join(artifact, 'pg-proof.json'),
      JSON.stringify({ ...base, result: 'PASS', sourceHashes: hashes }),
    );
    await writeFile(
      path.join(
        root,
        '.local/lot1a/active-version-target-upgrade-current.json',
      ),
      JSON.stringify({ phase: 'upgraded', containerId: base.containerId }),
    );
  };
  await save();
  const run = (requireHttp = false, expired = false) =>
    spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import {localActiveVersionEnvironment} from ${JSON.stringify(helper)};Date.now=()=>Date.UTC(2026,${expired ? 10 : 9},20);const e=await localActiveVersionEnvironment({requireHttp:${requireHttp}});console.log(JSON.stringify({enabled:e.ADMIN_LOCAL_ACTIVE_VERSION_ENABLED,operational:e.ADMIN_ACTIVE_VERSION_ENABLED,publicKeys:Object.keys(e).filter(k=>k.startsWith('NEXT_PUBLIC_'))}));`,
      ],
      { cwd: root, encoding: 'utf8', windowsHide: true },
    );
  return { root, artifact, marker, privateState, http, save, run };
}
it('accepts the explicit dedicated PG qualification but requires HTTP qualification for main', async () => {
  const f = await fixture();
  expect(f.run().status).toBe(0);
  expect(f.run(true).status).not.toBe(0);
  f.marker.phase = 'qualified-http';
  await f.save();
  const r = f.run(true);
  expect(r.status).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({
    enabled: 'true',
    operational: 'false',
    publicKeys: [],
  });
});
it.each([
  [
    'remote hostname',
    'postgresql://novlearn_admin_active_version_service:synthetic-fixture-password@remote.invalid:55434/admin_local',
  ],
  [
    'writer identity',
    'postgresql://novlearn_admin_publication_service:synthetic-fixture-password@127.0.0.1:55434/admin_local',
  ],
  [
    'other database',
    'postgresql://novlearn_admin_active_version_service:synthetic-fixture-password@127.0.0.1:55434/postgres',
  ],
  [
    'SSL query override',
    'postgresql://novlearn_admin_active_version_service:synthetic-fixture-password@127.0.0.1:55434/admin_local?sslmode=disable',
  ],
])(
  'refuses %s even in a qualification-shaped operator file',
  async (_label, url) => {
    const f = await fixture();
    f.privateState.config.url = url;
    await f.save();
    expect(f.run().status).not.toBe(0);
  },
);
it('refuses unqualified state, foreign target and stale reader code', async () => {
  const f = await fixture();
  f.marker.phase = 'provisioned';
  await f.save();
  expect(f.run().status).not.toBe(0);
  f.marker.phase = 'qualified-pg';
  f.privateState.containerId = '2'.repeat(64);
  await f.save();
  expect(f.run().status).not.toBe(0);
  f.privateState.containerId = '1'.repeat(64);
  await f.save();
  await writeFile(path.join(f.root, files[0]), 'changed source');
  expect(f.run().status).not.toBe(0);
});
it('refuses expired or malformed certificate configuration without network activity', async () => {
  const f = await fixture();
  expect(f.run(false, true).status).not.toBe(0);
  f.privateState.config.ca = 'invalid';
  await f.save();
  expect(f.run().status).not.toBe(0);
});
it('requires the HTTP receipt to belong to the same target and real Admin qualification', async () => {
  const f = await fixture();
  f.marker.phase = 'qualified-http';
  f.http.actualAdminAuth = false;
  await f.save();
  expect(f.run(true).status).not.toBe(0);
  f.http.actualAdminAuth = true;
  f.http.containerId = '2'.repeat(64);
  await f.save();
  expect(f.run(true).status).not.toBe(0);
});
it('rejects a changed HTTP receipt and an artifact outside the isolated workspace', async () => {
  const f = await fixture();
  f.marker.phase = 'qualified-http';
  await f.save();
  await writeFile(f.marker.httpProof, JSON.stringify(f.http) + ' ');
  expect(f.run(true).status).not.toBe(0);
  f.marker.artifact = path.join(f.root, 'outside');
  await f.save();
  expect(f.run().status).not.toBe(0);
});
