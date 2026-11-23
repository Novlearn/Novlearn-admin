import { CatalogueSyncPanel } from '@/components/catalogue-sync-panel';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { requireCatalogueClient } from '@/lib/catalogue-server';
import { catalogueSyncPage } from '@/lib/catalogue-sync';
import { readCatalogueSyncConfiguration } from '@/lib/catalogue-sync-config';
import { catalogueSyncTargetAvailable } from '@/lib/catalogue-sync-service';

export const dynamic = 'force-dynamic';

export default async function CatalogueSyncPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const config = readCatalogueSyncConfiguration(process.env);
  if (!config)
    return (
      <Unavailable reason="La capacité de synchronisation n’est pas activée sur cette instance." />
    );
  if (!(await catalogueSyncTargetAvailable(config)))
    return (
      <Unavailable reason="La capacité SQL cible atomic-catalogue-target-v1 n’est pas disponible. Aucun lot ne peut être confirmé." />
    );
  const client = await requireCatalogueClient();
  const { data, error } = await client.rpc('admin_list_catalogue_sync_ready', {
    p_after: '',
    p_limit: 100,
  });
  const page = !error ? catalogueSyncPage(data) : null;
  if (!page)
    return (
      <Unavailable reason="La liste Staging est indisponible ou son format n’est pas reconnu." />
    );
  const params = await searchParams;
  const batchId = typeof params.batch === 'string' ? params.batch : '';
  const payloadDigest = typeof params.digest === 'string' ? params.digest : '';
  const resume =
    /^[0-9a-f-]{36}$/i.test(batchId) && /^[0-9a-f]{64}$/.test(payloadDigest)
      ? { batchId, payloadDigest }
      : null;
  return (
    <div className="max-w-6xl space-y-7">
      <header>
        <p className="text-sm font-semibold text-blue-700">
          Staging → Production
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Synchroniser le catalogue
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Préparez un lot de 1 à 100 changements prêts. Chaque opération est
          inspectée sur la cible, puis le lot est envoyé dans une transaction
          unique. Aucun résultat n’est annoncé avant vérification du reçu
          durable.
        </p>
      </header>
      <CatalogueSyncPanel
        initialItems={page.items}
        next={page.next}
        resume={resume}
      />
    </div>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <section className="card max-w-3xl space-y-3">
      <p className="text-sm font-semibold text-amber-800">
        Synchronisation indisponible
      </p>
      <p className="leading-7 text-slate-700">{reason}</p>
    </section>
  );
}
