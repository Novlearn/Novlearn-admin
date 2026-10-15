import { requireCatalogueClient } from '@/lib/catalogue-server';
import { flashcardFilter, type FlashcardPage } from '@/lib/flashcards';
import { FlashcardsManager } from '@/components/flashcards-manager';
export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogueClient(),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === 'string') params.set(key, value);
  const filter = flashcardFilter(params);
  const { data, error } = await client.rpc('admin_list_flashcards', {
    p_query: filter.query,
    p_chapter: filter.chapter,
    p_offset: (filter.page - 1) * 25,
  });
  return (
    <FlashcardsManager
      data={
        !error &&
        data &&
        Array.isArray(data.items) &&
        Array.isArray(data.chapters) &&
        typeof data.total === 'number'
          ? (data as FlashcardPage)
          : null
      }
      filter={filter}
    />
  );
}
