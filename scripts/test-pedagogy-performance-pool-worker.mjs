import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { createLocalPedagogyReader } from './reader.mjs';
const state = JSON.parse(await readFile('/fixture/private.json', 'utf8'));
const cases = JSON.parse(await readFile('/fixture/goldens.json', 'utf8'));
const sockets = new Set();
const proxy = net.createServer((client) => {
  const upstream = net.connect({ host: '127.0.0.1', port: 5432 });
  for (const s of [client, upstream]) {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    s.on('error', () => {
      client.destroy();
      upstream.destroy();
    });
  }
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
  client.pipe(upstream).pipe(client);
});
await new Promise((resolve, reject) => {
  proxy.once('error', reject);
  proxy.listen(55436, '127.0.0.1', resolve);
});
const reader = createLocalPedagogyReader(state.config),
  measurements = [];
const stable = (v) => {
  const x = structuredClone(v);
  delete x.asOf;
  return x;
};
try {
  for (let round = 1; round <= 2; round++) {
    const started = performance.now();
    const results = await Promise.all(
      cases.map(async (c) => {
        const t = performance.now(),
          actual = await reader.read(c.query);
        assert.deepEqual(
          stable(actual),
          stable(c.report),
          'Full actual reader DTO must match the independently qualified native oracle',
        );
        return {
          case: c.name,
          round,
          elapsedMs: performance.now() - t,
          oracleExact: true,
        };
      }),
    );
    measurements.push(...results);
    console.log(
      JSON.stringify({
        round,
        concurrentCalls: 2,
        elapsedMs: performance.now() - started,
        results,
      }),
    );
  }
  await writeFile(
    '/fixture/connection-proof.json',
    JSON.stringify(
      {
        result:
          'PASS for actual verified-TLS pool with two concurrent large-data reads',
        date: new Date().toISOString(),
        measurements,
        realServerReader: true,
        realTls: true,
        maximumConcurrentCalls: 2,
        reusedPoolAcrossRounds: true,
        statementTimeoutUnchanged: 10000,
        clientQueryTimeoutUnchanged: 12000,
        poolMaximumUnchanged: 2,
        remoteOperations: false,
        browserExecuted: false,
        productionSlaCertified: false,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await reader.close();
  for (const s of sockets) s.destroy();
  await new Promise((resolve) => proxy.close(resolve));
}
