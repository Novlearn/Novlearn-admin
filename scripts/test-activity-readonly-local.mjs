// Real PostgreSQL qualification on an explicitly named isolated fixture only.
// Never accepts a remote endpoint, operational database or arbitrary SQL input.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  decodeActivityStatistics,
  statisticsPeriod,
} from '../src/lib/activity-statistics.ts';

const [container, database = 'postgres', ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.match(
  container ?? '',
  /^novlearn-admin-(?:activity-sql-\d+|lot1a-replay-\d{17}|lot1a-backup-\d{17})$/,
);
assert.match(
  database,
  /^(?:postgres|activity_copy|admin_backup_restore|activity_restore_\d+)$/,
);
const artifact = path.resolve(
  '.local/lot1a/activity-readonly-check-' + Date.now(),
);
await mkdir(artifact);
const docker = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DockerDesktop/resources/bin/docker.exe',
);
const cli = (args, input) =>
  spawnSync(
    docker,
    ['--host', 'npipe:////./pipe/dockerDesktopLinuxEngine', ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 16777216,
    },
  );
const inspect = cli(['inspect', container]);
assert.equal(inspect.status, 0);
const actual = JSON.parse(inspect.stdout)[0];
assert.equal(
  actual.State.Running,
  true,
  'Start the retained fixture explicitly; do not recreate it',
);
assert.equal(actual.HostConfig.NetworkMode, 'none');
assert.deepEqual(actual.HostConfig.PortBindings ?? {}, {});
assert.match(
  actual.Config.Image,
  /^public\.ecr\.aws\/supabase\/postgres(?::17\.11\.0\.003|@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4)$/,
);
const imageInspection = cli(['image', 'inspect', actual.Image]);
assert.equal(imageInspection.status, 0);
const expectedImageDigest =
  'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4';
assert(
  JSON.parse(imageInspection.stdout)[0].RepoDigests.includes(
    expectedImageDigest,
  ),
);
function sql(input) {
  return cli(
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
    input,
  );
}
function checked(input) {
  const result = sql(input);
  assert.equal(result.status, 0, 'Fixture inspection failed');
  return result.stdout.trim();
}
assert.equal(
  checked('SELECT count(*) FROM auth.users;'),
  '0',
  'Named fixture tests require pristine Auth; preservation on populated copies is qualified separately',
);
const snapshot = () =>
  JSON.parse(
    checked(`CREATE FUNCTION pg_temp.activity_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t record; n bigint; h text; result jsonb:='{}'; BEGIN
FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP
EXECUTE format('SELECT count(*),encode(extensions.digest(coalesce(string_agg(to_jsonb(r)::text,E''\\n'' ORDER BY to_jsonb(r)::text),''''),''sha256''),''hex'') FROM %I.%I r',t.schemaname,t.tablename) INTO n,h;
result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,jsonb_build_object('rows',n,'sha256',h)); END LOOP; RETURN result; END; $$; SELECT pg_temp.activity_snapshot();`)
      .split('\n')
      .at(-1),
  );
const before = snapshot();
const fixture = await readFile(
  new URL('./test-activity-readonly-local.sql', import.meta.url),
  'utf8',
);
assert(fixture.endsWith('ROLLBACK;\n'));
const rawQuery = await readFile(
  new URL('./activity-statistics-query.sql', import.meta.url),
  'utf8',
);
const query = rawQuery.trim().replace(/;$/, '');
const body =
  fixture.slice(0, -'ROLLBACK;\n'.length) +
  `
SET SESSION AUTHORIZATION novlearn_activity_reader;
PREPARE activity(date,date) AS ${query};
EXECUTE activity('2026-10-15','2026-10-18');
SET TIME ZONE 'America/New_York';
EXECUTE activity('2026-10-15','2026-10-18');
EXECUTE activity('2026-01-01','2026-01-02');
PREPARE bound_count(date,date) AS SELECT jsonb_build_object('boundedRows',count(*)) FROM (${query}) bounded;
EXECUTE bound_count('2026-10-17','2026-10-15');
EXECUTE bound_count('2026-07-01','2026-10-18');
EXECUTE bound_count('2099-01-01','2099-01-02');
EXECUTE bound_count(NULL,'2026-10-18');
EXECUTE bound_count('2026-10-15','2026-10-18');
RESET SESSION AUTHORIZATION;
ROLLBACK;
`;
const result = sql(body);
const log = artifact + '/native-check.log';
await writeFile(log, result.stdout + '\n' + result.stderr);
assert.equal(result.status, 0, 'Actual SQL assertions failed; see ' + log);
const outputs = result.stdout.split(/\r?\n/).flatMap((line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
});
const values = outputs.filter((value) => value?.schemaVersion === 1);
assert.equal(values.length, 3);
const expected = {
  activeAccounts: '2',
  exerciseAttempts: '5',
  duelAttempts: '2',
  completedDuels: '1',
  accountsCreated: '1',
  correct: '2',
  incorrect: '2',
  abandoned: '1',
  unclassified: '0',
};
for (const value of values.slice(0, 2)) {
  assert.deepEqual(value.accounts, { total: '4', anonymous: '1' });
  assert.deepEqual(value.totals, expected);
  assert.deepEqual(
    value.daily.map((row) => row.activeAccounts),
    ['2', '1', '2'],
  );
  assert.deepEqual(
    value.daily.map((row) => row.date),
    ['2026-10-15', '2026-10-16', '2026-10-17'],
  );
  assert(
    decodeActivityStatistics(
      { ...value, environment: 'local-fixture' },
      {
        environment: 'local-fixture',
        period: statisticsPeriod('2026-10-15', '2026-10-17'),
      },
    ),
  );
}
const first = { ...values[0] },
  second = { ...values[1] };
delete first.asOf;
delete second.asOf;
assert.deepEqual(first, second, 'Aggregates change with the session timezone');
assert.deepEqual(
  values[2].totals,
  Object.fromEntries(Object.keys(expected).map((key) => [key, '0'])),
);
assert.equal(values[2].daily.length, 1);
assert(
  decodeActivityStatistics(
    { ...values[2], environment: 'local-fixture' },
    {
      environment: 'local-fixture',
      period: statisticsPeriod('2026-01-01', '2026-01-01'),
    },
  ),
);
assert.deepEqual(
  outputs
    .filter((value) => value?.boundedRows !== undefined)
    .map((value) => value.boundedRows),
  [0, 0, 0, 0, 1],
);
const after = snapshot();
assert.deepEqual(
  after,
  before,
  'Fixture transaction changed preserved table rows',
);
const proof = {
  result: 'PASS for native isolated SQL permission and aggregate qualification',
  date: new Date().toISOString(),
  container,
  database,
  artifact,
  log,
  postgresImageDigest: expectedImageDigest,
  driverSha256: createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex'),
  querySha256: createHash('sha256').update(rawQuery).digest('hex'),
  fixtureSha256: createHash('sha256').update(fixture).digest('hex'),
  permissionAssertions: (result.stderr.match(/NOTICE:  PASS:/g) ?? []).length,
  aggregateExecutions: values.length,
  boundedQueryExecutions: 5,
  expectedTotals: expected,
  utcSessionTimezoneInvariant: true,
  emptyPeriodVerified: true,
  invalidBoundsReturnNoRow: true,
  actualDomainDecoderAccepted: true,
  tableSnapshotsCompared: Object.keys(before).length,
  allTableRowsPreserved: true,
  fixtureTransactionRolledBack: true,
  sequenceValuesCompared: false,
  sequenceScope:
    'nextval is not transactional; this pristine fixture may advance sequences, without changing table rows',
  realLoginOrTlsExecuted: false,
  productionReaderActivated: false,
  remoteDatabaseOperationPerformed: false,
  existingApplicationModified: false,
  browserExecuted: false,
};
await writeFile(
  artifact + '/proof.json',
  JSON.stringify(proof, null, 2) + '\n',
);
console.log(JSON.stringify(proof));
