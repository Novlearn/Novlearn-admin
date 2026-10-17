// Fixture-only byte forwarding. TLS terminates at PostgreSQL, not this proxy.
import net from 'node:net';
const prefix = process.env.FIXTURE_PREFIX;
if (!/^novlearn-admin-publication-local-\d+$/.test(prefix ?? ''))
  throw Error('Invalid fixture prefix');
for (const [port, suffix] of [
  [5433, '-db'],
  [5434, '-target-db'],
]) {
  net
    .createServer((client) => {
      const upstream = net.connect({ host: prefix + suffix, port: 5432 });
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
      client.pipe(upstream).pipe(client);
    })
    .listen(port, '0.0.0.0');
}
