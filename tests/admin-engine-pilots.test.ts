import { expect, it, vi } from 'vitest';
import {
  instantiateExercise,
  projectPublicInstance,
  gradeAnswer,
  validateDefinition,
  generateVariables,
} from 'novlearn-exercise-engine';
import type { ExerciseDefinition, JsonObject } from 'novlearn-exercise-engine';
import definitions from '../examples/admin-engine-pilots/definitions.json';
import cases from './fixtures/admin-engine-pilot-cases.json';
import { draftEnvelope } from '@/lib/catalogue';
import type { PreviewCase } from '@/lib/preview';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/engine-runtime', () => ({ runEngine: fake.run }));
import { testPreview, isSafePublicProjection } from '@/lib/preview-server';

// Trusted synthetic corpus: mathematical operations are the actual installed library.
// This transport seam does NOT qualify native isolation or Vercel.
fake.run.mockImplementation(async (op: string, payload: JsonObject) => {
  if (op === 'instantiateExercise')
    return instantiateExercise(
      payload.definition as unknown as ExerciseDefinition,
      { seed: Number(payload.seed), instanceId: String(payload.instanceId) },
    );
  if (op === 'projectPublicInstance')
    return projectPublicInstance(payload.official as never);
  if (op === 'gradeAnswer')
    return gradeAnswer(payload.official as never, payload.submission as never);
  throw Error('Unexpected operation');
});
it.each(definitions.map((d, index) => [d.title, index] as const))(
  '%s : contrat, Engine et parcours de tests Admin sur trois seeds',
  async (_title, index) => {
    const definition = definitions[index] as ExerciseDefinition;
    expect(draftEnvelope(definition)).toBe(true);
    expect(validateDefinition(definition)).toMatchObject({ ok: true });
    const report = await testPreview(
      definition,
      [0, 1, 42],
      cases[index] as PreviewCase[],
      AbortSignal.timeout(120000),
    );
    expect(report.passed, JSON.stringify(report)).toBe(true);
    expect(report.seeds).toHaveLength(3);
    for (const seed of [0, 1, 42]) {
      const instance = instantiateExercise(definition, {
        seed,
        instanceId: definition.id,
      });
      expect(instance.ok).toBe(true);
      if (!instance.ok) throw Error('Instantiation');
      expect(
        isSafePublicProjection(projectPublicInstance(instance.value)),
      ).toBe(true);
    }
  },
  120000,
);
it('le pilote aléatoire respecte ses contraintes et leur impossibilité ne produit pas un repli', () => {
  const generation = structuredClone(
    definitions[1].generation,
  ) as ExerciseDefinition['generation'];
  for (const seed of [0, 1, 42]) {
    const result = generateVariables(generation, { seed });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.values.a;
      expect(value.kind).toBe('integer');
      if (value.kind === 'integer') expect(value.value).toBeGreaterThan(3);
    }
  }
  generation.constraints = [
    {
      kind: 'comparison',
      left: { variable: 'a' },
      operator: '<',
      right: { constant: 0 },
    },
  ];
  expect(generateVariables(generation, { seed: 42 }).ok).toBe(false);
});
