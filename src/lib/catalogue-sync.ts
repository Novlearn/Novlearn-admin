import { isFingerprint, isUuid } from './catalogue';

export const CATALOGUE_SYNC_KINDS = [
  'chapter',
  'competence',
  'flashcard',
  'exercise',
] as const;
export type CatalogueSyncKind = (typeof CATALOGUE_SYNC_KINDS)[number];
export type CatalogueSyncCandidate = {
  sortKey: string;
  kind: CatalogueSyncKind;
  catalogId: string;
  status: string;
  fingerprint: string;
  id?: string;
  versionId?: string | null;
  revision?: number | null;
  blockedReason?: string | null;
};
export type CatalogueSyncPayload = {
  kind: CatalogueSyncKind;
  catalogId: string;
  action: 'upsert' | 'archive';
  fingerprint: string;
  dependencies: Record<string, unknown>[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
};
export type CatalogueSyncInspection = { stateToken: string };
export type CatalogueSyncReceiptItem = {
  kind: CatalogueSyncKind;
  catalogId: string;
  fingerprint: string;
  targetId: string;
  result: 'applied' | 'unchanged' | 'archived';
};
export type CatalogueSyncReceipt = {
  batchId: string;
  stateToken: string;
  items: CatalogueSyncReceiptItem[];
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const kind = (v: unknown): v is CatalogueSyncKind =>
  CATALOGUE_SYNC_KINDS.includes(v as CatalogueSyncKind);

export function catalogueSyncCandidate(
  value: unknown,
): value is CatalogueSyncCandidate {
  if (!object(value)) return false;
  return (
    typeof value.sortKey === 'string' &&
    value.sortKey.length > 0 &&
    value.sortKey.length <= 200 &&
    kind(value.kind) &&
    isUuid(value.catalogId) &&
    typeof value.status === 'string' &&
    ['ready', 'published', 'archived', 'blocked'].includes(value.status) &&
    isFingerprint(value.fingerprint) &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.versionId === undefined ||
      value.versionId === null ||
      isUuid(value.versionId)) &&
    (value.revision === undefined ||
      value.revision === null ||
      (typeof value.revision === 'number' &&
        Number.isSafeInteger(value.revision) &&
        value.revision > 0)) &&
    (value.blockedReason === undefined ||
      value.blockedReason === null ||
      typeof value.blockedReason === 'string')
  );
}

export function catalogueSyncPage(value: unknown): {
  items: CatalogueSyncCandidate[];
  limit: number;
  next: string | null;
} | null {
  if (
    !object(value) ||
    !exact(value, ['items', 'limit', 'next']) ||
    !Array.isArray(value.items) ||
    typeof value.limit !== 'number' ||
    !Number.isInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 100 ||
    (value.next !== null &&
      (typeof value.next !== 'string' || value.next.length > 200)) ||
    value.items.length > value.limit ||
    !value.items.every(catalogueSyncCandidate) ||
    new Set(value.items.map((i) => i.sortKey)).size !== value.items.length
  )
    return null;
  return structuredClone(value) as {
    items: CatalogueSyncCandidate[];
    limit: number;
    next: string | null;
  };
}

export function catalogueSyncPayload(
  value: unknown,
): CatalogueSyncPayload | null {
  if (
    !object(value) ||
    !kind(value.kind) ||
    !isUuid(value.catalogId) ||
    !['upsert', 'archive'].includes(String(value.action)) ||
    !isFingerprint(value.fingerprint) ||
    !Array.isArray(value.dependencies) ||
    value.dependencies.length > 100 ||
    !value.dependencies.every(object) ||
    (value.action === 'upsert' &&
      (!object(value.data) || value.catalogId !== value.data.catalogId)) ||
    (value.data !== undefined &&
      (!object(value.data) || value.catalogId !== value.data.catalogId))
  )
    return null;
  return structuredClone(value) as CatalogueSyncPayload;
}

export function catalogueSyncInspection(
  value: unknown,
): CatalogueSyncInspection | null {
  if (
    !object(value) ||
    !exact(value, ['stateToken']) ||
    !isFingerprint(value.stateToken)
  )
    return null;
  return structuredClone(value) as CatalogueSyncInspection;
}

export function catalogueSyncReceipt(
  value: unknown,
  batchId: string,
): CatalogueSyncReceipt | null {
  if (
    !object(value) ||
    !exact(value, ['batchId', 'stateToken', 'items']) ||
    value.batchId !== batchId ||
    !isFingerprint(value.stateToken) ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 100
  )
    return null;
  const items = value.items;
  if (
    !items.every(
      (item) =>
        object(item) &&
        exact(item, [
          'kind',
          'catalogId',
          'fingerprint',
          'targetId',
          'result',
        ]) &&
        kind(item.kind) &&
        isUuid(item.catalogId) &&
        isFingerprint(item.fingerprint) &&
        typeof item.targetId === 'string' &&
        item.targetId.length > 0 &&
        item.targetId.length <= 128 &&
        ['applied', 'unchanged', 'archived'].includes(String(item.result)),
    ) ||
    new Set(
      items.map(
        (i) =>
          `${(i as Record<string, unknown>).kind}:${(i as Record<string, unknown>).catalogId}`,
      ),
    ).size !== items.length
  )
    return null;
  return structuredClone(value) as CatalogueSyncReceipt;
}

export function catalogueSyncReceiptMatches(
  receipt: CatalogueSyncReceipt,
  payloads: CatalogueSyncPayload[],
) {
  if (receipt.items.length !== payloads.length) return false;
  const expected = new Map(
    payloads.map((p) => [`${p.kind}:${p.catalogId}`, p.fingerprint]),
  );
  return receipt.items.every(
    (item) =>
      expected.get(`${item.kind}:${item.catalogId}`) === item.fingerprint,
  );
}

export function catalogueSyncTargetErrorClass(
  sqlState: string | null,
): 'blocked' | 'conflict' | 'unavailable' {
  return sqlState === '23503'
    ? 'blocked'
    : sqlState === '40001'
      ? 'conflict'
      : 'unavailable';
}
