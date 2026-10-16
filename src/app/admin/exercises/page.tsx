import { CatalogueList } from '@/components/catalogue-list';
import {
  catalogueFilter,
  editorialLabels,
  isExerciseId,
  isUuid,
  PAGE_SIZE,
  type CataloguePage,
} from '@/lib/catalogue';
import { loadCatalogue, requireCatalogueClient } from '@/lib/catalogue-server';

/** The interactive selection makes this a client boundary. Explicitly project
 * metadata so an unexpected RPC field or nested value never crosses it. */
function presentation(data: CataloguePage | null): CataloguePage | null {
  if (
    !data ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    !Array.isArray(data.items) ||
    data.items.length > PAGE_SIZE ||
    data.items.length > data.total
  )
    return null;
  const nullableUuid = (value: unknown) => value === null || isUuid(value);
  if (
    data.items.some(
      (item) =>
        !item ||
        !isExerciseId(item.id) ||
        !nullableUuid(item.catalogId) ||
        !nullableUuid(item.versionId) ||
        !nullableUuid(item.activeVersionId) ||
        !['title', 'appTitle', 'chapter', 'difficulty', 'exerciseType'].every(
          (field) => typeof item[field as keyof typeof item] === 'string',
        ) ||
        !Array.isArray(item.skills) ||
        item.skills.some((skill) => typeof skill !== 'string') ||
        !Object.hasOwn(editorialLabels, item.status) ||
        typeof item.archived !== 'boolean' ||
        typeof item.needsCalculator !== 'boolean' ||
        (item.revision !== null &&
          (!Number.isSafeInteger(item.revision) || item.revision < 1)) ||
        (item.updatedAt !== null && typeof item.updatedAt !== 'string'),
    )
  )
    return null;
  return {
    total: data.total,
    items: data.items.map((item) => ({
      id: item.id,
      catalogId: item.catalogId,
      title: item.title,
      appTitle: item.appTitle,
      chapter: item.chapter,
      difficulty: item.difficulty,
      skills: [...item.skills],
      exerciseType: item.exerciseType,
      needsCalculator: item.needsCalculator,
      status: item.status,
      revision: item.revision,
      versionId: item.versionId,
      activeVersionId: item.activeVersionId,
      archived: item.archived,
      updatedAt: item.updatedAt,
    })),
  };
}

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
    <CatalogueList
      data={presentation(await loadCatalogue(client, filter))}
      filter={filter}
    />
  );
}
