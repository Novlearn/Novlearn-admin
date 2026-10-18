// Runs only inside the isolated SQL fixture's network namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import { createLocalActivityReader } from './activity-reader.mjs';

const state = JSON.parse(await readFile('/fixture/private.json', 'utf8'));
const config = state.config;
assert.equal(new URL(config.url).hostname, '127.0.0.1');
assert.equal(new URL(config.url).port, '55435');
assert.equal(new URL(config.url).pathname, '/activity_copy');
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
const checks = [];
const connect = async (changes = {}) => {
  const client = new pg.Client({
    connectionString: config.url,
    ssl: { rejectUnauthorized: true, ca: config.ca },
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
try {
  if (process.argv[2] === '--expect-drift') {
    const reader = createLocalActivityReader(config);
    try {
      await assert.rejects(
        reader.read({
          from: '2026-10-15',
          to: '2026-10-17',
          until: '2026-10-18',
          days: 3,
        }),
        /Statistiques indisponibles/,
      );
      console.log(
        'PASS: real server reader rejects unexpected effective privilege',
      );
    } finally {
      await reader.close();
    }
  } else {
    const client = await connect();
    try {
      assert.equal(client.connection.stream.encrypted, true);
      assert.equal(client.connection.stream.authorized, true);
      const tls = await client.query(
        'SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()',
      );
      assert.equal(tls.rows[0].ssl, true);
      assert.match(tls.rows[0].version, /^TLSv1\.[23]$/);
      checks.push(
        'Actual password login with verified certificate, host and TLS 1.2+',
      );
      for (const assumed of [false, true]) {
        for (const statement of [
          'SELECT email FROM auth.users',
          'SELECT * FROM public.profiles',
          'UPDATE public.exercise_attempts SET is_correct=false',
          'CREATE TEMP TABLE activity_forbidden(value integer)',
          'SELECT pg_catalog.lo_create(0)',
          'SELECT pg_catalog.lo_creat(-1)',
          "SELECT pg_catalog.lo_from_bytea(0,'x'::bytea)",
          'SET ROLE novlearn_publication_executor',
          'SELECT * FROM novlearn_admin_private.test_signing_keys',
        ]) {
          await client.query('BEGIN READ WRITE');
          if (assumed)
            await client.query('SET LOCAL ROLE novlearn_activity_reader');
          await assert.rejects(
            client.query(statement),
            (e) => e.code === '42501',
          );
          await client.query('ROLLBACK');
        }
        checks.push(
          (assumed ? 'Assumed reader' : 'Session login') +
            ': nine actual 42501 denials in read-write transactions',
        );
      }
      const auditSql = await readFile(
        '/app/scripts/activity-reader-audit.sql',
        'utf8',
      );
      const audits = [];
      audits.push((await client.query(auditSql)).rows[0].audit);
      await client.query('SET ROLE novlearn_activity_reader');
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
      checks.push('Server statement timeout cancels a real query');
    } finally {
      await client.end();
    }
    const bad = new URL(config.url);
    bad.password = 'invalid-fixture-password';
    await assert.rejects(
      connect({ connectionString: bad.href }),
      (e) => e.code === '28P01',
    );
    checks.push('Wrong password rejected by SCRAM authentication');
    await assert.rejects(
      connect({ ssl: { rejectUnauthorized: true, ca: state.untrustedCa } }),
      (e) =>
        [
          'DEPTH_ZERO_SELF_SIGNED_CERT',
          'SELF_SIGNED_CERT_IN_CHAIN',
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        ].includes(e.code),
    );
    checks.push('Untrusted certificate rejected');
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
    checks.push('Wrong certificate hostname rejected');
    await assert.rejects(connect({ ssl: false }), (e) => e.code === '28000');
    checks.push('Unencrypted login rejected by fixture HBA');
    const other = new URL(config.url);
    other.pathname = '/postgres';
    await assert.rejects(
      connect({ connectionString: other.href }),
      (e) => e.code === '28000',
    );
    checks.push('Login to another database rejected by fixture HBA');

    const reader = createLocalActivityReader(config);
    try {
      const period = {
        from: '2026-10-15',
        to: '2026-10-17',
        until: '2026-10-18',
        days: 3,
      };
      const result = await reader.read(period);
      assert.equal(result.environment, 'local-copy');
      assert.deepEqual(result.accounts, { total: '4', anonymous: '1' });
      assert.deepEqual(result.totals, {
        activeAccounts: '2',
        exerciseAttempts: '5',
        duelAttempts: '2',
        completedDuels: '1',
        accountsCreated: '1',
        correct: '2',
        incorrect: '2',
        abandoned: '1',
        unclassified: '0',
      });
      assert.equal(result.daily.length, 3);
      checks.push(
        'Real server reader audits both identities and decodes known nonempty aggregate',
      );
      assert.deepEqual(
        await reader.read(period).then((r) => r.totals),
        result.totals,
      );
      checks.push('Reused pool lease is reset and both identities re-audited');
      const empty = await reader.read({
        from: '2026-01-01',
        to: '2026-01-01',
        until: '2026-01-02',
        days: 1,
      });
      assert.equal(empty.totals.exerciseAttempts, '0');
      checks.push('Valid empty period distinguished from unavailable data');
      await assert.rejects(
        reader.read({ ...period, until: '2026-10-19' }),
        /Statistiques indisponibles/,
      );
      checks.push('Inconsistent period rejected before SQL execution');
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
          writeDenials: 18,
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
        writeDenials: 18,
      }),
    );
  }
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
