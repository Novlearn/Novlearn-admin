// Nominal reader qualification inside the isolated SQL-67 network namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import { createLocalUserDetailReader } from './user-detail-reader.mjs';
import { createLocalUsersReader } from './users-reader.mjs';
import { detailItemKey } from './user-detail-domain.mjs';

const state = JSON.parse(await readFile('/fixture/private.json', 'utf8'));
const config = state.config;
const endpoint = new URL(config.url);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.port, '55435');
assert.equal(endpoint.pathname, '/activity_copy');
assert.equal(endpoint.username, 'novlearn_admin_user_detail_service');
const query = {
  period: {
    from: '2026-10-15',
    to: '2026-10-17',
    until: '2026-10-18',
    days: 3,
  },
  userId: 'a8100000-0000-4000-8000-000000000001',
  view: 'history',
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
    const reader = createLocalUserDetailReader(config);
    try {
      await assert.rejects(
        reader.read(query),
        /Fiche utilisateur indisponible/,
      );
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
          'SELECT rolpassword FROM pg_catalog.pg_authid',
          'SELECT raw_user_meta_data FROM auth.users',
          'SELECT birth_date FROM public.profiles',
          'SELECT role FROM public.profiles',
          'SELECT score FROM public.exercise_attempts',
          'SELECT content FROM public.exercises',
          'SELECT * FROM public.exercise_versions',
          'SELECT answer FROM public.duel_attempts',
          'SELECT exercise_data FROM public.duels',
          'SELECT * FROM public.exercise_attempt_instances',
          'SELECT * FROM public.duel_exercise_instances',
          'SELECT payload FROM public.admin_exercise_test_runs',
          'SELECT * FROM novlearn_admin_private.test_signing_keys',
          'UPDATE public.user_progress SET level=100',
          'CREATE TEMP TABLE forbidden_detail(value integer)',
          'SELECT pg_catalog.lo_create(0)',
          'SELECT pg_catalog.lo_creat(-1)',
          "SELECT pg_catalog.lo_from_bytea(0,'x'::bytea)",
          'SET ROLE novlearn_publication_executor',
          'SET ROLE novlearn_users_reader',
        ]) {
          await client.query('BEGIN READ WRITE');
          if (assumed)
            await client.query('SET LOCAL ROLE novlearn_user_detail_reader');
          await assert.rejects(
            client.query(statement),
            (e) => e.code === '42501',
          );
          await client.query('ROLLBACK');
        }
        checks.push(
          (assumed ? 'Assumed reader' : 'Session login') +
            ': twenty-one actual 42501 denials in read-write transactions',
        );
      }
      const auditSql = await readFile(
        '/app/scripts/user-detail-reader-audit.sql',
        'utf8',
      );
      const audits = [(await client.query(auditSql)).rows[0].audit];
      await client.query('SET ROLE novlearn_user_detail_reader');
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
    const reader = createLocalUserDetailReader(config);
    try {
      const result = await reader.read(query);
      assert(result);
      assert.equal(result.user.id, query.userId);
      assert.equal(result.user.email, 'activity-a@example.test');
      assert.equal(result.page.total, '4');
      assert.equal(result.items.length, 4);
      assert.equal(result.activity.exerciseAttempts, '3');
      assert.equal(result.activity.duelAttempts, '1');
      assert.equal(result.activity.undatedExerciseAttempts, '1');
      assert(
        result.items
          .filter((i) => i.kind === 'exercise')
          .every((i) => i.versionId === null),
      );
      checks.push(
        'Actual audited detail reader returns known identity and historical attempts without invented versions',
      );
      const chapters = await reader.read({ ...query, view: 'chapters' });
      assert(chapters);
      assert.equal(chapters.items.length, 3);
      assert.equal(chapters.items[0].level, 40);
      assert.equal(chapters.items[0].completed, '3');
      assert.deepEqual(chapters.items[1].issues, [
        'missing-level',
        'missing-count',
        'missing-date',
      ]);
      assert.deepEqual(chapters.items[2].issues, [
        'invalid-count',
        'future-date',
      ]);
      assert.equal(chapters.items[2].completed, null);
      checks.push(
        'Nonempty chapter progress preserves missing values, negative-count warning and future date',
      );
      const competences = await reader.read({ ...query, view: 'competences' });
      assert(competences);
      assert.equal(competences.items.length, 3);
      const above = competences.items.find(
        (i) => i.id === 'local_detail_progress_a',
      );
      assert.equal(above.points, '15');
      assert.equal(above.maximum, '10');
      assert.deepEqual(above.issues, ['points-above-current-maximum']);
      const orphan = competences.items.find(
        (i) => i.id === 'local_detail_progress_unmatched',
      );
      assert.equal(orphan.maximum, null);
      assert.deepEqual(orphan.issues, ['unknown-competence', 'missing-date']);
      checks.push(
        'Nonempty competence progress keeps raw points above current maximum and unknown taxonomy',
      );
      const guest = await reader.read({
        ...query,
        userId: 'a8100000-0000-4000-8000-000000000002',
      });
      assert(guest);
      assert.equal(guest.user.email, null);
      assert.equal(guest.user.name, 'Compte invité');
      checks.push('Guest profile remains anonymous on the actual connection');
      assert.equal(
        await reader.read({
          ...query,
          userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        }),
        null,
      );
      checks.push(
        'Actual absent account returns null rather than a fabricated empty profile',
      );
      assert.deepEqual((await reader.read(query)).items, result.items);
      checks.push('Pool lease is reset and audited before reuse');
      const emptyPeriod = {
        from: '2026-01-01',
        to: '2026-01-01',
        until: '2026-01-02',
        days: 1,
      };
      const empty = await reader.read({ ...query, period: emptyPeriod });
      assert(empty);
      assert.equal(empty.page.total, '0');
      assert.equal(empty.activity.exerciseAttempts, '0');
      const sameProgress = await reader.read({
        ...query,
        view: 'chapters',
        period: emptyPeriod,
      });
      assert.deepEqual(sameProgress.items, chapters.items);
      checks.push(
        'Empty activity is separate from current progression and account absence',
      );
      const after = await reader.read({
        ...query,
        after: detailItemKey(result.items[1]),
      });
      assert.deepEqual(after.items, result.items.slice(2));
      const before = await reader.read({
        ...query,
        before: detailItemKey(result.items[2]),
      });
      assert.deepEqual(before.items, result.items.slice(0, 2));
      checks.push(
        'Actual history cursor directions retain ordering and complete boundaries',
      );
      await assert.rejects(
        reader.read({ ...query, period: { ...query.period, days: 4 } }),
        /Fiche utilisateur indisponible/,
      );
      checks.push(
        'Invalid trusted period metadata rejected before SQL checkout',
      );
    } finally {
      await reader.close();
    }
    const oldReader = createLocalUsersReader(state.oldUsersConfig);
    try {
      const old = await oldReader.read({
        period: query.period,
        query: '',
        after: null,
        before: null,
      });
      assert.equal(old.total, '4');
      assert.equal(old.items[0].exerciseAttempts, '3');
      assert.equal(old.items[1].email, null);
      checks.push(
        'Previously qualified list reader and its original TLS credentials still work on SQL 67',
      );
    } finally {
      await oldReader.close();
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
          writeDenials: 42,
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
        writeDenials: 42,
      }),
    );
  }
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
