// Real Auth/PostgREST workspace on new local Docker resources only. No linked
// Supabase project, remote credential or existing application database is used.
import assert from 'node:assert/strict';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
const stamp = Date.now(),
  prefix = 'novlearn-admin-local-' + stamp;
const artifact = path.resolve('.local/local-admin-' + stamp);
const sourceContainer = 'novlearn-admin-lot1a-replay-20261016100059641';
const manifestFile = path.resolve(
  '../Novlearn/.local/admin-sql-replay/novlearn-admin-lot1a-replay-20261016100059641/manifest.json',
);
const manifestHash =
  '6d051125165f540db70f182a0343c014b47294c4671c728a9862209ecbed272b';
const images = {
  db: 'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4',
  auth: 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  rest: 'public.ecr.aws/supabase/postgrest@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf',
  api: 'public.ecr.aws/supabase/kong@sha256:1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d',
};
const names = Object.fromEntries(
  Object.keys(images).map((key) => [key, prefix + '-' + key]),
);
const network = prefix + '-net';
const edgeNetwork = prefix + '-loopback';
const apiOrigin = 'http://127.0.0.1:55431',
  appOrigin = 'http://127.0.0.1:3150';
const secrets = {
  db: randomBytes(24).toString('hex'),
  auth: randomBytes(24).toString('hex'),
  rest: randomBytes(24).toString('hex'),
  jwt: randomBytes(48).toString('hex'),
  adminPassword: randomBytes(24).toString('base64url'),
  userPassword: randomBytes(24).toString('base64url'),
};
const secretValues = Object.values(secrets);
const safe = (value) =>
  secretValues.reduce(
    (text, secret) => text.replaceAll(secret, '[local secret]'),
    String(value),
  );
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const cli = (args, input) => {
  const result = spawnSync(docker, ['--host', endpoint, ...args], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  assert.equal(result.status, 0, safe(result.stderr));
  return result.stdout.trim();
};
const sql = (container, database, text) =>
  cli(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    text,
  );
const sha = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
const literal = (text) =>
  `convert_from(decode('${Buffer.from(text).toString('base64')}','base64'),'UTF8')`;
const snapshot = (container, database) =>
  JSON.parse(
    sql(
      container,
      database,
      `CREATE FUNCTION pg_temp.snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; j jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h; j:=j||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h)); END LOOP; RETURN j; END;$$; SELECT pg_temp.snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const waitPg = async (name) => {
  for (let i = 0; i < 60; i++) {
    const r = spawnSync(
      docker,
      [
        '--host',
        endpoint,
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'supabase_admin',
        '-d',
        'postgres',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    if (r.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error('Local database did not become ready');
};
const jwt = (role) => {
  const body = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        iss: 'supabase',
        ref: 'novlearn-admin-local',
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 365,
        aud: 'authenticated',
      }),
    ).toString('base64url'),
  ].join('.');
  const token =
    body +
    '.' +
    createHmac('sha256', secrets.jwt).update(body).digest('base64url');
  secretValues.push(token);
  return token;
};
const anonKey = jwt('anon'),
  serviceKey = jwt('service_role');
await mkdir(artifact, { recursive: true });
await writeFile(
  path.join(artifact, 'private.json'),
  JSON.stringify(
    {
      prefix,
      names,
      network,
      artifact,
      images,
      accounts: [],
      secrets,
      anonKey,
      serviceKey,
      database: 'admin_local',
      pending: true,
    },
    null,
    2,
  ) + '\n',
);
let sourceStarted = false;
const created = [];
try {
  assert.equal(await sha(manifestFile), manifestHash);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  assert.equal(manifest.length, 63);
  for (const file of manifest)
    assert.equal(
      await sha(path.resolve('../Novlearn/supabase/migrations', file.name)),
      file.sha256,
      file.name,
    );
  for (const port of [3150, 55431])
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', () =>
        reject(Error('Local workspace port already in use: ' + port)),
      );
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
  assert.equal(
    cli(['info', '--format', '{{.OSType}} {{.CgroupVersion}}']),
    'linux 2',
  );
  assert.equal(
    cli([
      'inspect',
      '--format',
      '{{.HostConfig.NetworkMode}}',
      sourceContainer,
    ]),
    'none',
  );
  assert.equal(
    cli(['inspect', '--format', '{{.State.Running}}', sourceContainer]),
    'false',
    'Do not interrupt a live source fixture',
  );
  cli(['start', sourceContainer]);
  sourceStarted = true;
  await waitPg(sourceContainer);
  const original = snapshot(sourceContainer, 'postgres');
  assert.equal(
    original['auth.users'].rows,
    0,
    'Pristine replay must contain no account',
  );
  cli([
    'exec',
    sourceContainer,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '--format=custom',
    '--file=/tmp/' + prefix + '.dump',
  ]);
  cli([
    'cp',
    sourceContainer + ':/tmp/' + prefix + '.dump',
    path.join(artifact, 'source.dump'),
  ]);
  assert.deepEqual(snapshot(sourceContainer, 'postgres'), original);
  cli(['stop', '--timeout', '15', sourceContainer]);
  sourceStarted = false;
  await writeFile(
    path.join(artifact, 'manifest.json'),
    await readFile(manifestFile),
  );
  await writeFile(
    path.join(artifact, 'db.env'),
    'POSTGRES_PASSWORD=' + secrets.db + '\nPOSTGRES_DB=postgres\n',
  );
  cli(['network', 'create', '--internal', network]);
  cli([
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
    path.join(artifact, 'db.env'),
    '--mount',
    `type=bind,source=${path.join(artifact, 'source.dump')},target=/seed/source.dump,readonly`,
    images.db,
  ]);
  created.push(names.db);
  await waitPg(names.db);
  sql(
    names.db,
    'postgres',
    `CREATE ROLE novlearn_publication_writer NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_executor NOLOGIN NOINHERIT; CREATE ROLE novlearn_publication_journal_executor NOLOGIN NOINHERIT; CREATE ROLE novlearn_admin_local_api LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets.rest}'; GRANT anon,authenticated TO novlearn_admin_local_api; ALTER ROLE supabase_auth_admin LOGIN PASSWORD '${secrets.auth}';`,
  );
  cli([
    'exec',
    names.db,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    'admin_local',
  ]);
  cli([
    'exec',
    names.db,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'admin_local',
    '--exit-on-error',
    '--single-transaction',
    '/seed/source.dump',
  ]);
  assert.deepEqual(snapshot(names.db, 'admin_local'), original);
  await writeFile(
    path.join(artifact, 'auth.env'),
    Object.entries({
      GOTRUE_API_HOST: '0.0.0.0',
      GOTRUE_API_PORT: '9999',
      API_EXTERNAL_URL: apiOrigin + '/auth/v1',
      GOTRUE_DB_DRIVER: 'postgres',
      GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${secrets.auth}@${names.db}:5432/admin_local?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: 'auth',
      GOTRUE_SITE_URL: appOrigin,
      GOTRUE_URI_ALLOW_LIST: appOrigin + '/**',
      GOTRUE_DISABLE_SIGNUP: 'true',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role',
      GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      GOTRUE_JWT_EXP: '3600',
      GOTRUE_JWT_SECRET: secrets.jwt,
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false',
      GOTRUE_MAILER_AUTOCONFIRM: 'true',
      GOTRUE_LOG_LEVEL: 'error',
    })
      .map(([key, value]) => key + '=' + value)
      .join('\n') + '\n',
  );
  await writeFile(
    path.join(artifact, 'rest.env'),
    Object.entries({
      PGRST_DB_URI: `postgres://novlearn_admin_local_api:${secrets.rest}@${names.db}:5432/admin_local?sslmode=disable`,
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: secrets.jwt,
      PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
      PGRST_DB_MAX_ROWS: '1000',
      PGRST_LOG_LEVEL: 'error',
    })
      .map(([key, value]) => key + '=' + value)
      .join('\n') + '\n',
  );
  for (const key of ['auth', 'rest']) {
    cli([
      'run',
      '-d',
      '--pull',
      'never',
      '--name',
      names[key],
      '--network',
      network,
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--pids-limit',
      '128',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--env-file',
      path.join(artifact, key + '.env'),
      images[key],
      ...(key === 'auth' ? ['auth', 'serve'] : []),
    ]);
    created.push(names[key]);
  }
  const consumers = [
    {
      username: 'local-anon',
      keyauth_credentials: [{ key: anonKey }],
      acls: [{ group: 'local' }],
    },
    {
      username: 'local-service',
      keyauth_credentials: [{ key: serviceKey }],
      acls: [{ group: 'local' }],
    },
  ];
  const services = [
    ['auth', 9999, '/auth/v1/'],
    ['rest', 3000, '/rest/v1/'],
  ].map(([key, port, route]) => ({
    name: key,
    url: `http://${names[key]}:${port}/`,
    routes: [{ name: key, paths: [route], strip_path: true }],
    plugins: [
      {
        name: 'key-auth',
        config: { key_names: ['apikey'], hide_credentials: false },
      },
      { name: 'acl', config: { allow: ['local'], hide_groups_header: true } },
    ],
  }));
  await writeFile(
    path.join(artifact, 'kong.json'),
    JSON.stringify(
      { _format_version: '2.1', _transform: true, consumers, services },
      null,
      2,
    ) + '\n',
  );
  cli([
    'network',
    'create',
    '--opt',
    'com.docker.network.bridge.host_binding_ipv4=127.0.0.1',
    edgeNetwork,
  ]);
  cli([
    'create',
    '--pull',
    'never',
    '--name',
    names.api,
    '--network',
    edgeNetwork,
    '--memory',
    '512m',
    '--memory-swap',
    '512m',
    '--pids-limit',
    '128',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '-p',
    '127.0.0.1:55431:8000',
    '-e',
    'KONG_DATABASE=off',
    '-e',
    'KONG_DECLARATIVE_CONFIG=/local/kong.json',
    '-e',
    'KONG_PROXY_LISTEN=0.0.0.0:8000',
    '-e',
    'KONG_ADMIN_LISTEN=off',
    '-e',
    'KONG_PREFIX=/tmp/kong',
    '-e',
    'KONG_NGINX_WORKER_PROCESSES=2',
    '-e',
    'KONG_LOG_LEVEL=error',
    '--mount',
    `type=bind,source=${path.join(artifact, 'kong.json')},target=/local/kong.json,readonly`,
    images.api,
  ]);
  created.push(names.api);
  cli(['network', 'connect', network, names.api]);
  cli(['start', names.api]);
  let healthy = false,
    lastHealth = 'no response';
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(apiOrigin + '/auth/v1/health', {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        healthy = true;
        break;
      }
      lastHealth =
        'HTTP ' + response.status + ' ' + (await response.text()).slice(0, 300);
    } catch (error) {
      lastHealth = error.name;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!healthy) throw Error('Local Auth not ready: ' + safe(lastHealth));
  const accounts = [];
  for (const kind of ['admin', 'user']) {
    const email = kind + '@novlearn-admin.local.invalid',
      password = secrets[kind + 'Password'];
    const response = await fetch(apiOrigin + '/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        authorization: 'Bearer ' + serviceKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: 'Local ' + kind,
          birth_date: '2000-01-01',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    assert.equal(response.status, 200, safe(JSON.stringify(body)));
    assert.match(body.id, /^[0-9a-f-]{36}$/);
    if (kind === 'admin')
      sql(
        names.db,
        'admin_local',
        `UPDATE public.profiles SET role='admin' WHERE id=${literal(body.id)}::uuid;`,
      );
    accounts.push({ kind, id: body.id, email, password });
  }
  const authConfig = {
    NODE_ENV: 'development',
    ADMIN_LOCAL_WORKSPACE_ENABLED: 'true',
    ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: manifestHash,
    ADMIN_LOCAL_SUPABASE_URL: apiOrigin,
    ADMIN_LOCAL_SUPABASE_ANON_KEY: anonKey,
    APP_BASE_URL: appOrigin,
    ADMIN_STAGING_AUTH_ENABLED: 'false',
    ADMIN_PUBLICATION_ENABLED: 'false',
    ADMIN_ENGINE_ENABLED: 'false',
  };
  await writeFile(
    path.join(artifact, 'private.json'),
    JSON.stringify(
      {
        prefix,
        names,
        network,
        edgeNetwork,
        artifact,
        images,
        authConfig,
        accounts,
        secrets,
        anonKey,
        serviceKey,
        database: 'admin_local',
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    path.join(artifact, 'app-config.json'),
    JSON.stringify({ artifact, authConfig, schemaVersion: 63 }, null, 2) + '\n',
  );
  await writeFile(
    path.join(artifact, 'login.txt'),
    `Application locale : ${appOrigin}\nCompte : ${accounts[0].email}\nMot de passe : ${accounts[0].password}\n\nCes identifiants appartiennent uniquement à cette copie locale.\n`,
  );
  const proof = {
    result: 'PASS for local real Auth bootstrap and exact database clone only',
    date: new Date().toISOString(),
    schemaMigrations: 63,
    manifestSha256: manifestHash,
    sourceDumpSha256: await sha(path.join(artifact, 'source.dump')),
    sourceRowsUnchanged: true,
    clonedRowsMatch: true,
    sourceAccounts: 0,
    createdAuthAccounts: accounts.map(({ kind, id }) => ({ kind, id })),
    realAuth: true,
    realPostgrestPending: true,
    applicationLoginPending: true,
    engineEnabled: false,
    apiOrigin,
    appOrigin,
    internalBackendNetwork: true,
    loopbackGatewayNetwork: edgeNetwork,
    onlyPublishedPort: '127.0.0.1:55431',
    images,
    names,
    sourceContainer,
  };
  await writeFile(
    path.join(artifact, 'bootstrap-proof.json'),
    JSON.stringify(proof, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      scope: proof.result,
      artifact,
      appOrigin,
      applicationStarted: false,
    }),
  );
} catch (error) {
  await writeFile(
    path.join(artifact, 'failure.txt'),
    safe(error?.stack ?? error),
  );
  for (const name of created) {
    try {
      cli(['stop', '--timeout', '15', name]);
    } catch {}
  }
  throw Error(safe(error?.message ?? error));
} finally {
  if (sourceStarted) cli(['stop', '--timeout', '15', sourceContainer]);
}
