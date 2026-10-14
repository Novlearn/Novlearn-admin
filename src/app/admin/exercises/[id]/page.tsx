import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { CatalogueAction } from '@/components/catalogue-action';
import { DraftMetadataForm } from '@/components/draft-metadata-form';
import { ExercisePreview } from '@/components/exercise-preview';
import { TestHistory } from '@/components/test-history';
import { EditorialReview } from '@/components/editorial-review';
import { ReviewHistory } from '@/components/review-history';
import { EditorialBadge } from '@/components/catalogue-list';
import {
  draftEnvelope,
  isExerciseId,
  isUuid,
  revisionDiff,
  type EditorialStatus,
} from '@/lib/catalogue';
import { requireCatalogueClient, versionColumns } from '@/lib/catalogue-server';

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = await requireCatalogueClient();
  const { id } = await params;
  const query = await searchParams;
  if (!isExerciseId(id)) notFound();
  const { data: parent, error: parentError } = await client
    .from('exercises')
    .select('id,catalog_id,title,active_version_id,admin_archived_at')
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
  const versionId =
    typeof query.version === 'string' ? query.version : history?.[0]?.id;
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
  const testHistory = version
    ? await client
        .from('admin_exercise_test_runs')
        .select('id,recorded_at,fingerprint,test_epoch,passed,payload')
        .eq('version_id', version.id)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(10)
    : null;
  const currentReceipt = version
    ? testHistory?.data?.find(
        (run) =>
          run.fingerprint === version.approval_fingerprint_sha256 &&
          run.test_epoch === version.test_epoch,
      )
    : undefined;
  const reviewHistory = version
    ? await client
        .from('admin_exercise_reviews')
        .select(
          'id,actor_id,recorded_at,action,comment,fingerprint,test_epoch,receipt_id,checklist',
        )
        .eq('version_id', version.id)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(10)
    : null;
  let comparison: ReturnType<typeof revisionDiff> | null = null;
  if (typeof query.compare === 'string') {
    if (!isUuid(query.compare) || !version) notFound();
    const { data: other, error } = await client
      .from('exercise_versions')
      .select('definition')
      .eq('id', query.compare)
      .eq('exercise_id', id)
      .maybeSingle();
    if (error) throw new Error('Comparison unavailable');
    if (!other) notFound();
    comparison = revisionDiff(other.definition, version.definition);
  }
  const title = canonical
    ? version.definition.title
    : parent.title || `Exercice #${id}`;
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
            Staging · #{id}
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
          {version && (
            <CatalogueAction
              action="duplicate"
              exerciseId={id}
              versionId={version.id}
            />
          )}
          {version && canonical && !editable && (
            <ExercisePreview
              key={
                'preview-' + version.id + version.approval_fingerprint_sha256
              }
              definition={version.definition as ExerciseDefinition}
              saved={{
                id: version.id,
                fingerprint: version.approval_fingerprint_sha256,
                epoch: version.test_epoch,
              }}
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
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {!version ? (
            <section className="notice">
              <h2 className="font-semibold">Contenu historique</h2>
              <p>
                Cet exercice n’a pas encore de définition canonique. Son contenu
                reste conservé ; une migration explicite est nécessaire avant
                son édition.
              </p>
            </section>
          ) : !canonical ? (
            <section className="notice">
              Cette définition ne possède pas une enveloppe canonique
              compatible. Elle est conservée en lecture seule.
            </section>
          ) : editable ? (
            <DraftMetadataForm
              key={version.id + version.approval_fingerprint_sha256}
              exerciseId={id}
              versionId={version.id}
              fingerprint={version.approval_fingerprint_sha256}
              testEpoch={version.test_epoch}
              definition={version.definition as ExerciseDefinition}
            />
          ) : (
            <section className="card">
              <h2 className="text-xl font-semibold">Version conservée</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {parent.admin_archived_at
                  ? 'Restaurez l’exercice pour reprendre son édition.'
                  : 'Cette révision est en lecture seule. Créez une nouvelle révision pour la modifier.'}
              </p>
              {!parent.admin_archived_at && (
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold text-blue-700">
                    Préparer une nouvelle révision
                  </summary>
                  <div className="mt-5">
                    <DraftMetadataForm
                      exerciseId={id}
                      definition={version.definition as ExerciseDefinition}
                      newRevision
                    />
                  </div>
                </details>
              )}
            </section>
          )}
          {version && (
            <section className="card">
              <h2 className="text-lg font-semibold">
                Définition de la révision
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {version.engine_contract} · {version.generation_version}
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                  Consulter le format canonique
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs leading-6">
                  {JSON.stringify(version.definition, null, 2)}
                </pre>
              </details>
              <p className="mt-4 text-xs text-slate-500">
                Cette définition privée peut contenir les réponses attendues.
                Elle est réservée aux administrateurs.
              </p>
            </section>
          )}
          {version && (
            <TestHistory
              runs={testHistory?.data ?? []}
              fingerprint={version.approval_fingerprint_sha256}
              epoch={version.test_epoch}
              unavailable={!!testHistory?.error}
            />
          )}
          {version && canonical && (
            <EditorialReview
              key={'review-' + version.id + '-' + version.updated_at}
              versionId={version.id}
              fingerprint={version.approval_fingerprint_sha256}
              epoch={version.test_epoch}
              status={version.editorial_status}
              receiptId={currentReceipt?.passed ? currentReceipt.id : null}
              enabled={process.env.ADMIN_EDITORIAL_REVIEW_ENABLED === 'true'}
              archived={!!parent.admin_archived_at}
            />
          )}
          {version && (
            <ReviewHistory
              reviews={reviewHistory?.data ?? []}
              fingerprint={version.approval_fingerprint_sha256}
              epoch={version.test_epoch}
              unavailable={!!reviewHistory?.error}
            />
          )}
          {comparison && (
            <section className="card">
              <h2 className="text-xl font-semibold">
                Comparaison des révisions
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {comparison.length} champ{comparison.length > 1 ? 's' : ''}{' '}
                modifié{comparison.length > 1 ? 's' : ''}
              </p>
              <div className="mt-4 space-y-4">
                {comparison.slice(0, 50).map((change) => (
                  <div
                    key={change.path}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <p className="break-all font-mono text-xs text-slate-500">
                      {change.path}
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-red-50 p-3 text-xs">
                        {JSON.stringify(change.before, null, 2) ?? 'Absent'}
                      </pre>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-green-50 p-3 text-xs">
                        {JSON.stringify(change.after, null, 2) ?? 'Absent'}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
              {comparison.length > 50 && (
                <p className="mt-4 text-sm text-slate-500">
                  Les 50 premiers changements sont affichés. Les définitions
                  complètes restent consultables.
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="card">
          <h2 className="text-lg font-semibold">Historique des versions</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Version active Staging : {parent.active_version_id ?? 'aucune'}. La
            publication en Production est une opération distincte.
          </p>
          <ul className="mt-5 space-y-4">
            {history?.map((item) => (
              <li key={item.id} className="border-t border-slate-100 pt-4">
                <Link
                  href={`/admin/exercises/${id}?version=${item.id}&history=${versionPage}`}
                  className={`text-sm font-semibold ${item.id === versionId ? 'text-blue-700' : 'text-slate-700'}`}
                >
                  Version {item.revision}
                </Link>
                <div className="mt-2">
                  <EditorialBadge
                    status={item.editorial_status as EditorialStatus}
                  />
                </div>
                {version && item.id !== versionId && (
                  <Link
                    href={`/admin/exercises/${id}?version=${versionId}&compare=${item.id}&history=${versionPage}`}
                    className="mt-2 block text-xs text-blue-700"
                  >
                    Comparer à cette version
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {!history?.length && (
            <p className="mt-4 text-sm text-slate-500">
              Aucune révision canonique.
            </p>
          )}
          <nav
            aria-label="Pagination des versions"
            className="mt-5 flex justify-between text-xs text-blue-700"
          >
            {versionPage > 1 ? (
              <Link href={`/admin/exercises/${id}?history=${versionPage - 1}`}>
                ← Précédentes
              </Link>
            ) : (
              <span />
            )}
            {versionPage * 25 < (count ?? 0) && (
              <Link href={`/admin/exercises/${id}?history=${versionPage + 1}`}>
                Suivantes →
              </Link>
            )}
          </nav>
        </aside>
      </div>
    </div>
  );
}
