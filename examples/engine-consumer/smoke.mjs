// Trusted synthetic definitions only. Applications use the bounded Node host
// for untrusted authoring inputs; direct calls here certify the library package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as engine from 'novlearn-exercise-engine';
import * as native from 'novlearn-exercise-engine/node-host';
import * as legacy from 'novlearn-exercise-engine/legacy';
import { checkArchive, checkInstallation } from './verify.mjs';

const manifest = JSON.parse(
  await readFile(
    new URL('./vendor/engine-release.json', import.meta.url),
    'utf8',
  ),
);
checkArchive(
  await readFile(new URL('./vendor/' + manifest.archive, import.meta.url)),
  manifest,
);
const inventory = await checkInstallation(
  fileURLToPath(new URL('.', import.meta.url)),
  manifest,
);
assert.deepEqual(Object.keys(engine).sort(), manifest.publicExports['.']);
assert.deepEqual(
  Object.keys(native).sort(),
  manifest.publicExports['./node-host'],
);
assert.deepEqual(
  Object.keys(legacy).sort(),
  manifest.publicExports['./legacy'],
);
const definition = JSON.parse(
  await readFile(new URL('./definition.json', import.meta.url), 'utf8'),
);
assert.equal(engine.validateDefinition(definition).ok, true);
assert.equal(
  engine.validateDefinition({ ...definition, schemaVersion: 4 }).ok,
  false,
);
assert.equal(engine.parseMathInput('1{,}25').ok, true);
const first = engine.instantiateExercise(definition, {
  seed: 42,
  instanceId: 'distribution-fixture',
});
assert.equal(first.ok, true);
const replay = engine.instantiateExercise(definition, {
  seed: 42,
  instanceId: 'distribution-fixture',
});
assert.deepEqual(replay, first);
const variables = engine.generateVariables(definition.generation, { seed: 42 });
assert.equal(variables.ok, true);
assert.deepEqual(
  engine.generateVariables(definition.generation, { seed: 42 }),
  variables,
);
const official = first.value;
assert.equal(official.engineVersion, manifest.pipelineVersion);
assert.equal(official.generation.version, manifest.generationVersion);
const projected = engine.projectPublicInstance(official);
assert.deepEqual(Object.keys(projected).sort(), [
  'elements',
  'instanceId',
  'schemaVersion',
  'title',
]);
assert.equal(projected.schemaVersion, manifest.schemaVersion);
const forbidden = new Set([
  'expected',
  'expectedLatex',
  'policy',
  'generation',
  'extensions',
  'definition',
]);
function inspect(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert(!forbidden.has(key), 'Private field exposed: ' + key);
    inspect(nested);
  }
}
inspect(projected);
const answer = official.elements.find((element) => element.id === 'q').expected
  .math.displayLatex;
const submission = (value) => ({
  schemaVersion: 5,
  instanceId: official.instanceId,
  questionId: 'q',
  answer: value,
});
assert.equal(
  engine.validateSubmission(submission({ format: 'latex', source: answer })).ok,
  true,
);
assert.equal(
  engine.gradeAnswer(official, submission({ format: 'latex', source: answer }))
    .state,
  'correct',
);
assert.equal(
  engine.gradeAnswer(official, submission({ format: 'latex', source: '-1000' }))
    .state,
  'incorrect',
);
assert.equal(
  engine.gradeAnswer(official, submission({ format: 'invalid-fixture' })).state,
  'invalid',
);
const impossible = structuredClone(definition);
impossible.generation.constraints = [
  {
    kind: 'comparison',
    left: { variable: 'a' },
    operator: '<',
    right: { constant: 0 },
  },
];
assert.equal(
  engine.generateVariables(impossible.generation, { seed: 42 }).ok,
  false,
);
assert.equal(
  engine.gradeAnswer(
    { ...official, engineVersion: 'unknown' },
    submission({ format: 'latex', source: answer }),
  ).state,
  'error',
);
assert.throws(() =>
  engine.projectPublicInstance({ ...official, schemaVersion: 4 }),
);
// These failures occur before launching a native process. Native Linux positive
// execution remains a separate qualification; never disguise it as this smoke.
const host = native.createNodeHost({ maxConcurrent: 1, maxQueued: 4 });
assert.throws(
  () => native.createNodeHost({ timeoutMs: 0 }),
  /Invalid host limit/,
);
assert.throws(
  () =>
    native.createNodeHost({ maxInputBytes: manifest.host.maxInputBytes + 1 }),
  /Invalid host limit/,
);
assert.throws(
  () => native.createNodeHost({ memoryMiB: 64, heapMiB: 128 }),
  /Heap cannot exceed/,
);
try {
  assert.equal((await host.run('{}')).error, 'invalid-request');
  assert.equal(
    (await host.run('x'.repeat(manifest.host.maxInputBytes + 1))).error,
    'input-limit',
  );
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await host.run(
        JSON.stringify({
          protocolVersion: 1,
          requestId: 'aborted-fixture',
          operation: 'validateDefinition',
          payload: { definition },
        }),
        { signal: controller.signal },
      )
    ).error,
    'aborted',
  );
} finally {
  await host.close();
}
assert.equal((await host.run('{}')).error, 'closed');
const pilots = JSON.parse(
  await readFile(new URL('./pilots.json', import.meta.url), 'utf8'),
);
const pilotCases = JSON.parse(
  await readFile(new URL('./pilot-cases.json', import.meta.url), 'utf8'),
);
for (const [index, pilot] of pilots.entries()) {
  assert.equal(engine.validateDefinition(pilot).ok, true);
  for (const seed of [0, 1, 42]) {
    const run = engine.instantiateExercise(pilot, {
      seed,
      instanceId: pilot.id,
    });
    assert.equal(run.ok, true);
    assert.deepEqual(
      engine.instantiateExercise(pilot, { seed, instanceId: pilot.id }),
      run,
    );
    inspect(engine.projectPublicInstance(run.value));
    for (const q of run.value.elements.filter((e) =>
      ['question', 'mcq'].includes(e.type),
    )) {
      const answer =
        q.type === 'mcq'
          ? { format: 'selection', optionIds: q.expected.optionIds }
          : { format: 'latex', source: q.expected.math.displayLatex };
      const grade = (answer) =>
        engine.gradeAnswer(run.value, {
          schemaVersion: 5,
          instanceId: pilot.id,
          questionId: q.id,
          answer,
        });
      assert.equal(grade(answer).state, 'correct');
      assert.equal(grade({ format: 'invalid-fixture' }).state, 'invalid');
      for (const test of pilotCases[index].filter((c) => c.questionId === q.id))
        assert.equal(grade(test.answer).state, test.expectedState);
    }
  }
}
console.log(
  JSON.stringify({
    result: 'PASS',
    artifact: manifest.archiveSha256,
    ...inventory,
    deterministic: true,
    publicProjection: true,
    pilots: pilots.length,
    pilotSeeds: [0, 1, 42],
    nativePositiveExecution: 'not-executed',
  }),
);
