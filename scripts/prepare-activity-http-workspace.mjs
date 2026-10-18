// Creates one separate synthetic activity source; never changes an existing app DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { build } from 'vite';
assert(process.execArgv.includes('--conditions=react-server'));
const marker = '.local/lot1a/activity-http-current.json';
const resumeRestore = process.argv[2] === '--resume-restore';
const resume = process.argv[2] === '--resume' || resumeRestore;
assert(process.argv.length === (resume ? 3 : 2));
const retained = resume ? JSON.parse(await readFile(marker, 'utf8')) : null;
if (!resume) await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
if (retained) assert.equal(retained.phase, 'creating');
await new Promise((resolve, reject) => {
  const s = net.createServer();
  s.once('error', reject);
  s.listen(55435, '127.0.0.1', () => s.close(resolve));
});
const stamp = Date.now(),
  artifact =
    retained?.artifact ?? path.resolve('.local/lot1a/activity-http-' + stamp),
  prefix = retained?.prefix ?? 'novlearn-admin-activity-http-' + stamp;
assert.equal(
  path.dirname(artifact).toLowerCase(),
  path.resolve('.local/lot1a').toLowerCase(),
);
assert.match(path.basename(artifact), /^activity-http-\d+$/);
assert.match(prefix, /^novlearn-admin-activity-http-\d+$/);
if (!resume) await mkdir(artifact);
const names = {
  db: prefix + '-db',
  proxy: prefix + '-proxy',
  network: prefix + '-internal',
  edge: prefix + '-edge',
};
const dump = path.resolve(
  '.local/lot1a/activity-sql-1792341273740/activity-65.dump',
);
assert.equal(
  createHash('sha256')
    .update(await readFile(dump))
    .digest('hex'),
  '6df199f04a0693fc1cdb1841cb506c8a304920da754be120fedc4f2f806783d7',
);
const savedPrivate = resumeRestore
  ? JSON.parse(await readFile(artifact + '/private.json', 'utf8'))
  : null;
const secrets = savedPrivate?.secrets ?? {
  owner: resume
    ? (await readFile(artifact + '/owner.env', 'utf8')).match(
        /^POSTGRES_PASSWORD=(.+)$/m,
      )?.[1]
    : randomBytes(24).toString('hex'),
  reader: randomBytes(24).toString('hex'),
};
assert.match(secrets.owner, /^[0-9a-f]{48}$/);
const safe = (t) =>
  Object.values(secrets).reduce(
    (s, v) => s.replaceAll(v, '[fixture secret]'),
    String(t),
  );
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
    exe,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(r.status, 0, safe(r.stderr));
  return r.stdout.trim();
};
const pgImage =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
const sql = (s, db = 'activity_copy') =>
  cli(
    [
      'exec',
      '-i',
      names.db,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      db,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    s,
  );
await writeFile(
  artifact + '/owner.env',
  'POSTGRES_PASSWORD=' + secrets.owner + '\nPOSTGRES_DB=postgres\n',
);
await writeFile(
  marker,
  JSON.stringify({ artifact, prefix, names, phase: 'creating' }, null, 2) +
    '\n',
);
// Inspect ranges instead of pruning retained fixtures or changing Docker globals.
if (!resumeRestore) {
  const ids = cli(['network', 'ls', '-q']).split(/\r?\n/);
  assert(ids.every((id) => /^[0-9a-f]+$/.test(id)));
  const networks = JSON.parse(cli(['network', 'inspect', ...ids]));
  const routes = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Get-NetRoute -AddressFamily IPv4 | Select-Object -ExpandProperty DestinationPrefix | ConvertTo-Json -Compress',
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 10000 },
  );
  assert.equal(
    routes.status,
    0,
    'Inspect host IPv4 routes before selecting fixture networks',
  );
  const hostRanges = JSON.parse(routes.stdout);
  const ranges = [
    ...networks.flatMap((n) =>
      (n.IPAM.Config ?? []).map((c) => c.Subnet).filter(Boolean),
    ),
    ...hostRanges.filter((s) => s !== '0.0.0.0/0'),
  ].filter((s) => s.includes('.'));
  const span = (cidr) => {
    const [ip, bits] = cidr.split('/'),
      n = ip.split('.').reduce((n, v) => n * 256 + Number(v), 0),
      size = 2 ** (32 - Number(bits));
    return [
      Math.floor(n / size) * size,
      Math.floor(n / size) * size + size - 1,
    ];
  };
  const subnets = { internal: '10.253.240.0/28', edge: '10.253.240.16/28' };
  for (const subnet of Object.values(subnets)) {
    const [a, b] = span(subnet);
    assert(
      !ranges.some((r) => {
        const [c, d] = span(r);
        return a <= d && c <= b;
      }),
      'Candidate overlaps an existing host/Docker route',
    );
  }
  if (resume) {
    assert.equal(
      cli(['ps', '-a', '--filter', 'name=' + prefix, '--format', '{{.Names}}']),
      '',
    );
    assert(
      !networks.some((n) => Object.values(names).includes(n.Name)),
      'Only resume the pre-network failure; inspect partial resources otherwise',
    );
  }
  await writeFile(
    artifact + '/network-audit.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hostRanges,
        dockerRanges: networks.map((n) => ({
          name: n.Name,
          config: n.IPAM.Config,
        })),
        subnets,
        noOverlaps: true,
        noNetworksDeleted: true,
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    artifact + '/private.json',
    JSON.stringify(
      { artifact, prefix, names, secrets, physicalConnectionQualified: false },
      null,
      2,
    ) + '\n',
  );
  cli([
    'network',
    'create',
    '--internal',
    '--subnet',
    subnets.internal,
    names.network,
  ]);
  cli(['network', 'create', '--subnet', subnets.edge, names.edge]);
  cli([
    'run',
    '-d',
    '--pull',
    'never',
    '--name',
    names.db,
    '--network',
    names.network,
    '--memory',
    '1g',
    '--memory-swap',
    '1g',
    '--pids-limit',
    '256',
    '--env-file',
    artifact + '/owner.env',
    '--mount',
    `type=bind,source=${dump},target=/seed/activity.dump,readonly`,
    pgImage,
  ]);
}
let ready = false;
for (let i = 0; i < 40; i++) {
  const r = spawnSync(
    exe,
    [
      '--host',
      'npipe:////./pipe/dockerDesktopLinuxEngine',
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
    { windowsHide: true, timeout: 5000 },
  );
  if (r.status === 0) {
    ready = true;
    break;
  }
  await delay(500);
}
assert(
  ready,
  'Inspect this same retained container; do not recreate after observation timeout',
);
if (!resumeRestore)
  sql(
    'CREATE ROLE novlearn_publication_writer NOLOGIN NOINHERIT;CREATE ROLE novlearn_publication_executor NOLOGIN NOINHERIT;CREATE ROLE novlearn_publication_journal_executor NOLOGIN NOINHERIT;CREATE ROLE novlearn_activity_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;',
    'postgres',
  );
if (resumeRestore) {
  assert.equal(
    sql(
      "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_admin_activity_service';",
      'postgres',
    ),
    '0',
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM pg_stat_activity WHERE datname='activity_copy';",
      'postgres',
    ),
    '0',
  );
  const preserved = 'activity_incomplete_' + stamp;
  const partial = {
    authUsers: sql('SELECT count(*) FROM auth.users;'),
    attempts: sql('SELECT count(*) FROM public.exercise_attempts;'),
  };
  sql('ALTER DATABASE activity_copy RENAME TO ' + preserved + ';', 'postgres');
  await writeFile(
    artifact + '/partial-preserved.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        database: preserved,
        partial,
        rowsDeleted: false,
        reason:
          'Initial restore was interrupted by PostgreSQL temporary bootstrap shutdown; resume only after permanent TCP readiness',
      },
      null,
      2,
    ) + '\n',
  );
}
cli([
  'exec',
  names.db,
  'pg_restore',
  '-U',
  'supabase_admin',
  '--dbname=postgres',
  '--create',
  '--exit-on-error',
  '/seed/activity.dump',
]);
assert.equal(sql('SELECT count(*) FROM auth.users;'), '4');
assert.equal(
  sql(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_admin_activity_service';",
  ),
  '0',
);
const snapshot = () =>
  JSON.parse(
    sql(
      `CREATE FUNCTION pg_temp.activity_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.activity_snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const before = snapshot();
assert.deepEqual(
  before,
  JSON.parse(
    await readFile(
      '.local/lot1a/activity-pg-1792343332880/rows-before.json',
      'utf8',
    ),
  ),
);
await writeFile(
  artifact + '/rows-before.json',
  JSON.stringify(before, null, 2) + '\n',
);
cli([
  'run',
  '--rm',
  '--pull',
  'never',
  '--network',
  'none',
  '--memory',
  '128m',
  '--memory-swap',
  '128m',
  '--pids-limit',
  '32',
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--user',
  '65534:65534',
  '--mount',
  `type=bind,source=${artifact},target=/certificates`,
  nodeImage,
  'openssl',
  'req',
  '-new',
  '-x509',
  '-nodes',
  '-newkey',
  'rsa:2048',
  '-keyout',
  '/certificates/server.key',
  '-out',
  '/certificates/server.crt',
  '-subj',
  '/CN=activity-http-local-fixture',
  '-addext',
  'subjectAltName=IP:127.0.0.1',
  '-days',
  '7',
]);
for (const ext of ['key', 'crt'])
  cli([
    'cp',
    artifact + '/server.' + ext,
    names.db + ':/tmp/admin-activity-http.' + ext,
  ]);
cli([
  'exec',
  names.db,
  'chown',
  'postgres:postgres',
  '/tmp/admin-activity-http.key',
  '/tmp/admin-activity-http.crt',
]);
cli([
  'exec',
  '--user',
  'postgres',
  names.db,
  'chmod',
  '600',
  '/tmp/admin-activity-http.key',
]);
sql(
  "ALTER SYSTEM SET ssl_cert_file='/tmp/admin-activity-http.crt';",
  'postgres',
);
sql(
  "ALTER SYSTEM SET ssl_key_file='/tmp/admin-activity-http.key';",
  'postgres',
);
sql('ALTER SYSTEM SET ssl=on;', 'postgres');
cli([
  'create',
  '--pull',
  'never',
  '--name',
  names.proxy,
  '--network',
  names.network,
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
  '127.0.0.1:55435:5435',
  '--env',
  'FIXTURE_PREFIX=' + prefix,
  '--mount',
  `type=bind,source=${path.resolve('scripts/activity-http-pg-proxy.mjs')},target=/proxy.mjs,readonly`,
  nodeImage,
  'node',
  '/proxy.mjs',
]);
cli(['network', 'connect', names.edge, names.proxy]);
cli(['start', names.proxy]);
const proxy = JSON.parse(cli(['inspect', names.proxy]))[0];
const ip = proxy.NetworkSettings.Networks[names.network].IPAddress;
assert.match(ip, /^\d+\.\d+\.\d+\.\d+$/);
const hba = sql('SHOW hba_file;', 'postgres');
assert(hba.startsWith('/'));
cli(['cp', names.db + ':' + hba, artifact + '/pg_hba.before.conf']);
const original = await readFile(artifact + '/pg_hba.before.conf', 'utf8');
await writeFile(
  artifact + '/pg_hba.conf',
  [
    'hostssl activity_copy novlearn_admin_activity_service ' +
      ip +
      '/32 scram-sha-256',
    'hostssl activity_copy novlearn_admin_activity_service 127.0.0.1/32 scram-sha-256',
    'host all novlearn_admin_activity_service 0.0.0.0/0 reject',
    'host all novlearn_admin_activity_service ::0/0 reject',
    'local all novlearn_admin_activity_service reject',
    original,
  ].join('\n'),
);
cli(['cp', artifact + '/pg_hba.conf', names.db + ':' + hba]);
cli(['exec', names.db, 'chown', 'postgres:postgres', hba]);
sql(
  `SET password_encryption='scram-sha-256';CREATE ROLE novlearn_admin_activity_service LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets.reader}';GRANT novlearn_activity_reader TO novlearn_admin_activity_service WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
);
sql('SELECT pg_reload_conf();', 'postgres');
assert.equal(
  sql(
    'SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;',
    'postgres',
  ),
  '0',
);
const config = {
  url: `postgresql://novlearn_admin_activity_service:${secrets.reader}@127.0.0.1:55435/activity_copy`,
  ca: await readFile(artifact + '/server.crt', 'utf8'),
  environment: 'local-copy',
};
await writeFile(
  artifact + '/private.json',
  JSON.stringify(
    {
      artifact,
      prefix,
      names,
      secrets,
      config,
      physicalConnectionQualified: false,
    },
    null,
    2,
  ) + '\n',
);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'warn',
  build: {
    ssr: path.resolve('src/lib/activity-pg.ts'),
    outDir: artifact + '/bundle',
    emptyOutDir: false,
    rolldownOptions: {
      external: ['pg', 'server-only'],
      output: { entryFileNames: 'reader.mjs' },
    },
  },
});
const { createLocalActivityReader } = await import(
  pathToFileURL(artifact + '/bundle/reader.mjs').href
);
const reader = createLocalActivityReader(config);
try {
  const result = await reader.read({
    from: '2026-10-15',
    to: '2026-10-17',
    until: '2026-10-18',
    days: 3,
  });
  assert.equal(result.environment, 'local-copy');
  assert.equal(result.totals.exerciseAttempts, '5');
  assert.deepEqual(result.accounts, { total: '4', anonymous: '1' });
  await writeFile(
    artifact + '/physical-aggregate.json',
    JSON.stringify(result, null, 2) + '\n',
  );
} finally {
  await reader.close();
}
assert.deepEqual(snapshot(), before);
const db = JSON.parse(cli(['inspect', names.db]))[0];
assert.deepEqual(Object.keys(db.NetworkSettings.Networks), [names.network]);
assert.deepEqual(db.HostConfig.PortBindings, {});
assert.equal(
  cli(['network', 'inspect', '--format', '{{.Internal}}', names.network]),
  'true',
);
assert.deepEqual(proxy.HostConfig.PortBindings, {
  '5435/tcp': [{ HostIp: '127.0.0.1', HostPort: '55435' }],
});
await writeFile(
  artifact + '/private.json',
  JSON.stringify(
    {
      artifact,
      prefix,
      names,
      secrets,
      config,
      physicalConnectionQualified: true,
    },
    null,
    2,
  ) + '\n',
);
const proof = {
  result:
    'PASS for separate synthetic SQL source and physical host TLS aggregate read',
  date: new Date().toISOString(),
  artifact,
  prefix,
  names,
  sourceDumpSha256:
    '6df199f04a0693fc1cdb1841cb506c8a304920da754be120fedc4f2f806783d7',
  sourceTablesExact: 62,
  newLoginCreatedAfterRestore: true,
  roleAndLoginAuditedByRealReader: true,
  verifiedTls: true,
  internalDbNetwork: true,
  dbPortsPublished: false,
  proxyLoopbackPort: 55435,
  existingAppDatabasesModified: false,
  remoteOperations: false,
};
await writeFile(
  artifact + '/preparation-proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  marker,
  JSON.stringify({ artifact, prefix, names, phase: 'prepared' }, null, 2) +
    '\n',
);
console.log(
  JSON.stringify({
    result: proof.result,
    artifact,
    sourceTablesExact: 62,
    existingAppDatabasesModified: false,
  }),
);
