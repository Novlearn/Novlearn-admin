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
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
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
  assert(html.includes('Configuration de connexion incomplète'));
  assert(
    !html.includes('http://127.0.0.1:3140/'),
    'Production login must not advertise a development-only loopback preview',
  );
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
  const mathFont = await fetch(
    `${origin}/mathlive/fonts/KaTeX_Main-Regular.woff2`,
  );
  assert.equal(mathFont.status, 200);
  assert(
    (await mathFont.arrayBuffer()).byteLength > 0,
    'MathLive font is empty',
  );
  assert.equal((await fetch(`${origin}/mathlive/LICENSE.txt`)).status, 200);
  for (const path of [
    '/admin',
    '/admin/exercises',
    '/admin/exercises/new',
    '/admin/exercises/1',
    '/admin/chapters',
    '/admin/competences',
    '/admin/flashcards',
    '/admin/publication',
    '/admin/statistics',
    '/admin/statistics/pedagogy',
    '/admin/users',
    '/admin/users/a8100000-0000-4000-8000-000000000001',
  ]) {
    const admin = await fetch(`${origin}${path}`, {
      redirect: 'manual',
      headers: { cookie: 'role=admin' },
    });
    assert.equal(admin.status, 307);
    assert.equal(
      new URL(admin.headers.get('location'), origin).pathname,
      '/login',
    );
  }
  for (const [path, method] of [
    ['/api/admin/session', 'GET'],
    ['/api/admin/statistics', 'GET'],
    ['/api/admin/statistics/pedagogy', 'GET'],
    ['/api/admin/statistics/pedagogy/references?kind=chapter', 'GET'],
    ['/api/admin/users', 'GET'],
    ['/api/admin/users/a8100000-0000-4000-8000-000000000001', 'GET'],
    ['/api/admin/exercises', 'GET'],
    ['/api/admin/exercises/1/target-version', 'GET'],
    ['/api/admin/exercises', 'POST'],
    ['/api/admin/engine', 'POST'],
    ['/api/admin/preview', 'POST'],
    ['/api/admin/review', 'POST'],
    ['/api/admin/publication', 'POST'],
    ['/api/admin/taxonomy?kind=chapter', 'GET'],
    ['/api/admin/taxonomy', 'POST'],
    ['/api/admin/flashcards', 'GET'],
    ['/api/admin/flashcards', 'POST'],
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
  assert.equal((await fetch(`${origin}/api/admin/publication`)).status, 405);
  for (const name of [
    'active-version-reader-audit.sql',
    'active-version-query.sql',
    'pedagogy-reader-audit.sql',
    'pedagogy-statistics-query.sql',
    'pedagogy-references-query.sql',
  ])
    assert.equal(
      (await fetch(`${origin}/scripts/${name}`, { redirect: 'manual' })).status,
      404,
      name,
    );
  console.log(
    'PASS: standalone CSS, disabled login, protected redirect, direct Auth endpoints, no-store and security headers.',
  );
} finally {
  server.kill();
}
