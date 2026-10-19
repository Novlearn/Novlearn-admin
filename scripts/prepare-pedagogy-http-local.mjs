// Creates a new local SQL69 source from a qualified synthetic backup.
// Never attaches networks to the isolated native test source or migrates an app DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { build } from 'vite';
import { detailRowsFunction } from './user-detail-local-fixture.mjs';
assert(process.execArgv.includes('--conditions=react-server'));
assert.equal(process.argv.length, 2);
const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const marker = '.local/lot1a/pedagogy-http-current.json';
await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
const native = await json('.local/lot1a/pedagogy-pg-current.json');
assert.equal(native.phase, 'qualified');
const qualification = await json(native.proof);
assert.equal(qualification.result, 'PASS');
assert.equal(qualification.realTls, true);
assert.equal(qualification.realServerReader, true);
assert.equal((await json(qualification.referenceBoundaryProof)).result, 'PASS');
for (const [f, h] of Object.entries(qualification.sourceHashes))
  assert.equal(sha(await readFile(f)), h, f);
const source = native.container;
assert.equal(source, 'novlearn-admin-user-detail-restore-1792414439728');
const credentials = await json(native.artifact + '/private.json');
const owner = randomBytes(24).toString('hex');
const readerPassword = decodeURIComponent(
  new URL(credentials.config.url).password,
);
const safe = (t) =>
  String(t ?? '')
    .replaceAll(owner, '[fixture owner]')
    .replaceAll(readerPassword, '[fixture reader]');
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input, binary = false, allowFailure = false) => {
  const r = spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: binary ? undefined : 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 33554432,
    },
  );
  if (!allowFailure) assert.equal(r.status, 0, safe(r.stderr));
  return r;
};
const checked = (args, input) => cli(args, input).stdout.trim();
const sql = (db, q, database = 'activity_copy') =>
  checked(
    [
      'exec',
      '-i',
      db,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    q,
  );
const value = (db, q) => JSON.parse(sql(db, q).split('\n').at(-1));
const snapQuery =
  'BEGIN;' +
  detailRowsFunction +
  (await readFile('scripts/reader-policies-snapshot.sql', 'utf8')) +
  'ROLLBACK;';
const before = value(source, snapQuery);
assert.deepEqual(
  before,
  await json(native.artifact + '/provisioned-snapshot.json'),
);
const inspected = JSON.parse(checked(['inspect', source]))[0];
assert.equal(inspected.State.Running, true);
assert.equal(inspected.HostConfig.NetworkMode, 'none');
assert.deepEqual(inspected.HostConfig.PortBindings, {});
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
assert(
  JSON.parse(
    checked(['image', 'inspect', inspected.Image]),
  )[0].RepoDigests.includes(pgImage),
);
const old = await json('.local/lot1a/activity-http-current.json');
assert.equal(old.phase, 'prepared');
const oldConfig = await json(old.artifact + '/private.json');
const network = oldConfig.names.network,
  edge = oldConfig.names.edge;
assert.match(network, /^novlearn-admin-activity-http-\d+-internal$/);
assert.match(edge, /^novlearn-admin-activity-http-\d+-edge$/);
const networks = JSON.parse(checked(['network', 'inspect', network, edge]));
assert.equal(networks[0].Internal, true);
assert.equal(networks[1].Internal, false);
assert.deepEqual(
  networks.map((n) => n.IPAM.Config.map((c) => c.Subnet)),
  [['10.253.240.0/28'], ['10.253.240.16/28']],
);
assert(
  Object.keys(networks[0].Containers).length <= 10,
  'Keep at least two free fixture addresses',
);
await new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(55436, '127.0.0.1', () => s.close(resolve));
});
const stamp = Date.now(),
  artifact = path.resolve('.local/lot1a/pedagogy-http-' + stamp),
  prefix = 'novlearn-admin-pedagogy-http-' + stamp;
const names = { db: prefix + '-db', proxy: prefix + '-proxy', network, edge };
await mkdir(artifact);
const state = {
  artifact,
  prefix,
  names,
  config: credentials.config,
  physicalConnectionQualified: false,
};
await writeFile(
  artifact + '/private.json',
  JSON.stringify(state, null, 2) + '\n',
  { mode: 0o600 },
);
const phase = async (step) =>
  writeFile(
    marker,
    JSON.stringify(
      { artifact, prefix, names, phase: 'creating', step },
      null,
      2,
    ) + '\n',
  );
await phase('backup');
const dump = cli(
  [
    'exec',
    source,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'activity_copy',
    '--format=custom',
    '--create',
  ],
  undefined,
  true,
).stdout;
assert(dump.subarray(0, 5).equals(Buffer.from('PGDMP')));
await writeFile(artifact + '/source-69.dump', dump);
const globals = checked([
  'exec',
  source,
  'pg_dumpall',
  '-U',
  'supabase_admin',
  '--roles-only',
]);
await writeFile(artifact + '/roles-private.sql', globals + '\n', {
  mode: 0o600,
});
const roles = before.metadata.roles.filter((r) =>
  r.rolname.startsWith('novlearn_'),
);
assert.equal(roles.length, 10);
assert(
  roles.every(
    (r) =>
      !r.rolsuper &&
      !r.rolcreatedb &&
      !r.rolcreaterole &&
      !r.rolreplication &&
      !r.rolbypassrls &&
      r.rolconfig === null,
  ),
);
const statements = globals
  .split(/\r?\n/)
  .filter((line) => /^(CREATE|ALTER) ROLE novlearn_[a-z_]+\b/.test(line));
for (const r of roles)
  assert.equal(
    statements.filter((line) => line === `CREATE ROLE ${r.rolname};`).length,
    1,
  );
const ident = (s) => '"' + s.replaceAll('"', '""') + '"';
for (const m of before.metadata.memberships.filter(
  (m) => m.role.startsWith('novlearn_') || m.member.startsWith('novlearn_'),
)) {
  assert(
    roles.some((r) => r.rolname === m.role) &&
      roles.some((r) => r.rolname === m.member),
  );
  statements.push(
    `SET ROLE ${ident(m.grantor)}; GRANT ${ident(m.role)} TO ${ident(m.member)} WITH ADMIN ${m.admin_option}, INHERIT ${m.inherit_option}, SET ${m.set_option}; RESET ROLE;`,
  );
}
await writeFile(
  artifact + '/owner.env',
  'POSTGRES_PASSWORD=' + owner + '\nPOSTGRES_DB=postgres\n',
  { mode: 0o600 },
);
for (const ext of ['crt', 'key'])
  await copyFile(
    native.artifact + '/server.' + ext,
    artifact + '/server.' + ext,
  );
await phase('start-new-database');
checked([
  'run',
  '-d',
  '--pull',
  'never',
  '--name',
  names.db,
  '--network',
  network,
  '--memory',
  '1g',
  '--memory-swap',
  '1g',
  '--pids-limit',
  '256',
  '--env-file',
  artifact + '/owner.env',
  '--mount',
  `type=bind,source=${artifact},target=/seed,readonly`,
  pgImage,
]);
let ready = false;
for (let i = 0; i < 40; i++) {
  if (
    cli(
      [
        'exec',
        names.db,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'supabase_admin',
        '-d',
        'postgres',
      ],
      undefined,
      false,
      true,
    ).status === 0
  ) {
    ready = true;
    break;
  }
  await delay(500);
}
assert(
  ready,
  'Inspect the same retained container; never recreate after observation timeout',
);
await phase('restore-new-database');
sql(names.db, statements.join('\n'), 'postgres');
const restored = cli([
  'exec',
  names.db,
  'pg_restore',
  '-U',
  'supabase_admin',
  '--dbname=postgres',
  '--create',
  '--exit-on-error',
  '/seed/source-69.dump',
]);
await writeFile(
  artifact + '/restore.log',
  restored.stdout + '\n' + restored.stderr,
);
// Ignore only built-in owner passwords and ACL array order when comparing copies.
const normalized = (s) => {
  const x = structuredClone(s);
  x.metadata.roles = x.metadata.roles.filter((r) =>
    r.rolname.startsWith('novlearn_'),
  );
  return JSON.parse(
    JSON.stringify(x, (k, v) =>
      k === 'acl' && typeof v === 'string' && v.startsWith('{')
        ? v.slice(1, -1).split(',').sort()
        : v,
    ),
  );
};
assert.deepEqual(
  normalized(value(names.db, snapQuery)),
  normalized(before),
  'Restored rows/sequences/schema/ACL/custom SCRAM identities must be exact',
);
await writeFile(
  artifact + '/source-snapshot.json',
  JSON.stringify(before, null, 2) + '\n',
);
await phase('tls-and-proxy');
for (const ext of ['key', 'crt'])
  checked([
    'cp',
    artifact + '/server.' + ext,
    names.db + ':/tmp/admin-pedagogy-http.' + ext,
  ]);
checked([
  'exec',
  names.db,
  'chown',
  'postgres:postgres',
  '/tmp/admin-pedagogy-http.key',
  '/tmp/admin-pedagogy-http.crt',
]);
checked([
  'exec',
  '--user',
  'postgres',
  names.db,
  'chmod',
  '600',
  '/tmp/admin-pedagogy-http.key',
]);
for (const [name, v] of [
  ['ssl_cert_file', '/tmp/admin-pedagogy-http.crt'],
  ['ssl_key_file', '/tmp/admin-pedagogy-http.key'],
  ['ssl', 'on'],
])
  sql(names.db, `ALTER SYSTEM SET ${name}='${v}';`, 'postgres');
checked([
  'create',
  '--pull',
  'never',
  '--name',
  names.proxy,
  '--network',
  network,
  '--memory',
  '64m',
  '--memory-swap',
  '64m',
  '--pids-limit',
  '32',
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--user',
  '65534:65534',
  '--publish',
  '127.0.0.1:55436:5436',
  '--env',
  'FIXTURE_PREFIX=' + prefix,
  '--mount',
  `type=bind,source=${path.resolve('scripts/pedagogy-http-pg-proxy.mjs')},target=/proxy.mjs,readonly`,
  nodeImage,
  'node',
  '/proxy.mjs',
]);
checked(['network', 'connect', edge, names.proxy]);
checked(['start', names.proxy]);
const proxy = JSON.parse(checked(['inspect', names.proxy]))[0],
  ip = proxy.NetworkSettings.Networks[network].IPAddress;
assert.match(ip, /^10\.253\.240\.\d+$/);
const hba = sql(names.db, 'SHOW hba_file;', 'postgres');
assert(hba.startsWith('/'));
checked(['cp', names.db + ':' + hba, artifact + '/pg_hba.before.conf']);
await writeFile(
  artifact + '/pg_hba.conf',
  [
    `hostssl activity_copy novlearn_admin_pedagogy_service ${ip}/32 scram-sha-256`,
    'host all novlearn_admin_pedagogy_service 0.0.0.0/0 reject',
    'host all novlearn_admin_pedagogy_service ::0/0 reject',
    'local all novlearn_admin_pedagogy_service reject',
    await readFile(artifact + '/pg_hba.before.conf', 'utf8'),
  ].join('\n'),
);
checked(['cp', artifact + '/pg_hba.conf', names.db + ':' + hba]);
checked(['exec', names.db, 'chown', 'postgres:postgres', hba]);
sql(names.db, 'SELECT pg_reload_conf();', 'postgres');
assert.equal(
  sql(
    names.db,
    'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;',
    'postgres',
  ),
  '0',
);
await phase('physical-host-reader');
await build({
  configFile: false,
  envDir: false,
  logLevel: 'error',
  build: {
    ssr: path.resolve('src/lib/pedagogy-pg.ts'),
    outDir: artifact + '/bundle',
    emptyOutDir: false,
    rolldownOptions: {
      external: ['pg', 'server-only'],
      output: { entryFileNames: 'reader.mjs' },
    },
  },
});
const { createLocalPedagogyReader } = await import(
  pathToFileURL(artifact + '/bundle/reader.mjs').href
);
const reader = createLocalPedagogyReader(state.config);
try {
  const query = {
    period: {
      from: '2026-10-15',
      to: '2026-10-17',
      until: '2026-10-18',
      days: 3,
    },
    chapter: null,
    competence: null,
    difficulty: null,
    exerciseType: null,
    mode: 'all',
    groupBy: 'chapter',
    sort: 'attempts',
    page: '1',
  };
  const result = await reader.read(query);
  assert.equal(result.environment, 'local-copy');
  const expected = await json(native.artifact + '/baseline-statistics.json');
  assert.equal(
    result.totals.exerciseAttempts,
    String(BigInt(expected.totals.exerciseAttempts) + 7n),
  );
  const choices = await reader.references({ kind: 'chapter', q: 'Ancien' });
  assert(
    choices.items.some((i) => i.id === 'ab100000-0000-4000-8000-000000000001'),
  );
  await writeFile(
    artifact + '/physical-results.json',
    JSON.stringify({ statistics: result, references: choices }, null, 2) + '\n',
  );
} finally {
  await reader.close();
}
assert.deepEqual(
  value(source, snapQuery),
  before,
  'Original native fixture must remain exact',
);
assert.deepEqual(
  normalized(value(names.db, snapQuery)),
  normalized(before),
  'New source must remain exact after reads',
);
const db = JSON.parse(checked(['inspect', names.db]))[0];
assert.deepEqual(Object.keys(db.NetworkSettings.Networks), [network]);
assert.deepEqual(db.HostConfig.PortBindings, {});
assert.deepEqual(proxy.HostConfig.PortBindings, {
  '5436/tcp': [{ HostIp: '127.0.0.1', HostPort: '55436' }],
});
state.physicalConnectionQualified = true;
await writeFile(
  artifact + '/private.json',
  JSON.stringify(state, null, 2) + '\n',
  { mode: 0o600 },
);
const proof = {
  result: 'PASS for separate SQL69 source and host verified-TLS reader',
  date: new Date().toISOString(),
  artifact,
  names,
  nativeProof: native.proof,
  sourceDumpSha256: sha(dump),
  tableRowsExact: 62,
  sequencesExact: 11,
  customRolesAndScramExact: 10,
  originalNativeSourceExact: true,
  mainDatabasesModified: false,
  existingCredentialsRotated: false,
  dbPortsPublished: false,
  proxyLoopbackPort: 55436,
  newPedagogyHttpExecuted: false,
  browserExecuted: false,
  remoteOperations: false,
};
await writeFile(
  artifact + '/preparation-proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  marker,
  JSON.stringify(
    {
      artifact,
      prefix,
      names,
      phase: 'prepared',
      proof: artifact + '/preparation-proof.json',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: proof.result,
    artifact,
    mainDatabasesModified: false,
  }),
);
