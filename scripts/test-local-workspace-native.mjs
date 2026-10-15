import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Calls only the existing loopback harness, never a browser or Supabase.
const origin = 'http://127.0.0.1:3140';
const artifact = new URL(
  '../.local/lot1a/workspace-http-' + Date.now() + '/',
  import.meta.url,
);
await mkdir(artifact, { recursive: true });
const definition = JSON.parse(
  await readFile(
    new URL('../tests/fixtures/preview-definition.json', import.meta.url),
    'utf8',
  ),
);
const checks = [];
async function post(path, body, status = 200, headers = {}) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(125000),
  });
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.json();
}
const status = await (await fetch(origin + '/__local/status')).json();
assert.deepEqual(status, { synthetic: true, database: false, engine: true });
checks.push('Native runtime connected; no database');
const valid = await post('/api/admin/engine', { definition });
assert.equal(valid.valid, true);
assert(!JSON.stringify(valid).includes('PRIVATE_'));
checks.push(
  'Canonical definition validated by native Engine without private echo',
);
const invalid = await post('/api/admin/engine', {
  definition: { ...definition, schemaVersion: 999 },
});
assert.equal(invalid.valid, false);
assert(invalid.diagnostics.length > 0);
checks.push('Invalid schema actually rejected by native Engine');
const preview = (
  await post('/api/admin/preview', { action: 'generate', definition, seed: 42 })
).result;
assert.equal(preview.seed, 42);
assert(!JSON.stringify(preview).includes('expected'));
assert(!JSON.stringify(preview).includes('PRIVATE_'));
checks.push(
  'Native instance generated; private data absent from public projection',
);
const details = (
  await post('/api/admin/preview', {
    action: 'inspect',
    previewId: preview.previewId,
  })
).result;
const answer = details.expected.find((item) => item.questionId === 'q').answer;
assert.equal(
  (
    await post('/api/admin/preview', {
      action: 'grade',
      previewId: preview.previewId,
      questionId: 'q',
      answer,
    })
  ).result.state,
  'correct',
);
checks.push('Actual native expected answer graded correct');
assert.equal(
  (
    await post('/api/admin/preview', {
      action: 'grade',
      previewId: preview.previewId,
      questionId: 'q',
      answer: { format: 'latex', source: '0' },
    })
  ).result.state,
  'incorrect',
);
checks.push('Actually incorrect answer graded incorrect');
const report = (
  await post('/api/admin/preview', {
    action: 'test',
    definition,
    seeds: [0, 42],
    cases: [
      {
        questionId: 'q',
        expectedState: 'incorrect',
        answer: { format: 'latex', source: '0' },
      },
    ],
  })
).result;
assert.equal(report.complete, true);
assert.equal(report.passed, true);
checks.push('Complete native multi-seed report passed');
await post('/api/admin/engine', { definition }, 403, {
  origin: 'http://example.invalid',
});
checks.push('Foreign origin refused');
const save = await post(
  '/api/admin/exercises',
  { action: 'save', definition },
  503,
);
assert(save.error);
checks.push('Unconnected database save refused, no fake success');
const publish = await post(
  '/api/admin/publication',
  { action: 'publish' },
  503,
);
assert(publish.error);
checks.push('Publication unavailable');
const proof = {
  result: 'PASS',
  date: new Date().toISOString(),
  checks,
  report,
  limitations: [
    'No browser or visual test executed.',
    'No real Auth, database, persisted mutation or publication tested.',
  ],
};
await writeFile(
  new URL('proof.json', artifact),
  JSON.stringify(proof, null, 2) + '\n',
);
console.log(
  `PASS ${checks.length} HTTP/native checks; proof=${artifact.pathname}`,
);
