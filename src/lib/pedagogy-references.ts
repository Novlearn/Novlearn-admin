import { readPedagogyQuery, type PedagogyQuery } from './pedagogy-statistics';
import type { StatisticsEnvironment } from './activity-statistics';
export type PedagogyReferenceQuery = {
  kind: 'chapter' | 'competence';
  q: string;
};
export type PedagogyReferences = {
  schemaVersion: 1;
  environment: StatisticsEnvironment;
  kind: 'chapter' | 'competence';
  q: string;
  more: boolean;
  items: { id: string; label: string; truncated: boolean }[];
};
const text = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && [...v].length <= max && !/[\p{Cc}\p{Cs}]/u.test(v);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export function readPedagogyReferenceQuery(
  params: URLSearchParams,
): { ok: true; query: PedagogyReferenceQuery } | { ok: false; error: string } {
  const kind = params.get('kind'),
    q = params.get('q') ?? '';
  if (
    [...params.keys()].some((k) => !['kind', 'q'].includes(k)) ||
    params.getAll('kind').length !== 1 ||
    params.getAll('q').length > 1 ||
    !['chapter', 'competence'].includes(kind ?? '') ||
    !text(q)
  )
    return { ok: false, error: 'Recherche de référence invalide.' };
  return {
    ok: true,
    query: { kind: kind as PedagogyReferenceQuery['kind'], q },
  };
}
export function decodePedagogyReferences(
  value: unknown,
  expected: {
    environment: StatisticsEnvironment;
    query: PedagogyReferenceQuery;
  },
): PedagogyReferences | null {
  const parsed = readPedagogyReferenceQuery(
    new URLSearchParams(expected.query),
  );
  if (
    !parsed.ok ||
    !['local-copy', 'local-fixture', 'production'].includes(
      expected.environment,
    ) ||
    !object(value) ||
    !exact(value, [
      'schemaVersion',
      'environment',
      'kind',
      'q',
      'more',
      'items',
    ]) ||
    value.schemaVersion !== 1 ||
    value.environment !== expected.environment ||
    value.kind !== expected.query.kind ||
    value.q !== expected.query.q ||
    typeof value.more !== 'boolean' ||
    !Array.isArray(value.items) ||
    value.items.length > 200 ||
    (value.more && value.items.length !== 200)
  )
    return null;
  const ids = new Set<string>();
  for (const item of value.items) {
    if (
      !object(item) ||
      !exact(item, ['id', 'label', 'truncated']) ||
      !text(item.id) ||
      !item.id.length ||
      typeof item.label !== 'string' ||
      !item.label.length ||
      [...item.label].length > 200 ||
      /\p{Cs}|\u0000/u.test(item.label) ||
      typeof item.truncated !== 'boolean' ||
      (value.kind === 'chapter' &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          item.id,
        )) ||
      ids.has(item.id)
    )
      return null;
    ids.add(item.id);
  }
  return structuredClone(value) as PedagogyReferences;
}
export function readPedagogyPageQuery(
  params: URLSearchParams,
  now = new Date(),
):
  | {
      ok: true;
      query: PedagogyQuery;
      chapterSearch: string;
      competenceSearch: string;
    }
  | { ok: false; error: string } {
  const searches = {
    chapterSearch: params.get('chapterSearch') ?? '',
    competenceSearch: params.get('competenceSearch') ?? '',
  };
  for (const key of ['chapterSearch', 'competenceSearch'] as const)
    if (params.getAll(key).length > 1 || !text(searches[key]))
      return { ok: false, error: 'Recherche de référence invalide.' };
  const core = new URLSearchParams(params);
  core.delete('chapterSearch');
  core.delete('competenceSearch');
  const parsed = readPedagogyQuery(core, now);
  return parsed.ok ? { ...parsed, ...searches } : parsed;
}
