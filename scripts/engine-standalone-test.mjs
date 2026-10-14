import assert from 'node:assert/strict';
import { createNodeHost } from '/app/node_modules/novlearn-exercise-engine/dist/node-host/index.js';

const host = createNodeHost({ maxConcurrent: 1, maxQueued: 4 });
const definition = {
  schemaVersion: 5,
  kind: 'composed',
  id: 'compiled-standalone-fixture',
  revision: '1',
  title: 'LOCAL FIXTURE',
  generation: {
    schemaVersion: 5,
    definitions: [],
    constraints: [],
    maxAttempts: 100,
    maxDraws: 1000,
  },
  variables: [],
  elements: [
    {
      id: 'question',
      type: 'question',
      text: 'Combien font 2 + 2 ?',
      points: 1,
      response: { format: 'latex', kind: 'rational' },
      expectedLatex: '4',
      policy: { domain: 'rational', form: 'value-only' },
    },
  ],
};
try {
  const result = await host.run(
    JSON.stringify({
      protocolVersion: 1,
      requestId: 'standalone-validate',
      operation: 'validateDefinition',
      payload: { definition },
    }),
  );
  assert(result.ok, JSON.stringify(result));
  assert.equal(result.value.ok, true);
  const instantiated = await host.run(
    JSON.stringify({
      protocolVersion: 1,
      requestId: 'standalone-instantiate',
      operation: 'instantiateExercise',
      payload: { definition, instanceId: 'compiled-fixture', seed: 42 },
    }),
  );
  assert(instantiated.ok, JSON.stringify(instantiated));
  assert.equal(instantiated.value.ok, true);
  console.log(
    JSON.stringify({
      result: 'PASS',
      artifact: 'actual Next standalone node_modules',
      nativeValidation: true,
      nativeInstantiation: true,
      workerDependencyClosureVerified: true,
      elapsedMs: result.metrics.elapsedMs,
    }),
  );
} finally {
  await host.close();
}
