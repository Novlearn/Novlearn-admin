// Runs only in the isolated retained database network namespace.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import pg from 'pg';
import { createLocalActiveVersionReader } from './active-version-reader.mjs';
const state = JSON.parse(await readFile('/fixture/private.json', 'utf8')),
  config = state.config;
const baseline = JSON.parse(
  await readFile('/fixture/native-proof.json', 'utf8'),
);
assert.equal(new URL(config.url).hostname, '127.0.0.1');
assert.equal(new URL(config.url).port, '55434');
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
  proxy.listen(55434, '127.0.0.1', resolve);
});
const connect = async (changes = {}) => {
  const c = new pg.Client({
    connectionString: config.url,
    ssl: { rejectUnauthorized: true, ca: config.ca, minVersion: 'TLSv1.2' },
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
try {
  if (process.argv[2] === '--expect-drift') {
    const r = createLocalActiveVersionReader(config);
    try {
      await assert.rejects(
        r.read(baseline.observations[0].catalogId),
        /Version publiée indisponible/,
      );
    } finally {
      await r.close();
    }
    console.log('PASS: privilege/policy drift refused');
  } else {
    const c = await connect();
    let denials = 0;
    try {
      assert.equal(c.connection.stream.encrypted, true);
      assert.equal(c.connection.stream.authorized, true);
      const ssl = (
        await c.query(
          'SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()',
        )
      ).rows[0];
      assert.equal(ssl.ssl, true);
      assert.match(ssl.version, /^TLSv1\.[23]$/);
      checks.push('physical verified TLS and SCRAM login');
      await assert.rejects(
        c.query('SELECT id FROM public.exercises'),
        (e) => e.code === '42501',
      );
      denials++;
      await c.query('SET ROLE novlearn_active_version_reader');
      for (const statement of baseline.denials) {
        // Genuine READ WRITE session: ACLs must deny writes without transaction_read_only.
        await assert.rejects(c.query(statement), (e) => e.code === '42501');
        denials++;
      }
      checks.push(
        'physical login has no inherited data access; capability denies 16 private reads/writes',
      );
    } finally {
      await c.end();
    }
    for (const [label, change] of [
      [
        'wrong password',
        {
          connectionString: config.url.replace(
            new URL(config.url).password,
            'incorrect-fixture-password',
          ),
        },
      ],
      ['plaintext', { ssl: false }],
      [
        'wrong CA',
        {
          ssl: {
            rejectUnauthorized: true,
            ca: state.untrustedCa,
            minVersion: 'TLSv1.2',
          },
        },
      ],
      [
        'wrong certificate hostname',
        {
          ssl: {
            rejectUnauthorized: true,
            ca: config.ca,
            servername: 'wrong.invalid',
            minVersion: 'TLSv1.2',
          },
        },
      ],
      [
        'wrong database',
        { connectionString: config.url.replace('/admin_local', '/postgres') },
      ],
    ]) {
      await assert.rejects(async () => {
        const x = await connect(change);
        await x.end();
      });
      checks.push('refuses ' + label);
    }
    const r = createLocalActiveVersionReader(config);
    const observations = [];
    try {
      for (const pair of [
        baseline.observations.slice(0, 2),
        baseline.observations.slice(2, 4),
        baseline.observations.slice(4),
      ]) {
        const result = await Promise.all(pair.map((p) => r.read(p.catalogId)));
        for (let i = 0; i < result.length; i++) {
          assert.deepEqual(result[i].parent, pair[i].snapshot.parent);
          assert.deepEqual(result[i].active, pair[i].snapshot.active);
          assert.equal(result[i].environment, 'local-copy');
          assert.equal(result[i].targetKey, 'local-http-fixture');
          observations.push(result[i]);
        }
      }
      checks.push(
        'real server reader, both identity audits, 6 exact snapshots, two concurrent connections',
      );
    } finally {
      await r.close();
    }
    await writeFile(
      '/output/worker-proof.json',
      JSON.stringify(
        {
          result: 'PASS',
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
  }
} finally {
  for (const s of sockets) s.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
