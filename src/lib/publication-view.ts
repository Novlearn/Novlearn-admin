import { isExerciseId, isFingerprint, isUuid } from './catalogue';
import {
  publicationStates,
  publicationTargetKey,
  type PublicationState,
} from './publication-journal';
import type { PublicationMode, PublicationPlan } from './publication';
import type { PublicationSummary } from './publication-service';
export type { PublicationSummary } from './publication-service';
export type PreparedPublication = {
  operation: PublicationSummary;
  plan: PublicationPlan;
  confirmation: string;
};
export const publicationStateLabels: Record<PublicationState, string> = {
  planned: 'Plan à confirmer',
  executing: 'Vérification du résultat nécessaire',
  uncertain: 'Résultat incertain',
  committed: 'Transfert confirmé',
  failed: 'Transfert non appliqué',
  cancelled: 'Plan annulé',
};
export type PublicationHistoryItem = {
  id: string;
  batchId: string;
  versionId: string;
  catalogId: string;
  targetKey: string;
  mode: PublicationMode;
  state: PublicationState;
  createdAt: string;
  updatedAt: string;
  errorCode: 'validation' | 'target_rejected' | 'not_applied' | null;
};
export function publicationHistory(
  value: unknown,
): { total: number; items: PublicationHistoryItem[] } | null {
  if (
    !object(value) ||
    !exact(value, ['total', 'items']) ||
    typeof value.total !== 'number' ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0 ||
    !Array.isArray(value.items) ||
    value.items.length > 25
  )
    return null;
  for (const item of value.items) {
    if (
      !object(item) ||
      !exact(item, [
        'id',
        'batchId',
        'versionId',
        'catalogId',
        'targetKey',
        'mode',
        'state',
        'createdAt',
        'updatedAt',
        'errorCode',
      ]) ||
      !isUuid(item.id) ||
      !isUuid(item.batchId) ||
      !isUuid(item.versionId) ||
      !isUuid(item.catalogId) ||
      !publicationTargetKey(item.targetKey) ||
      (item.mode !== 'publish' && item.mode !== 'rollback') ||
      !publicationStates.includes(item.state as PublicationState) ||
      !['createdAt', 'updatedAt'].every(
        (field) =>
          typeof item[field] === 'string' &&
          item[field].length <= 48 &&
          Number.isFinite(Date.parse(item[field])),
      ) ||
      (item.state === 'failed'
        ? !['validation', 'target_rejected', 'not_applied'].includes(
            String(item.errorCode),
          ) || typeof item.errorCode !== 'string'
        : item.errorCode !== null)
    )
      return null;
  }
  if (
    new Set(value.items.map((item) => item.id)).size !== value.items.length ||
    value.items.length > value.total
  )
    return null;
  return structuredClone(value) as {
    total: number;
    items: PublicationHistoryItem[];
  };
}
export const publicationActionLabels: Record<
  PublicationPlan['action'],
  string
> = {
  create_exercise: 'Créer l’exercice et sa première révision',
  append_revision: 'Ajouter une nouvelle révision',
  activate_revision: 'Activer cette révision',
  rollback: 'Réactiver une révision précédente',
  unchanged: 'Contenu déjà identique',
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).sort().join(',') === [...names].sort().join(',');
const revision = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 999999999;
const nullableId = (v: unknown) => v === null || isExerciseId(v);
export function publicationSummary(value: unknown): PublicationSummary | null {
  if (
    !object(value) ||
    !exact(value, [
      'id',
      'batchId',
      'sourceVersionId',
      'catalogId',
      'revision',
      'mode',
      'state',
      'expiresAt',
      'outcome',
      'error',
    ]) ||
    !isUuid(value.id) ||
    !isUuid(value.batchId) ||
    !isUuid(value.sourceVersionId) ||
    !isUuid(value.catalogId) ||
    !revision(value.revision) ||
    (value.mode !== 'publish' && value.mode !== 'rollback') ||
    !publicationStates.includes(value.state as PublicationState) ||
    typeof value.expiresAt !== 'string' ||
    value.expiresAt.length > 48 ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    return null;
  if (value.state === 'committed') {
    const result = value.outcome;
    if (
      !object(result) ||
      !exact(result, [
        'catalogId',
        'revision',
        'businessDigest',
        'exerciseId',
        'versionId',
        'stateToken',
        'result',
      ]) ||
      result.catalogId !== value.catalogId ||
      result.revision !== value.revision ||
      !isFingerprint(result.businessDigest) ||
      !isExerciseId(result.exerciseId) ||
      !isUuid(result.versionId) ||
      !isFingerprint(result.stateToken) ||
      ![
        'unchanged',
        value.mode === 'rollback' ? 'rolled_back' : 'published',
      ].includes(String(result.result)) ||
      typeof result.result !== 'string' ||
      value.error !== null
    )
      return null;
  } else if (
    value.outcome !== null ||
    (value.state === 'failed'
      ? !['not_applied', 'validation', 'target_rejected'].includes(
          String(value.error),
        ) || typeof value.error !== 'string'
      : value.error !== null)
  )
    return null;
  return structuredClone(value) as PublicationSummary;
}
export function preparedPublication(
  value: unknown,
): PreparedPublication | null {
  if (!object(value) || !exact(value, ['operation', 'plan', 'confirmation']))
    return null;
  const operation = publicationSummary(value.operation),
    plan = value.plan;
  if (
    !operation ||
    operation.state !== 'planned' ||
    !object(plan) ||
    !exact(plan, [
      'action',
      'mode',
      'catalogId',
      'revision',
      'businessDigest',
      'stateToken',
      'targetExerciseId',
      'previousRevision',
      'definitionChanges',
      'headerChanges',
    ]) ||
    typeof plan.action !== 'string' ||
    !Object.hasOwn(publicationActionLabels, plan.action) ||
    plan.mode !== operation.mode ||
    plan.catalogId !== operation.catalogId ||
    plan.revision !== operation.revision ||
    !isFingerprint(plan.businessDigest) ||
    !isFingerprint(plan.stateToken) ||
    !nullableId(plan.targetExerciseId) ||
    (plan.previousRevision !== null && !revision(plan.previousRevision)) ||
    typeof value.confirmation !== 'string' ||
    value.confirmation.length > 4096 ||
    !/^[-_a-zA-Z0-9]+\.[a-f0-9]{64}$/.test(value.confirmation)
  )
    return null;
  for (const changes of [plan.definitionChanges, plan.headerChanges]) {
    if (!Array.isArray(changes) || changes.length > 20000) return null;
    for (const change of changes)
      if (
        !object(change) ||
        Object.keys(change).some(
          (key) => !['path', 'before', 'after'].includes(key),
        ) ||
        typeof change.path !== 'string' ||
        !change.path.startsWith('/') ||
        change.path.length > 4096
      )
        return null;
  }
  if (
    plan.mode === 'rollback' &&
    !['rollback', 'unchanged'].includes(plan.action)
  )
    return null;
  if (plan.mode === 'publish' && plan.action === 'rollback') return null;
  return structuredClone({
    operation,
    plan,
    confirmation: value.confirmation,
  }) as PreparedPublication;
}
export type PublicationCommand =
  | {
      action: 'prepare';
      versionId: string;
      fingerprint: string;
      epoch: string;
      mode: PublicationMode;
      batchId: string;
    }
  | { action: 'confirm'; operationId: string; confirmation: string }
  | { action: 'recover' | 'cancel'; operationId: string };
export function publicationIntent(
  action: PublicationCommand['action'],
  context: {
    versionId: string;
    fingerprint: string;
    epoch: string;
    mode: PublicationMode;
    enabled: boolean;
    busy: boolean;
    eligible: boolean;
    accepted: boolean;
    mustObserve: boolean;
    prepared: PreparedPublication | null;
    operation: PublicationSummary | null;
    now: number;
  },
  batchId: () => string = () => crypto.randomUUID(),
): PublicationCommand | null {
  if (!context.enabled || context.busy) return null;
  const { prepared, operation } = context,
    current = operation ?? prepared?.operation;
  if (action === 'prepare') {
    if (
      !context.eligible ||
      (current && ['planned', 'executing', 'uncertain'].includes(current.state))
    )
      return null;
    return {
      action,
      versionId: context.versionId,
      fingerprint: context.fingerprint,
      epoch: context.epoch,
      mode: context.mode,
      batchId: batchId(),
    };
  }
  if (!current) return null;
  if (action === 'confirm') {
    if (
      !context.eligible ||
      !prepared ||
      current.id !== prepared.operation.id ||
      current.state !== 'planned' ||
      !context.accepted ||
      context.mustObserve ||
      Date.parse(prepared.operation.expiresAt) <= context.now
    )
      return null;
    return {
      action,
      operationId: current.id,
      confirmation: prepared.confirmation,
    };
  }
  if (
    action === 'cancel' &&
    (current.state !== 'planned' || context.mustObserve)
  )
    return null;
  return { action, operationId: current.id };
}
export class PublicationRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string | null = null,
  ) {
    super(message);
  }
}
/** One explicit user action, one POST. A transport failure is never retried or
 * turned into a successful publication. Only the server's decoded fact counts. */
export async function requestPublication(
  command: PublicationCommand,
  signal?: AbortSignal,
  environment: 'operational' | 'local-fixture' = 'operational',
): Promise<PreparedPublication | PublicationSummary> {
  let response: Response;
  try {
    response = await fetch('/api/admin/publication', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command),
      signal,
    });
  } catch {
    throw new PublicationRequestError(
      command.action === 'prepare'
        ? 'Préparation non confirmée. Consultez l’historique avant de réessayer.'
        : 'Réponse non reçue. Vérifiez le résultat avant toute nouvelle tentative.',
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new PublicationRequestError(
      'Réponse non reconnue. Vérifiez l’historique avant de réessayer.',
    );
  }
  if (!response.ok) {
    const message =
      object(data) && typeof data.error === 'string'
        ? data.error.slice(0, 500)
        : 'Opération indisponible. Vérifiez son résultat avant de réessayer.';
    throw new PublicationRequestError(
      message,
      object(data) && typeof data.code === 'string' ? data.code : null,
    );
  }
  if (
    !object(data) ||
    !exact(data, ['sourceEnvironment', 'targetEnvironment', 'result']) ||
    data.sourceEnvironment !==
      (environment === 'local-fixture' ? 'local-source' : 'staging') ||
    data.targetEnvironment !==
      (environment === 'local-fixture' ? 'local-target' : 'production')
  )
    throw new PublicationRequestError(
      'Environnements de publication non confirmés.',
    );
  if (command.action === 'prepare') {
    const prepared = preparedPublication(data.result);
    if (
      !prepared ||
      prepared.operation.sourceVersionId !== command.versionId ||
      prepared.operation.batchId !== command.batchId ||
      prepared.operation.mode !== command.mode
    )
      throw new PublicationRequestError(
        'Le diff reçu ne correspond pas à la révision demandée. Consultez l’historique.',
      );
    return prepared;
  }
  const result = publicationSummary(data.result);
  if (
    !result ||
    result.id !== command.operationId ||
    (command.action === 'cancel' && result.state !== 'cancelled') ||
    (command.action === 'confirm' &&
      ['planned', 'executing'].includes(result.state))
  )
    throw new PublicationRequestError(
      'Le résultat de cette opération n’est pas confirmé. Vérifiez l’historique.',
    );
  return result;
}
