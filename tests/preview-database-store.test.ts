import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { instantiateExercise } from 'novlearn-exercise-engine';
import fixture from './fixtures/preview-definition.json';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { certifiedEngineIdentity } from '@/lib/engine-identity';
vi.mock('server-only', () => ({}));
import { DatabasePreviewStore } from '@/lib/preview-database-store';
const official = instantiateExercise(fixture as ExerciseDefinition, {
  seed: 42,
  instanceId: 'database-fixture',
});
if (!official.ok) throw Error('Synthetic fixture');
const base = {
  previewId: '10000000-0000-4000-8000-000000000001',
  owner: 'alice',
  digest: 'a'.repeat(64),
  seed: 42,
  artifact: certifiedEngineIdentity.engineArchiveSha256,
  official: official.value,
};
it('relit via un second adaptateur avec la session courante, jamais depuis un snapshot navigateur', async () => {
  const rpc = vi.fn().mockImplementation(() => ({
    abortSignal: async () => ({
      data: { ...base, expiresAt: Date.now() + 590000 },
      error: null,
    }),
  }));
  const client = { rpc } as unknown as SupabaseClient;
  const signal = new AbortController().signal;
  const first = new DatabasePreviewStore(client, signal);
  const saved = await first.put('alice', base.digest, 42, official.value);
  const second = new DatabasePreviewStore(client, signal);
  expect((await second.get('alice', saved.previewId)).official).toEqual(
    official.value,
  );
  expect(rpc.mock.calls[1]).toEqual([
    'admin_get_preview_snapshot',
    {
      p_id: saved.previewId,
      p_artifact: certifiedEngineIdentity.engineArchiveSha256,
    },
  ]);
  await expect(second.get('bob', saved.previewId)).rejects.toMatchObject({
    status: 503,
  });
});
it.each([
  { owner: 'bob' },
  { artifact: 'c'.repeat(64) },
  { expiresAt: 0 },
  { previewId: 'not-an-id' },
  { seed: -1 },
])('refuse un résultat privé incohérent : %j', async (mutation) => {
  const client = {
    rpc: () => ({
      abortSignal: async () => ({
        data: { ...base, expiresAt: Date.now() + 590000, ...mutation },
        error: null,
      }),
    }),
  } as unknown as SupabaseClient;
  await expect(
    new DatabasePreviewStore(client, new AbortController().signal).get(
      'alice',
      base.previewId,
    ),
  ).rejects.toMatchObject({ status: 503 });
});
it.each([
  ['P0002', 410],
  ['P0001', 429],
  ['42501', 503],
  ['XX000', 503],
])('traduit le refus SQL %s sans fuite', async (code, status) => {
  const client = {
    rpc: () => ({
      abortSignal: async () => ({
        error: { code, message: 'private SQL details' },
      }),
    }),
  } as unknown as SupabaseClient;
  await expect(
    new DatabasePreviewStore(client, new AbortController().signal).get(
      'alice',
      base.previewId,
    ),
  ).rejects.toMatchObject({ status });
});
