import 'server-only';
import { certifiedEngineIdentity } from './engine-identity';
import { definitionDigest, testPreview } from './preview-server';
import {
  passedPublicationReport,
  type PublicationSource,
} from './publication-source';
import type { PreviewTestReport } from './preview';
export type PublicationVerification = {
  definitionDigest: string;
  engineArchiveSha256: string;
  seeds: number[];
  checkedAt: number;
};
export class PublicationVerificationError extends Error {
  constructor() {
    super('Current Engine verification failed');
  }
}
export function matchingPublicationReport(
  source: PublicationSource,
  report: PreviewTestReport,
): boolean {
  try {
    const expected = source.source.report;
    if (
      !passedPublicationReport(expected) ||
      !passedPublicationReport(report) ||
      report.engineVersion !== certifiedEngineIdentity.version ||
      expected.engineVersion !== report.engineVersion ||
      report.definitionDigest !==
        definitionDigest(JSON.parse(source.payload.definitionJson)) ||
      expected.definitionDigest !== report.definitionDigest ||
      report.seeds.length !== expected.seeds.length
    )
      return false;
    return report.seeds.every(
      (seed, index) =>
        seed.seed === expected.seeds[index].seed &&
        JSON.stringify(
          seed.checks.map((c) => [c.questionId, c.expectedState]),
        ) ===
          JSON.stringify(
            expected.seeds[index].checks.map((c) => [
              c.questionId,
              c.expectedState,
            ]),
          ),
    );
  } catch {
    return false;
  }
}
/** Official native Engine only; does not issue a new receipt or invalidate the
 * approved review. The caller holds the existing bounded preview job slot. */
export async function verifyPublicationEngine(
  source: PublicationSource,
  signal: AbortSignal,
): Promise<PublicationVerification> {
  signal.throwIfAborted();
  try {
    if (
      (
        [
          'engineContract',
          'generationVersion',
          'canonicalizationVersion',
          'engineArchiveSha256',
        ] as const
      ).some((key) => source.payload[key] !== certifiedEngineIdentity[key])
    )
      throw new PublicationVerificationError();
    const definition = JSON.parse(source.payload.definitionJson);
    const seeds = source.source.report.seeds.map((seed) => seed.seed);
    const report = await testPreview(
      definition,
      seeds,
      structuredClone(source.source.cases),
      signal,
    );
    signal.throwIfAborted();
    if (!matchingPublicationReport(source, report))
      throw new PublicationVerificationError();
    return {
      definitionDigest: report.definitionDigest,
      engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
      seeds,
      checkedAt: Date.now(),
    };
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof PublicationVerificationError) throw error;
    throw new PublicationVerificationError();
  }
}
