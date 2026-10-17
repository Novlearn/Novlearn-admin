// Dedicated source/target preparation only. Never accepts a remote Docker
// endpoint or a workspace belonging to the ordinary application.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import { build } from 'vite';
import { certifiedEngineIdentity } from '../src/lib/engine-identity.ts';
const artifact = path.resolve(process.argv[2] ?? '');
assert(
  artifact
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
assert.match(path.basename(artifact), /^local-admin-publication-\d+$/);
const state = JSON.parse(await readFile(artifact + '/private.json', 'utf8'));
assert.equal(state.artifact, artifact);
assert.equal(
  state.authConfig.ADMIN_LOCAL_SUPABASE_URL,
  'http://127.0.0.1:55432',
);
assert.match(state.prefix, /^novlearn-admin-publication-local-\d+$/);
assert.equal(state.names.db, state.prefix + '-db');
const marker = artifact + '/publication-pg.json';
await assert.rejects(access(marker), (e) => e.code === 'ENOENT');
for (const port of [55433, 55434])
  await new Promise((resolve, reject) => {
    const p = net.createServer();
    p.once('error', reject);
    p.listen(port, '127.0.0.1', () => p.close(resolve));
  });
const directory = artifact + '/pg-' + Date.now();
await mkdir(directory);
const target = state.prefix + '-target-db',
  proxy = state.prefix + '-pg-proxy';
const nodeImage =
  'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b';
const secrets = {
  targetOwner: randomBytes(24).toString('hex'),
  source: randomBytes(24).toString('hex'),
  target: randomBytes(24).toString('hex'),
};
const safe = (t) =>
  [...Object.values(secrets), ...Object.values(state.secrets)].reduce(
    (s, v) => s.replaceAll(v, '[fixture secret]'),
    String(t),
  );
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) => {
  const r = spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 16777216,
    },
  );
  assert.equal(r.status, 0, safe(r.stderr));
  return r.stdout.trim();
};
const sql = (name, db, input) =>
  cli(
    [
      'exec',
      '-i',
      name,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      db,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    input,
  );
const snapshot = (name) =>
  JSON.parse(
    sql(
      name,
      'admin_local',
      `CREATE FUNCTION pg_temp.snap() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.snap();`,
    )
      .split('\n')
      .at(-1),
  );
assert.equal(
  cli(['inspect', '--format', '{{.Internal}}', state.network]),
  'true',
);
assert.equal(
  cli(['inspect', '--format', '{{.Config.Image}}', state.names.db]),
  state.images.db,
);
const stopped = [],
  created = [];
const checks = [];
try {
  for (const name of [state.names.api, state.names.auth, state.names.rest]) {
    assert.equal(
      cli(['inspect', '--format', '{{.State.Running}}', name]),
      'true',
    );
    cli(['stop', '--timeout', '15', name]);
    stopped.push(name);
  }
  const before = snapshot(state.names.db);
  const runtimeRow = (name) =>
    JSON.parse(
      sql(
        name,
        'admin_local',
        'SELECT to_jsonb(r) FROM novlearn_admin_private.publication_runtime r WHERE singleton;',
      ),
    );
  const assertClosedRuntime = (row) => {
    assert.equal(row.enabled, false);
    assert.equal(
      row.engine_archive_sha256,
      certifiedEngineIdentity.engineArchiveSha256,
    );
  };
  assertClosedRuntime(runtimeRow(state.names.db));
  assert.equal(Object.keys(before).length, 62);
  await writeFile(
    directory + '/source-before.json',
    JSON.stringify(before, null, 2),
  );
  await writeFile(
    directory + '/target.env',
    'POSTGRES_PASSWORD=' + secrets.targetOwner + '\nPOSTGRES_DB=postgres\n',
  );
  cli([
    'run',
    '-d',
    '--pull',
    'never',
    '--name',
    target,
    '--network',
    state.network,
    '--memory',
    '1g',
    '--memory-swap',
    '1g',
    '--pids-limit',
    '256',
    '--env-file',
    directory + '/target.env',
    '--mount',
    `type=bind,source=${artifact},target=/fixture,readonly`,
    state.images.db,
  ]);
  created.push(target);
  for (let i = 0; ; i++) {
    const r = spawnSync(
      docker,
      [
        '--host',
        'npipe:////./pipe/dockerDesktopLinuxEngine',
        'exec',
        target,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'supabase_admin',
        '-d',
        'postgres',
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (r.status === 0) break;
    assert(i < 30, 'Target readiness');
    await new Promise((r) => setTimeout(r, 1000));
  }
  sql(
    target,
    'postgres',
    'CREATE ROLE novlearn_publication_writer NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_executor NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_journal_executor NOLOGIN NOINHERIT;',
  );
  cli([
    'exec',
    target,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    'admin_local',
  ]);
  cli([
    'exec',
    target,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'admin_local',
    '--single-transaction',
    '--exit-on-error',
    '/fixture/source.dump',
  ]);
  const targetBefore = snapshot(target);
  assertClosedRuntime(runtimeRow(target));
  assert.equal(targetBefore['auth.users'].rows, 0);
  assert.equal(Object.keys(targetBefore).length, 62);
  checks.push(
    'Separate target restored from pristine SQL 64 dump with zero Auth accounts',
  );
  for (const [label, name] of [
    ['source', state.names.db],
    ['target', target],
  ]) {
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
      `type=bind,source=${directory},target=/certificates`,
      nodeImage,
      'openssl',
      'req',
      '-new',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      '/certificates/' + label + '.key',
      '-out',
      '/certificates/' + label + '.crt',
      '-subj',
      '/CN=local-publication-fixture',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-days',
      '7',
    ]);
    for (const ext of ['key', 'crt'])
      cli([
        'cp',
        directory + '/' + label + '.' + ext,
        name + ':/tmp/publication-http-' + label + '.' + ext,
      ]);
    cli([
      'exec',
      name,
      'chown',
      'postgres:postgres',
      '/tmp/publication-http-' + label + '.key',
      '/tmp/publication-http-' + label + '.crt',
    ]);
    cli([
      'exec',
      '--user',
      'postgres',
      name,
      'chmod',
      '600',
      '/tmp/publication-http-' + label + '.key',
    ]);
    sql(
      name,
      'postgres',
      `ALTER SYSTEM SET ssl_cert_file='/tmp/publication-http-${label}.crt';`,
    );
    sql(
      name,
      'postgres',
      `ALTER SYSTEM SET ssl_key_file='/tmp/publication-http-${label}.key';`,
    );
    sql(name, 'postgres', 'ALTER SYSTEM SET ssl=on;');
    sql(name, 'postgres', 'SELECT pg_reload_conf();');
  }
  sql(
    state.names.db,
    'admin_local',
    `SET password_encryption='scram-sha-256'; CREATE ROLE novlearn_admin_journal_service LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets.source}'; GRANT novlearn_publication_journal_executor TO novlearn_admin_journal_service;`,
  );
  sql(
    target,
    'admin_local',
    `SET password_encryption='scram-sha-256'; CREATE ROLE novlearn_admin_publication_service LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets.target}'; GRANT novlearn_publication_executor TO novlearn_admin_publication_service;`,
  );
  const config = {
    source: {
      url: `postgresql://novlearn_admin_journal_service:${secrets.source}@127.0.0.1:55433/admin_local`,
      ca: await readFile(directory + '/source.crt', 'utf8'),
    },
    target: {
      url: `postgresql://novlearn_admin_publication_service:${secrets.target}@127.0.0.1:55434/admin_local`,
      ca: await readFile(directory + '/target.crt', 'utf8'),
    },
    targetKey: 'local-http-fixture',
    review: 'isolated SQL 64 qualification only',
  };
  await writeFile(
    directory + '/pg-private.json',
    JSON.stringify(
      {
        artifact,
        directory,
        target,
        proxy,
        secrets,
        config,
        publicationEnabled: false,
      },
      null,
      2,
    ) + '\n',
  );
  cli([
    'create',
    '--pull',
    'never',
    '--name',
    proxy,
    '--network',
    state.network,
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
    '127.0.0.1:55433:5433',
    '--publish',
    '127.0.0.1:55434:5434',
    '--env',
    'FIXTURE_PREFIX=' + state.prefix,
    '--mount',
    `type=bind,source=${path.resolve('scripts/publication-http-pg-proxy.mjs')},target=/proxy.mjs,readonly`,
    nodeImage,
    'node',
    '/proxy.mjs',
  ]);
  created.push(proxy);
  cli(['network', 'connect', state.edgeNetwork, proxy]);
  cli(['start', proxy]);
  const entry = directory + '/driver-entry.ts';
  await writeFile(
    entry,
    "export {createPublicationPgPools} from '" +
      path.resolve('src/lib/publication-pg.ts').replaceAll('\\', '/') +
      "';\n",
  );
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      ssr: entry,
      outDir: directory + '/bundle',
      emptyOutDir: false,
      rolldownOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: 'driver.mjs' },
      },
    },
  });
  const r = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      'scripts/test-publication-http-pg-worker.mjs',
      directory,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4194304 },
  );
  await writeFile(directory + '/connection.log', safe(r.stdout + r.stderr));
  assert.equal(
    r.status,
    0,
    'Physical TLS qualification failed; inspect retained log',
  );
  assert.deepEqual(snapshot(state.names.db), before);
  assert.deepEqual(snapshot(target), targetBefore);
  checks.push(
    'All 62 source and target table snapshots remain unchanged after TLS and identity checks',
  );
  const inspect = (name) => {
    const c = JSON.parse(cli(['inspect', name]))[0];
    return {
      name,
      running: c.State.Running,
      ports: c.HostConfig.PortBindings,
      networks: Object.keys(c.NetworkSettings.Networks),
      memory: c.HostConfig.Memory,
      memorySwap: c.HostConfig.MemorySwap,
      pids: c.HostConfig.PidsLimit,
      readOnly: c.HostConfig.ReadonlyRootfs,
      user: c.Config.User,
      capDrop: c.HostConfig.CapDrop,
      securityOpt: c.HostConfig.SecurityOpt,
    };
  };
  const connections = JSON.parse(
    await readFile(directory + '/connection-proof.json', 'utf8'),
  );
  const targetInspection = inspect(target),
    sourceInspection = inspect(state.names.db),
    proxyInspection = inspect(proxy);
  for (const db of [targetInspection, sourceInspection]) {
    assert.deepEqual(db.networks, [state.network]);
    assert(Object.values(db.ports ?? {}).every((value) => !value?.length));
    assertClosedRuntime(runtimeRow(db.name));
  }
  assert.deepEqual(
    proxyInspection.networks.sort(),
    [state.network, state.edgeNetwork].sort(),
  );
  assert.deepEqual(proxyInspection.ports, {
    '5433/tcp': [{ HostIp: '127.0.0.1', HostPort: '55433' }],
    '5434/tcp': [{ HostIp: '127.0.0.1', HostPort: '55434' }],
  });
  const proof = {
    result: 'PASS for isolated source/target TLS preparation only',
    date: new Date().toISOString(),
    artifact,
    directory,
    checks,
    connections,
    target: targetInspection,
    proxy: proxyInspection,
    sourceDatabase: sourceInspection,
    sourceTablesPreserved: 62,
    targetTablesPreserved: 62,
    targetPristine: true,
    sourceDumpSha256: createHash('sha256')
      .update(await readFile(artifact + '/source.dump'))
      .digest('hex'),
    publicationEnabled: false,
    targetRuntimeEnabled: false,
    targetApplyExecuted: false,
    publicationHttpExecuted: false,
  };
  await writeFile(
    directory + '/proof.json',
    JSON.stringify(proof, null, 2) + '\n',
  );
  await writeFile(
    marker,
    JSON.stringify(
      {
        artifact,
        directory,
        target,
        proxy,
        privateFile: directory + '/pg-private.json',
        proof: directory + '/proof.json',
        publicationEnabled: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      result: proof.result,
      directory,
      tlsChecks: connections.checks.length,
      targetApplyExecuted: false,
      publicationHttpExecuted: false,
    }),
  );
} catch (error) {
  await writeFile(directory + '/failure.txt', safe(error?.stack ?? error));
  for (const name of created.reverse())
    try {
      cli(['stop', '--timeout', '15', name]);
    } catch {}
  throw Error('Isolated PostgreSQL preparation failed; see retained artifact');
} finally {
  for (const name of stopped.reverse()) cli(['start', name]);
}
