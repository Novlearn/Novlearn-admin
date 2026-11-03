// Mounted into an isolated consumer by the local Linux copy harness.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNodeHost } from 'novlearn-exercise-engine/node-host';
const pilots = JSON.parse(await readFile('/inputs/pilots.json', 'utf8'));
const cases = JSON.parse(await readFile('/inputs/pilot-cases.json', 'utf8'));
const host = createNodeHost({ maxConcurrent: 1, maxQueued: 4 });
let calls = 0;
const results = [];
async function run(operation, payload) {
  const result = await host.run(
    JSON.stringify({
      protocolVersion: 1,
      requestId: 'pilot-' + ++calls,
      operation,
      payload,
    }),
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert(
    result.metrics.peakCgroupBytes > 0 &&
      result.metrics.peakCgroupBytes <= 384 * 1048576,
  );
  assert.throws(() => process.kill(result.metrics.workerPid, 0), {
    code: 'ESRCH',
  });
  return result.value;
}
try {
  for (const [index, definition] of pilots.entries()) {
    assert.equal((await run('validateDefinition', { definition })).ok, true);
    for (const seed of [0, 1, 42]) {
      const instanceId = definition.id + '-' + seed;
      const first = await run('instantiateExercise', {
        definition,
        seed,
        instanceId,
      });
      assert.equal(first.ok, true);
      assert.deepEqual(
        await run('instantiateExercise', { definition, seed, instanceId }),
        first,
      );
      const official = first.value;
      const projected = await run('projectPublicInstance', { official });
      assert.deepEqual(Object.keys(projected).sort(), [
        'elements',
        'instanceId',
        'schemaVersion',
        'title',
      ]);
      assert(!JSON.stringify(projected).includes('expected'));
      for (const q of official.elements.filter((e) =>
        ['question', 'mcq'].includes(e.type),
      )) {
        const grade = async (answer, expected) =>
          assert.equal(
            (
              await run('gradeAnswer', {
                official,
                submission: {
                  schemaVersion: 5,
                  instanceId,
                  questionId: q.id,
                  answer,
                },
              })
            ).state,
            expected,
          );
        const answer =
          q.type === 'mcq'
            ? { format: 'selection', optionIds: q.expected.optionIds }
            : { format: 'latex', source: q.expected.math.displayLatex };
        await grade(answer, 'correct');
        await grade({ format: 'invalid-fixture' }, 'invalid');
        for (const c of cases[index].filter((c) => c.questionId === q.id))
          await grade(c.answer, c.expectedState);
      }
      results.push({ pilot: index + 1, seed, passed: true });
    }
  }
  const impossible = structuredClone(pilots[1].generation);
  impossible.constraints = [
    {
      kind: 'comparison',
      left: { variable: 'a' },
      operator: '<',
      right: { constant: 0 },
    },
  ];
  assert.equal(
    (await run('generateVariables', { definition: impossible, seed: 42 })).ok,
    false,
  );
  console.log(
    JSON.stringify({
      result: 'PASS',
      profile: {
        timeoutMs: 5000,
        memoryMiB: 384,
        heapMiB: 128,
        maxConcurrent: 1,
        maxQueued: 4,
        pids: 64,
        swap: 0,
      },
      calls,
      pilots: results,
      workersStopped: true,
    }),
  );
} finally {
  await host.close();
}
