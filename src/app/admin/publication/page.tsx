import Link from 'next/link';
import { requireCatalogueClient } from '@/lib/catalogue-server';
import {
  publicationHistory,
  publicationStateLabels,
} from '@/lib/publication-view';
import { readPublicationPgConfiguration } from '@/lib/publication-pg';
import { readPublicationConfirmationKey } from '@/lib/publication-service';
import { PublicationHistoryActions } from '@/components/publication-history-actions';
export default async function PublicationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogueClient(),
    query = await searchParams;
  const page =
    typeof query.page === 'string' &&
    /^[1-9]\d{0,3}$/.test(query.page) &&
    Number(query.page) <= 4001
      ? Number(query.page)
      : 1;
  const { data, error } = await client.rpc(
    'admin_list_publication_operations',
    { p_offset: (page - 1) * 25 },
  );
  const history = error ? null : publicationHistory(data);
  const enabled =
    !!readPublicationPgConfiguration(process.env) &&
    !!readPublicationConfirmationKey(process.env) &&
    process.env.ADMIN_ENGINE_ENABLED === 'true';
  return (
    <div className="max-w-6xl space-y-7">
      <header>
        <p className="text-sm font-semibold text-blue-700">
          Staging → Production
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Mes opérations de publication
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Retrouvez vos plans et leurs résultats, y compris après une
          interruption. Vérifier un résultat ne relance aucun transfert.
        </p>
      </header>
      {!enabled && (
        <p className="notice">
          Les actions de publication attendent l’activation de leurs prérequis.
        </p>
      )}
      {!history ? (
        <p className="notice" role="alert">
          Historique de publication indisponible. Aucun résultat n’est déduit de
          cette erreur.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {history.total} opération{history.total > 1 ? 's' : ''} · page{' '}
            {page} · 25 opérations par page. Cet historique concerne votre
            compte.
          </p>
          {!history.items.length ? (
            <section className="card">
              <p>Aucune opération sur cette page.</p>
              <Link
                href="/admin/exercises"
                className="mt-4 inline-block font-semibold text-blue-700"
              >
                Consulter le catalogue
              </Link>
            </section>
          ) : (
            <ol className="space-y-5">
              {history.items.map((item) => (
                <li key={item.id} className="card space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {item.mode === 'rollback'
                          ? 'Réactivation d’une révision'
                          : 'Publication'}{' '}
                        · {publicationStateLabels[item.state]}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Créée le{' '}
                        {new Date(item.createdAt).toLocaleString('fr-FR', {
                          timeZone: 'Europe/Paris',
                        })}
                      </p>
                    </div>
                    <span className="badge">
                      {item.mode === 'rollback'
                        ? 'Réactivation'
                        : 'Publication'}
                    </span>
                  </div>
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer font-semibold">
                      Identifiants de suivi
                    </summary>
                    <div className="mt-3 space-y-2 break-all">
                      <p>Opération : {item.id}</p>
                      <p>Catalogue : {item.catalogId}</p>
                      <p>Révision Staging : {item.versionId}</p>
                      <p>Lot : {item.batchId}</p>
                    </div>
                  </details>
                  <PublicationHistoryActions item={item} enabled={enabled} />
                </li>
              ))}
            </ol>
          )}
          <nav
            aria-label="Pages des opérations de publication"
            className="flex gap-5 text-sm font-semibold text-blue-700"
          >
            {page > 1 && (
              <Link href={'/admin/publication?page=' + (page - 1)}>
                ← Précédente
              </Link>
            )}
            {page < 4001 && page * 25 < history.total && (
              <Link href={'/admin/publication?page=' + (page + 1)}>
                Suivante →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
