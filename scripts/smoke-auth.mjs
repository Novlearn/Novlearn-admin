import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const origin = 'http://127.0.0.1:3137';
const server = spawn(process.execPath, ['.next/standalone/server.js'], {
  cwd: new URL('../', import.meta.url),
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    HOSTNAME: '127.0.0.1',
    PORT: '3137',
    ADMIN_STAGING_AUTH_ENABLED: 'false',
  },
});
let logs = '';
server.stdout.on('data', (value) => {
  logs += value;
});
server.stderr.on('data', (value) => {
  logs += value;
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server failed: ${logs}`);
    try {
      if ((await fetch(`${origin}/login`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for local listener, never contact Supabase. */
    }
    await setTimeout(100);
  }
  assert(ready, 'Local server did not start');
  const login = await fetch(`${origin}/login`);
  const html = await login.text();
  assert(html.includes('Connexion en attente d’activation'));
  for (const name of ['email', 'password']) {
    const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
    assert(input?.[0].includes('disabled=""'), `${name} must be disabled`);
  }
  assert.match(login.headers.get('cache-control'), /no-store/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY');
  const css = html.match(/href="([^\"]+\.css[^\"]*)"/);
  assert(css, 'Stylesheet missing');
  const stylesheet = await fetch(new URL(css[1], origin));
  assert.equal(stylesheet.status, 200);
  const styles = await stylesheet.text();
  for (const logo of [
    '/logo/novlearn-principal-ui.svg',
    '/logo/novlearn-logo-ui.svg',
  ]) {
    assert(html.includes(logo), `Logo absent from HTML: ${logo}`);
    assert.equal((await fetch(`${origin}${logo}`)).status, 200, logo);
  }
  const fonts = [...styles.matchAll(/url\(["']?([^\)"']+\.woff2)["']?\)/g)];
  assert(fonts.length >= 2, 'Inter and Fredoka must be served locally');
  for (const font of fonts)
    assert.equal((await fetch(new URL(font[1], origin))).status, 200);
  const admin = await fetch(`${origin}/admin`, {
    redirect: 'manual',
    headers: { cookie: 'role=admin' },
  });
  assert.equal(admin.status, 307);
  assert.equal(
    new URL(admin.headers.get('location'), origin).pathname,
    '/login',
  );
  for (const [path, method] of [
    ['/api/admin/session', 'GET'],
    ['/auth/login', 'POST'],
    ['/auth/logout', 'POST'],
  ]) {
    const response = await fetch(`${origin}${path}`, {
      method,
      redirect: 'manual',
      headers: { origin },
    });
    assert.equal(response.status, 503, path);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal((await fetch(`${origin}/auth/login`)).status, 405);
  assert.equal((await fetch(`${origin}/auth/logout`)).status, 405);
  console.log(
    'PASS: standalone CSS, disabled login, protected redirect, direct Auth endpoints, no-store and security headers.',
  );
} finally {
  server.kill();
}
