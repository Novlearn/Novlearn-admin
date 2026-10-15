import { beforeEach, expect, it, vi } from 'vitest';
import {
  instantiateExercise,
  projectPublicInstance,
  gradeAnswer,
} from 'novlearn-exercise-engine';
import native from './fixtures/publication-journal-sql.json';
import { parsePublicationSource } from '@/lib/publication-source';
import {
  matchingPublicationReport,
  verifyPublicationEngine,
} from '@/lib/publication-verification';
vi.mock('server-only', () => ({}));
const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/engine-runtime', () => ({ runEngine: fake.run }));
const source = () =>
  parsePublicationSource(
    { payload: native.payload, source: native.source_snapshot },
    {
      versionId: native.version_id,
      fingerprint: native.source_fingerprint,
      epoch: native.source_epoch,
    },
  )!;
beforeEach(() => {
  fake.run.mockReset().mockImplementation(async (op, p, signal) => {
    signal?.throwIfAborted();
    if (op === 'instantiateExercise')
      return instantiateExercise(p.definition, {
        seed: p.seed,
        instanceId: p.instanceId,
      });
    if (op === 'projectPublicInstance')
      return projectPublicInstance(p.official);
    if (op === 'gradeAnswer') return gradeAnswer(p.official, p.submission);
    throw Error('PRIVATE ENGINE DETAIL');
  });
});
it('actually reruns the official SDK on both approved seeds and all cases without altering the receipt', async () => {
  const input = source(),
    before = structuredClone(input);
  const result = await verifyPublicationEngine(
    input,
    new AbortController().signal,
  );
  expect(result).toMatchObject({
    definitionDigest: native.source_snapshot.report.definitionDigest,
    engineArchiveSha256: native.payload.engineArchiveSha256,
    seeds: [0, 42],
  });
  expect(result.checkedAt).toBeGreaterThan(0);
  expect(
    fake.run.mock.calls.filter(([op]) => op === 'instantiateExercise'),
  ).toHaveLength(4);
  expect(
    fake.run.mock.calls.filter(([op]) => op === 'gradeAnswer'),
  ).toHaveLength(6);
  expect(input).toEqual(before);
});
it('compares mathematical coverage while allowing fresh random instance identities', () => {
  const input = source(),
    report = structuredClone(input.source.report);
  for (const seed of report.seeds)
    for (const check of seed.checks)
      check.result.instanceId = 'different-fresh-instance';
  expect(matchingPublicationReport(input, report)).toBe(true);
  report.seeds.reverse();
  expect(matchingPublicationReport(input, report)).toBe(false);
});
it('rejects changed seed, changed question coverage, changed digest and malformed definition', () => {
  for (const mutate of [
    (r: typeof native.source_snapshot.report) => {
      r.seeds[0].seed = 5;
    },
    (r: typeof native.source_snapshot.report) => {
      r.seeds[0].checks.reverse();
    },
    (r: typeof native.source_snapshot.report) => {
      r.definitionDigest = 'a'.repeat(64);
    },
  ]) {
    const input = source(),
      report = structuredClone(native.source_snapshot.report);
    mutate(report);
    expect(
      matchingPublicationReport(input, report as typeof input.source.report),
    ).toBe(false);
  }
  const bad = source();
  bad.payload.definitionJson = 'not-json';
  expect(matchingPublicationReport(bad, bad.source.report)).toBe(false);
});
it.each([
  'engineContract',
  'generationVersion',
  'canonicalizationVersion',
  'engineArchiveSha256',
] as const)('does not run an uncertified %s runtime', async (key) => {
  const input = source();
  input.payload[key] = 'changed';
  await expect(
    verifyPublicationEngine(input, new AbortController().signal),
  ).rejects.toThrow('Current Engine verification failed');
  expect(fake.run).not.toHaveBeenCalled();
});
it('fails when a formerly incorrect case now becomes correct', async () => {
  const input = source();
  input.source.cases[0].answer = { format: 'latex', source: 'a+1' };
  await expect(
    verifyPublicationEngine(input, new AbortController().signal),
  ).rejects.toThrow('Current Engine verification failed');
});
it('refuses a new definition even if its own fresh test succeeds', async () => {
  const input = source(),
    definition = JSON.parse(input.payload.definitionJson);
  definition.title = 'changed';
  input.payload.definitionJson = JSON.stringify(definition);
  await expect(
    verifyPublicationEngine(input, new AbortController().signal),
  ).rejects.toThrow('Current Engine verification failed');
});
it('masks worker failures and preserves cancellation without a success receipt', async () => {
  fake.run.mockRejectedValue(Error('PRIVATE ENGINE DETAIL'));
  await expect(
    verifyPublicationEngine(source(), new AbortController().signal),
  ).rejects.toThrow('Current Engine verification failed');
  fake.run.mockClear();
  const abort = new AbortController();
  abort.abort();
  await expect(
    verifyPublicationEngine(source(), abort.signal),
  ).rejects.toHaveProperty('name', 'AbortError');
  expect(fake.run).not.toHaveBeenCalled();
});
