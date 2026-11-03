import { requireCatalogueClient } from '@/lib/catalogue-server';
import { EngineQualificationPanel } from '@/components/engine-qualification-panel';
export const dynamic = 'force-dynamic';
export default async function EngineQualificationPage() {
  await requireCatalogueClient();
  return (
    <main className="space-y-6">
      <p className="text-sm text-slate-500">
        Préproduction · diagnostic serveur
      </p>
      <h1 className="text-3xl font-semibold">Qualification Engine</h1>
      <EngineQualificationPanel />
    </main>
  );
}
