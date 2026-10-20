// Execute official read-only advisors in the retained copy's network namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const state = JSON.parse(await readFile('/output/private.json', 'utf8'));
const url = new URL('postgresql://supabase_admin@127.0.0.1:5432/admin_local');
url.password = state.owner;
const options =
  '-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=3000';
const connection = new pg.Client({
  connectionString: url.href,
  ssl: { ca: state.ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  options,
  connectionTimeoutMillis: 3000,
});
try {
  await connection.connect();
  assert.equal(connection.connection.stream.authorized, true);
  const row = (
    await connection.query(
      "SELECT current_user, current_setting('transaction_read_only') AS readonly,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl",
    )
  ).rows[0];
  assert.deepEqual(row, {
    current_user: 'supabase_admin',
    readonly: 'on',
    ssl: true,
  });
} finally {
  await connection.end();
}
const environment = { ...process.env };
for (const k of Object.keys(environment))
  if (k.startsWith('SUPABASE_')) delete environment[k];
const run = (args) =>
  spawnSync('/tool/supabase', args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 90000,
    maxBuffer: 16777216,
    env: environment,
    cwd: '/output',
  });
const version = run(['--version']);
assert.equal(version.status, 0);
assert.equal(version.stdout.trim(), '2.98.2');
const help = run(['db', 'advisors', '--help']);
assert.equal(help.status, 0);
assert(help.stdout.includes('--db-url') && help.stdout.includes('--fail-on'));
await writeFile('/output/help.txt', help.stdout);
await writeFile('/output/ca.crt', state.ca);
url.searchParams.set('sslmode', 'verify-full');
url.searchParams.set('sslrootcert', '/output/ca.crt');
url.searchParams.set('options', options);
const result = run([
  'db',
  'advisors',
  '--db-url',
  url.href,
  '--level',
  'info',
  '--type',
  'all',
  '--fail-on',
  'error',
  '--output',
  'json',
]);
const redact = (s) =>
  String(s ?? '')
    .replaceAll(state.owner, '[fixture owner]')
    .replaceAll(url.href, '[verified local copy URL]');
await writeFile('/output/advisors.stdout', redact(result.stdout));
await writeFile('/output/advisors.stderr', redact(result.stderr));
await writeFile(
  '/output/cli-execution.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      exitCode: result.status,
      signal: result.signal,
      errorCode: result.error?.code ?? null,
      version: '2.98.2',
      verifiedTls: true,
      transactionDefaultReadOnly: true,
      remoteOperations: false,
    },
    null,
    2,
  ) + '\n',
);
assert.equal(result.status, 0, 'Inspect retained CLI outputs');
const findings = JSON.parse(result.stdout);
assert(Array.isArray(findings));
const levels = {},
  rules = {};
for (const f of findings) {
  levels[f.level] = (levels[f.level] ?? 0) + 1;
  rules[f.name] = (rules[f.name] ?? 0) + 1;
}
assert.equal(levels.ERROR ?? 0, 0);
await writeFile(
  '/output/worker-proof.json',
  JSON.stringify(
    {
      result: 'PASS',
      total: findings.length,
      errors: 0,
      levels,
      rules,
      verifiedTls: true,
      transactionDefaultReadOnly: true,
      cliVersion: '2.98.2',
      remoteOperations: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ result: 'PASS', levels, total: findings.length }));
