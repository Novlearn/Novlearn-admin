'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  AnswerSubmission,
  CorrectionResult,
  ExerciseDefinition,
} from 'novlearn-exercise-engine';
import type {
  PreviewCase,
  PreviewDiagnostic,
  PreviewResult,
  PreviewTestReport,
} from '@/lib/preview';
import { PublicExercise, MathDisplay } from './public-exercise';
import { MathInput } from './math-input';

const testSeeds = [0, 1, 42];
type PreviewPost = <Result>(
  url: string,
  body: unknown,
) => Promise<{
  result: Result;
  valid?: boolean;
  diagnostics?: PreviewDiagnostic[];
}>;

export function ExercisePreview({
  definition,
  disabled = false,
  engineEnabled = false,
}: {
  definition: ExerciseDefinition;
  disabled?: boolean;
  engineEnabled?: boolean;
}) {
  const source = JSON.stringify(definition);
  const latest = useRef(source);
  latest.current = source;
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [report, setReport] = useState<PreviewTestReport | null>(null);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostic[]>([]);
  const [showCases, setShowCases] = useState(false);
  const [answers, setAnswers] = useState<Record<string, PreviewCase['answer']>>(
    {},
  );
  const questions = definition.elements.filter(
    (item) => item.type === 'question' || item.type === 'mcq',
  );

  useEffect(() => {
    controller.current?.abort();
    setPreview(null);
    setReport(null);
    setError('');
    setDiagnostics([]);
    return () => controller.current?.abort();
  }, [source]);

  async function request<T>(
    run: (post: PreviewPost) => Promise<T>,
  ): Promise<T> {
    if (controller.current) throw Error('busy');
    const cancel = new AbortController();
    controller.current = cancel;
    setBusy(true);
    setError('');
    setDiagnostics([]);
    const post: PreviewPost = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: cancel.signal,
      });
      const data = await response.json();
      if (source !== latest.current || cancel.signal.aborted)
        throw Error('stale');
      if (!response.ok) {
        setError(data.error ?? 'Calcul indisponible.');
        setDiagnostics(data.diagnostics ?? []);
        throw Error('request');
      }
      return data;
    };
    try {
      return await run(post);
    } catch (failure) {
      if (
        !cancel.signal.aborted &&
        source === latest.current &&
        (!(failure instanceof Error) || failure.message !== 'request')
      )
        setError('Calcul indisponible. Réessayez.');
      throw failure;
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  async function verify() {
    if (disabled || controller.current) return;
    const cases = questions.flatMap((question): PreviewCase[] => {
      const answer = answers[question.id];
      const format =
        question.type === 'mcq' ? 'selection' : question.response.format;
      if (!answer || answer.format !== format) return [];
      if (
        answer.format === 'selection'
          ? !answer.optionIds.length
          : !answer.source.trim()
      )
        return [];
      return [{ questionId: question.id, expectedState: 'incorrect', answer }];
    });
    if (cases.length > 16) {
      setError('Testez au maximum 16 réponses incorrectes à la fois.');
      return;
    }
    setReport(null);
    try {
      await request(async (post) => {
        const validation = await post('/api/admin/engine', { definition });
        if (validation.valid !== true) {
          setError('Corrigez la définition avant de vérifier l’exercice.');
          setDiagnostics(validation.diagnostics ?? []);
          return;
        }
        const next = (
          await post<PreviewTestReport>('/api/admin/preview', {
            action: 'test',
            definition,
            seeds: testSeeds,
            cases,
          })
        ).result;
        setReport(next);
        if (
          next.seeds.some((item) =>
            item.diagnostics.some(
              (issue) => issue.code === 'negative-case-required',
            ),
          )
        )
          setShowCases(true);
      });
    } catch {}
  }

  async function generate() {
    if (disabled || controller.current) return;
    const seed = preview ? crypto.getRandomValues(new Uint32Array(1))[0] : 42;
    try {
      const result = await request((post) =>
        post<PreviewResult>('/api/admin/preview', {
          action: 'generate',
          definition,
          seed,
        }),
      );
      setPreview(result.result);
    } catch {}
  }

  async function submit(
    questionId: string,
    answer: AnswerSubmission['answer'],
  ): Promise<CorrectionResult> {
    if (!preview) throw Error('Aperçu indisponible');
    const result = await request((post) =>
      post<CorrectionResult>('/api/admin/preview', {
        action: 'grade',
        previewId: preview.previewId,
        questionId,
        answer,
      }),
    );
    return result.result;
  }

  function updateAnswer(id: string, answer: PreviewCase['answer']) {
    setAnswers((current) => ({ ...current, [id]: answer }));
    setReport(null);
  }

  if (!engineEnabled)
    return (
      <p className="notice">Les aperçus et tests ne sont pas disponibles.</p>
    );

  const reportIssues = report?.seeds.flatMap((item) => item.diagnostics) ?? [];
  const missingCase = reportIssues.some(
    (item) => item.code === 'negative-case-required',
  );
  const failedChecks =
    report?.seeds.flatMap((item) =>
      item.checks
        .filter((check) => !check.passed)
        .map((check) => {
          const position = questions.findIndex(
            (question) => question.id === check.questionId,
          );
          const label =
            check.label === 'Cas administrateur'
              ? 'La réponse de test n’a pas été reconnue comme incorrecte.'
              : check.label === 'Attendu officiel'
                ? 'La réponse attendue n’a pas été reconnue comme correcte.'
                : 'Le format invalide n’a pas été reconnu.';
          return position < 0 ? label : `Question ${position + 1} · ${label}`;
        }),
    ) ?? [];
  const messages = [
    ...new Set([
      ...diagnostics.map((item) => item.message),
      ...reportIssues
        .filter((item) => item.code !== 'negative-case-required')
        .map((item) => item.message),
      ...failedChecks,
    ]),
  ];

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
      aria-label="Aperçu et vérification"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button"
          disabled={disabled || busy}
          onClick={() => void verify()}
    -�׻h��춻�q�^togueSyncConfiguration,
  ) {
    this.pools = createPublicationPgPools(config);
  }
  async close() {
    await this.pools.close();
  }

  async targetReady() {
    return catalogueSyncTargetReady(this.pools);
  }

  async list(after = '', limit = 50) {
    if (
      after.length > 200 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new CatalogueSyncError('invalid');
    const { data, error } = await this.sourceClient.rpc(
      'admin_list_catalogue_sync_ready',
      {
        p_after: after,
        p_limit: limit,
      },
    );
    if (error) throw this.sourceError(error);
    return data;
  }

  private sourceError(error: { code?: string }) {
    return new CatalogueSyncError(
      error.code === '42501'
        ? 'forbidden'
        : error.code === '23503'
          ? 'blocked'
          : error.code === '40001' || error.code === 'PT409'
            ? 'conflict'
            : 'unavailable',
      error.code ?? null,
    );
  }

  async prepare(batchId: string, candidates: CatalogueSyncCandidate[]) {
    if (
      !isUuid(batchId) ||
      candidates.length < 1 ||
      candidates.length > 100 ||
      candidates.some((c) => !c || c.status === 'blocked') ||
      new Set(candidates.map((c) => `${c.kind}:${c.catalogId}`)).size !==
        candidates.length
    )
      throw new CatalogueSyncError('invalid');
    const actor = await authorizeAdmin(this.auth);
    if (!actor.allowed)
      throw new CatalogueSyncError(
        actor.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    const prepared: {
      operation: Operation;
      candidate: CatalogueSyncCandidate;
    }[] = [];
    try {
      for (const candidate of candidates) {
        await authFailure(this.auth, actor.userId);
        const { data: rawPayload, error: exportError } =
          await this.sourceClient.rpc('admin_export_catalogue_sync_item', {
            p_kind: candidate.kind,
            p_catalog_id: candidate.catalogId,
            p_expected_fingerprint: candidate.fingerprint,
          });
        if (exportError) throw this.sourceError(exportError);
        const payload = catalogueSyncPayload(rawPayload);
        if (
          !payload ||
          payload.kind !== candidate.kind ||
          payload.catalogId !== candidate.catalogId ||
          payload.fingerprint !== candidate.fingerprint
        )
          throw new CatalogueSyncError('conflict');
        const target = await this.pools.target();
        let inspectionValue: unknown;
        try {
          const result = await target.query(
            'SELECT novlearn_admin_private.inspect_catalogue_sync_item($1::text,$2::uuid) AS inspection',
            [candidate.kind, candidate.catalogId],
          );
          inspectionValue = result.rows[0]?.inspection;
        } finally {
          target.release();
        }
        const inspection = catalogueSyncInspection(inspectionValue);
        if (!inspection) throw new CatalogueSyncError('unavailable');
        await authFailure(this.auth, actor.userId);
        const { data: operationValue, error: prepareError } =
          await this.sourceClient.rpc(
            'admin_prepare_catalogue_sync_operation',
            {
              p_batch_id: batchId,
              p_kind: candidate.kind,
              p_catalog_id: candidate.catalogId,
              p_fingerprint: payload.fingerprint,
              p_target_key: this.config.targetKey,
              p_inspection: inspection,
            },
          );
        if (prepareError) throw this.sourceError(prepareError);
        const operation = asOperation(operationValue);
        if (
          !operation ||
          operation.payload.kind !== candidate.kind ||
          operation.payload.catalogId !== candidate.catalogId ||
          operation.payload.fingerprint !== candidate.fingerprint ||
          operation.state !== 'planned'
        )
          throw new CatalogueSyncError('unavailable');
        prepared.push({ operation, candidate });
      }
      const source = await this.pools.source();
      let batchDigest: unknown;
      try {
        const result = await source.query(
          'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
          [batchId],
        );
        batchDigest = result.rows[0]?.digest;
      } finally {
        source.release();
      }
      if (!isFingerprint(batchDigest))
        throw new CatalogueSyncError('unavailable');
      return {
        batchId,
        batchDigest,
        payloadDigest: digest(
          prepared
            .map(({ operation }) => ({
              payload: operation.payload,
              inspection: operation.inspection,
            }))
            .sort((a, b) =>
              `${a.payload.kind}:${a.payload.catalogId}`.localeCompare(
                `${b.payload.kind}:${b.payload.catalogId}`,
              ),
            ),
        ),
        items: prepared.map(({ operation, candidate }) => ({
          kind: operation.payload.kind,
          catalogId: operation.payload.catalogId,
          fingerprint: operation.payload.fingerprint,
          action: operation.payload.action,
          status: candidate.status,
          revision: operation.payload.revision ?? null,
          data: operation.payload.data,
          dependencies: operation.payload.dependencies,
          expiresAt: operation.expiresAt,
        })),
      };
    } catch (error) {
      if (error instanceof CatalogueSyncError) throw error;
      throw new CatalogueSyncError('unavailable');
    }
  }

  async confirm(batchId: string, payloadDigest: string) {
    if (!isUuid(batchId) || !isFingerprint(payloadDigest))
      throw new CatalogueSyncError('invalid');
    const actor = await authorizeAdmin(this.auth);
    if (!actor.allowed)
      throw new CatalogueSyncError(
        actor.reason === 'unavailable' ? 'unavailable' : 'forbidden',
      );
    const source = await this.pools.source();
    let batchDigest: unknown;
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
        [batchId],
      );
      batchDigest = result.rows[0]?.digest;
    } finally {
      source.release();
    }
    if (!isFingerprint(batchDigest))
      throw new CatalogueSyncError('unavailable');
    return this.withTargetLease((target) =>
      this.applyClaimedBatch(
        target,
        actor.userId,
        batchId,
        batchDigest,
        payloadDigest,
      ),
    );
  }

  private async applyClaimedBatch(
    target: PublicationConnection,
    actorId: string,
    batchId: string,
    batchDigest: string,
    payloadDigest: string,
  ) {
    await authFailure(this.auth, actorId);
    const journal = await this.pools.source();
    let claimed: unknown;
    try {
      const result = await journal.query(
        'SELECT novlearn_admin_private.claim_catalogue_sync_batch($1::uuid,$2::uuid,$3::text) AS batch',
        [actorId, batchId, batchDigest],
      );
      claimed = result.rows[0]?.batch;
    } catch (error) {
      const code = errorCode(error);
      throw new CatalogueSyncError(
        code === '40001'
          ? 'conflict'
          : code === '42501'
            ? 'forbidden'
            : 'unavailable',
        code,
      );
    } finally {
      journal.release();
    }
    if (
      !object(claimed) ||
      claimed.batchId !== batchId ||
      claimed.batchDigest !== batchDigest ||
      !Array.isArray(claimed.operations) ||
      !claimed.operations.every(
        (operation: unknown) =>
          object(operation) && operation.target_key === this.config.targetKey,
      )
    )
      throw new CatalogueSyncError('unavailable');
    const operations = claimed.operations.map(asOperation);
    if (
      operations.length < 1 ||
      operations.length > 100 ||
      operations.some(
        (op) =>
          !op || op.state !== 'executing' || op.payload.action === undefined,
      )
    )
      throw new CatalogueSyncError('unavailable');
    const valid = operations as Operation[];
    const actualDigest = digest(
      valid
        .map((op) => ({ payload: op.payload, inspection: op.inspection }))
        .sort((a, b) =>
          `${a.payload.kind}:${a.payload.catalogId}`.localeCompare(
            `${b.payload.kind}:${b.payload.catalogId}`,
          ),
        ),
    );
    if (actualDigest !== payloadDigest)
      throw new CatalogueSyncError('conflict');
    const items = valid.map((op) => ({
      payload: op.payload,
      inspection: op.inspection,
    }));
    let receipt: CatalogueSyncReceipt | null = null;
    let rejected: string | null = null;
    let rollbackKnown = false;
    try {
      await target.query('BEGIN');
      const result = await target.query(
        'SELECT novlearn_admin_private.apply_catalogue_sync_batch($1::uuid,$2::text,$3::jsonb) AS receipt',
        [batchId, payloadDigest, JSON.stringify(items)],
      );
      const value = catalogueSyncReceipt(result.rows[0]?.receipt, batchId);
      if (
        !value ||
        !catalogueSyncReceiptMatches(
          value,
          valid.map((op) => op.payload),
        )
      )
        throw Object.assign(new Error('invalid receipt'), {
          code: 'RECEIPT_INVALID',
        });
      if ((await target.query('COMMIT')).command !== 'COMMIT')
        throw new CatalogueSyncError('uncertain');
      receipt = value;
    } catch (error) {
      rejected = errorCode(error);
      try {
        await target.query('ROLLBACK');
        rollbackKnown = true;
      } catch {
        rollbackKnown = false;
      }
    }
    if (!receipt) {
      const observed = await this.observeTarget(target, batchId, payloadDigest);
      if (
        observed.state === 'committed' &&
        observed.receipt &&
        catalogueSyncReceiptMatches(
          observed.receipt,
          valid.map((op) => op.payload),
        )
      )
        receipt = observed.receipt;
      else if (
        observed.state === 'not_applied' &&
        rollbackKnown &&
        rejected !== 'RECEIPT_INVALID'
      ) {
        await this.record(
          actorId,
          batchId,
          batchDigest,
          'executing',
          'failed',
          null,
          rejected === '40001' ? 'not_applied' : 'target_rejected',
        );
        throw new CatalogueSyncError(
          catalogueSyncTargetErrorClass(rejected),
          rejected,
        );
      } else {
        await this.record(
          actorId,
          batchId,
          batchDigest,
          'executing',
          'uncertain',
          null,
          null,
        ).catch(() => undefined);
        throw new CatalogueSyncError('uncertain', rejected);
      }
    }
    try {
      await this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        'committed',
        receipt,
        null,
      );
      return { state: 'committed' as const, receipt };
    } catch {
      await this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        'uncertain',
        null,
        null,
      ).catch(() => undefined);
      throw new CatalogueSyncError('uncertain');
    }
  }

  async recover(actorId: string, batchId: string, payloadDigest: string) {
    if (!isUuid(batchId) || !isFingerprint(payloadDigest))
      throw new CatalogueSyncError('invalid');
    await authFailure(this.auth, actorId);
    const source = await this.pools.source();
    let batchDigest: unknown;
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.catalogue_sync_batch_digest($1::uuid) AS digest',
        [batchId],
      );
      batchDigest = result.rows[0]?.digest;
    } finally {
      source.release();
    }
    if (!isFingerprint(batchDigest))
      throw new CatalogueSyncError('unavailable');
    return this.withTargetLease((target) =>
      this.reconcileBatch(target, actorId, batchId, batchDigest, payloadDigest),
    );
  }

  private async reconcileBatch(
    target: PublicationConnection,
    actorId: string,
    batchId: string,
    batchDigest: string,
    payloadDigest: string,
  ) {
    const observed = await this.observeTarget(target, batchId, payloadDigest);
    if (observed.state === 'committed' && observed.receipt) {
      await this.recordRecovering(
        actorId,
        batchId,
        batchDigest,
        'committed',
        observed.receipt,
        null,
      );
      return { state: 'committed' as const, receipt: observed.receipt };
    }
    if (observed.state === 'not_applied') {
      await this.recordRecovering(
        actorId,
        batchId,
        batchDigest,
        'failed',
        null,
        'not_applied',
      );
      return { state: 'failed' as const, receipt: null };
    }
    await this.recordRecovering(
      actorId,
      batchId,
      batchDigest,
      'uncertain',
      null,
      null,
    ).catch(() => undefined);
    return { state: 'uncertain' as const, receipt: null };
  }

  private async recordRecovering(
    actorId: string,
    batchId: string,
    batchDigest: string,
    state: 'uncertain' | 'committed' | 'failed',
    receipt: CatalogueSyncReceipt | null,
    error: 'not_applied' | null,
  ) {
    try {
      return await this.record(
        actorId,
        batchId,
        batchDigest,
        'uncertain',
        state,
        receipt,
        error,
      );
    } catch (failure) {
      if (
        !(failure instanceof CatalogueSyncError) ||
        failure.code !== 'conflict'
      )
        throw failure;
      return this.record(
        actorId,
        batchId,
        batchDigest,
        'executing',
        state,
        receipt,
        error,
      );
    }
  }

  /** Hold the SQL contract's lock across the source transition too, so recovery
   * cannot observe absence between a claim and its target transaction. */
  private async withTargetLease<T>(
    work: (target: PublicationConnection) => Promise<T>,
  ) {
    const target = await this.pools.target();
    let locked = false;
    let destroy = true;
    try {
      await target.query(
        "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('novlearn-catalogue-sync-v1',0))",
      );
      locked = true;
      return await work(target);
    } finally {
      if (locked) {
        try {
          const result = await target.query(
            "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('novlearn-catalogue-sync-v1',0)) AS unlocked",
          );
          destroy = result.rows[0]?.unlocked !== true;
        } catch {
          // Do not reuse a session whose lock release was not confirmed.
        }
      }
      target.release(destroy);
    }
  }

  private async observeTarget(
    target: PublicationConnection,
    batchId: string,
    payloadDigest: string,
  ) {
    try {
      const result = await target.query(
        'SELECT novlearn_admin_private.observe_catalogue_sync_batch($1::uuid,$2::text) AS observation',
        [batchId, payloadDigest],
      );
      const value = result.rows[0]?.observation;
      if (
        !object(value) ||
        value.batchId !== batchId ||
        value.payloadDigest !== payloadDigest ||
        !['not_applied', 'committed'].includes(String(value.state))
      )
        return { state: 'uncertain' as const, receipt: null };
      const receipt =
        value.state === 'committed'
          ? catalogueSyncReceipt(value.receipt, batchId)
          : null;
      if (value.state === 'committed' && !receipt)
        return { state: 'uncertain' as const, receipt: null };
      return { state: value.state as 'not_applied' | 'committed', receipt };
    } catch {
      return { state: 'uncertain' as const, receipt: null };
    }
  }

  private async record(
    actorId: string,
    batchId: string,
    batchDigest: string,
    expectedState: 'executing' | 'uncertain',
    state: 'uncertain' | 'committed' | 'failed',
    receipt: CatalogueSyncReceipt | null,
    error: 'not_applied' | 'target_rejected' | null,
  ) {
    await authFailure(this.auth, actorId);
    const source = await this.pools.source();
    try {
      const result = await source.query(
        'SELECT novlearn_admin_private.record_catalogue_sync_batch($1::uuid,$2::uuid,$3::text,$4::text,$5::text,$6::jsonb,$7::text) AS operations',
        [
          actorId,
          batchId,
          batchDigest,
          expectedState,
          state,
          receipt ? JSON.stringify(receipt) : null,
          error,
        ],
      );
      const operations = result.rows[0]?.operations;
      if (
        !Array.isArray(operations) ||
        operations.length < 1 ||
        operations.length > 100 ||
        operations.some(
          (item) => !asOperation(item) || asOperation(item)?.state !== state,
        )
      )
        throw new CatalogueSyncError('unavailable');
      return operations;
    } catch (failure) {
      if (failure instanceof CatalogueSyncError) throw failure;
      const code = errorCode(failure);
      throw new CatalogueSyncError(
        code === '40001' ? 'conflict' : 'unavailable',
        code,
      );
    } finally {
      source.release();
    }
  }
}

async function catalogueSyncTargetReady(
  pools: ReturnType<typeof createPublicationPgPools>,
) {
  let target: PublicationConnection | undefined;
  try {
    target = await pools.target();
    const result = await target.query(
      'SELECT novlearn_admin_private.catalogue_sync_target_contract() AS contract',
    );
    return result.rows[0]?.contract === 'atomic-catalogue-target-v1';
  } catch {
    return false;
  } finally {
    target?.release();
  }
}

export async function catalogueSyncTargetAvailable(
  config: CatalogueSyncConfiguration,
) {
  const pools = createPublicationPgPools(config);
  try {
    return await catalogueSyncTargetReady(pools);
  } finally {
    await pools.close().catch(() => undefined);
  }
}
