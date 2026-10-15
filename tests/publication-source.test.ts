import { beforeEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import native from './fixtures/publication-journal-sql.json';
import {
  isPublicationSelection,
  loadPublicationSource,
  parsePublicationSource,
  passedPublicationReport,
} from '@/lib/publication-source';
vi.mock('server-only', () => ({}));
const selection = () => ({
  versionId: native.version_id,
  fingerprint: native.source_fingerprint,
  epoch: native.source_epoch,
});
const source = () =>
  structuredClone({ payload: native.payload, source: native.source_snapshot });
const fetcher = vi.fn<typeof fetch>();
const client = () =>
  createClient('https://fixture.supabase.co', 'sb_publishable_fixture', {
    global: { fetch: fetcher },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (request) => {
    const url = String(request);
    const data = url.includes('/rpc/')
      ? source()
      : {
          id: native.version_id,
          definition: JSON.parse(native.payload.definitionJson),
        };
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
it('accepts the actual native-approved SQL export, including empty questionId in the invalid diagnostic', () => {
  expect(passedPublicationReport(native.source_snapshot.report)).toBe(true);
  expect(parsePublicationSource(source(), selection())).toEqual(source());
});
it('requires exact source selection and preserves bigint epochs as decimal strings', () => {
  expect(
    isPublicationSelection({ ...selection(), epoch: '9223372036854775807' }),
  ).toBe(true);
  for (const epoch of [0, '-1', '00', '9223372036854775808', '1e3'])
    expect(isPublicationSelection({ ...selection(), epoch })).toBe(false);
  expect(isPublicationSelection({ ...selection(), target: 'arbitrary' })).toBe(
    false,
  );
  expect(
    parsePublicationSource(source(), {
      ...selection(),
      fingerprint: 'a'.repeat(64),
    }),
  ).toBeNull();
  expect(
    parsePublicationSource(source(), { ...selection(), epoch: '1' }),
  ).toBeNull();
  const unsafe = source();
  unsafe.source.epoch = 9007199254740992;
  expect(
    parsePublicationSource(unsafe, {
      ...selection(),
      epoch: '9007199254740992',
    }),
  ).toBeNull();
});
it.each(['passed', 'complete'])(
  'rejects an incomplete or unsuccessful %s report',
  (field) => {
    const input = source();
    Object.assign(input.source.report, { [field]: false });
    expect(parsePublicationSource(input, selection())).toBeNull();
  },
);
it.each(['reproducible', 'publicProjectionSafe', 'passed'])(
  'rejects a failed seed invariant %s',
  (field) => {
    const input = source();
    Object.assign(input.source.report.seeds[0], { [field]: false });
    expect(parsePublicationSource(input, selection())).toBeNull();
  },
);
it('rejects duplicated seeds, diagnostic failures and missing negative coverage', () => {
  const input = source();
  input.source.report.seeds[1].seed = input.source.report.seeds[0].seed;
  expect(passedPublicationReport(input.source.report)).toBe(false);
  const noNegative = source();
  noNegative.source.report.seeds[0].checks.pop();
  expect(passedPublicationReport(noNegative.source.report)).toBe(false);
  const diagnostics = source();
  Object.assign(diagnostics.source.report.seeds[0], {
    diagnostics: [{ code: 'failure' }],
  });
  expect(passedPublicationReport(diagnostics.source.report)).toBe(false);
});
it('requires a matching actual result, question and Engine schema', () => {
  for (const result of [
    { state: 'incorrect' },
    { questionId: 'wrong' },
    { schemaVersion: 6 },
  ]) {
    const input = source();
    Object.assign(input.source.report.seeds[0].checks[0].result, result);
    expect(passedPublicationReport(input.source.report)).toBe(false);
  }
});
it('refuses added fields, malformed cases, oversized responses and shares no mutable snapshot', () => {
  expect(
    parsePublicationSource({ ...source(), secret: 'x' }, selection()),
  ).toBeNull();
  const extra = source();
  Object.assign(extra.source, { unknown: true });
  expect(parsePublicationSource(extra, selection())).toBeNull();
  const bad = source();
  Object.assign(bad.source.cases[0], { answer: [] });
  expect(parsePublicationSource(bad, selection())).toBeNull();
  const big = source();
  Object.assign(big.source.cases[0], {
    answer: { source: 'x'.repeat(1048576) },
  });
  expect(parsePublicationSource(big, selection())).toBeNull();
  const original = source(),
    parsed = parsePublicationSource(original, selection())!;
  original.source.report.seeds[0].checks[0].label = 'changed';
  expect(parsed.source.report.seeds[0].checks[0].label).not.toBe('changed');
});
it('uses only the session-scoped row and fixed export RPC with exact selection and roundtrip definition', async () => {
  const signal = new AbortController().signal;
  await expect(
    loadPublicationSource(client(), selection(), signal),
  ).resolves.toEqual(source());
  expect(fetcher).toHaveBeenCalledTimes(2);
  const rowUrl = new URL(String(fetcher.mock.calls[0][0]));
  expect(rowUrl.pathname).toBe('/rest/v1/exercise_versions');
  expect(rowUrl.searchParams.get('select')).toBe('id,definition');
  expect(rowUrl.searchParams.get('id')).toBe(`eq.${native.version_id}`);
  const [rpcUrl, options] = fetcher.mock.calls[1];
  expect(String(rpcUrl)).toBe(
    'https://fixture.supabase.co/rest/v1/rpc/admin_export_exercise_publication',
  );
  expect(JSON.parse(String(options?.body))).toEqual({
    p_version_id: native.version_id,
    p_fingerprint: native.source_fingerprint,
    p_epoch: '0',
    p_roundtrip_definition: JSON.parse(native.payload.definitionJson),
  });
  expect(options?.signal).toBe(signal);
});
it.each([
  ['40001', 'conflict'],
  ['42501', 'forbidden'],
  ['P0002', 'missing'],
  ['XX000', 'unavailable'],
])('masks SQL %s without exposing private messages', async (code, expected) => {
  fetcher.mockImplementation(async (request) =>
    String(request).includes('/rpc/')
      ? new Response(
          JSON.stringify({ code, message: 'PRIVATE DATABASE DETAIL' }),
          { status: 400 },
        )
      : new Response(
          JSON.stringify({
            id: native.version_id,
            definition: JSON.parse(native.payload.definitionJson),
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
  );
  await expect(
    loadPublicationSource(client(), selection(), new AbortController().signal),
  ).rejects.toMatchObject({ code: expected, message: expected });
});
it('does not export when the source row is absent, inaccessible or mismatched', async () => {
  for (const data of [
    null,
    { id: 'wrong', definition: {} },
    { id: native.version_id, definition: [] },
  ]) {
    fetcher.mockReset().mockResolvedValue(
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      loadPublicationSource(
        client(),
        selection(),
        new AbortController().signal,
      ),
    ).rejects.toHaveProperty('code', data === null ? 'missing' : 'unavailable');
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it('does no I/O for invalid input or prior cancellation and stops between the two reads', async () => {
  await expect(
    loadPublicationSource(
      client(),
      { ...selection(), epoch: '-1' },
      new AbortController().signal,
    ),
  ).rejects.toHaveProperty('code', 'invalid');
  const abort = new AbortController();
  abort.abort();
  await expect(
    loadPublicationSource(client(), selection(), abort.signal),
  ).rejects.toHaveProperty('name', 'AbortError');
  expect(fetcher).not.toHaveBeenCalled();
  const mid = new AbortController();
  fetcher.mockImplementation(async () => {
    mid.abort();
    return new Response(
      JSON.stringify({ id: native.version_id, definition: {} }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  await expect(
    loadPublicationSource(client(), selection(), mid.signal),
  ).rejects.toHaveProperty('name', 'AbortError');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
