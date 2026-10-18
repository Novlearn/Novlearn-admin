// Reproducible native SQL/DTO test on a pristine, explicitly named SQL-66 fixture.
// The four test accounts and their attempts are rolled back; no operational DB.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
const [container, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(container ?? '', /^novlearn-admin-lot1a-replay-\d{17}$/);
const artifact = path.resolve(
  '.local/lot1a/users-readonly-check-' + Date.now(),
);
await mkdir(artifact);
const exe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) =>
  spawnSync(
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
const inspected = cli(['inspect', container]);
assert.equal(inspected.status, 0);
const actual = JSON.parse(inspected.stdout)[0];
assert.equal(actual.State.Running, true);
assert.equal(actual.HostConfig.NetworkMode, 'none');
assert.deepEqual(actual.HostConfig.PortBindings, {});
const image = cli(['image', 'inspect', actual.Image]);
assert.equal(image.status, 0);
const digest =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(JSON.parse(image.stdout)[0].RepoDigests.includes(digest));
const sql = (text) =>
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
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    text,
  );
const checked = (text) => {
  const r = sql(text);
  assert.equal(r.status, 0, 'Fixture inspection failed');
  return r.stdout.trim();
};
assert.equal(checked('SELECT count(*) FROM auth.users;'), '0');
assert.equal(
  checked(
    "SELECT count(*) FROM pg_roles WHERE rolname='novlearn_users_reader' AND NOT rolcanlogin;",
  ),
  '1',
);
const snapshot = () =>
  JSON.parse(
    checked(
      `CREATE FUNCTION pg_temp.users_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h));END LOOP;RETURN result;END;$$;SELECT pg_temp.users_snapshot();`,
    )
      .split('\n')
      .at(-1),
  );
const before = snapshot();
assert.equal(Object.keys(before).length, 62);
const seed = await readFile('scripts/test-activity-readonly-local.sql', 'utf8');
const first = seed.indexOf('INSERT INTO auth.users('),
  last = seed.indexOf(
    'SET SESSION AUTHORIZATION novlearn_activity_reader;',
    first,
  );
assert(first >= 0 && last > first);
const assertions = await readFile(
  'scripts/test-users-readonly-local.sql',
  'utf8',
);
assert(assertions.endsWith('ROLLBACK;\n'));
const body = assertions
  .replace(/^BEGIN;$/m, '')
  .slice(0, -'ROLLBACK;\n'.length);
const rawQuery = await readFile('scripts/users-list-query.sql', 'utf8'),
  query = rawQuery.trim().replace(/;$/, '');
const baseExec = (q = '', after = 'NULL', before = 'NULL', limit = 2) =>
  `EXECUTE users('2026-10-15','2026-10-18','${q.replaceAll("'", "''")}',${after},${before},${limit});`;
const queries = [
  baseExec(),
  baseExec('', "'a8100000-0000-4000-8000-000000000002'"),
  baseExec('', 'NULL', "'a8100000-0000-4000-8000-000000000003'"),
  baseExec('ACTIVITY-A'),
  baseExec('activity-b'),
  baseExec('Compte invité'),
  "EXECUTE users('2026-01-01','2026-01-02','',NULL,NULL,25);",
  baseExec('', "'ffffffff-ffff-ffff-ffff-ffffffffffff'"),
];
const literalAndLong = `RESET SESSION AUTHORIZATION;
UPDATE public.profiles SET first_name='Littéral %_\\',last_name=NULL WHERE id='a8100000-0000-4000-8000-000000000003';
SET SESSION AUTHORIZATION novlearn_users_reader;
${baseExec('%')}${baseExec('_')}${baseExec('\\')}
RESET SESSION AUTHORIZATION;
UPDATE public.profiles SET first_name=repeat('😀',201),last_name=NULL WHERE id='a8100000-0000-4000-8000-000000000003';
SET SESSION AUTHORIZATION novlearn_users_reader;
${baseExec('😀')}
SET TIME ZONE 'America/New_York';
${baseExec()}
RESET SESSION AUTHORIZATION;
UPDATE public.profiles SET first_name=chr(160)||chr(9),last_name=NULL WHERE id='a8100000-0000-4000-8000-000000000003';
SET SESSION AUTHORIZATION novlearn_users_reader;
${baseExec('activity-c')}
RESET SESSION AUTHORIZATION;
`;
const bounds = [
  "'2026-10-18','2026-10-15','',NULL,NULL,2",
  "'2026-07-01','2026-10-18','',NULL,NULL,2",
  "'2099-01-01','2099-01-02','',NULL,NULL,2",
  "NULL,'2026-10-18','',NULL,NULL,2",
  "'2026-10-15','2026-10-18','',NULL,NULL,26",
  "'2026-10-15','2026-10-18','', 'a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002',2",
  "'2026-10-15','2026-10-18','',NULL,NULL,2",
];
const input =
  'BEGIN;\n' +
  seed.slice(first, last) +
  '\n' +
  body +
  '\nSET SESSION AUTHORIZATION novlearn_users_reader; PREPARE users(date,date,text,uuid,uuid,integer) AS ' +
  query +
  ';\n' +
  queries.join('\n') +
  '\n' +
  literalAndLong +
  `\nSET SESSION AUTHORIZATION novlearn_users_reader; PREPARE bounded(date,date,text,uuid,uuid,integer) AS SELECT jsonb_build_object('boundedRows',count(*)) FROM (${query}) q;\n` +
  bounds.map((args) => 'EXECUTE bounded(' + args + ');').join('\n') +
  '\nRESET SESSION AUTHORIZATION; ROLLBACK;';
const r = sql(input);
await writeFile(artifact + '/native.log', r.stdout + '\n' + r.stderr);
assert.equal(
  r.status,
  0,
  'Native SQL check failed; see ' + artifact + '/native.log',
);
const output = r.stdout.split(/\r?\n/).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  }),
  pages = output.filter((p) => p?.schemaVersion === 1);
assert.equal(pages.length, 14);
await build({
  configFile: false,
  envDir: false,
  logLevel: 'warn',
  build: {
    ssr: path.resolve('src/lib/users.ts'),
    outDir: artifact + '/bundle',
    emptyOutDir: false,
    rolldownOptions: { output: { entryFileNames: 'users.mjs' } },
  },
});
const { decodeUsersPage } = await import(
  pathToFileURL(artifact + '/bundle/users.mjs').href
);
const base = {
  period: {
    from: '2026-10-15',
    to: '2026-10-17',
    until: '2026-10-18',
    days: 3,
  },
  query: '',
  after: null,
  before: null,
};
const contexts = [
  base,
  { ...base, after: 'a8100000-0000-4000-8000-000000000002' },
  { ...base, before: 'a8100000-0000-4000-8000-000000000003' },
  { ...base, query: 'ACTIVITY-A' },
  { ...base, query: 'activity-b' },
  { ...base, query: 'Compte invité' },
  {
    ...base,
    period: {
      from: '2026-01-01',
      to: '2026-01-01',
      until: '2026-01-02',
      days: 1,
    },
  },
  { ...base, after: 'ffffffff-ffff-ffff-ffff-ffffffffffff' },
  ...['%', '_', '\\', '😀'].map((query) => ({ ...base, query })),
  base,
  { ...base, query: 'activity-c' },
];
for (let i = 0; i < pages.length; i++)
  assert(
    decodeUsersPage(
      { ...pages[i], environment: 'local-copy' },
      contexts[i],
      i === 6 ? 25 : 2,
    ),
    'Domain decoder rejected actual page ' + i,
  );
assert.deepEqual(
  pages[0].items.map((r) => r.id.slice(-1)),
  ['1', '2'],
);
assert.deepEqual(
  pages[1].items.map((r) => r.id.slice(-1)),
  ['3', '4'],
);
assert.deepEqual(pages[2].items, pages[0].items);
assert.equal(pages[0].total, '4');
assert.equal(pages[0].items[0].exerciseAttempts, '3');
assert.equal(pages[0].items[0].duelAttempts, '1');
assert.equal(pages[0].items[0].lastActivity, '2026-10-17T23:59:59.000000Z');
assert.equal(pages[0].items[1].email, null);
assert.equal(pages[0].items[1].name, 'Compte invité');
assert.equal(pages[4].total, '0');
assert.equal(pages[5].items[0].anonymous, true);
assert(
  pages[6].items.every(
    (i) =>
      i.lastActivity === null &&
      i.exerciseAttempts === '0' &&
      i.duelAttempts === '0',
  ),
);
assert.equal(pages[7].items.length, 0);
for (const p of pages.slice(8, 11)) {
  assert.equal(p.total, '1');
  assert.equal(p.items[0].id.slice(-1), '3');
}
assert.equal(pages[11].items[0].name, '😀'.repeat(200) + '…');
assert.equal(pages[11].items[0].nameTruncated, true);
assert.deepEqual(pages[12].items, pages[0].items);
assert.equal(pages[13].items[0].name, 'Nom non renseigné');
assert.equal(pages[13].items[0].nameTruncated, false);
assert.deepEqual(
  output.filter((p) => p?.boundedRows !== undefined).map((p) => p.boundedRows),
  [0, 0, 0, 0, 0, 0, 1],
);
assert.deepEqual(snapshot(), before);
const files = [
  'scripts/users-list-query.sql',
  'scripts/test-users-readonly-local.sql',
  'scripts/test-users-readonly-local.mjs',
  'src/lib/users.ts',
];
const hashes = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [
      file,
      createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
    ]),
  ),
);
const permissionAssertions = (r.stderr.match(/^NOTICE:.*PASS:/gm) ?? []).length;
assert.equal(permissionAssertions, 35);
const proof = {
  result: 'PASS for native nominal SQL, bounds and decoder checks',
  date: new Date().toISOString(),
  container,
  artifact,
  sourceHashes: hashes,
  permissionAssertions,
  actualUserQueries: 14,
  boundedQueries: 7,
  actualDomainDecoderAccepted: true,
  literalSearchVerified: true,
  unicodeTruncationFlagVerified: true,
  timezoneInvariant: true,
  anonymousNameEmailMasked: true,
  tableRowsPreserved: 62,
  fixtureRolledBack: true,
  sequencesCompared: false,
  sequenceScope:
    'Non-transactional nextval can advance in this pristine fixture; table rows remain exact',
  realLoginOrTlsExecuted: false,
  applicationModified: false,
  remoteOperations: false,
  browserExecuted: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
await writeFile(
  '.local/lot1a/users-readonly-current.json',
  JSON.stringify({ artifact, proof: artifact + '/proof.json' }, null, 2) + '\n',
);
console.log(JSON.stringify(proof));
