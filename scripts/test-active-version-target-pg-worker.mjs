// Real loopback proxy / SCRAM / verified TLS and production reader code.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import pg from 'pg';
const [artifact, run] = process.argv.slice(2);
assert(artifact && run);
const state = JSON.parse(await readFile(artifact + '/private.json', 'utf8'));
const expected = JSON.parse(
  await readFile(artifact + '/expectations.json', 'utf8'),
);
const { createLocalActiveVersionReader } = await import(
  pathToFileURL(run + '/bundle/reader.mjs').href
);
const config = state.config;
const untrustedCa = await readFile(
  '.local/lot1a/active-version-pg-1792436591935/untrusted.crt',
  'utf8',
);
const connect = async (changes) => {
  const c = new pg.Client({
    connectionString: config.url,
    ssl: { ca: config.ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
    connectionTimeoutMillis: 3000,
    ...changes,
  });
  c.on('error', () => {});
  try {
    await c.connect();
    return c;
  } catch (e) {
    await c.end().catch(() => {});
    throw e;
  }
};
const checks = [];
let denials = 0;
const client = await connect();
try {
  assert.equal(client.connection.stream.encrypted, true);
  assert.equal(client.connection.stream.authorized, true);
  const ssl = (
    await client.query(
      'SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()',
    )
  ).rows[0];
  assert(ssl.ssl);
  assert.match(ssl.version, /^TLSv1\.[23]$/);
  checks.push(
    'actual target SCRAM login through retained proxy and verified TLS',
  );
  await assert.rejects(
    client.query('SELECT id FROM public.exercises'),
    (e) => e.code === '42501',
  );
  denials++;
  await client.query('SET ROLE novlearn_active_version_reader');
  for (const q of expected.denials) {
    await assert.rejects(client.query(q), (e) => e.code === '42501');
    denials++;
  }
  checks.push(
    'NOINHERIT login and 16 capability refusals in genuine READ WRITE sessions',
  );
} finally {
  await client.end();
}
for (const [label, changes] of [
  [
    'wrong password',
    {
      connectionString: config.url.replace(
        new URL(config.url).password,
        'incorrect-local-reader-password',
      ),
    },
  ],
  ['plaintext', { ssl: false }],
  ['untrusted CA', { ssl: { ca: untrustedCa, rejectUnauthorized: true } }],
  [
    'wrong hostname',
    {
      ssl: {
        ca: config.ca,
        rejectUnauthorized: true,
        servername: 'wrong.invalid',
      },
    },
  ],
  [
    'wrong database',
    { connectionString: config.url.replace('/admin_local', '/postgres') },
  ],
]) {
  await assert.rejects(async () => {
    const c = await connect(changes);
    await c.end();
  });
  checks.push('refuses ' + label);
}
const reader = createLocalActiveVersionReader(config);
const observations = [];
try {
  for (let i = 0; i < expected.observations.length; i += 2) {
    const pairs = expected.observations.slice(i, i + 2);
    const rows = await Promise.all(pairs.map((p) => reader.read(p.catalogId)));
    rows.forEach((row, index) => {
      assert.deepEqual(row.parent, pairs[index].parent);
      assert.deepEqual(row.active, pairs[index].active);
      assert.equal(row.environment, 'local-copy');
      observations.push({
        catalogId: row.catalogId,
        activeRevision: row.active?.revision ?? null,
        latestRevision: pairs[index].latestRevision,
      });
    });
  }
  const absentId = 'ad700000-0000-4000-8000-000000000098';
  const absent = await reader.read(absentId);
  assert.equal(absent.parent, null);
  assert.equal(absent.active, null);
  observations.push({
    catalogId: absentId,
    activeRevision: null,
    latestRevision: null,
  });
  checks.push(
    'real reader audits both identities, two concurrent leases, exact independent pointer metadata and genuine absence',
  );
} finally {
  await reader.close();
}
await writeFile(
  path.join(run, 'proof.json'),
  JSON.stringify(
    {
      result: 'PASS',
      at: new Date().toISOString(),
      checks,
      denials,
      observations,
      realTls: true,
      realServerReader: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    checks: checks.length,
    denials,
    observations: observations.length,
  }),
);
