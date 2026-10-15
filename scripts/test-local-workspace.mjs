import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { localWorkspaceConfig, workspaceOrigin } from './local-workspace.mjs';

// HTTP tests of the isolated harness; not an Auth or browser acceptance suite.
test('local workspace: closed operations, exact origin, bounded native requests', async () => {
  const calls = [];
  let available = true;
  const config = localWorkspaceConfig({
    engine: async (body) => {
      calls.push(body);
      if (!available) throw Error('Runtime stopped');
      return {
        status: 200,
        body: { valid: false, diagnostics: [{ code: 'fixture' }] },
      };
    },
  });
  let middleware;
  config.plugins[0].configureServer({
    middlewares: {
      use: (value) => {
        middleware = value;
      },
    },
  });
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path, body, headers = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        origin: workspaceOrigin,
        'content-type': 'application/json',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  try {
    const root = await fetch(base + '/', { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/tests/browser/index.html');
    assert.deepEqual(await (await fetch(base + '/__local/status')).json(), {
      synthetic: true,
      database: false,
      engine: true,
    });
    assert.equal((await fetch(base + '/api/admin/engine')).status, 403);
    assert.equal(
      (
        await request(
          '/api/admin/engine',
          { definition: {} },
          { origin: 'http://example.invalid' },
        )
      ).status,
      403,
    );
    assert.equal(
      (await request('/api/admin/engine', { definition: {} }, { origin: '' }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          '/api/admin/engine',
          { definition: {} },
          { 'content-type': 'text/plain' },
        )
      ).status,
      415,
    );
    assert.equal(
      (await request('/api/admin/engine', { definition: {}, official: {} }))
        .status,
      400,
    );
    assert.equal(
      (await request('/api/admin/preview', { action: 'validate' })).status,
      400,
    );
    assert.equal((await request('/api/admin/engine', '{')).status, 400);
    assert.equal(
      (await request('/api/admin/engine', 'x'.repeat(262145))).status,
      413,
    );
    assert.equal(
      (await request('/api/admin/exercises', { action: 'save' })).status,
      503,
    );
    assert.equal(
      (await request('/api/admin/publication', { action: 'publish' })).status,
      503,
    );
    assert.equal((await request('/api/admin/session', {})).status, 503);
    assert.equal(calls.length, 0);
    const validated = await request('/api/admin/engine', {
      definition: { schemaVersion: 999 },
    });
    assert.equal(validated.status, 200);
    assert.equal(validated.headers.get('cache-control'), 'no-store');
    assert.equal((await validated.json()).valid, false);
    assert.deepEqual(calls[0], {
      action: 'validate',
      definition: { schemaVersion: 999 },
    });
    available = false;
    assert.equal(
      (await request('/api/admin/preview', { action: 'generate' })).status,
      503,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('local workspace: no native runtime means no successful calculation', async () => {
  const config = localWorkspaceConfig();
  let middleware;
  config.plugins[0].configureServer({
    middlewares: {
      use: (value) => {
        middleware = value;
      },
    },
  });
  const server = createServer((request, response) => {
    void middleware(request, response, () => response.end());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(base + '/__local/status')).json(), {
      synthetic: true,
      database: false,
      engine: false,
    });
    for (const path of ['/api/admin/engine', '/api/admin/preview']) {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: {
          origin: workspaceOrigin,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ definition: {} }),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert(body.error);
      assert(!Object.hasOwn(body, 'valid'));
      assert(!Object.hasOwn(body, 'result'));
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
