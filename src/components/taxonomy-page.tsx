import { requireCatalogueClient } from '@/lib/catalogue-server';
import {
  taxonomyFilter,
  type TaxonomyData,
  type TaxonomyKind,
} from '@/lib/taxonomy';
import { TaxonomyManager } from './taxonomy-manager';
export type TaxonomySearch = Promise<
  Record<string, string | string[] | undefined>
>;
export async function TaxonomyPage({
  kind,
  searchParams,
}: {
  kind: TaxonomyKind;
  searchParams: TaxonomySearch;
}) {
  const client = await requireCatalogueClient();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === 'string') params.set(key, value);
  const filter = taxonomyFilter(params);
  const { data, error } = await client.rpc('admin_list_taxonomy', {
    p_kind: kind,
    p_query: filter.query,
    p_chapter: filter.chapter,
    p_offset: (filter.page - 1) * 25,
  });
  return (
    <TaxonomyManager
      kind={kind}
      data={
        !error &&
        data &&
        Array.isArray(data.items) &&
        Array.isArray(data.chapters) &&
        typeof data.total === 'number'
          ? (data as TaxonomyData)
          : null
      }
      filter={filter}
    />
  );
}
