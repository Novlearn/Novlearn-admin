import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { LOCAL_SCHEMA_MANIFEST_SHA256 } from '@/lib/auth/config';
import {
  readLocalEngineConfiguration,
  runLocalEngine,
} from '@/lib/engine-local-transport';
const env = () => ({
  NODE_ENV: 'development',
  ADMIN_LOCAL_WORKSPACE_ENABLED: 'true',
  ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: LOCAL_SCHEMA_MANIFEST_SHA256,
  ADMIN_LOCAL_SUPABASE_URL: 'http://127.0.0.1:55431',
  APP_BASE_URL: 'http://127.0.0.1:3150',
  ADMIN_LOCAL_SUPABASE_ANON_KEY: [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        iss: 'supabase',
        ref: 'novlearn-admin-local',
        role: 'anon',
      }),
    ).toString('base64url'),
    'a'.repeat(43),
  ].join('.'),
  ADMIN_ENGINE_ENABLED: 'true',
  ADMIN_LOCAL_ENGINE_URL: 'http://127.0.0.1:3151/run',
  ADMIN_LOCAL_ENGINE_CAPABILITY: 'a'.repeat(64),
});
const configure = () => {
  for (const [key, value] of Object.entries(env())) vi.stubEnv(key, value);
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('private local Linux transport', () => {
  it('requires the qualified isolated development Auth configuration', () => {
    expect(readLocalEngineConfiguration(env())).toEqual({
      url: 'http://127.0.0.1:3151/run',
      capability: 'a'.repeat(64),
    });
  });
  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { ADMIN_LOCAL_WORKSPACE_ENABLED: 'false' },
    { ADMIN_ENGINE_ENABLED: 'false' },
    { ADMIN_STAGING_AUTH_ENABLED: 'true' },
    { ADMIN_PUBLICATION_ENABLED: 'true' },
    { ADMIN_LOCAL_ENGINE_URL: 'http://localhost:3151/run' },
    { ADMIN_LOCAL_ENGINE_URL: 'http://127.0.0.1:3151/other' },
    { ADMIN_LOCAL_ENGINE_URL: 'https://example.com/run' },
    { ADMIN_LOCAL_ENGINE_URL: 'http://127.0.0.1:3151/run?target=remote' },
    { ADMIN_LOCAL_ENGINE_CAPABILITY: '' },
    { ADMIN_LOCAL_ENGINE_CAPABILITY: 'a'.repeat(63) },
    { ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: 'a'.repeat(64) },
  ])(
    'rejects mixed environments, destinations and absent capabilities %#',
    (change) => {
      expect(readLocalEngineConfiguration({ ...env(), ...change })).toBeNull();
    },
  );
  it('sends only the operation envelope and binds the response to its request', async () => {
    configure();
    const fetch = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      expect(Object.keys(request).sort()).toEqual([
        'operation',
        'payload',
        'protocolVersion',
        'requestId',
      ]);
      return Response.json({
        requestId: request.requestId,
        ok: true,
        value: { ok: true },
        metrics: { elapsedMs: 1, queuedMs: 0 },
      });
    });
    vi.stubGlobal('fetch', fetch);
    expect(
      await runLocalEngine('validateDefinition', { definition: {} }),
    ).toMatchObject({ ok: true, value: { ok: true } });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3151/run',
      expect.objectContaining({
        redirect: 'error',
        cache: 'no-store',
        headers: expect.objectContaining({
          authorization: 'Bearer ' + 'a'.repeat(64),
        }),
      }),
    );
  });
  it('does not contact any transport without its complete local gate', async () => {
    configure();
    vi.stubEnv('NODE_ENV', 'production');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(runLocalEngine('validateDefinition', {})).rejects.toThrow(
      'not configured',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { requestId: 'wrong', ok: true, value: true },
    { requestId: 'same', ok: false, error: 'invented-success' },
  ])('rejects unbound or invalid worker results %#', async (result) => {
    configure();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) =>
        Response.json({
          ...result,
          requestId:
            result.requestId === 'same'
              ? JSON.parse(init.body).requestId
              : result.requestId,
        }),
      ),
    );
    await expect(runLocalEngine('validateDefinition', {})).rejects.toThrow(
      'protocol',
    );
  });
  it('bounds output and rejects a failed worker without a replacement calculation', async () => {
    configure();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x'.repeat(2099201))),
    );
    await expect(runLocalEngine('validateDefinition', {})).rejects.toThrow(
      'output limit',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await expect(runLocalEngine('validateDefinition', {})).rejects.toThrow(
      'unavailable',
    );
  });
  it('bounds input before transport and propagates cancellation', async () => {
    configure();
    const fetch = vi.fn(async (_url, init) => {
      init.signal.throwIfAborted();
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      runLocalEngine('validateDefinition', { text: 'x'.repeat(1048576) }),
    ).rejects.toThrow('input limit');
    expect(fetch).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runLocalEngine('validateDefinition', {}, controller.signal),
    ).rejects.toThrow();
  });
});
