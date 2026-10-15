import { ContentOverview } from '@/components/content-overview';
import { requireCatalogueClient } from '@/lib/catalogue-server';
import { loadContentOverview } from '@/lib/dashboard-server';

export default async function AdminHome() {
  const client = await requireCatalogueClient();
  return <ContentOverview data={await loadContentOverview(client)} />;
}
