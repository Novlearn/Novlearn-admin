import { beforeEach, expect, it, vi } from 'vitest';
import {
  instantiateExercise,
  projectPublicInstance,
  gradeAnswer,
} from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/engine-runtime', () => ({ runEngine: fake.run }));
import {
  PreviewStore,
  PreviewError,
  acquirePreviewJob,
  definitionDigest,
  generatePreview,
  gradePreview,
  inspectPreview,
  isSafePublicProjection,
  testPreview,
} from '@/lib/preview-server';
const definition = () => ({
  ...newDraft('Test'),
  elements: [
    {
      id: 'q',
      type: 'question' as const,
      text: 'Deux plus deux ?',
      points: 1,
      response: { format: 'latex' as const, kind: 'rational' as const },
      expectedLatex: '4',
      policy: { domain: 'rational' as const, form: 'value-only' as const },
    },
  ],
  extensions: { privateSentinel: 'NEVER_PUBLIC' },
});
const official = () => {
  const result = instantiateExercise(definition(), {
    seed: 42,
    instanceId: 'fixture',
  });
  if (!result.ok) throw Error(JSON.stringify(result));
  return result.value;
};
beforeEach(() => {
  fake.run.mockImplementation(async (op, p, signal) => {
    signal?.throwIfAborted();
    if (op === 'instantiateExercise')
      return instantiateExercise(p.definition, {
        seed: p.seed,
        instanceId: p.instanceId,
      });
    if (op === 'projectPublicInstance')
      return projectPublicInstance(p.official);
    if (op === 'gradeAnswer') return gradeAnswer(p.official, p.submission);
    throw Error(op);
  });
});
it('conserve un snapshot détaché, le borne et refuse un autre propriétaire ou son expiration', () => {
  let time = 0;
  const store = new PreviewStore(() => time);
  const source = official();
  const item = store.put('alice', 'digest', 42, source);
  source.title = 'forged';
  expect(store.get('alice', item.previewId).official.title).toBe('Test');
  expect(() => store.get('bob', item.previewId)).toThrow(PreviewError);
  const read = store.get('alice', item.previewId);
  read.official.title = 'forged again';
  expect(store.get('alice', item.previewId).official.title).toBe('Test');
  time = 600000;
  expect(() => store.get('alice', item.previewId)).toThrow(PreviewError);
  const huge = { ...official(), title: 'x'.repeat(524289) };
  expect(() => store.put('alice', 'digest', 42, huge)).toThrow(PreviewError);
});
it('garde deux instantanés par Admin et trente-deux globalement sans évincer les autres propriétaires', () => {
  const store = new PreviewStore();
  // This case tests cache quotas. Instantiate once; put() detaches every entry.
  // Mathematical generation/replay is exercised by the separate Engine cases.
  const snapshot = official();
  const a = store.put('alice', 'd', 1, snapshot);
  store.put('alice', 'd', 2, snapshot);
  store.put('alice', 'd', 3, snapshot);
  expect(() => store.get('alice', a.previewId)).toThrow();
  for (let i = 0; i < 30; i++) store.put('user' + i, 'd', 1, snapshot);
  expect(() => store.put('extra', 'd', 1, snapshot)).toThrow(PreviewError);
});
it('borne les travaux actifs et libère après la fin', () => {
  const a = acquirePreviewJob('a'),
    b = acquirePreviewJob('b');
  expect(() => acquirePreviewJob('a')).toThrow();
  expect(() => acquirePreviewJob('c')).toThrow();
  a();
  const c = acquirePreviewJob('c');
  b();
  c();
});
it('ne fournit que la projection officielle ; les attendus exigent une inspection propriétaire distincte', async () => {
  const preview = await generatePreview(
    'alice',
    definition(),
    42,
    new AbortController().signal,
  );
  expect(JSON.stringify(preview)).not.toContain('NEVER_PUBLIC');
  expect(JSON.stringify(preview)).not.toContain('expected');
  expect(inspectPreview('alice', preview.previewId).expected[0].answer).toEqual(
    { format: 'latex', source: '4' },
  );
  expect(() => inspectPreview('bob', preview.previewId)).toThrow();
  const corrected = await gradePreview(
    'alice',
    preview.previewId,
    'q',
    { format: 'latex', source: '4' },
    new AbortController().signal,
  );
  expect(corrected.state).toBe('correct');
  const call = fake.run.mock.calls.find((c) => c[0] === 'gradeAnswer');
  expect(call?.[1].official.definition.extensions.privateSentinel).toBe(
    'NEVER_PUBLIC',
  );
  await expect(
    gradePreview(
      'bob',
      preview.previewId,
      'q',
      { format: 'latex', source: '4' },
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  await expect(
    gradePreview(
      'alice',
      preview.previewId,
      'absent',
      { format: 'latex', source: '4' },
      new AbortController().signal,
    ),
  ).rejects.toThrow();
});
it('détecte une projection qui laisse fuiter des attentes, y compris dans un objet imbriqué', () => {
  const projected = projectPublicInstance(official());
  expect(isSafePublicProjection(projected)).toBe(true);
  expect(
    isSafePublicProjection({
      ...projected,
      elements: [
        { id: 'q', type: 'text', text: 'Safe', nested: { expected: 'secret' } },
      ],
    }),
  ).toBe(false);
  expect(
    isSafePublicProjection({ ...projected, generation: { values: { a: 1 } } }),
  ).toBe(false);
});
it('exerce des seeds distinctes, le rejeu, les attendus, les formats invalides et les cas incorrects via Engine', async () => {
  const result = await testPreview(
    definition(),
    [0, 42],
    [
      {
        questionId: 'q',
        answer: { format: 'latex', source: '5' },
        expectedState: 'incorrect',
      },
    ],
    new AbortController().signal,
  );
  expect(result.passed).toBe(true);
  expect(result.seeds.map((s) => s.seed)).toEqual([0, 42]);
  expect(
    result.seeds.every(
      (s) => s.reproducible && s.publicProjectionSafe && s.checks.length === 3,
    ),
  ).toBe(true);
});
it('ne déclare pas un test réussi sans cas négatif ou lorsque sa réponse est en réalité correcte', async () => {
  const missing = await testPreview(
    definition(),
    [1],
    [],
    new AbortController().signal,
  );
  expect(missing.passed).toBe(false);
  expect(missing.seeds[0].diagnostics[0].code).toBe('negative-case-required');
  const falseNegative = await testPreview(
    definition(),
    [1],
    [
      {
        questionId: 'q',
        answer: { format: 'latex', source: '4' },
        expectedState: 'incorrect',
      },
    ],
    new AbortController().signal,
  );
  expect(falseNegative.passed).toBe(false);
});
it('présente les diagnostics d’une génération impossible et ne corrige aucune instance inventée', async () => {
  const bad = {
    ...definition(),
    generation: {
      ...definition().generation,
      definitions: [{ kind: 'computed', name: 'a', latex: 'a+1' }],
    },
  };
  const result = await testPreview(bad, [1], [], new AbortController().signal);
  expect(result.passed).toBe(false);
  expect(result.seeds[0].diagnostics.length).toBeGreaterThan(0);
  expect(fake.run.mock.calls.every((c) => c[0] !== 'gradeAnswer')).toBe(true);
});
it('refuse les résultats Engine invalides et respecte l’annulation', async () => {
  fake.run.mockResolvedValue(null);
  await expect(
    generatePreview('alice', definition(), 1, new AbortController().signal),
  ).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(
    testPreview(definition(), [1], [], controller.signal),
  ).rejects.toThrow();
});
it('ne certifie pas un rejeu divergent ou un résultat indéterminé', async () => {
  const run = fake.run.getMockImplementation()!;
  let calls = 0;
  fake.run.mockImplementation(async (op, p, signal) => {
    const value = await run(op, p, signal);
    if (op === 'instantiateExercise' && ++calls === 2)
      value.value.generation.draws++;
    if (op === 'gradeAnswer') value.state = 'indeterminate';
    return value;
  });
  const result = await testPreview(
    definition(),
    [42],
    [
      {
        questionId: 'q',
        answer: { format: 'latex', source: '5' },
        expectedState: 'incorrect',
      },
    ],
    new AbortController().signal,
  );
  expect(result.passed).toBe(false);
  expect(result.seeds[0].reproducible).toBe(false);
  expect(result.seeds[0].checks.every((c) => !c.passed)).toBe(true);
});
it('masque tout champ de correction hors contrat et garde toutes les variantes textuelles dans l’inspection privée', async () => {
  const text = {
    ...definition(),
    elements: [
      {
        id: 'q',
        type: 'question' as const,
        text: 'Mot',
        points: 1,
        response: { format: 'text' as const, kind: 'text' as const },
        expectedTexts: ['oui', 'yes'],
        policy: { domain: 'text' as const, form: 'value-only' as const },
      },
    ],
  };
  const preview = await generatePreview(
    'text-owner',
    text,
    1,
    new AbortController().signal,
  );
  expect(
    inspectPreview('text-owner', preview.previewId).expected[0].variants,
  ).toEqual(['oui', 'yes']);
  const run = fake.run.getMockImplementation()!;
  fake.run.mockImplementation(async (op, p, s) => {
    const result = await run(op, p, s);
    return op === 'gradeAnswer'
      ? { ...result, expected: 'MUST_NOT_ECHO' }
      : result;
  });
  const result = await gradePreview(
    'text-owner',
    preview.previewId,
    'q',
    { format: 'text', source: 'yes' },
    new AbortController().signal,
  );
  expect(result.state).toBe('correct');
  expect(JSON.stringify(result)).not.toContain('MUST_NOT_ECHO');
});
it('rattache l’empreinte à tout le contenu, en conservant l’ordre des éléments', () => {
  const d = definition();
  expect(definitionDigest(d)).toBe(definitionDigest({ ...d, title: d.title }));
  expect(definitionDigest({ ...d, title: 'Other' })).not.toBe(
    definitionDigest(d),
  );
  const reordered = {
    ...d,
    elements: [...d.elements, { id: 't', type: 'text' as const, text: 'Text' }],
  };
  expect(definitionDigest(reordered)).not.toBe(
    definitionDigest({
      ...reordered,
      elements: [...reordered.elements].reverse(),
    }),
  );
});
it('teste les QCM multiples et les variantes texte par ID de question avec leurs réponses incorrectes', async () => {
  const d = {
    ...definition(),
    elements: [
      {
        id: 'multi',
        type: 'mcq' as const,
        text: 'Deux choix',
        points: 1,
        mode: 'multiple' as const,
        options: [
          { id: 'a', content: { format: 'text' as const, text: 'A' } },
          { id: 'b', content: { format: 'text' as const, text: 'B' } },
        ],
        expectedOptionIds: ['a', 'b'],
      },
      {
        id: 'text',
        type: 'question' as const,
        text: 'Mot',
        points: 1,
        response: { format: 'text' as const, kind: 'text' as const },
        expectedTexts: ['oui', 'yes'],
        policy: { domain: 'text' as const, form: 'value-only' as const },
      },
    ],
  };
  const report = await testPreview(
    d,
    [42],
    [
      {
        questionId: 'multi',
        answer: { format: 'selection', optionIds: ['a'] },
        expectedState: 'incorrect',
      },
      {
        questionId: 'text',
        answer: { format: 'text', source: 'no' },
        expectedState: 'incorrect',
      },
      {
        questionId: 'text',
        answer: { format: 'text', source: 'yes' },
        expectedState: 'correct',
      },
    ],
    new AbortController().signal,
  );
  expect(report.passed).toBe(true);
  expect(
    report.seeds[0].checks.filter((c) => c.questionId === 'multi'),
  ).toHaveLength(3);
  expect(
    report.seeds[0].checks.filter((c) => c.questionId === 'text'),
  ).toHaveLength(4);
});
