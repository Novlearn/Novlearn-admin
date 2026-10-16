import { isExerciseId, isFingerprint, isUuid } from './catalogue';
import { publicationEpoch } from './publication-journal';
import {
  preparedPublication,
  publicationSummary,
  requestPublication,
  type PreparedPublication,
  type PublicationCommand,
  type PublicationSummary,
} from './publication-view';

export const MAX_PUBLICATION_BATCH = 5;
export type BatchLocator = { versionId: string; operationId: string | null };
export type BatchCandidate = {
  versionId: string;
  exerciseId: string;
  catalogId: string;
  title: string;
  revision: number;
  fingerprint: string;
  epoch: string;
  status: string;
  archived: boolean;
};
export const batchEligible = (value: BatchCandidate) =>
  !value.archived && ['approved', 'published'].includes(value.status);
export function batchCandidate(value: unknown): value is BatchCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    isUuid(v.versionId) &&
    isExerciseId(v.exerciseId) &&
    isUuid(v.catalogId) &&
    typeof v.title === 'string' &&
    v.title.length > 0 &&
    v.title.length <= 1000 &&
    typeof v.revision === 'number' &&
    Number.isSafeInteger(v.revision) &&
    v.revision > 0 &&
    v.revision <= 999999999 &&
    isFingerprint(v.fingerprint) &&
    publicationEpoch(v.epoch) &&
    typeof v.status === 'string' &&
    ['draft', 'in_review', 'approved', 'published', 'archived'].includes(
      v.status,
    ) &&
    typeof v.archived === 'boolean'
  );
}
/** URL checkpoints contain only opaque identities, never confirmation capabilities. */
export function parseBatchQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => !['version', 'batch'].includes(key)))
    return null;
  const batches = params.getAll('batch'),
    values = params.getAll('version');
  if (
    batches.length > 1 ||
    (batches.length && !isUuid(batches[0])) ||
    !values.length ||
    values.length > MAX_PUBLICATION_BATCH
  )
    return null;
  const items: BatchLocator[] = [];
  for (const value of values) {
    const parts = value.split('~');
    if (
      parts.length > 2 ||
      !isUuid(parts[0]) ||
      (parts.length === 2 && (!batches.length || !isUuid(parts[1])))
    )
      return null;
    items.push({
      versionId: parts[0].toLowerCase(),
      operationId: parts[1]?.toLowerCase() ?? null,
    });
  }
  if (
    new Set(items.map((i) => i.versionId)).size !== items.length ||
    new Set(items.filter((i) => i.operationId).map((i) => i.operationId))
      .size !== items.filter((i) => i.operationId).length
  )
    return null;
  return { batchId: batches[0]?.toLowerCase() ?? null, items };
}
export function batchUrl(batchId: string, items: BatchLocator[]) {
  const params = new URLSearchParams({ batch: batchId });
  for (const item of items)
    params.append(
      'version',
      item.versionId + (item.operationId ? '~' + item.operationId : ''),
    );
  if (!parseBatchQuery(params)) throw Error('Lot invalide.');
  return '/admin/publication/batch?' + params;
}
type Phase = 'idle' | 'ready' | 'verify' | 'known' | 'blocked';
export type BatchRow = {
  versionId: string;
  candidate: BatchCandidate | null;
  operationId: string | null;
  phase: Phase;
  prepared: PreparedPublication | null;
  operation: PublicationSummary | null;
  reviewed: boolean;
  error: string;
};
export const canReplanBatchRow = (row: BatchRow) =>
  !!row.candidate &&
  batchEligible(row.candidate) &&
  ((row.phase === 'blocked' && !row.operationId) ||
    (row.phase === 'known' &&
      !!row.operation &&
      ['failed', 'cancelled'].includes(row.operation.state)));
export type BatchSnapshot = {
  batchId: string;
  busy: 'prepare' | 'confirm' | 'recover' | 'cancel' | null;
  rows: BatchRow[];
};
type Transport = (
  command: PublicationCommand,
  signal?: AbortSignal,
) => Promise<PreparedPublication | PublicationSummary>;

/** Sequential per-exercise transactions. A lost/uncertain confirmation stops the
 * remaining sends; recovery only observes existing operations. No automatic retry. */
export class PublicationBatch {
  private rows: BatchRow[];
  private busy: BatchSnapshot['busy'] = null;
  private controller: AbortController | null = null;
  private disposed = false;
  constructor(
    readonly batchId: string,
    items: BatchLocator[],
    candidates: (BatchCandidate | null)[],
    private readonly enabled: boolean,
    private readonly transport: Transport = requestPublication,
    private readonly changed: (state: BatchSnapshot) => void = () => {},
    private readonly now = Date.now,
  ) {
    batchUrl(batchId, items);
    if (
      candidates.length !== items.length ||
      candidates.some(
        (c, i) =>
          c !== null &&
          (!batchCandidate(c) || c.versionId !== items[i].versionId),
      )
    )
      throw Error('Sélection invalide.');
    const available = candidates.filter((c): c is BatchCandidate => c !== null);
    if (
      new Set(available.map((c) => c.catalogId)).size !== available.length ||
      new Set(available.map((c) => c.exerciseId)).size !== available.length
    )
      throw Error('Sélectionnez une seule révision par exercice.');
    this.rows = items.map((item, i) => ({
      ...item,
      candidate: structuredClone(candidates[i]),
      phase: item.operationId
        ? 'verify'
        : candidates[i] && batchEligible(candidates[i]!)
          ? 'idle'
          : 'blocked',
      prepared: null,
      operation: null,
      reviewed: false,
      error: '',
    }));
  }
  snapshot(): BatchSnapshot {
    return structuredClone({
      batchId: this.batchId,
      busy: this.busy,
      rows: this.rows,
    });
  }
  checkpoint() {
    return batchUrl(
      this.batchId,
      this.rows.map(({ versionId, operationId }) => ({
        versionId,
        operationId,
      })),
    );
  }
  private emit() {
    if (!this.disposed) this.changed(this.snapshot());
  }
  review(versionId: string, checked: boolean) {
    const row = this.rows.find((r) => r.versionId === versionId);
    if (
      this.busy ||
      !row ||
      row.phase !== 'ready' ||
      !row.prepared ||
      Date.parse(row.prepared.operation.expiresAt) <= this.now()
    )
      return;
    row.reviewed = checked;
    this.emit();
  }
  replan(versionId: string) {
    const row = this.rows.find((r) => r.versionId === versionId);
    if (this.busy || !row || !canReplanBatchRow(row)) return;
    Object.assign(row, {
      phase: 'idle',
      operationId: null,
      operation: null,
      prepared: null,
      reviewed: false,
      error: '',
    });
    this.emit();
  }
  stop() {
    this.controller?.abort();
  }
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
    this.stop();
  }
  private check(row: BatchRow, value: PublicationSummary) {
    if (
      value.batchId !== this.batchId ||
      value.sourceVersionId !== row.versionId ||
      value.mode !== 'publish' ||
      (row.operationId && value.id !== row.operationId) ||
      (row.candidate &&
        (value.catalogId !== row.candidate.catalogId ||
          value.revision !== row.candidate.revision))
    )
      throw Error('Le résultat ne correspond pas à cet exercice du lot.');
  }
  private known(row: BatchRow, result: unknown) {
    const op = publicationSummary(result);
    if (!op) throw Error('Résultat de publication non reconnu.');
    this.check(row, op);
    row.operation = op;
    row.operationId = op.id;
    row.prepared = null;
    row.reviewed = false;
    row.phase = ['committed', 'failed', 'cancelled'].includes(op.state)
      ? 'known'
      : 'verify';
    return op;
  }
  async run(action: NonNullable<BatchSnapshot['busy']>) {
    if (!this.enabled || this.busy || this.disposed) return;
    if (
      action === 'confirm' &&
      this.rows.some((row) => row.phase === 'verify' && row.operationId)
    )
      return;
    const selected = this.rows.filter((row) =>
      action === 'prepare'
        ? row.phase === 'idle' && row.candidate && batchEligible(row.candidate)
        : action === 'confirm'
          ? row.phase === 'ready' && row.reviewed
          : action === 'recover'
            ? row.phase === 'verify' && !!row.operationId
            : row.operation?.state === 'planned' &&
              (row.phase === 'ready' || row.phase === 'verify'),
    );
    if (!selected.length) return;
    if (
      action === 'confirm' &&
      selected.some(
        (row) =>
          !row.prepared ||
          Date.parse(row.prepared.operation.expiresAt) <= this.now(),
      )
    ) {
      for (const row of selected)
        if (
          !row.prepared ||
          Date.parse(row.prepared.operation.expiresAt) <= this.now()
        ) {
          row.reviewed = false;
          row.error =
            'Ce plan a expiré. Annulez-le avant de préparer un nouveau diff.';
        }
      this.emit();
      return;
    }
    this.busy = action;
    this.controller = new AbortController();
    this.emit();
    try {
      for (const row of selected) {
        if (this.controller.signal.aborted || this.disposed) break;
        row.error = '';
        try {
          if (action === 'prepare') {
            const c = row.candidate!;
            const result = preparedPublication(
              await this.transport(
                {
                  action,
                  versionId: row.versionId,
                  fingerprint: c.fingerprint,
                  epoch: c.epoch,
                  mode: 'publish',
                  batchId: this.batchId,
                },
                this.controller.signal,
              ),
            );
            if (!result)
              throw Error('Diff non reconnu. Consultez votre historique.');
            this.check(row, result.operation);
            row.prepared = result;
            row.operation = result.operation;
            row.operationId = result.operation.id;
            row.reviewed = false;
            row.phase = 'ready';
          } else {
            const prepared = row.prepared;
            if (
              action === 'confirm' &&
              (!prepared ||
                Date.parse(prepared.operation.expiresAt) <= this.now())
            )
              throw Error('Plan expiré avant ce transfert.');
            // Consume the confirmation before dispatch, including an aborted/lost response.
            row.prepared = null;
            row.reviewed = false;
            row.phase = 'verify';
            row.operation = null;
            this.emit();
            const result = await this.transport(
              action === 'confirm'
                ? {
                    action,
                    operationId: row.operationId!,
                    confirmation: prepared!.confirmation,
                  }
                : { action, operationId: row.operationId! },
              this.controller.signal,
            );
            const observed = this.known(row, result);
            if (action === 'confirm' && observed.state !== 'committed') {
              this.emit();
              break;
            }
            if (action === 'cancel' && observed.state !== 'cancelled')
              throw Error('Annulation non confirmée. Vérifiez le résultat.');
          }
          this.emit();
        } catch (error) {
          row.error =
            error instanceof Error
              ? error.message
              : 'Résultat non confirmé. Consultez votre historique.';
          if (action === 'prepare') row.phase = 'blocked';
          else row.phase = 'verify';
          this.emit();
          break;
        }
      }
    } finally {
      if (action === 'confirm')
        for (const row of this.rows) row.reviewed = false;
      this.busy = null;
      this.controller = null;
      this.emit();
    }
  }
}
