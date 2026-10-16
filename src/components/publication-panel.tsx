'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestEditorLeave } from '@/lib/editor-navigation';
import {
  publicationActionLabels,
  publicationStateLabels,
  requestPublication,
  publicationIntent,
  type PreparedPublication,
  type PublicationSummary,
} from '@/lib/publication-view';
import type { PublicationMode, PublicationPlan } from '@/lib/publication';
const valueText = (value: unknown) =>
  value === undefined ? 'Absent' : JSON.stringify(value, null, 2);
export function PublicationChanges({
  title,
  changes,
}: {
  title: string;
  changes: PublicationPlan['definitionChanges'];
}) {
  return (
    <details
      className="rounded-xl border border-slate-200 p-4"
      open={changes.length > 0}
    >
      <summary className="cursor-pointer font-semibold">
        {title} · {changes.length} changement{changes.length > 1 ? 's' : ''}
      </summary>
      {!changes.length ? (
        <p className="mt-3 text-sm text-slate-500">Aucune différence.</p>
      ) : (
        <div className="mt-4 max-h-[32rem] space-y-4 overflow-auto">
          {changes.map((change, index) => (
            <div
              key={change.path + '-' + index}
              className="rounded-lg bg-slate-50 p-3"
            >
              <p className="mb-3 break-all text-xs font-semibold text-slate-600">
                {change.path}
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {(
                  [
                    ['Production actuelle', change.before],
                    ['Après confirmation', change.after],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="mb-2 text-xs font-semibold">{label}</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
                      {valueText(value)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
export function PublicationResult({
  operation,
}: {
  operation: PublicationSummary;
}) {
  const uncertain = ['uncertain', 'executing'].includes(operation.state);
  return (
    <div
      className={
        'rounded-xl border p-4 text-sm ' +
        (operation.state === 'committed'
          ? 'border-green-200 bg-green-50 text-green-900'
          : uncertain
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-slate-50 text-slate-700')
      }
      role="status"
    >
      <p className="font-semibold">{publicationStateLabels[operation.state]}</p>
      {operation.outcome && (
        <p className="mt-2">
          {operation.outcome.result === 'unchanged'
            ? 'Le contenu attendu a été constaté comme identique lors de la vérification.'
            : operation.outcome.result === 'rolled_back'
              ? 'La réactivation de cette révision a été confirmée en Production.'
              : 'Le transfert de cette révision a été confirmé en Production.'}
        </p>
      )}
      {uncertain && (
        <p className="mt-2">
          La publication n’est pas confirmée. Vérifiez son résultat ; aucun
          nouveau transfert ne sera lancé par cette vérification.
        </p>
      )}
      {operation.state === 'failed' && (
        <p className="mt-2">
          L’absence d’application de ce transfert a été établie. Corrigez le
          problème, puis préparez un nouveau diff.
        </p>
      )}
      <p className="mt-3 break-all text-xs">Opération : {operation.id}</p>
    </div>
  );
}
export function PublicationPanel({
  versionId,
  fingerprint,
  epoch,
  revision,
  status,
  enabled,
  archived = false,
}: {
  versionId: string;
  fingerprint: string;
  epoch: string;
  revision: number;
  status: string;
  enabled: boolean;
  archived?: boolean;
}) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedPublication | null>(null),
    [operation, setOperation] = useState<PublicationSummary | null>(null),
    [mode, setMode] = useState<PublicationMode>('publish'),
    [pendingAction, setPendingAction] = useState<
      'prepare' | 'confirm' | 'cancel' | 'recover' | null
    >(null),
    [error, setError] = useState(''),
    [accepted, setAccepted] = useState(false),
    [mustObserve, setMustObserve] = useState(false),
    [now, setNow] = useState(Date.now);
  const inFlight = useRef(false),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!prepared) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [prepared]);
  const busy = pendingAction !== null;
  const eligible = !archived && ['approved', 'published'].includes(status),
    expired = !!prepared && Date.parse(prepared.operation.expiresAt) <= now;
  async function run(action: 'prepare' | 'confirm' | 'cancel' | 'recover') {
    const command = publicationIntent(action, {
      versionId,
      fingerprint,
      epoch,
      mode,
      enabled,
      busy: inFlight.current,
      eligible,
      accepted,
      mustObserve,
      prepared,
      operation,
      now: Date.now(),
    });
    if (!command || !requestEditorLeave()) return;
    inFlight.current = true;
    setPendingAction(action);
    setError('');
    controller.current = new AbortController();
    try {
      const result = await requestPublication(
        command,
        controller.current.signal,
      );
      if (!mounted.current) return;
      if ('operation' in result) {
        setPrepared(result);
        setOperation(result.operation);
        setAccepted(false);
        setMustObserve(false);
        setNow(Date.now());
      } else {
        setOperation(result);
        setAccepted(false);
        setMustObserve(['executing', 'uncertain'].includes(result.state));
        if (result.state !== 'planned') setPrepared(null);
        if (result.state === 'committed') router.refresh();
      }
    } catch (failure) {
      if (!mounted.current) return;
      setError(
        failure instanceof Error
          ? failure.message
          : 'Résultat non confirmé. Consultez l’historique.',
      );
      setAccepted(false);
      if (action !== 'prepare') setMustObserve(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setPendingAction(null);
    }
  }
  const pending =
    operation &&
    ['planned', 'executing', 'uncertain'].includes(operation.state);
  return (
    <section
      className="card space-y-5"
      aria-labelledby="publication-heading"
      aria-busy={busy}
    >
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700">
          Staging → Production
        </p>
        <h2 id="publication-heading" className="text-xl font-semibold">
          Publier la révision {revision}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Préparez le diff, relisez les changements, puis confirmez. Les tests
          Engine sont exécutés à nouveau à chaque étape.
        </p>
      </header>
      {!enabled && (
        <p className="notice">
          La publication attend l’activation de ses prérequis. Vous pouvez
          consulter la révision et ses rapports.
        </p>
      )}
      {!eligible && (
        <p className="text-sm text-slate-600">
          {archived
            ? 'Cet exercice est archivé.'
            : 'Cette révision doit être approuvée avant publication.'}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {operation && <PublicationResult operation={operation} />}
      {!pending && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Action
            <select
              className="field mt-2"
              value={mode}
              disabled={busy || !enabled || !eligible}
              onChange={(event) =>
                setMode(event.target.value as PublicationMode)
              }
            >
              <option value="publish">Publier cette révision</option>
              <option value="rollback">
                Réactiver cette révision précédente
              </option>
            </select>
          </label>
          <button
            type="button"
            className="button"
            disabled={busy || !enabled || !eligible}
            onClick={() => void run('prepare')}
          >
            {busy ? 'Vérification Engine et préparation…' : 'Préparer le diff'}
          </button>
        </div>
      )}
      {prepared && !mustObserve && operation?.state === 'planned' && (
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <h3 className="font-semibold">Relire avant confirmation</h3>
          <p className="text-sm">
            {publicationActionLabels[prepared.plan.action]} · révision{' '}
            {prepared.plan.revision}
            {prepared.plan.previousRevision !== null
              ? ` · actuellement active : ${prepared.plan.previousRevision}`
              : ''}
          </p>
          <PublicationChanges
            title="Métadonnées de l’exercice"
            changes={prepared.plan.headerChanges}
          />
          <PublicationChanges
            title="Définition de la révision"
            changes={prepared.plan.definitionChanges}
          />
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">
              Identité et traçabilité du plan
            </summary>
            <p className="mt-2 break-all">
              Catalogue : {prepared.plan.catalogId}
              <br />
              Empreinte métier : {prepared.plan.businessDigest}
            </p>
          </details>
          <p className="text-sm text-slate-600">
            {expired
              ? 'Ce plan a expiré. Annulez-le puis préparez un nouveau diff.'
              : `Plan valable jusqu’au ${new Date(prepared.operation.expiresAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}.`}
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={accepted}
              disabled={busy || expired || !enabled || !eligible}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              J’ai relu le diff et je confirme{' '}
              {mode === 'rollback'
                ? 'la réactivation de cette révision précédente'
                : 'ce transfert'}{' '}
              en Production.
            </span>
          </label>
          <button
            type="button"
            className="button"
            disabled={busy || !accepted || expired || !enabled || !eligible}
            onClick={() => void run('confirm')}
          >
            {pendingAction === 'confirm'
              ? 'Vérification et transfert…'
              : mode === 'rollback'
                ? 'Confirmer la réactivation'
                : 'Confirmer la publication'}
          </button>
        </div>
      )}
      {pending && (
        <div className="flex flex-wrap gap-3">
          {(mustObserve || operation.state !== 'planned') && (
            <button
              type="button"
              className="button"
              disabled={busy || !enabled}
              onClick={() => void run('recover')}
            >
              {pendingAction === 'recover'
                ? 'Vérification…'
                : 'Vérifier le résultat'}
            </button>
          )}
          {operation.state === 'planned' && !mustObserve && (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold"
              disabled={busy || !enabled}
              onClick={() => void run('cancel')}
            >
              {pendingAction === 'cancel' ? 'Annulation…' : 'Annuler ce plan'}
            </button>
          )}
        </div>
      )}
      <p className="text-sm">
        <Link
          href="/admin/publication"
          className="font-semibold text-blue-700 underline underline-offset-4"
        >
          Retrouver mes opérations de publication
        </Link>
      </p>
    </section>
  );
}
