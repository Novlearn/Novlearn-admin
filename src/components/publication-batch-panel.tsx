'use client';
import { useEffect, useReducer, useState } from 'react';
import Link from 'next/link';
import {
  PublicationBatch,
  canReplanBatchRow,
  type BatchCandidate,
  type BatchLocator,
} from '@/lib/publication-batch';
import {
  publicationActionLabels,
  requestPublication,
} from '@/lib/publication-view';
import { PublicationChanges, PublicationResult } from './publication-panel';

export function PublicationBatchPanel({
  batchId,
  items,
  candidates,
  enabled,
  persistCheckpoint = true,
}: {
  batchId: string;
  items: BatchLocator[];
  candidates: (BatchCandidate | null)[];
  enabled: boolean;
  persistCheckpoint?: boolean;
}) {
  const [, redraw] = useReducer((n) => n + 1, 0);
  const [runner] = useState(
    () =>
      new PublicationBatch(
        batchId,
        items,
        candidates,
        enabled,
        requestPublication,
        () => redraw(),
      ),
  );
  const [now, setNow] = useState(Date.now),
    [cancelConfirmed, setCancelConfirmed] = useState(false);
  const state = runner.snapshot(),
    checkpoint = runner.checkpoint(),
    busy = !!state.busy;
  const idle = state.rows.filter((r) => r.phase === 'idle').length;
  const ready = state.rows.filter((r) => r.phase === 'ready').length;
  const reviewed = state.rows.filter((r) => r.phase === 'ready' && r.reviewed);
  const verify = state.rows.filter(
    (r) => r.phase === 'verify' && r.operationId,
  ).length;
  const planned = state.rows.filter(
    (r) => r.operation?.state === 'planned',
  ).length;
  const committed = state.rows.filter(
    (r) => r.operation?.state === 'committed',
  ).length;
  useEffect(() => {
    runner.activate();
    return () => runner.dispose();
  }, [runner]);
  useEffect(() => {
    if (persistCheckpoint)
      window.history.replaceState(window.history.state, '', checkpoint);
  }, [checkpoint, persistCheckpoint]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ready]);
  const run = async (action: 'prepare' | 'confirm' | 'recover' | 'cancel') => {
    setCancelConfirmed(false);
    await runner.run(action);
  };
  return (
    <div className="space-y-6" aria-busy={busy}>
      {!enabled && (
        <p className="notice">
          La publication attend l’activation de ses prérequis. Aucun transfert
          n’est disponible sur cette instance.
        </p>
      )}
      <section className="card space-y-4" aria-labelledby="batch-progress">
        <h2 id="batch-progress" className="text-xl font-semibold">
          {committed} résultat{committed > 1 ? 's' : ''} confirmé
          {committed > 1 ? 's' : ''} sur {state.rows.length} exercices
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          Chaque exercice possède son diff, sa confirmation et son résultat. Les
          transferts sont indépendants : un résultat incertain ou un refus
          arrête les envois suivants et conserve les transferts déjà confirmés.
        </p>
        <p className="text-sm text-slate-600">
          {idle} à préparer · {ready} diff{ready > 1 ? 's' : ''} prêt
          {ready > 1 ? 's' : ''} · {verify} résultat{verify > 1 ? 's' : ''} à
          vérifier.
        </p>
        {verify > 0 && (
          <p className="notice">
            Vérifiez les opérations en attente avant toute nouvelle
            confirmation. Après rechargement, les confirmations ne sont pas
            conservées ; un plan encore en attente peut être annulé pour
            préparer un nouveau diff.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="button"
            disabled={!enabled || busy || !idle}
            onClick={() => void run('prepare')}
          >
            {state.busy === 'prepare'
              ? 'Vérification Engine et préparation…'
              : `Préparer ${idle} exercice${idle > 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            className="button"
            disabled={
              !enabled ||
              busy ||
              verify > 0 ||
              !reviewed.length ||
              reviewed.some(
                (r) =>
                  !r.prepared ||
                  Date.parse(r.prepared.operation.expiresAt) <= now,
              )
            }
            onClick={() => void run('confirm')}
          >
            {state.busy === 'confirm'
              ? 'Vérification et transfert…'
              : `Confirmer ${reviewed.length} exercice${reviewed.length > 1 ? 's' : ''} relu${reviewed.length > 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            className="rounded-lg border border-blue-200 px-4 py-3 font-semibold text-blue-700 disabled:opacity-50"
            disabled={!enabled || busy || !verify}
            onClick={() => void run('recover')}
          >
            Vérifier les {verify} résultats en attente
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-3 font-semibold disabled:opacity-50"
            disabled={!enabled || busy || !planned}
            onClick={() => setCancelConfirmed(true)}
          >
            Annuler les {planned} plans en attente
          </button>
          {busy && (
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 font-semibold"
              onClick={() => runner.stop()}
            >
              Arrêter les envois suivants
            </button>
          )}
        </div>
        {busy && (
          <p className="text-sm text-slate-600" role="status">
            Opération en cours. Un transfert déjà commencé peut aboutir après
            l’arrêt ; vérifiez son résultat.
          </p>
        )}
        {cancelConfirmed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm">
              Annuler ces {planned} plans encore en attente ? Aucun transfert
              confirmé n’est annulé.
            </p>
            <div className="mt-3 flex gap-4">
              <button
                type="button"
                className="font-semibold text-red-700"
                disabled={busy}
                onClick={() => void run('cancel')}
              >
                Confirmer l’annulation des plans
              </button>
              <button
                type="button"
                className="font-semibold"
                onClick={() => setCancelConfirmed(false)}
              >
                Conserver les plans
              </button>
            </div>
          </div>
        )}
      </section>
      <ol className="space-y-5">
        {state.rows.map((row, index) => {
          const c = row.candidate,
            p = row.prepared,
            expired = !!p && Date.parse(p.operation.expiresAt) <= now;
          return (
            <li className="card space-y-4" key={row.versionId}>
              <header>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Exercice {index + 1} sur {state.rows.length}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {c?.title ?? 'Révision indisponible'}
                </h2>
                {c && (
                  <p className="mt-2 text-sm">
                    <Link
                      className="font-semibold text-blue-700 underline"
                      href={`/admin/exercises/${c.exerciseId}?version=${c.versionId}`}
                    >
                      Exercice #{c.exerciseId} · révision {c.revision}
                    </Link>
                  </p>
                )}
              </header>
              {row.error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  {row.error}
                </p>
              )}
              {row.phase === 'blocked' && !row.error && (
                <p className="text-sm text-slate-600">
                  {!c
                    ? 'Cette révision ne peut pas être chargée.'
                    : c.archived
                      ? 'Cet exercice est archivé.'
                      : 'Cette révision doit être approuvée avant publication.'}
                </p>
              )}
              {row.phase === 'idle' && (
                <p className="text-sm text-slate-600">
                  La présence et les différences en Production seront vérifiées
                  à la préparation du diff.
                </p>
              )}
              {row.phase === 'verify' && !row.operation && (
                <p className="notice">
                  Cette opération doit être relue sur le serveur. Aucun résultat
                  n’est déduit de son identifiant.
                </p>
              )}
              {row.operation && <PublicationResult operation={row.operation} />}
              {canReplanBatchRow(row) && (
                <button
                  type="button"
                  className="font-semibold text-blue-700 underline disabled:opacity-50"
                  disabled={!enabled || busy}
                  onClick={() => runner.replan(row.versionId)}
                >
                  Reprendre la préparation de cet exercice
                </button>
              )}
              {p && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                  <h3 className="font-semibold">
                    {publicationActionLabels[p.plan.action]}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {p.plan.previousRevision === null
                      ? 'Aucune révision active en Production lors de la préparation.'
                      : `Révision active en Production lors de la préparation : ${p.plan.previousRevision}.`}
                  </p>
                  <PublicationChanges
                    title="Métadonnées de l’exercice"
                    changes={p.plan.headerChanges}
                  />
                  <PublicationChanges
                    title="Définition de la révision"
                    changes={p.plan.definitionChanges}
                  />
                  <p className="text-sm text-slate-600">
                    {expired
                      ? 'Ce plan a expiré. Annulez-le avant de préparer un autre diff.'
                      : `Plan valable jusqu’au ${new Date(p.operation.expiresAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}.`}
                  </p>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={row.reviewed}
                      disabled={!enabled || busy || expired}
                      onChange={(e) =>
                        runner.review(row.versionId, e.target.checked)
                      }
                    />
                    <span>
                      J’ai relu ce diff et je confirme le transfert de cet
                      exercice en Production.
                    </span>
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-slate-600">
        Conservez l’adresse de cette page pour retrouver les opérations connues
        du lot. Une préparation dont la réponse n’a pas été reçue peut aussi
        figurer dans votre historique ; elle n’est jamais confirmée
        automatiquement.
      </p>
      <Link
        href="/admin/publication"
        className="font-semibold text-blue-700 underline"
      >
        Consulter mon historique complet de publication
      </Link>
    </div>
  );
}
