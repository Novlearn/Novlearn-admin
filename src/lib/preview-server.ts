import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AnswerSubmission,
  ExerciseInstance,
  JsonValue,
  PrivateElement,
  PublicInstance,
  CorrectionResult,
} from 'novlearn-exercise-engine';
import { runEngine } from './engine-runtime';
import type {
  PreviewCase,
  PreviewDetails,
  PreviewDiagnostic,
  PreviewResult,
  PreviewTestReport,
  SeedTestReport,
} from './preview';

export class PreviewError extends Error {
  readonly status: number;
  readonly diagnostics?: PreviewDiagnostic[];
  constructor(
    status: number,
    message: string,
    diagnostics?: PreviewDiagnostic[],
  ) {
    super(message);
    this.status = status;
    this.diagnostics = diagnostics;
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const json = (v: unknown) => v as JsonValue;
const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : object(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
      : v;
export const definitionDigest = (definition: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(definition)))
    .digest('hex');

export type Snapshot = {
  owner: string;
  digest: string;
  seed: number;
  official: ExerciseInstance;
  expiresAt: number;
  bytes: number;
};
export interface SnapshotRepository {
  put(
    owner: string,
    digest: string,
    seed: number,
    official: ExerciseInstance,
  ):
    | ({ previewId: string } & Snapshot)
    | Promise<{ previewId: string } & Snapshot>;
  get(owner: string, id: string): Snapshot | Promise<Snapshot>;
}
/** Ephemeral process-local snapshots; no official instance is accepted from a browser. */
export class PreviewStore {
  private readonly entries = new Map<string, Snapshot>();
  private readonly now: () => number;
  constructor(now = Date.now) {
    this.now = now;
  }
  private expire() {
    for (const [id, s] of this.entries)
      if (s.expiresAt <= this.now()) this.entries.delete(id);
  }
  put(owner: string, digest: string, seed: number, official: ExerciseInstance) {
    this.expire();
    const bytes = Buffer.byteLength(JSON.stringify(official));
    if (bytes > 524288)
      throw new PreviewError(413, 'Instance trop volumineuse pour cet aperçu.');
    const own = [...this.entries].filter(([, s]) => s.owner === owner);
    if (own.length >= 2) this.entries.delete(own[0][0]);
    if (this.entries.size >= 32)
      throw new PreviewError(
        429,
        'Capacité des aperçus atteinte. Réessayez après expiration.',
      );
    const previewId = randomUUID();
    const snapshot = {
      owner,
      digest,
      seed,
      official: structuredClone(official),
      expiresAt: this.now() + 600000,
      bytes,
    };
    this.entries.set(previewId, snapshot);
    return { previewId, ...snapshot };
  }
  get(owner: string, id: string) {
    this.expire();
    const snapshot = this.entries.get(id);
    if (!snapshot || snapshot.owner !== owner)
      throw new PreviewError(
        410,
        'Aperçu expiré ou indisponible. Générez une nouvelle instance.',
      );
    return structuredClone(snapshot);
  }
}
const store = new PreviewStore();
const active = new Set<string>();
export function acquirePreviewJob(owner: string) {
  if (active.has(owner) || active.size >= 2)
    throw new PreviewError(
      429,
      'Un calcul est déjà en cours. Réessayez après sa fin.',
    );
  active.add(owner);
  return () => active.delete(owner);
}
const privateKeys = new Set([
  'definition',
  'generation',
  'expected',
  'expectedLatex',
  'expectedTexts',
  'expectedOptionIds',
  'policy',
  'optionMath',
  'mathFields',
  'extensions',
  'math',
  'source',
  'substituted',
  'syntax',
]);
export function isSafePublicProjection(
  value: unknown,
): value is PublicInstance {
  if (
    !object(value) ||
    value.schemaVersion !== 5 ||
    typeof value.instanceId !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.elements) ||
    Object.keys(value).sort().join(',') !==
      'elements,instanceId,schemaVersion,title'
  )
    return false;
  const pending: unknown[] = [value];
  while (pending.length) {
    const item = pending.pop();
    if (Array.isArray(item)) pending.push(...item);
    else if (object(item)) {
      if (Object.keys(item).some((k) => privateKeys.has(k))) return false;
      pending.push(...Object.values(item));
    }
  }
  return value.elements.every(
    (e) =>
      object(e) &&
      typeof e.id === 'string' &&
      typeof e.type === 'string' &&
      e.type !== 'hint' &&
      e.type !== 'explanation',
  );
}
function diagnostics(v: unknown): PreviewDiagnostic[] {
  if (
    !Array.isArray(v) ||
    !v.length ||
    v.some(
      (d) =>
        !object(d) ||
        typeof d.code !== 'string' ||
        typeof d.path !== 'string' ||
        typeof d.message !== 'string',
    )
  )
    throw new Error('Engine diagnostics protocol');
  return v as PreviewDiagnostic[];
}
async function instantiate(
  definition: unknown,
  seed: number,
  instanceId: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const result = await runEngine(
    'instantiateExercise',
    { definition: json(definition), seed, instanceId },
    signal,
  );
  if (!object(result) || typeof result.ok !== 'boolean')
    throw new Error('Engine instantiation protocol');
  if (!result.ok)
    throw new PreviewError(
      422,
      'La génération a échoué.',
      diagnostics(result.diagnostics),
    );
  const official = result.value;
  if (
    !object(official) ||
    official.schemaVersion !== 5 ||
    official.engineVersion !== '0.1.0' ||
    official.instanceId !== instanceId ||
    !Array.isArray(official.elements) ||
    !object(official.generation)
  )
    throw new Error('Engine instance protocol');
  return official as unknown as ExerciseInstance;
}
async function project(official: ExerciseInstance, signal: AbortSignal) {
  const value = await runEngine(
    'projectPublicInstance',
    { official: json(official) },
    signal,
  );
  if (
    !isSafePublicProjection(value) ||
    value.instanceId !== official.instanceId
  )
    throw new Error('Engine public projection protocol');
  return value;
}
const questions = (official: ExerciseInstance) =>
  official.elements.filter(
    (e): e is Extract<PrivateElement, { type: 'question' | 'mcq' }> =>
      e.type === 'question' || e.type === 'mcq',
  );
function expectedAnswer(
  q: Extract<PrivateElement, { type: 'question' | 'mcq' }>,
): AnswerSubmission['answer'] {
  if (q.type === 'mcq')
    return { format: 'selection', optionIds: [...q.expected.optionIds] };
  if (q.expected.kind === 'text')
    return { format: 'text', source: q.expected.variants[0] };
  return { format: 'latex', source: q.expected.math.displayLatex };
}
async function grade(
  official: ExerciseInstance,
  questionId: string,
  answer: JsonValue,
  signal: AbortSignal,
): Promise<CorrectionResult> {
  const result = await runEngine(
    'gradeAnswer',
    {
      official: json(official),
      submission: {
        schemaVersion: 5,
        instanceId: official.instanceId,
        questionId,
        answer,
      },
    },
    signal,
  );
  if (
    !object(result) ||
    result.schemaVersion !== 5 ||
    result.instanceId !== official.instanceId ||
    typeof result.questionId !== 'string' ||
    !['correct', 'incorrect', 'invalid', 'indeterminate', 'error'].includes(
      String(result.state),
    ) ||
    typeof result.code !== 'string'
  )
    throw new Error('Engine correction protocol');
  const fields = [
    'schemaVersion',
    'instanceId',
    'questionId',
    'state',
    'value',
    'comparison',
    'form',
    'domain',
    'proof',
    'code',
  ];
  if (fields.slice(4).some((k) => typeof result[k] !== 'string'))
    throw new Error('Engine correction fields');
  return Object.fromEntries(
    fields.map((k) => [k, result[k]]),
  ) as unknown as CorrectionResult;
}
export async function generatePreview(
  owner: string,
  definition: unknown,
  seed: number,
  signal: AbortSignal,
  repository: SnapshotRepository = store,
): Promise<PreviewResult> {
  const official = await instantiate(definition, seed, randomUUID(), signal);
  const instance = await project(official, signal);
  signal.throwIfAborted();
  const snapshot = await repository.put(
    owner,
    definitionDigest(definition),
    seed,
    official,
  );
  return {
    previewId: snapshot.previewId,
    expiresAt: snapshot.expiresAt,
    definitionDigest: snapshot.digest,
    seed,
    instance,
    engineVersion: official.engineVersion,
  };
}
export async function inspectPreview(
  owner: string,
  previewId: string,
  repository: SnapshotRepository = store,
): Promise<PreviewDetails> {
  const { official } = await repository.get(owner, previewId);
  return {
    values: official.generation.values,
    draws: official.generation.draws,
    attempts: official.generation.attempts,
    expected: questions(official).map((q) => ({
      questionId: q.id,
      answer: expectedAnswer(q),
      ...(q.type === 'question' && q.expected.kind === 'text'
        ? { variants: q.expected.variants }
        : {}),
    })),
  };
}
export async function gradePreview(
  owner: string,
  previewId: string,
  questionId: string,
  answer: JsonValue,
  signal: AbortSignal,
  repository: SnapshotRepository = store,
) {
  const { official } = await repository.get(owner, previewId);
  if (!questions(official).some((q) => q.id === questionId))
    throw new PreviewError(400, 'Question inconnue pour cet aperçu.');
  return grade(official, questionId, answer, signal);
}
export async function testPreview(
  definition: unknown,
  seeds: number[],
  cases: PreviewCase[],
  signal: AbortSignal,
): Promise<PreviewTestReport> {
  const reports: SeedTestReport[] = [];
  for (const seed of seeds) {
    const report: SeedTestReport = {
      seed,
      passed: false,
      reproducible: false,
      publicProjectionSafe: false,
      diagnostics: [],
      checks: [],
    };
    reports.push(report);
    try {
      const instanceId = randomUUID();
      const official = await instantiate(definition, seed, instanceId, signal);
      const replay = await instantiate(definition, seed, instanceId, signal);
      report.reproducible =
        definitionDigest(official) === definitionDigest(replay);
      await project(official, signal);
      report.publicProjectionSafe = true;
      const qs = questions(official);
      if (!qs.length)
        report.diagnostics.push({
          path: '/elements',
          code: 'no-question',
          message:
            'Aucune question à corriger : la couverture des réponses reste à établir.',
        });
      if (qs.length > 8)
        throw new PreviewError(
          422,
          'Le banc automatique est limité à huit questions par requête.',
        );
      const check = async (
        questionId: string,
        label: string,
        answer: JsonValue,
        expectedState: string,
      ) => {
        const result = await grade(official, questionId, answer, signal);
        report.checks.push({
          questionId,
          label,
          expectedState,
          result,
          passed: result.state === expectedState,
        });
      };
      for (const q of qs) {
        await check(
          q.id,
          'Attendu officiel',
          json(expectedAnswer(q)),
          'correct',
        );
        await check(
          q.id,
          'Format volontairement invalide',
          { format: 'invalid-fixture' },
          'invalid',
        );
        for (const c of cases.filter((c) => c.questionId === q.id))
          await check(
            q.id,
            'Cas administrateur',
            json(c.answer),
            c.expectedState,
          );
        if (
          !cases.some(
            (c) => c.questionId === q.id && c.expectedState === 'incorrect',
          )
        )
          report.diagnostics.push({
            path: '/elements',
            questionId: q.id,
            code: 'negative-case-required',
            message:
              'Ajoutez un cas volontairement incorrect pour cette question.',
          });
      }
      for (const c of cases)
        if (!qs.some((q) => q.id === c.questionId))
          report.diagnostics.push({
            path: '/cases',
            questionId: c.questionId,
            code: 'unknown-question',
            message: 'Le cas de test référence une question absente.',
          });
      report.passed =
        report.reproducible &&
        report.publicProjectionSafe &&
        !report.diagnostics.length &&
        report.checks.every((c) => c.passed);
    } catch (error) {
      if (!(error instanceof PreviewError)) throw error;
      report.diagnostics = error.diagnostics ?? [
        { path: '', code: 'test-limit', message: error.message },
      ];
    }
  }
  return {
    definitionDigest: definitionDigest(definition),
    engineVersion: '0.1.0',
    passed: reports.every((r) => r.passed),
    complete: true,
    seeds: reports,
  };
}
