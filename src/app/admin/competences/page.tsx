import { TaxonomyPage, type TaxonomySearch } from '@/components/taxonomy-page';
export default function CompetencesPage({
  searchParams,
}: {
  searchParams: TaxonomySearch;
}) {
  return <TaxonomyPage kind="competence" searchParams={searchParams} />;
}
