// Byte forwarding only; TLS terminates in the separate synthetic SQL69 copy.
import net from 'node:net';
const prefix = process.env.FIXTURE_PREFIX;
if (!/^novlearn-admin-pedagogy-http-\d+$/.test(prefix ?? ''))
  throw Error('Invalid pedagogy fixture');
const sockets = new Set();
const server = net
  .createServer((client) => {
    const upstream = net.connect({ host: prefix + '-db', port: 5432 });
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    }
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
    client.pipe(upstream).pipe(client);
  })
  .listen(5436, '0.0.0.0');
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  server.close(() => process.exit(0));
  for (const s of sockets) s.destroy();
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
