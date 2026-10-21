import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('novlearn-exercise-engine/node-host', () => ({
  createNodeHost: fake.create,
}));
import { isEngineEnabled } from '@/lib/engine-identity';
import { runEngine } from '@/lib/engine-runtime';

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
});
