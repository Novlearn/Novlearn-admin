import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireCatalogueClient } from '@/lib/catalogue-server';
import {
  MAX_PUBLICATION_BATCH,
  parseBatchQuery,
} from '@/lib/publication-batch';
import { loadBatchCandidates } from '@/lib/publication-batch-server';
import { readPublicationPgConfiguration } from '@/lib/publication-pg';
import { readPublicationConfirmationKey } from '@/lib/publication-service';
import { PublicationBatchPanel } from '@/components/publication-batch-panel';

export default async function PublicationBatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogueClient();
  const publicationConfig = readPublicationPgConfiguration(process.env);
  const localFixture =
    process.env.ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED === 'true';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  const query = parseBatchQuery(params);
  const candidates = query
    ? await loadBatchCandidates(client, query.items)
    : null;
  const present = candidates?.filter((c) => c !== null) ?? [];
  const duplicate =
    new Set(present.map((c) => c.exerciseId)).size !== present.length ||
    new Set(present.map((c) => c.catalogId)).size !== present.length;
  const enabled =
    !!publicationConfig &&
    !!readPublicationConfirmationKey(
      process.env,
      publicationConfig?.localFixture,
    ) &&
    process.env.ADMIN_ENGINE_ENABLED === 'true';
  const batchId = query?.batchId ?? randomUUID();
  return (
    <div className="max-w-6xl space-y-7">
      <header>
        <p className="text-sm font-semibold text-blue-700">
          {localFixture
            ? 'Copie source → copie cible · essai local'
            : 'Staging → Production'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Publier plusieurs exercices
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Relisez chaque diff avant de confirmer les exercices choisis. Un lot
          contient au maximum {MAX_PUBLICATION_BATCH} exercices ; les calculs et
          les transferts sont effectués l’un après l’autre.
        </p>
      </header>
      {!query || !candidates || duplicate ? (
        <section className="card space-y-4">
          <p role="alert">
            {!query
              ? `Sélectionnez de 1 à ${MAX_PUBLICATION_BATCH} révisions distinctes depuis le catalogue.`
              : duplicate
                ? 'Sélectionnez une seule révision par exercice.'
                : 'La sélection est indisponible. Aucun résultat n’est déduit de cette erreur.'}
          </p>
          <Link
            href="/admin/exercises"
            className="font-semibold text-blue-700 underline"
          >
            Retour au catalogue
          </Link>
        </section>
      ) : (
        <PublicationBatchPanel
          key={batchId}
          batchId={batchId}
          items={query.items}
          candidates={candidates}
          enabled={enabled}
          localFixture={localFixture}
        />
      )}
    </div>
  );
}
