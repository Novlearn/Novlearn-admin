import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  runEngine,
  closeEngineRuntime,
  EngineRuntimeError,
} from './engine-runtime.ts';

const definition = {
  schemaVersion: 5,
  kind: 'composed',
  id: 'local-admin-runtime',
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
  const accepted = await runEngine('validateDefinition', { definition });
  assert.equal(accepted.ok, true);
  const rejected = await runEngine('validateDefinition', {
    definition: { ...definition, schemaVersion: 4 },
  });
  assert.equal(rejected.ok, false);
  assert(rejected.diagnostics.some((issue) => issue.path === '/schemaVersion'));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runEngine('validateDefinition', { definition }, controller.signal),
    (error) =>
      error instanceof EngineRuntimeError && error.reason === 'aborted',
  );
  const cgroup = Object.fromEntries(
    await Promise.all(
      ['memory.max', 'memory.swap.max', 'pids.max'].map(async (file) => [
        file,
        (await readFile(`/sys/fs/cgroup/${file}`, 'utf8')).trim(),
      ]),
    ),
  );
  assert.equal(cgroup['memory.max'], '402653184');
  assert.equal(cgroup['memory.swap.max'], '0');
  assert.equal(cgroup['pids.max'], '64');
  console.log(
    JSON.stringify({
      result: 'PASS',
      profile: 'Linux x64 / bounded cgroup v2',
      cgroup,
      canonicalValidation: true,
      invalidSchemaRejected: true,
      abortedRequestRejected: true,
      unboundedFallback: false,
    }),
  );
} finally {
  await closeEngineRuntime();
}
