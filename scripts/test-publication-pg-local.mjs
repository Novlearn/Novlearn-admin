// Actual TLS/SQL tests on a newly retained local fixture. No remote connection,
// trigger-planting probe, live Auth or remote publication is performed.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { build } from 'vite';

assert(
  process.execArgv.includes('--conditions=react-server'),
  'Run with --conditions=react-server',
);
const stamp = Date.now();
const targetTransactions = process.argv.includes('--target-transactions');
const pristineContainer = 'novlearn-admin-lot1a-replay-20261015132052356';
const artifact = path.resolve('.local/lot1a/publication-pg-' + stamp);
await mkdir(artifact, { recursive: true });
const container = 'novlearn-admin-pg-' + stamp;
const network = container + '-internal';
const sourceContainer = 'novlearn-admin-lot1a-replay-20261015125108699';
const sourceDatabase = 'admin_receipt_native_1792068827587';
const actor = '98500000-0000-4000-8000-000000000001';
const version = 'c3368fa2-3c7e-4824-b38d-cd3183d7a620';
const sourceRole = 'novlearn_publication_journal_executor';
const targetRole = 'novlearn_publication_executor';
const sourceLogin = 'novlearn_admin_journal_service';
const targetLogin = 'novlearn_admin_publication_service';
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine';
const secrets = [
  randomBytes(24).toString('hex'),
  randomBytes(24).toString('hex'),
  randomBytes(24).toString('hex'),
];
const safe = (text) =>
  secrets.reduce(
    (text, secret) => text.replaceAll(secret, '[fixture secret]'),
    String(text),
  );
const cli = (args, input, allowFailure = false) => {
  const result = spawnSync(docker, ['--host', endpoint, ...args], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 16777216,
  });
  if (!allowFailure) assert.equal(result.status, 0, safe(result.stderr));
  return result;
};
const sqlAt = (name, database, statement) =>
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
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    statement,
  ).stdout.trim();
const sql = (database, statement) => sqlAt(container, database, statement);
const value = (database, statement) =>
  JSON.parse(sql(database, statement).split('\n').at(-1));
const snapshot = (name, database) =>
  JSON.parse(
    sqlAt(
      name,
      database,
      `CREATE FUNCTION pg_temp.all_rows() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.all_rows();`,
    )
      .split('\n')
      .at(-1),
  );
const wait = async (name) => {
  for (let i = 0; i < 40; i++) {
    if (
      cli(
        [
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
        undefined,
        true,
      ).status === 0
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error('Local PostgreSQL not ready');
};
let sourceStarted = false,
  created = false,
  pristineStarted = false,
  clientProcess,
  clientExit;
const checks = [];
try {
  assert.equal(
    cli([
      'inspect',
      '--format',
      '{{.HostConfig.NetworkMode}}',
      sourceContainer,
    ]).stdout.trim(),
    'none',
  );
  assert.equal(
    cli([
      'inspect',
      '--format',
      '{{.State.Running}}',
      sourceContainer,
    ]).stdout.trim(),
    'false',
    'Do not interrupt another fixture run',
  );
  cli(['start', sourceContainer]);
  sourceStarted = true;
  await wait(sourceContainer);
  const originalRows = snapshot(sourceContainer, sourceDatabase);
  cli([
    'exec',
    sourceContainer,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    sourceDatabase,
    '--format=custom',
    `--file=/tmp/pg-source-${stamp}.dump`,
  ]);
  cli([
    'cp',
    `${sourceContainer}:/tmp/pg-source-${stamp}.dump`,
    path.join(artifact, 'source.dump'),
  ]);
  assert.deepEqual(snapshot(sourceContainer, sourceDatabase), originalRows);
  cli(['stop', '--timeout', '15', sourceContainer]);
  sourceStarted = false;
  checks.push('Original native-approved fixture unchanged by dump');
  console.log('Source copied; original fixture stopped.');
  await writeFile(
    path.join(artifact, 'fixture.env'),
    `POSTGRES_PASSWORD=${secrets[0]}\nPOSTGRES_DB=postgres\n`,
  );
  cli(['network', 'create', '--internal', network]);
  assert.equal(
    cli([
      'network',
      'inspect',
      '--format',
      '{{.Internal}}',
      network,
    ]).stdout.trim(),
    'true',
  );
  cli([
    'run',
    '--detach',
    '--pull',
    'never',
    '--name',
    container,
    '--network',
    network,
    '--env-file',
    path.join(artifact, 'fixture.env'),
    '--mount',
    `type=bind,source=${artifact},target=/fixture-input,readonly`,
    'public.ecr.aws/supabase/postgres:17.11.0.003',
  ]);
  created = true;
  await wait(container);
  const inspect = JSON.parse(cli(['inspect', container]).stdout)[0];
  assert(
    Object.values(inspect.NetworkSettings.Ports).every(
      (binding) => !binding || binding.length === 0,
    ),
  );
  sql(
    'postgres',
    `CREATE ROLE novlearn_publication_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; CREATE ROLE ${targetRole} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; CREATE ROLE ${sourceRole} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;`,
  );
  for (const database of ['source_fixture', 'target_fixture']) {
    cli([
      'exec',
      container,
      'createdb',
      '-U',
      'supabase_admin',
      '--template=template0',
      database,
    ]);
    cli([
      'exec',
      container,
      'pg_restore',
      '-U',
      'supabase_admin',
      '-d',
      database,
      '--exit-on-error',
      '--single-transaction',
      '/fixture-input/source.dump',
    ]);
    assert.deepEqual(snapshot(container, database), originalRows);
  }
  const migration = path.resolve(
    '../Novlearn/supabase/migrations/20261015131620_novlearn_admin_publication_recovery.sql',
  );
  cli(['cp', migration, container + ':/tmp/recovery.sql']);
  cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'source_fixture',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '/tmp/recovery.sql',
  ]);
  assert.deepEqual(snapshot(container, 'source_fixture'), originalRows);
  checks.push('Migration 61 changes no table rows in restored copy');
  // Prepare a real plan from the native-reviewed source. Inspection is explicitly
  // synthetic and cannot authorize a target write in this fixture.
  const template = value(
    'source_fixture',
    `BEGIN; SELECT novlearn_admin_private.publication_journal_actor('${actor}'); CREATE TEMP TABLE fixture_export AS SELECT public.admin_export_exercise_publication(v.id,v.approval_fingerprint_sha256,v.test_epoch,v.definition) AS exported,v.* FROM public.exercise_versions v WHERE v.id='${version}'; SELECT novlearn_admin_private.prepare_publication_operation('${actor}',gen_random_uuid(),id,approval_fingerprint_sha256,test_epoch,definition,'recovery-template','publish',jsonb_build_object('desiredHeader',novlearn_admin_private.publication_header(definition),'state',jsonb_build_object('catalogId',exported->'payload'->'catalogId','requestedRevision',exported->'payload'->'revision','latestRevision',0,'stateToken',repeat('c',64),'runtime',(exported->'payload')-ARRAY['schemaVersion','catalogId','revision','definitionJson','businessDigest'],'parent',NULL,'candidate',NULL,'active',NULL))) FROM fixture_export; COMMIT;`,
  );
  assert.equal(template.state, 'planned');
  const beforeFixtures = snapshot(container, 'source_fixture');
  cli([
    'cp',
    path.resolve('scripts/test-publication-recovery-local.sql'),
    container + ':/tmp/recovery-tests.sql',
  ]);
  const sqlResult = cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'source_fixture',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    `actor=${actor}`,
    '-f',
    '/tmp/recovery-tests.sql',
  ]);
  await writeFile(
    path.join(artifact, 'recovery-sql.log'),
    sqlResult.stdout + sqlResult.stderr,
  );
  const recovery = JSON.parse(
    sqlResult.stdout.split('\n').find((line) => line.startsWith('{')),
  );
  assert.equal(recovery.result, 'PASS');
  assert.equal(recovery.recoveryAssertions, 16);
  assert.deepEqual(snapshot(container, 'source_fixture'), beforeFixtures);
  checks.push('16 recovery SQL assertions; all fixture rows rolled back');
  console.log('Recovery SQL assertions passed.');
  // The PostgreSQL image has no openssl binary. Generate fixture-only keys in
  // the pinned offline Node image; artifacts stay ignored and are never logged.
  for (const [name, san] of [
    ['correct', 'DNS:' + container + ',DNS:localhost,IP:127.0.0.1'],
    ['wrong-host', 'DNS:wrong.local.invalid'],
  ]) {
    cli([
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--mount',
      `type=bind,source=${artifact},target=/certificates`,
      'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
      'openssl',
      'req',
      '-new',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      `/certificates/${name}.key`,
      '-out',
      `/certificates/${name}.crt`,
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=' + san,
      '-days',
      '2',
    ]);
    for (const extension of ['crt', 'key'])
      cli([
        'cp',
        path.join(artifact, name + '.' + extension),
        `${container}:/tmp/${name}.${extension}`,
      ]);
    cli([
      'exec',
      container,
      'chown',
      'postgres:postgres',
      `/tmp/${name}.key`,
      `/tmp/${name}.crt`,
    ]);
    cli([
      'exec',
      '--user',
      'postgres',
      container,
      'chmod',
      '600',
      `/tmp/${name}.key`,
    ]);
  }
  const certificate = async (name) => {
    sql('postgres', `ALTER SYSTEM SET ssl_cert_file='/tmp/${name}.crt';`);
    sql('postgres', `ALTER SYSTEM SET ssl_key_file='/tmp/${name}.key';`);
    sql('postgres', 'ALTER SYSTEM SET ssl=on;');
    sql('postgres', 'SELECT pg_reload_conf();');
    await new Promise((resolve) => setTimeout(resolve, 300));
  };
  await certificate('correct');
  sql(
    'postgres',
    `SET password_encryption='scram-sha-256'; CREATE ROLE ${sourceLogin} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets[1]}'; CREATE ROLE ${targetLogin} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${secrets[2]}'; GRANT ${sourceRole} TO ${sourceLogin}; GRANT ${targetRole} TO ${targetLogin};`,
  );
  await writeFile(
    path.join(artifact, 'native-entry.ts'),
    `export { createPublicationPgPools } from '../../../src/lib/publication-pg.ts'; export { PublicationJournal } from '../../../src/lib/publication-journal-server.ts'; export { PublicationTarget } from '../../../src/lib/publication-target.ts';\n`,
  );
  await build({
    configFile: false,
    envDir: false,
    logLevel: 'warn',
    build: {
      ssr: path.join(artifact, 'native-entry.ts'),
      outDir: path.join(artifact, 'bundle'),
      emptyOutDir: false,
      rolldownOptions: {
        external: ['pg', 'server-only'],
        output: { entryFileNames: 'native.mjs' },
      },
    },
  });
  const ca = await readFile(path.join(artifact, 'correct.crt'), 'utf8');
  const config = {
    source: {
      url:
        'postgresql://' +
        sourceLogin +
        ':' +
        secrets[1] +
        '@' +
        container +
        ':5432/source_fixture',
      ca,
    },
    target: {
      url:
        'postgresql://' +
        targetLogin +
        ':' +
        secrets[2] +
        '@' +
        container +
        ':5432/target_fixture',
      ca,
    },
    targetKey: 'novlearn-production',
    review: 'isolated synthetic fixture only',
  };
  await writeFile(
    path.join(artifact, 'client.json'),
    JSON.stringify({ config, actor, operationId: template.id }),
  );
  if (targetTransactions) {
    assert.equal(
      cli([
        'inspect',
        '--format',
        '{{.State.Running}}',
        pristineContainer,
      ]).stdout.trim(),
      'false',
    );
    assert.equal(
      cli([
        'inspect',
        '--format',
        '{{.HostConfig.NetworkMode}}',
        pristineContainer,
      ]).stdout.trim(),
      'none',
    );
    cli(['start', pristineContainer]);
    pristineStarted = true;
    await wait(pristineContainer);
    const pristineRows = snapshot(pristineContainer, 'postgres');
    assert.equal(pristineRows['auth.users'].rows, 0);
    assert.equal(pristineRows['public.exercises'].rows, 0);
    cli([
      'exec',
      pristineContainer,
      'pg_dump',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '--format=custom',
      `--file=/tmp/target-pristine-${stamp}.dump`,
    ]);
    cli([
      'cp',
      `${pristineContainer}:/tmp/target-pristine-${stamp}.dump`,
      path.join(artifact, 'target-pristine.dump'),
    ]);
    assert.deepEqual(snapshot(pristineContainer, 'postgres'), pristineRows);
    cli(['stop', '--timeout', '15', pristineContainer]);
    pristineStarted = false;
    cli([
      'exec',
      container,
      'createdb',
      '-U',
      'supabase_admin',
      '--template=template0',
      'transfer_source',
    ]);
    cli([
      'exec',
      container,
      'pg_restore',
      '-U',
      'supabase_admin',
      '-d',
      'transfer_source',
      '--exit-on-error',
      '--single-transaction',
      '/fixture-input/source.dump',
    ]);
    cli([
      'exec',
      container,
      'psql',
      '-qAt',
      '-U',
      'supabase_admin',
      '-d',
      'transfer_source',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      '/tmp/recovery.sql',
    ]);
    const definition = JSON.parse(template.payload.definitionJson);
    assert.equal(typeof definition.catalogue.chapter, 'string');
    assert(Array.isArray(definition.catalogue.skills));
    const literal = (text) =>
      `convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}','base64'),'UTF8')`;
    for (const database of [
      'transfer_target',
      'transfer_abort',
      'transfer_lost_after',
      'transfer_lost_before',
      'transfer_socket',
    ]) {
      cli([
        'exec',
        container,
        'createdb',
        '-U',
        'supabase_admin',
        '--template=template0',
        database,
      ]);
      cli([
        'exec',
        container,
        'pg_restore',
        '-U',
        'supabase_admin',
        '-d',
        database,
        '--exit-on-error',
        '--single-transaction',
        '/fixture-input/target-pristine.dump',
      ]);
      sql(
        database,
        `INSERT INTO public.chapters(id,name,order_index,aliases) VALUES('a6300000-0000-4000-8000-000000000001',${literal(definition.catalogue.chapter)},990,'{}');`,
      );
      sql(
        database,
        "INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('transaction-history-skill','LOCAL TRANSACTION UNRELATED SKILL','a6300000-0000-4000-8000-000000000001',10);",
      );
      for (const [index, skill] of definition.catalogue.skills.entries())
        sql(
          database,
          `INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('transaction-target-skill-${index}',${literal(skill)},'a6300000-0000-4000-8000-000000000001',10);`,
        );
      sql(
        database,
        `DO $$ DECLARE e bigint; d bigint; BEGIN
       INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
       SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"TRANSACTION HISTORY FIXTURE","birth_date":"2000-01-01"}',now(),now()
       FROM unnest(ARRAY['a6310000-0000-4000-8000-000000000001'::uuid,'a6310000-0000-4000-8000-000000000002'::uuid]) id;
       INSERT INTO public.friends(user1_id,user2_id,status) VALUES('a6310000-0000-4000-8000-000000000001','a6310000-0000-4000-8000-000000000002','accepted');
       INSERT INTO public.exercises(title,chapter,content) VALUES('LOCAL TRANSACTION HISTORY','Local history','{}') RETURNING id INTO e;
       INSERT INTO public.exercise_attempts(user_id,exercise_id,is_correct) VALUES('a6310000-0000-4000-8000-000000000002',e,false);
       INSERT INTO public.duels(player1_id,player2_id,status) VALUES('a6310000-0000-4000-8000-000000000001','a6310000-0000-4000-8000-000000000002','active') RETURNING id INTO d;
       INSERT INTO public.duel_attempts(duel_id,player_id,element_id,is_correct) VALUES(d,'a6310000-0000-4000-8000-000000000002',0,true);
       END; $$; UPDATE novlearn_admin_private.publication_runtime SET enabled=true WHERE singleton;`,
      );
    }
    await writeFile(
      path.join(artifact, 'target-input.json'),
      JSON.stringify({ source: template }) + '\n',
    );
    console.log('Isolated transaction targets and existing history prepared.');
  }
  clientProcess = spawn(
    docker,
    [
      '--host',
      endpoint,
      'run',
      '--rm',
      '--init',
      '--interactive',
      '--pull',
      'never',
      '--name',
      container + '-client',
      '--network',
      network,
      '--memory',
      '256m',
      '--memory-swap',
      '256m',
      '--pids-limit',
      '64',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--user',
      '65534:65534',
      '--mount',
      'type=bind,source=' + artifact + ',target=/fixture,readonly',
      '--mount',
      'type=bind,source=' +
        path.resolve('node_modules') +
        ',target=/node_modules,readonly',
      '--mount',
      'type=bind,source=' +
        path.resolve('scripts/test-publication-pg-worker.mjs') +
        ',target=/worker.mjs,readonly',
      '--mount',
      'type=bind,source=' +
        path.resolve('scripts/test-publication-target-worker.mjs') +
        ',target=/target-worker.mjs,readonly',
      'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b',
      'node',
      '--conditions=react-server',
      '/worker.mjs',
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const pending = new Map();
  let sequence = 0,
    readyResolve,
    readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  clientProcess.stderr.on('data', (data) => process.stderr.write(safe(data)));
  clientExit = new Promise((resolve) =>
    clientProcess.once('close', (code) => {
      readyReject(Error('Fixture client exited: ' + code));
      for (const request of pending.values())
        request.reject(Error('Fixture client exited'));
      pending.clear();
      resolve(code);
    }),
  );
  clientProcess.once('error', readyReject);
  createInterface({ input: clientProcess.stdout }).on('line', (line) => {
    const data = JSON.parse(line);
    if (data.ready) readyResolve();
    else {
      const request = pending.get(data.id);
      if (request) {
        pending.delete(data.id);
        if (data.error)
          request.reject(
            Error(
              'Native fixture command ' +
                request.command +
                ': ' +
                data.message +
                ' (' +
                data.code +
                ' at ' +
                data.phase +
                ')',
            ),
          );
        else request.resolve(data.result);
      }
    }
  });
  await ready;
  const request = async (command) => {
    const id = String(++sequence);
    const result = await new Promise((resolve, reject) => {
      pending.set(id, { command, resolve, reject });
      clientProcess.stdin.write(JSON.stringify({ id, command }) + '\n');
    });
    await writeFile(
      path.join(artifact, command + '.json'),
      JSON.stringify(result, null, 2) + '\n',
    );
    return result;
  };
  const identity = await request('identity');
  const tls = identity.tls;
  assert.equal(identity.untrustedCertificateRejected, true);
  checks.push(
    'Both real LOGIN identities bind their distinct capability over verified TLS',
  );
  checks.push('Untrusted self-signed certificate actually rejected');
  await certificate('wrong-host');
  assert.equal((await request('wrongHost')).wrongHostnameRejected, true);
  checks.push('Trusted certificate with wrong hostname actually rejected');
  await certificate('correct');
  sql('postgres', 'ALTER ROLE ' + sourceLogin + ' INHERIT;');
  assert.equal((await request('inherit')).roleDriftRejected, true);
  sql('postgres', 'ALTER ROLE ' + sourceLogin + ' NOINHERIT;');
  checks.push(
    'Unexpected real role inheritance refused before capability checkout',
  );
  sql('postgres', `GRANT ${sourceRole} TO ${sourceLogin} WITH ADMIN OPTION;`);
  assert.equal((await request('delegatedMembership')).delegationRejected, true);
  sql('postgres', `REVOKE ADMIN OPTION FOR ${sourceRole} FROM ${sourceLogin};`);
  checks.push(
    'Delegable capability membership actually refused without weakening allowed grants',
  );
  const lease = await request('prepareRecovery');
  assert.equal(lease.dedicatedLeasePassed, true);
  const outsideJournal = (rows) =>
    Object.fromEntries(
      Object.entries(rows).filter(
        ([name]) =>
          !name.startsWith('novlearn_admin_private.publication_operation'),
      ),
    );
  const beforeRevocation = snapshot(container, 'source_fixture');
  assert.deepEqual(
    outsideJournal(beforeRevocation),
    outsideJournal(originalRows),
  );
  const profileBefore = value(
    'source_fixture',
    `SELECT to_jsonb(p) FROM public.profiles p WHERE id='${actor}'`,
  );
  const revokedChange = value(
    'source_fixture',
    "UPDATE public.profiles SET role='user' WHERE id='" +
      actor +
      "' RETURNING jsonb_build_object('profile',to_jsonb(profiles),'transactionTime',transaction_timestamp());",
  );
  // The owner intentionally changes this one synthetic profile. Its normal
  // updated_at trigger must fire. Verify the entire expected row, not a filtered
  // comparison that hides dates or unrelated fields.
  assert.deepEqual(revokedChange.profile, {
    ...profileBefore,
    role: 'user',
    updated_at: revokedChange.transactionTime,
  });
  const revokedRows = snapshot(container, 'source_fixture');
  const recovered = await request('recover');
  assert.equal(recovered.machineRecoveryAfterRevocation, true);
  assert.equal(recovered.staleHumanGatewayRejectedBySql, true);
  checks.push(
    'Actual driver/journal recovery survives initiator revocation without authorizing human access',
  );
  const after = snapshot(container, 'source_fixture');
  assert.deepEqual(outsideJournal(after), outsideJournal(revokedRows));
  assert.deepEqual(snapshot(container, 'target_fixture'), originalRows);
  checks.push(
    'Driver preserves all 60 source tables before and after the exact owner-fixture revocation; all 62 target tables unchanged',
  );
  cli([
    'exec',
    container,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'source_fixture',
    '--format=custom',
    '--file=/tmp/recovery-restored.dump',
  ]);
  cli([
    'cp',
    container + ':/tmp/recovery-restored.dump',
    path.join(artifact, 'recovery-restored.dump'),
  ]);
  cli([
    'exec',
    container,
    'createdb',
    '-U',
    'supabase_admin',
    '--template=template0',
    'restored_fixture',
  ]);
  cli([
    'exec',
    container,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'restored_fixture',
    '--exit-on-error',
    '--single-transaction',
    '/tmp/recovery-restored.dump',
  ]);
  assert.deepEqual(snapshot(container, 'restored_fixture'), after);
  // Prepare the Admin profile for the independent rollback-only SQL suite in
  // this NEW restored copy, then preserve its complete resulting snapshot.
  sql(
    'restored_fixture',
    `UPDATE public.profiles SET role='admin' WHERE id='${actor}';`,
  );
  const restoredFixtureRows = snapshot(container, 'restored_fixture');
  const restoredResult = cli([
    'exec',
    container,
    'psql',
    '-qAt',
    '-U',
    'supabase_admin',
    '-d',
    'restored_fixture',
    '-v',
    'ON_ERROR_STOP=1',
    '-v',
    `actor=${actor}`,
    '-f',
    '/tmp/recovery-tests.sql',
  ]);
  await writeFile(
    path.join(artifact, 'recovery-restored-sql.log'),
    restoredResult.stdout + restoredResult.stderr,
  );
  const restoredProof = JSON.parse(
    restoredResult.stdout.split('\n').find((line) => line.startsWith('{')),
  );
  assert.equal(restoredProof.recoveryAssertions, 16);
  assert.deepEqual(
    snapshot(container, 'restored_fixture'),
    restoredFixtureRows,
  );
  checks.push(
    '16 recovery assertions pass again after dump/restore; all 62 table snapshots match',
  );
  const targetChecks = [];
  const transferSnapshots = {};
  if (targetTransactions) {
    const sourceBefore = snapshot(container, 'transfer_source');
    const outsideTransfer = (rows) =>
      Object.fromEntries(
        Object.entries(rows).filter(
          ([name]) =>
            !['public.exercises', 'public.exercise_versions'].includes(name),
        ),
      );
    for (const [command, database] of [
      ['targetPublish', 'transfer_target'],
      ['targetRepeat', 'transfer_target'],
      ['targetAbort', 'transfer_abort'],
      ['targetLostAfter', 'transfer_lost_after'],
      ['targetRecoverAfter', 'transfer_lost_after'],
      ['targetLostBefore', 'transfer_lost_before'],
      ['targetRecoverBefore', 'transfer_lost_before'],
      ['targetLostSocket', 'transfer_socket'],
      ['targetRecoverSocket', 'transfer_socket'],
    ]) {
      const before = snapshot(container, database);
      assert(before['public.exercise_attempts'].rows > 0);
      assert(before['public.duel_attempts'].rows > 0);
      const legacyBefore = value(
        database,
        "SELECT to_jsonb(e) FROM public.exercises e WHERE catalog_id IS NULL AND title='LOCAL TRANSACTION HISTORY'",
      );
      const result = await request(command);
      const after = snapshot(container, database);
      assert.deepEqual(outsideTransfer(after), outsideTransfer(before));
      assert.deepEqual(
        value(
          database,
          "SELECT to_jsonb(e) FROM public.exercises e WHERE catalog_id IS NULL AND title='LOCAL TRANSACTION HISTORY'",
        ),
        legacyBefore,
      );
      if (
        [
          'targetRepeat',
          'targetAbort',
          'targetLostBefore',
          'targetRecoverAfter',
          'targetRecoverBefore',
          'targetLostSocket',
          'targetRecoverSocket',
        ].includes(command)
      )
        assert.deepEqual(after, before);
      if (command === 'targetPublish') {
        assert.equal(result.outcome.result, 'published');
        assert.equal(result.contended, true);
        assert.equal(result.contendedAfterCommit, true);
        assert.equal(
          after['public.exercises'].rows,
          before['public.exercises'].rows + 1,
        );
        assert.equal(
          after['public.exercise_versions'].rows,
          before['public.exercise_versions'].rows + 1,
        );
      }
      if (command === 'targetRepeat')
        assert.equal(result.outcome.result, 'unchanged');
      if (command === 'targetAbort') assert.equal(result.state, 'aborted');
      if (command === 'targetLostAfter')
        assert.equal(
          after['public.exercise_versions'].rows,
          before['public.exercise_versions'].rows + 1,
        );
      if (command === 'targetRecoverAfter')
        assert.equal(result.outcome.result, 'unchanged');
      if (
        command === 'targetLostBefore' ||
        command === 'targetLostAfter' ||
        command === 'targetLostSocket'
      )
        assert.equal(result.state, 'uncertain');
      if (
        command === 'targetRecoverBefore' ||
        command === 'targetRecoverSocket'
      )
        assert.equal(result.state, 'not_applied');
      targetChecks.push({
        command,
        database,
        result: 'PASS',
        observation: result,
      });
      transferSnapshots[command] = { before, after };
    }
    assert.deepEqual(
      outsideJournal(snapshot(container, 'transfer_source')),
      outsideJournal(sourceBefore),
    );
    checks.push(
      'Nine real target transaction/recovery scenarios preserve existing learner history and all excluded tables',
    );
    await writeFile(
      path.join(artifact, 'transfer-snapshots.json'),
      JSON.stringify(transferSnapshots, null, 2) + '\n',
    );
  }
  const sha = async (file) =>
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  await writeFile(
    path.join(artifact, 'snapshots.json'),
    JSON.stringify(
      {
        originalRows,
        beforeFixtures,
        beforeRevocation,
        revokedChange,
        revokedRows,
        after,
        restoredFixtureRows,
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    path.join(artifact, 'proof.json'),
    JSON.stringify(
      {
        result: 'PASS',
        container,
        network,
        host: container,
        publishedPorts: false,
        internalNetwork: true,
        checks,
        targetChecks,
        tls,
        recoveryAssertions: recovery.recoveryAssertions,
        recoveryAssertionsAfterRestore: restoredProof.recoveryAssertions,
        restoredTableSnapshotsMatch: true,
        sqlFixturesRolledBack: true,
        driverBusinessTablesPreserved: 60,
        expectedOwnerFixtureRevocationVerifiedExactly: true,
        targetTablesPreserved: 62,
        sequencesCompared: false,
        migrationSha256: await sha(migration),
        sourceDumpSha256: await sha(path.join(artifact, 'source.dump')),
        scope: targetTransactions
          ? 'Real local target transactions and journal recovery with a previously native-approved source and synthetic identity gateway; no remote operation'
          : 'Actual local TLS driver and machine journal recovery; synthetic identity gateway and inspection, no target apply or real Auth',
        limitations: [
          'Source and target fixture databases share one isolated PostgreSQL cluster.',
          targetTransactions
            ? 'No complete publication service, fresh Engine execution at transfer, live Auth or complete confinement certification.'
            : 'No full target transfer or complete confinement certification.',
          'No remote configuration, SQL, Auth activation, publication, push or deployment.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`PASS: ${checks.length} integration checks; proof=${artifact}`);
} catch (error) {
  await writeFile(
    path.join(artifact, 'failure.txt'),
    safe(error?.stack ?? error),
  );
  throw error;
} finally {
  if (clientProcess) {
    clientProcess.stdin.end();
    await clientExit;
  }
  if (created) cli(['stop', '--timeout', '15', container]);
  if (sourceStarted) cli(['stop', '--timeout', '15', sourceContainer]);
  if (pristineStarted) cli(['stop', '--timeout', '15', pristineContainer]);
}
