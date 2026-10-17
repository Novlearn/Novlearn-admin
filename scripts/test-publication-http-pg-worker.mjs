import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const directory = path.resolve(process.argv[2] ?? '');
assert(
  directory
    .toLowerCase()
    .startsWith((path.resolve('.local') + path.sep).toLowerCase()),
);
const state = JSON.parse(
  await readFile(directory + '/pg-private.json', 'utf8'),
);
const { createPublicationPgPools } = await import(
  pathToFileURL(directory + '/bundle/driver.mjs').href
);
assert.equal(new URL(state.config.source.url).origin, 'null');
for (const [which, port] of [
  ['source', '55433'],
  ['target', '55434'],
]) {
  const u = new URL(state.config[which].url);
  assert.equal(u.hostname, '127.0.0.1');
  assert.equal(u.port, port);
  assert.equal(u.pathname, '/admin_local');
}
const checks = [];
const pools = createPublicationPgPools(state.config);
try {
  for (const [which, role, login] of [
    [
      'source',
      'novlearn_publication_journal_executor',
      'novlearn_admin_journal_service',
    ],
    [
      'target',
      'novlearn_publication_executor',
      'novlearn_admin_publication_service',
    ],
  ]) {
    const client = await pools[which]();
    try {
      assert.equal(client.connection.stream.encrypted, true);
      assert.equal(client.connection.stream.authorized, true);
      const r = await client.query(
        'SELECT current_user AS role,session_user AS login,current_database() AS db',
      );
      assert.deepEqual(r.rows, [{ role, login, db: 'admin_local' }]);
      await assert.rejects(
        client.query('SELECT * FROM public.exercise_versions LIMIT 1'),
        (e) => e.code === '42501',
      );
      checks.push(
        which +
          ': real verified TLS, exact least-privilege role and direct table reads refused',
      );
    } finally {
      client.release();
    }
  }
} finally {
  await pools.close();
}
for (const [label, mutate] of [
  [
    'untrusted CA',
    (c) => {
      c.source.ca = c.target.ca;
    },
  ],
  [
    'wrong source password',
    (c) => {
      const u = new URL(c.source.url);
      u.password = 'invalid-fixture-password';
      c.source.url = u.href;
    },
  ],
  [
    'source identity on target',
    (c) => {
      const u = new URL(c.source.url);
      u.port = '55434';
      c.source.url = u.href;
    },
  ],
  [
    'wrong target password',
    (c) => {
      const u = new URL(c.target.url);
      u.password = 'invalid-fixture-password';
      c.target.url = u.href;
    },
  ],
]) {
  const config = structuredClone(state.config);
  mutate(config);
  const p = createPublicationPgPools(config);
  try {
    await assert.rejects(
      label === 'wrong target password' ? p.target() : p.source(),
      /Publication backend unavailable/,
    );
    checks.push(label + ': refused');
  } finally {
    await p.close();
  }
}
await writeFile(
  directory + '/connection-proof.json',
  JSON.stringify(
    {
      result:
        'PASS for isolated physical TLS connections and SQL identities only',
      date: new Date().toISOString(),
      checks,
      sourceAndTargetDistinct: true,
      verifiedTLS: true,
      leastPrivilege: true,
      sourceContract: 'atomic-source-finalization-v1',
      targetApplyExecuted: false,
      publicationHttpExecuted: false,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS',
    checks: checks.length,
    targetApplyExecuted: false,
    publicationHttpExecuted: false,
  }),
);
