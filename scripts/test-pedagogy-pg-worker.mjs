// Actual least-privilege login and reader inside its isolated PG namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import { createLocalPedagogyReader } from './pedagogy-reader.mjs';
import { readPedagogyQuery } from './pedagogy-domain.mjs';
const state = JSON.parse(await readFile('/fixture/private.json', 'utf8')),
  config = state.config;
const endpoint = new URL(config.url);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.port, '55436');
assert.equal(endpoint.pathname, '/activity_copy');
assert.equal(endpoint.username, 'novlearn_admin_pedagogy_service');
const parsed = readPedagogyQuery(
  new URLSearchParams('from=2026-10-15&to=2026-10-17'),
);
assert.equal(parsed.ok, true);
const query = parsed.query;
const sockets = new Set();
const proxy = net.createServer((client) => {
  const upstream = net.connect({ host: '127.0.0.1', port: 5432 });
  for (const s of [client, upstream]) {
    sockets.add(s);
    s.on('error', () => {
      client.destroy();
      upstream.destroy();
    });
    s.on('close', () => sockets.delete(s));
  }
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(55436, '127.0.0.1', resolve);
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
    const reader = createLocalPedagogyReader(config);
    try {
      await assert.rejects(
        reader.read(query),
        /Analyse pédagogique indisponible/,
      );
      await assert.rejects(
        reader.references({ kind: 'chapter', q: '' }),
        /Analyse pédagogique indisponible/,
      );
      console.log('PASS: effective privilege drift refused');
    } finally {
      await reader.close();
    }
  } else {
    const client = await connect();
    let denials = 0;
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
      assert.equal(
        (await client.query('SELECT current_user')).rows[0].current_user,
        'novlearn_admin_pedagogy_service',
      );
      checks.push(
        'Actual login with verified certificate, TLS 1.2+ and expected physical identity',
      );
      const denied = [
        'SELECT email FROM auth.users',
        'SELECT is_anonymous FROM auth.users',
        'SELECT encrypted_password FROM auth.users',
        'SELECT id FROM public.profiles',
        'SELECT content FROM public.exercises',
        'SELECT definition FROM public.exercise_versions',
        'SELECT answer FROM public.duel_attempts',
        'SELECT score FROM public.exercise_attempts',
        'SELECT rolpassword FROM pg_catalog.pg_authid',
        'SELECT * FROM public.admin_exercise_test_runs',
        'SELECT * FROM novlearn_admin_private.publication_operations',
        'UPDATE public.exercise_attempts SET is_correct=true',
        'DELETE FROM public.exercise_attempts',
        'TRUNCATE public.exercise_attempts',
        "INSERT INTO public.exercise_attempts(id,user_id,is_correct) VALUES(982900001,'b8100000-0000-4000-8000-000000000001',true)",
        "SELECT nextval('public.exercise_attempts_id_seq')",
        'CREATE TABLE public.pedagogy_denied(id integer)',
        'CREATE TEMP TABLE pedagogy_denied(id integer)',
        'CREATE SEQUENCE public.pedagogy_denied',
        'SELECT pg_catalog.lo_create(982900001)',
        'SET ROLE authenticated',
        'SET ROLE novlearn_activity_reader',
        'SELECT public.get_monthly_leaderboard(now(),1,NULL::text)',
      ];
      for (const assumed of [false, true]) {
        for (const statement of denied) {
          await client.query('BEGIN READ WRITE');
          if (assumed)
            await client.query('SET LOCAL ROLE novlearn_pedagogy_reader');
          await assert.rejects(
            client.query(statement),
            (e) => e.code === '42501',
          );
          await client.query('ROLLBACK');
          denials++;
        }
        checks.push(
          (assumed ? 'Assumed reader' : 'Session login') +
            ': actual private-read/write/creation/role 42501 denials in read-write transactions',
        );
      }
      const audit = await readFile(
        '/app/scripts/pedagogy-reader-audit.sql',
        'utf8',
      );
      const audits = [(await client.query(audit)).rows[0].audit];
      await client.query('SET ROLE novlearn_pedagogy_reader');
      audits.push((await client.query(audit)).rows[0].audit);
      await writeFile(
        '/output/physical-audits.json',
        JSON.stringify(audits, null, 2),
      );
      assert.equal(audits[0].columns.length, 0);
      assert.equal(audits[1].columns.length, 32);
      await client.query("SET statement_timeout='100ms'");
      await assert.rejects(
        client.query('SELECT pg_sleep(1)'),
        (e) => e.code === '57014',
      );
      checks.push('Actual server-side timeout cancels a query');
    } finally {
      await client.end();
    }
    const wrong = new URL(config.url);
    wrong.password = 'invalid-fixture-password';
    await assert.rejects(
      connect({ connectionString: wrong.href }),
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
    const reader = createLocalPedagogyReader(config);
    try {
      const result = await reader.read(query);
      assert.equal(result.environment, 'local-copy');
      const baseline = JSON.parse(
        await readFile('/fixture/baseline-statistics.json', 'utf8'),
      );
      for (const [key, increment] of Object.entries({
        exerciseAttempts: '7',
        duelAttempts: '3',
        completedDuels: '2',
        activeAccounts: '3',
        correct: '3',
        incorrect: '5',
        abandoned: '2',
        unclassified: '0',
      }))
        assert.equal(
          result.totals[key],
          String(BigInt(baseline.totals[key]) + BigInt(increment)),
          key,
        );
      checks.push(
        'Actual server reader aggregates retained data plus disjoint labelled fixtures without modifying old rows',
      );
      const chapter = await reader.read({
        ...query,
        chapter: 'ab100000-0000-4000-8000-000000000001',
      });
      assert.equal(chapter.totals.exerciseAttempts, '3');
      assert.equal(chapter.totals.duelAttempts, '3');
      checks.push('Actual chapter filter resolves current unambiguous aliases');
      const competence = await reader.read({
        ...query,
        competence: 'skill_b',
        groupBy: 'competence',
      });
      assert.equal(competence.totals.exerciseAttempts, '3');
      assert.equal(competence.totals.duelAttempts, '2');
      checks.push(
        'Actual competence filter and overlapping attribution retain unexpanded totals',
      );
      const hard = await reader.read({ ...query, difficulty: 'hard' });
      assert.equal(hard.totals.exerciseAttempts, '2');
      const flash = await reader.read({ ...query, exerciseType: 'flash' });
      assert.equal(flash.totals.exerciseAttempts, '2');
      checks.push('Actual difficulty and classic/flash metadata filters');
      const single = await reader.read({
        ...query,
        chapter: 'ab100000-0000-4000-8000-000000000001',
        competence: 'skill_b',
        difficulty: 'easy',
        exerciseType: 'classic',
        mode: 'exercise',
        groupBy: 'exercise',
        sort: 'success',
      });
      assert.equal(single.groups.rows.length, 1);
      assert.equal(single.totals.exerciseAttempts, '2');
      assert.equal(single.totals.duelAttempts, '0');
      checks.push('Actual combined filters and recorded-success ordering');
      const duel = await reader.read({ ...query, mode: 'duel' });
      assert.equal(duel.totals.exerciseAttempts, '0');
      assert.equal(
        duel.totals.completedDuels,
        String(BigInt(baseline.totals.completedDuels) + BigInt(2)),
      );
      checks.push(
        'Duel response rows and completed matches remain separate metrics',
      );
      const empty = await reader.read({
        ...query,
        competence: 'not-a-real-competence',
      });
      assert.equal(empty.totals.exerciseAttempts, '0');
      assert.equal(empty.groups.total, '0');
      checks.push(
        'A valid empty selection is distinct from a failed connection',
      );
      const past = await reader.read({ ...query, page: '9007199254740993' });
      assert.equal(past.groups.page, '9007199254740993');
      assert.equal(past.groups.rows.length, 0);
      checks.push(
        'Bigint page survives actual parameterized PostgreSQL without JavaScript rounding',
      );
      await assert.rejects(
        reader.read({ ...query, period: { ...query.period, days: 5 } }),
        /Analyse pédagogique indisponible/,
      );
      checks.push('Invalid trusted period metadata rejected');
      const again = await reader.read(query);
      const strip = (v) => {
        const x = structuredClone(v);
        delete x.asOf;
        return x;
      };
      assert.deepEqual(strip(again), strip(result));
      checks.push('Reused pool lease resets and re-audits physical identities');
      const chapters = await reader.references({
        kind: 'chapter',
        q: 'Ancien',
      });
      assert(
        chapters.items.some(
          (item) => item.id === 'ab100000-0000-4000-8000-000000000001',
        ),
      );
      checks.push('Audited reference search finds current chapter aliases');
      const skills = await reader.references({
        kind: 'competence',
        q: 'sKiLl_B',
      });
      assert.equal(skills.items.length, 1);
      assert.equal(skills.items[0].id, 'skill_b');
      checks.push(
        'Audited competence search is case insensitive and returns bounded metadata only',
      );
      const literal = await reader.references({
        kind: 'competence',
        q: '%_\\',
      });
      assert.equal(literal.items.length, 0);
      checks.push(
        'Reference substring search treats wildcard characters as literal text',
      );
    } finally {
      await reader.close();
    }
    await writeFile(
      '/output/connection-proof.json',
      JSON.stringify(
        {
          result: 'PASS',
          date: new Date().toISOString(),
          checks,
          writeAndPrivateReadDenials: denials,
          realLogin: true,
          realTls: true,
          realServerReader: true,
          sourceLabel: 'local-copy',
          browserExecuted: false,
          remoteOperations: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      JSON.stringify({ result: 'PASS', checks: checks.length, denials }),
    );
  }
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
