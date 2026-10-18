// Nominal reader qualification inside the isolated SQL-66 network namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import { createLocalUsersReader } from './users-reader.mjs';

const state = JSON.parse(await readFile('/fixture/private.json', 'utf8'));
const config = state.config;
const endpoint = new URL(config.url);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.port, '55435');
assert.equal(endpoint.pathname, '/activity_copy');
assert.equal(endpoint.username, 'novlearn_admin_users_service');
const query = {
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
const sockets = new Set();
const proxy = net.createServer((client) => {
  const upstream = net.connect({ host: '127.0.0.1', port: 5432 });
  for (const socket of [client, upstream]) {
    sockets.add(socket);
    socket.on('error', () => {
      client.destroy();
      upstream.destroy();
    });
    socket.on('close', () => sockets.delete(socket));
  }
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(55435, '127.0.0.1', resolve);
});
const connect = async (changes = {}) => {
  const client = new pg.Client({
    connectionString: config.url,
    ssl: { rejectUnauthorized: true, ca: config.ca, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
    connectionTimeoutMillis: 3000,
    ...changes,
  });
  client.on('error', () => {});
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
};
const checks = [];
try {
  if (process.argv[2] === '--expect-drift') {
    const reader = createLocalUsersReader(config);
    try {
      await assert.rejects(reader.read(query), /Utilisateurs indisponibles/);
      console.log(
        'PASS: real nominal reader rejects unexpected effective privilege',
      );
    } finally {
      await reader.close();
    }
  } else {
    const client = await connect();
    try {
      assert.equal(client.connection.stream.encrypted, true);
      assert.equal(client.connection.stream.authorized, true);
      const tls = (
        await client.query(
          'SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()',
        )
      ).rows[0];
      assert.equal(tls.ssl, true);
      assert.match(tls.version, /^TLSv1\.[23]$/);
      checks.push('Actual login with verified certificate and TLS 1.2+');
      for (const assumed of [false, true]) {
        for (const statement of [
          'SELECT encrypted_password FROM auth.users',
          'SELECT raw_user_meta_data FROM auth.users',
          'SELECT birth_date FROM public.profiles',
          'SELECT is_correct FROM public.exercise_attempts',
          'UPDATE public.profiles SET first_name=first_name',
          'CREATE TEMP TABLE users_forbidden(value integer)',
          'SELECT pg_catalog.lo_create(0)',
          'SELECT pg_catalog.lo_creat(-1)',
          "SELECT pg_catalog.lo_from_bytea(0,'x'::bytea)",
          'SET ROLE novlearn_publication_executor',
          'SET ROLE novlearn_activity_reader',
          'SELECT * FROM novlearn_admin_private.test_signing_keys',
        ]) {
          await client.query('BEGIN READ WRITE');
          if (assumed)
            await client.query('SET LOCAL ROLE novlearn_users_reader');
          await assert.rejects(
            client.query(statement),
            (e) => e.code === '42501',
          );
          await client.query('ROLLBACK');
        }
        checks.push(
          (assumed ? 'Assumed reader' : 'Session login') +
            ': twelve actual 42501 denials in read-write transactions',
        );
      }
      const auditSql = await readFile(
        '/app/scripts/users-reader-audit.sql',
        'utf8',
      );
      const audits = [(await client.query(auditSql)).rows[0].audit];
      await client.query('SET ROLE novlearn_users_reader');
      audits.push((await client.query(auditSql)).rows[0].audit);
      await writeFile(
        '/fixture/physical-audits.json',
        JSON.stringify(audits, null, 2) + '\n',
      );
      await client.query("SET statement_timeout='100ms'");
      await assert.rejects(
        client.query('SELECT pg_sleep(1)'),
        (e) => e.code === '57014',
      );
      checks.push('Server timeout cancels an actual query');
    } finally {
      await client.end();
    }
    const bad = new URL(config.url);
    bad.password = 'invalid-fixture-password';
    await assert.rejects(
      connect({ connectionString: bad.href }),
      (e) => e.code === '28P01',
    );
    checks.push('Wrong password refused by SCRAM');
    await assert.rejects(
      connect({ ssl: { rejectUnauthorized: true, ca: state.untrustedCa } }),
      (e) =>
        [
          'DEPTH_ZERO_SELF_SIGNED_CERT',
          'SELF_SIGNED_CERT_IN_CHAIN',
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        ].includes(e.code),
    );
    checks.push('Untrusted CA refused');
    await assert.rejects(
      connect({
        ssl: {
          rejectUnauthorized: true,
          ca: config.ca,
          servername: 'wrong-fixture.invalid',
        },
      }),
      (e) => e.code === 'ERR_TLS_CERT_ALTNAME_INVALID',
    );
    checks.push('Wrong certificate hostname refused');
    await assert.rejects(connect({ ssl: false }), (e) => e.code === '28000');
    checks.push('Plaintext refused by HBA');
    const other = new URL(config.url);
    other.pathname = '/postgres';
    await assert.rejects(
      connect({ connectionString: other.href }),
      (e) => e.code === '28000',
    );
    checks.push('Other database refused by HBA');
    const reader = createLocalUsersReader(config);
    try {
      const result = await reader.read(query);
      assert.equal(result.environment, 'local-copy');
      assert.equal(result.total, '4');
      assert.equal(result.items.length, 4);
      assert.equal(result.items[0].name, 'LOCAL ACTIVITY A');
      assert.equal(result.items[0].email, 'activity-a@example.test');
      assert.equal(result.items[0].exerciseAttempts, '3');
      assert.equal(result.items[0].duelAttempts, '1');
      assert.equal(result.items[0].lastActivity, '2026-10-17T23:59:59.000000Z');
      assert.equal(result.items[1].anonymous, true);
      assert.equal(result.items[1].email, null);
      assert.equal(result.items[1].name, 'Compte invité');
      assert.equal(result.items[2].exerciseAttempts, '0');
      assert.equal(result.items[2].lastActivity, null);
      checks.push(
        'Actual server reader audits both identities, returns four known users and masks guest identity',
      );
      assert.deepEqual((await reader.read(query)).items, result.items);
      checks.push('Reused lease is reset and re-audited');
      const search = await reader.read({ ...query, query: 'activity-c' });
      assert.equal(search.total, '1');
      assert.equal(search.items[0].email, 'activity-c@example.test');
      assert.equal(
        (await reader.read({ ...query, query: 'activity-b' })).total,
        '0',
      );
      checks.push('Literal search works and hidden guest fields do not match');
      const empty = await reader.read({
        ...query,
        query: 'no-such-synthetic-user',
      });
      assert.equal(empty.total, '0');
      assert.deepEqual(empty.items, []);
      checks.push('Empty search is distinct from unavailability');
      const noActivity = await reader.read({
        ...query,
        period: {
          from: '2026-01-01',
          to: '2026-01-01',
          until: '2026-01-02',
          days: 1,
        },
      });
      assert.equal(noActivity.total, '4');
      assert(
        noActivity.items.every(
          (u) =>
            u.exerciseAttempts === '0' &&
            u.duelAttempts === '0' &&
            u.lastActivity === null,
        ),
      );
      checks.push(
        'Empty activity period retains accounts without fabricated activity',
      );
      const after = await reader.read({ ...query, after: result.items[1].id });
      assert.deepEqual(after.items, result.items.slice(2));
      const before = await reader.read({
        ...query,
        before: result.items[2].id,
      });
      assert.deepEqual(before.items, result.items.slice(0, 2));
      checks.push('Actual UUID cursors preserve ordering in both directions');
      await assert.rejects(
        reader.read({ ...query, period: { ...query.period, days: 4 } }),
        /Utilisateurs indisponibles/,
      );
      await assert.rejects(
        reader.read({ ...query, query: ' hidden ' }),
        /Utilisateurs indisponibles/,
      );
      checks.push(
        'Invalid trusted query metadata refused before connection checkout',
      );
    } finally {
      await reader.close();
    }
    await writeFile(
      '/fixture/connection-proof.json',
      JSON.stringify(
        {
          result: 'PASS',
          date: new Date().toISOString(),
          checks,
          realLogin: true,
          realTls: true,
          realServerReader: true,
          writeDenials: 24,
          remoteAccess: false,
          browserExecuted: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      JSON.stringify({
        result: 'PASS',
        checks: checks.length,
        writeDenials: 24,
      }),
    );
  }
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
