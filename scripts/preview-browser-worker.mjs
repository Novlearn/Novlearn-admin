import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import {
  generatePreview,
  gradePreview,
  inspectPreview,
  testPreview,
  acquirePreviewJob,
} from './preview-server.ts';
import { closeEngineRuntime, runEngine } from './engine-runtime.ts';

const definition = JSON.parse(
  await readFile('/inputs/preview-definition.json', 'utf8'),
);
const signal = () => AbortSignal.timeout(120000);
const validation = await runEngine(
  'validateDefinition',
  { definition },
  signal(),
);
assert.equal(validation.ok, true);
const invalidValidation = await runEngine(
  'validateDefinition',
  { definition: { ...definition, schemaVersion: 999 } },
  signal(),
);
assert.equal(invalidValidation.ok, false);
assert(invalidValidation.diagnostics.length > 0);
const preview = await generatePreview(
  'native-fixture-owner',
  definition,
  42,
  signal(),
);
assert(!JSON.stringify(preview).includes('PRIVATE_'));
assert(!JSON.stringify(preview).includes('expected'));
const details = inspectPreview('native-fixture-owner', preview.previewId);
const answer = details.expected.find((q) => q.questionId === 'q').answer;
assert.equal(
  (
    await gradePreview(
      'native-fixture-owner',
      preview.previewId,
      'q',
      answer,
      signal(),
    )
  ).state,
  'correct',
);
assert.equal(
  (
    await gradePreview(
      'native-fixture-owner',
      preview.previewId,
      'q',
      { format: 'latex', source: '0' },
      signal(),
    )
  ).state,
  'incorrect',
);
assert.throws(() => inspectPreview('other-owner', preview.previewId));
const report = await testPreview(
  definition,
  [0, 42],
  [
    {
      questionId: 'q',
      expectedState: 'incorrect',
      answer: { format: 'latex', source: '0' },
    },
  ],
  signal(),
);
assert.equal(report.complete, true);
assert.equal(report.passed, true, JSON.stringify(report));
const textDefinition = {
  ...definition,
  elements: [
    {
      id: 'text-question',
      type: 'question',
      text: 'Réponse textuelle',
      points: 1,
      response: { format: 'text', kind: 'text' },
      expectedTexts: ['oui', 'yes'],
      policy: { domain: 'text', form: 'value-only' },
    },
  ],
};
const textPreview = await generatePreview(
  'native-text-owner',
  textDefinition,
  1,
  signal(),
);
assert.deepEqual(
  inspectPreview('native-text-owner', textPreview.previewId).expected[0]
    .variants,
  ['oui', 'yes'],
);
assert.equal(
  (
    await gradePreview(
      'native-text-owner',
      textPreview.previewId,
      'text-question',
      { format: 'text', source: 'yes' },
      signal(),
    )
  ).state,
  'correct',
);
const cgroup = Object.fromEntries(
  await Promise.all(
    ['memory.max', 'memory.swap.max', 'pids.max'].map(async (name) => [
      name,
      (await readFile('/sys/fs/cgroup/' + name, 'utf8')).trim(),
    ]),
  ),
);
assert.deepEqual(cgroup, {
  'memory.max': '402653184',
  'memory.swap.max': '0',
  'pids.max': '64',
});
process.stdout.write(
  JSON.stringify({
    ready: true,
    proof: {
      result: 'PASS',
      nativePreview: true,
      nativeValidation: true,
      nativeInvalidDefinitionRejected: true,
      nativeCorrection: true,
      ownerIsolation: true,
      privateProjection: true,
      nativeTextVariants: true,
      multiSeedReport: report,
      cgroup,
    },
  }) + '\n',
);

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
try {
  for await (const line of rl) {
    let id, release;
    try {
      const request = JSON.parse(line);
      id = request.id;
      const b = request.body;
      if (
        !b ||
        typeof b !== 'object' ||
        Array.isArray(b) ||
        Object.hasOwn(b, 'official')
      )
        throw Error('Bad fixture request');
      const owner = 'synthetic-browser-owner';
      if (
        b.action === 'test' &&
        (!Array.isArray(b.seeds) ||
          b.seeds.length < 1 ||
          b.seeds.length > 5 ||
          !b.seeds.every(
            (s) => Number.isSafeInteger(s) && s >= 0 && s <= 0xffffffff,
          ) ||
          !Array.isArray(b.cases) ||
          b.cases.length > 16)
      )
        throw Error('Fixture test limits');
      release = acquirePreviewJob(owner);
      let result;
      if (b.action === 'validate') {
        const value = await runEngine(
          'validateDefinition',
          { definition: b.definition },
          signal(),
        );
        if (!value || typeof value.ok !== 'boolean')
          throw Error('Invalid Engine result');
        process.stdout.write(
          JSON.stringify({
            id,
            status: 200,
            body: {
              environment: 'staging',
              valid: value.ok,
              diagnostics: value.ok ? [] : value.diagnostics,
            },
          }) + '\n',
        );
        continue;
      } else if (b.action === 'generate')
        result = await generatePreview(owner, b.definition, b.seed, signal());
      else if (b.action === 'inspect')
        result = inspectPreview(owner, b.previewId);
      else if (b.action === 'grade')
        result = await gradePreview(
          owner,
          b.previewId,
          b.questionId,
          b.answer,
          signal(),
        );
      else if (b.action === 'test')
        result = await testPreview(b.definition, b.seeds, b.cases, signal());
      else throw Error('Unknown fixture action');
      process.stdout.write(
        JSON.stringify({
          id,
          status: 200,
          body: { environment: 'staging', result },
        }) + '\n',
      );
    } catch (e) {
      process.stdout.write(
        JSON.stringify({
          id,
          status: e.status ?? 503,
          body: {
            error: e.status ? e.message : 'Fixture runtime unavailable',
            diagnostics: e.diagnostics,
          },
        }) + '\n',
      );
    } finally {
      release?.();
    }
  }
} finally {
  await closeEngineRuntime();
}
