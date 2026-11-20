import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  gradeAnswer,
  instantiateExercise,
  projectPublicInstance,
  type ExerciseDefinition,
} from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';
import { DatabasePreviewStore } from '@/lib/preview-database-store';
import { PreviewError } from '@/lib/preview-server';
vi.mock('server-only', () => ({}));

const definition: ExerciseDefinition = {
  ...newDraft('Aperçu persistant'),
  elements: [
    {
      id: 'q',
      type: 'question',
      text: 'Deux plus deux ?',
      points: 1,
      response: { format: 'latex', kind: 'rational' },
      expectedLatex: '4',
      policy: { domain: 'rational', form: 'value-only' },
    },
  ],
} as ExerciseDefinition;

it('génère une projection élève, relit le snapshot privé et corrige avec le vrai Engine', async () => {
  const generated = instantiateExercise(definition, {
    seed: 42,
    instanceId: 'preview-persistent-flow',
  });
  expect(generated.ok).toBe(true);
  if (!generated.ok)
    throw new Error('Le fixture doit être accepté par Engine.');

  const stored = new Map<string, Record<string, unknown>>();
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => ({
    abortSignal: async () => {
      if (name === 'admin_put_preview_snapshot') {
        const snapshot = {
          previewId: '10000000-0000-4000-8000-000000000001',
          owner: 'alice',
          digest: args.p_digest,
          seed: args.p_seed,
          artifact: args.p_artifact,
          official: args.p_official,
          expiresAt: Date.now() + 590000,
        };
        stored.set(snapshot.previewId, snapshot);
        return { data: snapshot, error: null };
      }
      const snapshot = stored.get(String(args.p_id));
      return snapshot?.owner === 'alice'
        ? { data: snapshot, error: null }
        : { data: null, error: { code: 'P0002', message: 'unavailable' } };
    },
  }));
  const client = { rpc } as unknown as SupabaseClient;
  const signal = new AbortController().signal;
  const writer = new DatabasePreviewStore(client, signal);
  const saved = await writer.put('alice', 'a'.repeat(64), 42, generated.value);
  const reader = new DatabasePreviewStore(client, signal);
  const { official } = await reader.get('alice', saved.previewId);

  const projection = projectPublicInstance(official);
  expect(projection).not.toHaveProperty('generation');
  expect(JSON.stringify(projection)).not.toContain('expected');
  expect(
    gradeAnswer(official, {
      schemaVersion: 5,
      instanceId: official.instanceId,
      questionId: 'q',
      answer: { format: 'latex', source: '4' },
    }).state,
  ).toBe('correct');
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'admin_put_preview_snapshot',
    'admin_get_preview_snapshot',
  ]);

  await expect(reader.get('bob', saved.previewId)).rejects.toBeInstanceOf(
    PreviewError,
  );
});
