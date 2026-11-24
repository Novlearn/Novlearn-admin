import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ create: vi.fn(), remote: vi.fn() }));
vi.mock('novlearn-exercise-engine/node-host', () => ({
  createNodeHost: fake.create,
}));
vi.mock('@/lib/engine-remote-transport', () => ({
  runRemoteEngine: fake.remote,
}));
import { isEngineEnabled, usesRemoteEngine } from '@/lib/engine-identity';
import {
  engineFailure,
  EngineRuntimeError,
  runEngine,
} from '@/lib/engine-runtime';

describe('profil Engine explicite', () => {
  it('demande une activation explicite hors Vercel', () => {
    expect(isEngineEnabled({})).toBe(false);
    expect(isEngineEnabled({ ADMIN_ENGINE_ENABLED: 'true' })).toBe(true);
  });
  it('refuse Vercel avant toute initialisation du host, même si le drapeau est actif', async () => {
    expect(isEngineEnabled({ VERCEL: '1', ADMIN_ENGINE_ENABLED: 'true' })).toBe(
      false,
    );
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('ADMIN_ENGINE_ENABLED', 'true');
    try {
      await expect(runEngine('validateDefinition', {})).rejects.toMatchObject({
        reason: 'runtime-profile',
      });
      expect(fake.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('n’active le profil Vercel que pour le transport HTTPS staging complet', () => {
    const remote = {
      VERCEL: '1',
      ADMIN_ENGINE_ENABLED: 'true',
      ENGINE_URL: 'https://staging.novlearn.fr/run',
      ENGINE_TOKEN: 'private-token-value-long-enough-for-the-host',
      ENGINE_ARTIFACT_SHA256: 'a'.repeat(64),
    };
    expect(isEngineEnabled(remote)).toBe(true);
    expect(
      isEngineEnabled({
        ...remote,
        ENGINE_URL: 'http://127.0.0.1:3151/run',
      }),
    ).toBe(false);
    expect(isEngineEnabled({ ...remote, ENGINE_ARTIFACT_SHA256: '' })).toBe(
      false,
    );
    expect(isEngineEnabled({ ...remote, ENGINE_TOKEN: 'short' })).toBe(false);
  });
  it('utilise le host HTTPS Staging en développement sans initialiser le moteur local', async () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_ENGINE_ENABLED', 'true');
    vi.stubEnv('ENGINE_URL', 'https://staging.novlearn.fr/run');
    vi.stubEnv('ENGINE_ARTIFACT_SHA256', 'a'.repeat(64));
    vi.stubEnv('ENGINE_TOKEN', '');
    try {
      expect(isEngineEnabled(process.env)).toBe(false);
      await expect(runEngine('validateDefinition', {})).rejects.toMatchObject({
        reason: 'runtime-profile',
      });
      expect(fake.remote).not.toHaveBeenCalled();
      vi.stubEnv('ENGINE_TOKEN', 'synthetic-staging-token-at-least-32-bytes');
      fake.remote.mockResolvedValueOnce({ ok: true, value: { ok: true } });
      expect(isEngineEnabled(process.env)).toBe(true);
      await expect(runEngine('validateDefinition', {})).resolves.toEqual({
        ok: true,
      });
      expect(fake.remote).toHaveBeenCalledWith(
        'validateDefinition',
        {},
        undefined,
      );
      expect(fake.create).not.toHaveBeenCalled();
      expect(usesRemoteEngine({ ...process.env, NODE_ENV: 'production' })).toBe(
        false,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('distingue surcharge, contrat distant et erreur interne', () => {
    expect(engineFailure(new EngineRuntimeError('busy'))).toMatchObject({
      status: 429,
      code: 'engine_busy',
    });
    expect(
      engineFailure(new EngineRuntimeError('contract-mismatch')),
    ).toMatchObject({ status: 502, code: 'engine_contract_mismatch' });
    expect(engineFailure(new Error('private implementation detail'))).toEqual({
      status: 500,
      code: 'engine_internal',
      message: 'Erreur interne pendant le traitement Engine.',
    });
  });
  it('laisse le lanceur local neutraliser une URL distante au niveau du processus', () => {
    const env = {
      NODE_ENV: 'development',
      ADMIN_ENGINE_ENABLED: 'true',
      ENGINE_URL: '',
    };
    expect(usesRemoteEngine(env)).toBe(false);
    expect(isEngineEnabled(env)).toBe(true);
  });
});
