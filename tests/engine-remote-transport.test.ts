import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  readRemoteEngineConfiguration,
  RemoteEngineError,
  runRemoteEngine,
} from '@/lib/engine-remote-transport';

const digest = 'a'.repeat(64);
const env = () => ({
  VERCEL: '1',
  ADMIN_ENGINE_URL: 'https://staging.novlearn.fr/run',
  ADMIN_ENGINE_TOKEN: 'secret-token-material-which-is-not-short',
  ADMIN_ENGINE_ARCHIVE_SHA256: digest,
});
const response = (body: unknown, status = 200, archive = digest) =>
  Response.json(body, {
    status,
    headers: { 'x-engine-archive-sha256': archive },
  });
const result = (requestId: string, value: unknown) => ({
  requestId,
  ok: true,
  value,
  metrics: { elapsedMs: 2, queuedMs: 0 },
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('transport HTTPS serveur vers Engine', () => {
  it('n'accepte que l'URL staging fixe, un token priv� assez long et une empreinte SHA256', () => {
    expect(readRemoteEngineConfiguration(env())).toMatchObject({
      url: 'https://staging.novlearn.fr/run',
    });
    for (const change of [
      { ADMIN_ENGINE_URL: 'http://127.0.0.1:3151/run' },
      { ADMIN_ENGINE_URL: 'https://staging.novlearn.fr/other' },
      { ADMIN_ENGINE_TOKEN: 'short' },
      { ADMIN_ENGINE_ARCHIVE_SHA256: 'not-a-sha' },
    ])
      expect(readRemoteEngineConfiguration({ ...env(), ...change })).toBeNull();
  });

  it('envoie exactement la requ�te protocole 1 et accepte la r�ponse r�elle HostResult sans protocolVersion', async () => {
    vi.stubEnv('ADMIN_ENGINE_URL', env().ADMIN_ENGINE_URL);
    vi.stubEnv('ADMIN_ENGINE_TOKEN', env().ADMIN_ENGINE_TOKEN);
    vi.stubEnv('ADMIN_ENGINE_ARCHIVE_SHA256', digest);
    const fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const sent = JSON.parse(String(init?.body));
        expect(Object.keys(sent).sort()).toEqual([
          'operation',
          'payload',
          'protocolVersion',
          'requestId',
        ]);
        expect(sent).toMatchObject({
          protocolVersion: 1,
          operation: 'validateDefinition',
          payload: { definition: { kind: 'composed' } },
        });
        expect(init?.headers).toMatchObject({
          authorization: `Bearer ${env().ADMIN_ENGINE_TOKEN}`,
          'content-type': 'application/json',
          'x-engine-archive-sha256': digest,
        });
        return response(
          result(sent.requestId, {
            ok: false,
            diagnostics: [
              { path: '/elements', code: 'value', message: 'Required' },
            ],
          }),
        );
      },
    );
    vi.stubGlobal('fetch', fetch);
    const value = await runRemoteEngine('validateDefinition', {
      definition: { kind: 'composed' },
    });
    expect(value).toMatchObject({
      ok: true,
      value: { ok: false, diagnostics: [{ code: 'value' }] },
    });
    expect(fetch).toHaveBeenCalledWith(
      env().ADMIN_ENGINE_URL,
      expect.objectContaining({ redirect: 'error', cache: 'no-store' }),
    );
  });

  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [409, 'archive-mismatch'],
    [400, 'contract-mismatch'],
    [415, 'contract-mismatch'],
    [429, 'busy'],
    [503, 'unavailable'],
    [504, 'timeout'],
  ] as const)(
    'maps HTTP %i to %s without a success result',
    async (status, reason) => {
      vi.stubEnv('ADMIN_ENGINE_URL', env().ADMIN_ENGINE_URL);
      vi.stubEnv('ADMIN_ENGINE_TOKEN', env().ADMIN_ENGINE_TOKEN);
      vi.stubEnv('ADMIN_ENGINE_ARCHIVE_SHA256', digest);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response({}, status)),
      );
      await expect(
        runRemoteEngine('validateDefinition', {}),
      ).rejects.toMatchObject({
        reason,
      });
    },
  );

  it('refuse les r�ponses d'une autre archive et les r�ponses au contrat inattendu', async () => {
    vi.stubEnv('ADMIN_ENGINE_URL', env().ADMIN_ENGINE_URL);
    vi.stubEnv('ADMIN_ENGINE_TOKEN', env().ADMIN_ENGINE_TOKEN);
    vi.stubEnv('ADMIN_ENGINE_ARCHIVE_SHA256', digest);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({}, 200, 'b'.repeat(64))),
    );
    await expect(
      runRemoteEngine('validateDefinition', {}),
    ).rejects.toMatchObject({
      reason: 'archive-mismatch',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ ok: true })),
    );
    await expect(
      runRemoteEngine('validateDefinition', {}),
    ).rejects.toMatchObject({
      reason: 'contract-mismatch',
    });
  });

  it('distingue le r�seau et les d�lais sans exposer token ou message transport', async () => {
    vi.stubEnv('ADMIN_ENGINE_URL', env().ADMIN_ENGINE_URL);
    vi.stubEnv('ADMIN_ENGINE_TOKEN', env().ADMIN_ENGINE_TOKEN);
    vi.stubEnv('ADMIN_ENGINE_ARCHIVE_SHA256', digest);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Error('sensitive fetch details');
      }),
    );
    try {
      await runRemoteEngine('validateDefinition', {});
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteEngineError);
      expect(error).toMatchObject({ reason: 'network' });
      expect(String(error)).not.toContain(env().ADMIN_ENGINE_TOKEN);
      expect(String(error)).not.toContain('sensitive fetch details');
    }
  });
});

