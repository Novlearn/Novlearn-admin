import { TaxonomyPage, type TaxonomySearch } from '@/components/taxonomy-page';
export default function ChaptersPage({
  searchParams,
}: {
  searchParams: TaxonomySearch;
}) {
  return <TaxonomyPage kind="chapter" searchParams={searchParams} />;
}
