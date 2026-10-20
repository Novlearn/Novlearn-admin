import {
  activeVersionState,
  compareActiveVersion,
  type ActiveVersionSnapshot,
  type ComparableVersion,
} from '@/lib/active-version';
export type ActiveVersionObservation =
  | { kind: 'disabled' | 'identity-unavailable' | 'unavailable' }
  | { kind: 'observed'; snapshot: ActiveVersionSnapshot };
export function ActiveVersionCard({
  observation,
  selected,
  exerciseId,
  refreshQuery,
}: {
  observation: ActiveVersionObservation;
  selected: ComparableVersion | null;
  exerciseId: string;
  refreshQuery: { version?: string; compare?: string; history: string };
}) {
  const snapshot =
    observation.kind === 'observed' ? observation.snapshot : null;
  const state = snapshot ? activeVersionState(snapshot) : null;
  const comparison = snapshot
    ? compareActiveVersion(snapshot, selected)
    : 'not-comparable';
  return (
    <section className="card" aria-labelledby="active-target-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-blue-700">
            Cible de publication · copie locale
          </p>
          <h2 id="active-target-title" className="mt-1 text-xl font-semibold">
            Version actuellement publiée
          </h2>
        </div>
        <form action={`/admin/exercises/${exerciseId}`} method="get">
          {Object.entries(refreshQuery).map(([name, value]) =>
            value ? (
              <input key={name} type="hidden" name={name} value={value} />
            ) : null,
          )}
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Actualiser
          </button>
        </form>
      </div>
      {observation.kind === 'disabled' && (
        <p className="mt-4 text-sm text-slate-600">
          La lecture de la cible locale n’est pas encore activée.
        </p>
      )}
      {observation.kind === 'identity-unavailable' && (
        <p className="mt-4 text-sm text-amber-800">
          L’identité de cet exercice ne permet pas encore de retrouver sa
          version sur la cible.
        </p>
      )}
      {observation.kind === 'unavailable' && (
        <p role="status" className="mt-4 text-sm text-amber-800">
          La cible est indisponible. Sa version active ne peut pas être
          vérifiée.
        </p>
      )}
      {snapshot && (
        <>
          {state?.state === 'absent' && (
            <p className="mt-4 text-sm text-slate-700">
              Cet exercice est absent de la cible locale.
            </p>
          )}
          {state?.state === 'unpublished' && (
            <p className="mt-4 text-sm text-slate-700">
              Cet exercice existe sur la cible locale, sans version active.
            </p>
          )}
          {state?.state === 'inconsistent' && (
            <p role="status" className="mt-4 text-sm text-amber-800">
              Les informations de la cible sont incohérentes. La version active
              ne peut pas être confirmée.
            </p>
          )}
          {state?.state === 'active' && snapshot.active && (
            <>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                Version {snapshot.active.revision} active
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Publiée le{' '}
                {new Date(snapshot.active.publishedAt!).toLocaleString(
                  'fr-FR',
                  { timeZone: 'Europe/Paris' },
                )}{' '}
                (heure de Paris).
              </p>
              {comparison === 'same-version' && (
                <p className="mt-3 text-sm text-green-800">
                  La révision, le contenu et le contrat Engine correspondent à
                  la version consultée.
                </p>
              )}
              {comparison === 'different-revision' && (
                <p className="mt-3 text-sm text-amber-800">
                  La révision active diffère de la version consultée.
                </p>
              )}
              {comparison === 'different-content' && (
                <p className="mt-3 text-sm text-amber-800">
                  Le numéro de révision correspond, mais le contenu ou le
                  contrat Engine diffère.
                </p>
              )}
            </>
          )}
          {snapshot.parent?.archivedAt && (
            <p className="mt-3 text-sm text-amber-800">
              Cet exercice est archivé sur la cible.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Vérifié le{' '}
            {new Date(snapshot.asOf).toLocaleString('fr-FR', {
              timeZone: 'Europe/Paris',
            })}{' '}
            (heure de Paris). Cette observation ne vaut pas nouveau reçu de
            publication.
          </p>
        </>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Cette cible contient les essais locaux. La Production reste séparée.
      </p>
    </section>
  );
}
