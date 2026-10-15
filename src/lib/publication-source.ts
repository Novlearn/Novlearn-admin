import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isFingerprint, isUuid } from './catalogue';
import { publicationEpoch } from './publication-journal';
import {
  parsePublicationPayload,
  type PublicationPayload,
} from './publication';
import type { PreviewCase, PreviewTestReport } from './preview';

export type PublicationSelection = {
  versionId: string;
  fingerprint: string;
  epoch: string;
};
export type PublicationSource = {
  payload: PublicationPayload;
  source: {
    versionId: string;
    fingerprint: string;
    epoch: string | number;
    reviewId: string;
    receiptId: string;
    report: PreviewTestReport;
    cases: PreviewCase[];
  };
};
export class PublicationSourceError extends Error {
  constructor(
    public readonly code:
      | 'invalid'
      | 'conflict'
      | 'forbidden'
      | 'missing'
      | 'unavailable',
  ) {
    super(code);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export const isPublicationSelection = (
  value: unknown,
): value is PublicationSelection =>
  object(value) &&
  Object.keys(value).sort().join(',') === 'epoch,fingerprint,versionId' &&
  isUuid(value.versionId) &&
  isFingerprint(value.fingerprint) &&
  publicationEpoch(value.epoch);

/** Successful report contract only; all mathematical decisions remain Engine's.
 * Require per-question correct, invalid and deliberately incorrect coverage. */
export function passedPublicationReport(
  value: unknown,
): value is PreviewTestReport {
  if (
    !object(value) ||
    !isFingerprint(value.definitionDigest) ||
    typeof value.engineVersion !== 'string' ||
    value.passed !== true ||
    value.complete !== true ||
    !Array.isArray(value.seeds) ||
    value.seeds.length < 2 ||
    value.seeds.length > 5
  )
    return false;
  const seen = new Set<number>();
  for (const seed of value.seeds) {
    if (
      !object(seed) ||
      typeof seed.seed !== 'number' ||
      !Number.isSafeInteger(seed.seed) ||
      seed.seed < 0 ||
      seed.seed > 0xffffffff ||
      seen.has(seed.seed) ||
      seed.passed !== true ||
      seed.reproducible !== true ||
      seed.publicProjectionSafe !== true ||
      !Array.isArray(seed.diagnostics) ||
      seed.diagnostics.length ||
      !Array.isArray(seed.checks) ||
      seed.checks.length < 3 ||
      seed.checks.length > 32
    )
      return false;
    seen.add(seed.seed);
    const questions = new Map<string, Set<string>>();
    for (const check of seed.checks) {
      // The official submission-contract diagnostic has no resolved question.
      // Valid and deliberately incorrect answers must identify the question.
      if (
        !object(check) ||
        typeof check.questionId !== 'string' ||
        !check.questionId ||
        check.questionId.length > 160 ||
        typeof check.label !== 'string' ||
        check.label.length > 200 ||
        check.passed !== true ||
        !['correct', 'incorrect', 'invalid'].includes(
          String(check.expectedState),
        ) ||
        !object(check.result) ||
        check.result.state !== check.expectedState ||
        check.result.schemaVersion !== 5 ||
        (check.result.questionId !== check.questionId &&
          !(
            check.expectedState === 'invalid' && check.result.questionId === ''
          ))
      )
        return false;
      const states = questions.get(check.questionId) ?? new Set<string>();
      states.add(String(check.expectedState));
      questions.set(check.questionId, states);
    }
    if (
      !questions.size ||
      questions.size > 8 ||
      [...questions.values()].some(
        (states) =>
          !['correct', 'incorrect', 'invalid'].every((state) =>
            states.has(state),
          ),
      )
    )
      return false;
  }
  return true;
}
export function parsePublicationSource(
  value: unknown,
  selection: PublicationSelection,
): PublicationSource | null {
  if (
    !isPublicationSelection(selection) ||
    !object(value) ||
    Object.keys(value).sort().join(',') !== 'payload,source'
  )
    return null;
  const payload = parsePublicationPayload(value.payload),
    source = value.source;
  if (
    !payload ||
    !object(source) ||
    Object.keys(source).sort().join(',') !==
      'cases,epoch,fingerprint,receiptId,report,reviewId,versionId' ||
    source.versionId !== selection.versionId ||
    source.fingerprint !== selection.fingerprint ||
    String(source.epoch) !== selection.epoch ||
    (typeof source.epoch !== 'string' &&
      !(
        typeof source.epoch === 'number' && Number.isSafeInteger(source.epoch)
      )) ||
    !isUuid(source.reviewId) ||
    !isUuid(source.receiptId) ||
    !passedPublicationReport(source.report) ||
    !Array.isArray(source.cases) ||
    source.cases.length < 1 ||
    source.cases.length > 16
  )
    return null;
  for (const entry of source.cases)
    if (
      !object(entry) ||
      Object.keys(entry).sort().join(',') !==
        'answer,expectedState,questionId' ||
      typeof entry.questionId !== 'string' ||
      !entry.questionId ||
      entry.questionId.length > 160 ||
      !object(entry.answer) ||
      !['correct', 'incorrect', 'invalid'].includes(String(entry.expectedState))
    )
      return null;
  try {
    if (Buffer.byteLength(JSON.stringify(value)) > 1048576) return null;
  } catch {
    return null;
  }
  return structuredClone({
    payload,
    source: source as PublicationSource['source'],
  });
}
/** Session client only, never a service-role client. Caller verifies live Auth
 * first; RLS and the fixed export RPC independently check the actual Admin. */
export async function loadPublicationSource(
  client: SupabaseClient,
  selection: PublicationSelection,
  signal: AbortSignal,
): Promise<PublicationSource> {
  if (!isPublicationSelection(selection))
    throw new PublicationSourceError('invalid');
  signal.throwIfAborted();
  try {
    const { data: row, error: loadError } = await client
      .from('exercise_versions')
      .select('id,definition')
      .eq('id', selection.versionId)
      .abortSignal(signal)
      .maybeSingle();
    if (loadError) throw new PublicationSourceError('unavailable');
    if (!row) throw new PublicationSourceError('missing');
    if (
      row.id !== selection.versionId ||
      !object(row.definition) ||
      Buffer.byteLength(JSON.stringify(row.definition)) > 262144
    )
      throw new PublicationSourceError('unavailable');
    signal.throwIfAborted();
    const { data, error } = await client
      .rpc('admin_export_exercise_publication', {
        p_version_id: selection.versionId,
        p_fingerprint: selection.fingerprint,
        p_epoch: selection.epoch,
        p_roundtrip_definition: row.definition,
      })
      .abortSignal(signal);
    if (error)
      throw new PublicationSourceError(
        error.code === '40001'
          ? 'conflict'
          : error.code === '42501'
            ? 'forbidden'
            : error.code === 'P0002'
              ? 'missing'
              : 'unavailable',
      );
    const exported = parsePublicationSource(data, selection);
    if (!exported) throw new PublicationSourceError('unavailable');
    signal.throwIfAborted();
    return exported;
  } catch (error) {
    if (error instanceof PublicationSourceError || signal.aborted) throw error;
    throw new PublicationSourceError('unavailable');
  }
}
