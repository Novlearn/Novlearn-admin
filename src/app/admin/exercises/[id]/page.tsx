import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { CatalogueAction } from '@/components/catalogue-action';
import { DraftMetadataForm } from '@/components/draft-metadata-form';
import { ExercisePreview } from '@/components/exercise-preview';
import { PublicationPanel } from '@/components/publication-panel';
import { readPublicationPgConfiguration } from '@/lib/publication-pg';
import { readPublicationConfirmationKey } from '@/lib/publication-service';
import { EditorialBadge } from '@/components/catalogue-list';
import {
  draftEnvelope,
  exerciseDisplayTitle,
  isExerciseId,
  isUuid,
  type EditorialStatus,
} from '@/lib/catalogue';
import { requireCatalogueClient, versionColumns } from '@/lib/catalogue-server';
import { readTestSigningConfiguration } from '@/lib/test-receipt';
import { isEngineEnabled } from '@/lib/engine-identity';
import {
  ActiveVersionCard,
  type ActiveVersionObservation,
} from '@/components/active-version-card';
import { activeCatalogId, comparableVersion } from '@/lib/active-version';
import { readLocalActiveVersionConfiguration } from '@/lib/active-version-config';
import { loadLocalActiveVersion } from '@/lib/active-version-server';
import NewExercisePage from '../new/page';

export const dynamic = 'force-dynamic';

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // The local dev router can resolve the literal creation slug through this route.
  if (id === 'new') return NewExercisePage();
  const client = await requireCatalogueClient();
  const canRecordTests = !!readTestSigningConfiguration(process.env);
  const engineEnabled = isEngineEnabled(process.env);
  const publicationConfig = readPublicationPgConfiguration(process.env);
  const publicationEnabled =
    !!publicationConfig &&
    !!readPublicationConfirmationKey(
      process.env,
      publicationConfig.localFixture,
    ) &&
    engineEnabled;
  const query = await searchParams;
  if (!isExerciseId(id)) notFound();
  const { data: parent, error: parentError } = await client
    .from('exercises')
    .select('id,catalog_id,title,app_title,active_version_id,admin_archived_at')
    .eq('id', id)
    .maybeSingle();
  if (parentError) throw new Error('Catalogue unavailable');
  if (!parent) notFound();
  const versionPage =
    typeof query.history === 'string' && /^[1-9]\d{0,3}$/.test(query.history)
      ? Number(query.history)
      : 1;
  const {
    data: history,
    error: historyError,
    count,
  } = await client
    .from('exercise_versions')
    .select('id,revision,editorial_status,updated_at', { count: 'exact' })
    .eq('exercise_id', id)
    .order('revision', { ascending: false })
    .range((versionPage - 1) * 25, versionPage * 25 - 1);
  if (historyError) throw new Error('Versions unavailable');
  const latest =
    typeof query.version !== 'string' && versionPage > 1
      ? await client
          .from('exercise_versions')
          .select('id')
          .eq('exercise_id', id)
          .order('revision', { ascending: false })
          .limit(1)
          .maybeSingle()
      : null;
  if (latest?.error) throw new Error('Latest version unavailable');
  const versionId =
    typeof query.version === 'string'
      ? query.version
      : latest
        ? latest.data?.id
        : history?.[0]?.id;
  if (versionId && !isUuid(versionId)) notFound();
  const versionResult = versionId
    ? await client
        .from('exercise_versions')
        .select(versionColumns)
        .eq('id', versionId)
        .eq('exercise_id', id)
        .maybeSingle()
    : null;
  if (versionResult?.error) throw new Error('Version unavailable');
  if (versionId && !versionResult?.data) notFound();
  const version = versionResult?.data;
  const editable =
    version?.editorial_status === 'draft' && !parent.admin_archived_at;
  const canonical = version && draftEnvelope(version.definition);
  const title = canonical
    ? exerciseDisplayTitle(
        version.definition.title,
        version.definition.catalogue?.appTitle,
      )
    : exerciseDisplayTitle(parent.title ?? '', parent.app_title);
  if (
    query.edit === 'revision' &&
    version &&
    canonical &&
    !editable &&
    !parent.admin_archived_at
  ) {
    return (
      <div className="max-w-4xl">
        <Link
          href={`/admin/exercises/${id}?version=${version.id}&history=${versionPage}`}
          className="text-sm font-medium text-blue-700"
        >
          ← Revenir à la version {version.revision}
        </Link>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight">
          Nouvelle révision
        </h1>
        <p className="mb-8 mt-2 text-slate-600">
          {title} · Brouillon à partir de la version {version.revision}
        </p>
        <DraftMetadataForm
          key={`new-${version.id}:${version.approval_fingerprint_sha256}:${version.test_epoch}`}
          engineEnabled={engineEnabled}
          canRecordTests={canRecordTests}
          exerciseId={id}
          versionId={version.id}
          fingerprint={version.approval_fingerprint_sha256}
          testEpoch={version.test_epoch}
          definition={version.definition}
          newRevision
        />
      </div>
    );
  }
  let targetObservation: ActiveVersionObservation = { kind: 'disabled' };
  if (readLocalActiveVersionConfiguration(process.env)) {
    if (!activeCatalogId(parent.catalog_id))
      targetObservation = { kind: 'identity-unavailable' };
    else {
      try {
        targetObservation = {
          kind: 'observed',
          snapshot: await loadLocalActiveVersion(parent.catalog_id),
        };
      } catch {
        targetObservation = { kind: 'unavailable' };
      }
    }
  }
  const comparable = version
    ? comparableVersion({
        revision: version.revision,
        definitionSha256: version.definition_sha256,
        engineContract: version.engine_contract,
        generationVersion: version.generation_version,
        canonicalizationVersion: version.canonicalization_version,
      })
    : null;
  const historyLink = (page: number) => {
    const params = new URLSearchParams({ history: String(page) });
    if (versionId) params.set('version', versionId);
    return `/admin/exercises/${id}?${params}`;
  };
  return (
    <div className="max-w-6xl">
      <Link
        href="/admin/exercises"
        className="text-sm font-medium text-blue-700"
      >
        ← Catalogue
      </Link>
      <div className="mb-8 mt-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-slate-500">
            #{id}
            {version ? ` · version ${version.revision}` : ''}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <div className="mt-4">
            <EditorialBadge
              status={
                parent.admin_archived_at
                  ? 'archived'
                  : ((version?.editorial_status as EditorialStatus) ?? 'legacy')
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {version && canonical && !editable && !parent.admin_archived_at && (
            <Link
              className="button inline-flex items-center"
              href={`/admin/exercises/${id}?version=${version.id}&history=${versionPage}&edit=revision`}
            >
              Créer une nouvelle révision
            </Link>
          )}
          {version && (
            <CatalogueAction
              action="duplicate"
              exerciseId={id}
              versionId={version.id}
            />
          )}
          <CatalogueAction
            action="archive"
            exerciseId={id}
            archived={!!parent.admin_archived_at}
          />
        </div>
      </div>
      {query.saved === '1' && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          Brouillon enregistré dans Staging.
        </p>
      )}
      {query.saved === 'approved' && version?.editorial_status === 'ready' && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          Révision approuvée dans Staging. Elle peut être synchronisée plus
          tard.
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {!version ? (
            <p className="notice">
              Exercice historique. Une migration est nécessaire pour le
              modifier.
            </p>
          ) : !canonical ? (
            <section className="notice">
              Cette version est disponible en lecture seule.
            </section>
          ) : editable ? (
            <DraftMetadataForm
              engineEnabled={engineEnabled}
              canRecordTests={canRecordTests}
              key={
                version.id +
                version.approval_fingerprint_sha256 +
                ':' +
                version.test_epoch
              }
              exerciseId={id}
              versionId={version.id}
              fingerprint={version.approval_fingerprint_sha256}
              testEpoch={version.test_epoch}
              definition={version.definition as ExerciseDefinition}
            />
          ) : parent.admin_archived_at ? (
            <p className="notice">
              Restaurez l’exercice pour reprendre son édition.
            </p>
          ) : null}
          {version && canonical && !editable && (
            <ExercisePreview
              engineEnabled={engineEnabled}
              canRecordTests={canRecordTests}
              key={version.id + version.approval_fingerprint_sha256}
              definition={version.definition}
              saved={{
                id: version.id,
                fingerprint: version.approval_fingerprint_sha256,
                epoch: version.test_epoch,
              }}
            />
          )}
          {publicationEnabled &&
            version &&
            canonical &&
            Number.isSafeInteger(version.test_epoch) &&
            version.test_epoch >= 0 && (
              <PublicationPanel
                key={
                  'publication-' +
                  version.id +
                  '-' +
                  version.approval_fingerprint_sha256 +
                  '-' +
                  version.test_epoch
                }
                versionId={version.id}
                fingerprint={version.approval_fingerprint_sha256}
                epoch={String(version.test_epoch)}
                revision={version.revision}
                status={version.editorial_status}
                archived={!!parent.admin_archived_at}
                localFixture={
                  process.env.ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED === 'true'
                }
                enabled
              />
            )}
        </div>
        <aside className="space-y-5">
          {targetObservation.kind !== 'disabled' && (
            <ActiveVersionCard
              observation={targetObservation}
              selected={comparable}
              exerciseId={id}
              refreshQuery={{
                version: versionId,
                history: String(versionPage),
              }}
            />
          )}
          <section className="card">
            <h2 className="text-lg font-semibold">Historique des versions</h2>
            <ul className="mt-5 space-y-4">
              {history?.map((item) => (
                <li key={item.id} className="border-t border-slate-100 pt-4">
                  <Link
                    href={`/admin/exercises/${id}?version=${item.id}&history=${versionPage}`}
                    aria-current={item.id === versionId ? 'page' : undefined}
                    className={`text-sm font-semibold ${item.id === versionId ? 'text-blue-700' : 'text-slate-700'}`}
                  >
                    Version {item.revision}
                  </Link>
                  <div className="mt-2">
                    <EditorialBadge
                      status={item.editorial_status as EditorialStatus}
                    />
                    {item.id === parent.active_version_id && (
                      <p className="mt-1 text-xs text-slate-500">
                        Active en Staging
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {!history?.length && (
              <p className="mt-4 text-sm text-slate-500">Aucune version.</p>
            )}
            <nav
              aria-label="Pagination des versions"
              className="mt-5 flex justify-between text-xs text-blue-700"
            >
              {versionPage > 1 ? (
                <Link href={historyLink(versionPage - 1)}>← Précédentes</Link>
              ) : (
                <span />
              )}
              {versionPage * 25 < (count ?? 0) && (
                <Link href={historyLink(versionPage + 1)}>Suivantes →</Link>
              )}
            </nav>
          </section>
        </aside>
      </div>
    </div>
  );
}
