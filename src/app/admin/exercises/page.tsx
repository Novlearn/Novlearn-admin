import { CatalogueList } from '@/components/catalogue-list';
import { catalogueFilter } from '@/lib/catalogue';
import { loadCatalogue, requireCatalogueClient } from '@/lib/catalogue-server';

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogueClient();
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (typeof value === 'string') params.set(key, value);
  const filter = catalogueFilter(params);
  return (
    <CatalogueList data={await loadCatalogue(client, filter)} filter={filter} />
  );
}
