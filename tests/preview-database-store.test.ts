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
it('crée puis relit via un second adaptateur avec la session courante', async () => {
  const snapshots = new Map<string, typeof base & { expiresAt: number }>();
  const rpc = vi.fn().mockImplementation((name, args) => ({
    abortSignal: async () => {
      if (name === 'admin_put_preview_snapshot') {
        const saved = {
          ...base,
          digest: args.p_digest,
          seed: args.p_seed,
          official: args.p_official,
          artifact: args.p_artifact,
          expiresAt: Date.now() + 590000,
        };
        snapshots.set(saved.previewId, saved);
        return { data: saved, error: null };
      }
      const saved = snapshots.get(args.p_id);
      return saved
        ? { data: saved, error: null }
        : { data: null, error: { code: 'P0002', message: 'unavailable' } };
    },
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
  expect(rpc.mock.calls[0]).toEqual([
    'admin_put_preview_snapshot',
    {
      p_digest: base.digest,
      p_seed: 42,
      p_official: official.value,
      p_artifact: certifiedEngineIdentity.engineArchiveSha256,
    },
  ]);
  await expect(second.get('bob', saved.previewId)).rejects.toMatchObject({
    status: 410,
    message: 'Aperçu expiré ou indisponible.',
  });
});
it.each([
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
it('rend un snapshot attribué à un autre utilisateur indisponible sans le révéler', async () => {
  const client = {
    rpc: () => ({
      abortSignal: async () => ({
        data: { ...base, owner: 'bob', expiresAt: Date.now() + 590000 },
        error: null,
      }),
    }),
  } as unknown as SupabaseClient;
  await expect(
    new DatabasePreviewStore(client, new AbortController().signal).get(
      'alice',
      base.previewId,
    ),
  ).rejects.toMatchObject({
    status: 410,
    message: 'Aperçu expiré ou indisponible.',
  });
});
it.each([
  ['P0002', 410],
  ['P0001', 429],
  ['PGRST202', 503],
  ['42883', 503],
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

it('identifie un contrat SQL de stockage absent sans renvoyer le détail PostgREST', async () => {
  const client = {
    rpc: () => ({
      abortSignal: async () => ({
        error: {
          code: 'PGRST202',
          message: 'Could not find the function in the schema cache',
        },
      }),
    }),
  } as unknown as SupabaseClient;
  await expect(
    new DatabasePreviewStore(client, new AbortController().signal).get(
      'alice',
      base.previewId,
    ),
  ).rejects.toMatchObject({
    status: 503,
    message:
      'Le contrat SQL du stockage privé des aperçus est absent ou désynchronisé en Staging.',
  });
});
