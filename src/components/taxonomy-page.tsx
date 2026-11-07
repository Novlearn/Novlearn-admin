import { requireCatalogueClient } from '@/lib/catalogue-server';
import {
  taxonomyFilter,
  type TaxonomyData,
  type TaxonomyKind,
} from '@/lib/taxonomy';
import { TaxonomyManager } from './taxonomy-manager';
const PAGE_SIZE = 25;

function isTaxonomyData(value: unknown): value is TaxonomyData {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as TaxonomyData).items) &&
    Array.isArray((value as TaxonomyData).chapters) &&
    Number.isSafeInteger((value as TaxonomyData).total) &&
    (value as TaxonomyData).total >= 0
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}
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
  const first = await client.rpc('admin_list_taxonomy', {
    p_kind: kind,
    p_query: kind === 'competence' ? '' : filter.query,
    p_chapter: kind === 'competence' ? null : filter.chapter,
    p_offset: kind === 'competence' ? 0 : (filter.page - 1) * PAGE_SIZE,
  });
  let data: TaxonomyData | null = null;
  if (!first.error && isTaxonomyData(first.data)) {
    if (kind === 'competence') {
      const offsets = Array.from(
        { length: Math.ceil(first.data.total / PAGE_SIZE) - 1 },
        (_, index) => (index + 1) * PAGE_SIZE,
      );
      const pages: TaxonomyData[] = [];
      for (let start = 0; start < offsets.length; start += 8) {
        const batch = await Promise.all(
          offsets.slice(start, start + 8).map((offset) =>
            client.rpc('admin_list_taxonomy', {
              p_kind: kind,
              p_query: '',
              p_chapter: null,
              p_offset: offset,
            }),
          ),
        );
        if (batch.some((page) => page.error || !isTaxonomyData(page.data))) {
          pages.length = 0;
          break;
        }
        pages.push(...batch.map((page) => page.data as TaxonomyData));
      }
      if (offsets.length === 0 || pages.length === offsets.length) {
        const chapters = first.data.chapters;
        const query = normalizeSearch(filter.query);
        const matchedChapterIds = new Set(
          chapters
            .filter((chapter) => normalizeSearch(chapter.name).includes(query))
            .map((chapter) => chapter.id),
        );
        const items = [first.data, ...pages]
          .flatMap((page) => page.items)
          .filter((item) => {
            const value = item.value as { chapter_id?: string; name: string };
            const matchesChapterFilter =
              !filter.chapter || value.chapter_id === filter.chapter;
            const matchesSearch =
              !query ||
              normalizeSearch(value.name).includes(query) ||
              normalizeSearch(item.id).includes(query) ||
              matchedChapterIds.has(value.chapter_id ?? '');
            return matchesChapterFilter && matchesSearch;
          });
        data = { items, total: items.length, chapters };
      }
    } else {
      data = first.data;
    }
  }
  return (
    <TaxonomyManager
      kind={kind}
      data={data}
      filter={kind === 'competence' ? { ...filter, page: 1 } : filter}
    />
  );
}
