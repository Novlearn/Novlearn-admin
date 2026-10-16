'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  reviewChecklistLabels,
  reviewContextKey,
  reviewIntent,
  requestReview,
  ReviewRequestError,
  type ReviewAction,
  type ReviewContext,
} from '@/lib/review';
import { requestEditorLeave } from '@/lib/editor-navigation';
export function EditorialReview(props: ReviewContext) {
  return <ReviewForm key={reviewContextKey(props)} {...props} />;
}
function ReviewForm({
  versionId,
  fingerprint,
  epoch,
  status,
  receiptId,
  enabled,
  archived = false,
}: ReviewContext) {
  const router = useRouter(),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(false),
    [mustReload, setMustReload] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<ReviewAction | null>(null);
  const inFlight = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const disabled = busy || !enabled || mustReload;
  const checked = Object.keys(reviewChecklistLabels).every((k) => checks[k]);
  const run = async () => {
    if (!confirm || disabled || inFlight.current) return;
    const command = reviewIntent(
      confirm,
      { versionId, fingerprint, epoch, status, receiptId, enabled, archived },
      checks,
      comment,
    );
    if (!command || !requestEditorLeave()) return;
    inFlight.current = true;
    controller.current = new AbortController();
    setBusy(true);
    setError('');
    try {
      await requestReview(command, controller.current.signal);
      if (!mounted.current) return;
      setConfirm(null);
      setChecks({});
      setComment('');
      router.refresh();
    } catch (failure) {
      if (!mounted.current) return;
      setConfirm(null);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Résultat non confirmé. Rechargez la fiche.',
      );
      setMustReload(
        !(failure instanceof ReviewRequestError) || failure.needsReload,
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section className="card space-y-5" aria-labelledby="review-heading">
      <div>
        <h2 id="review-heading" className="text-lg font-semibold">
          Relecture humaine
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          La relecture porte sur cette révision enregistrée. Son dernier rapport
          doit être complet, réussi sur plusieurs seeds, et couvrir les réponses
          correctes, incorrectes et invalides. Le serveur contrôle les
          références Staging.
        </p>
      </div>
      {!enabled && (
        <p className="notice">
          La relecture serveur est désactivée. Aucun statut ne sera changé.
        </p>
      )}
      {archived ? (
        <p className="text-sm text-slate-500">
          Restaurez l’exercice pour reprendre sa relecture.
        </p>
      ) : status === 'published' ? (
        <p className="text-sm text-slate-500">
          Cette version publiée est conservée. Préparez une nouvelle révision
          pour changer son contenu.
        </p>
      ) : (
        <>
          {!receiptId && (
            <p className="text-sm text-amber-900">
              Consignez d’abord les tests de l’état courant sur au moins deux
              seeds, avec une couverture complète.
            </p>
          )}
          {status === 'in_review' && (
            <fieldset disabled={disabled} className="space-y-3">
              <legend className="mb-3 text-sm font-semibold">
                Attestation de l’administrateur connecté
              </legend>
              {Object.entries(reviewChecklistLabels).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 text-sm leading-6"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!checks[key]}
                    onChange={(e) =>
                      setChecks({ ...checks, [key]: e.target.checked })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="label">
            Commentaire de relecture
            <textarea
              className="field min-h-24"
              value={comment}
              maxLength={2000}
              disabled={disabled}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {status === 'draft' && (
              <button
                type="button"
                className="button"
                disabled={disabled || !receiptId}
                onClick={() => setConfirm('request_review')}
              >
                Soumettre à la relecture
              </button>
            )}
            {status === 'in_review' && (
              <button
                type="button"
                className="button"
                disabled={disabled || !receiptId || !checked}
                onClick={() => setConfirm('approve')}
              >
                Approuver cette révision
              </button>
            )}
            {['in_review', 'approved'].includes(status) && (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold"
                disabled={disabled || !comment.trim()}
                onClick={() => setConfirm('return_to_draft')}
              >
                Renvoyer à corriger
              </button>
            )}
          </div>
          {confirm && (
            <div
              className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
              role="group"
              aria-label="Confirmer la relecture"
            >
              <p className="text-sm text-blue-900">
                {confirm === 'approve'
                  ? 'Confirmer votre attestation humaine pour cette révision et son état exact ? Cette approbation ne publie rien.'
                  : confirm === 'request_review'
                    ? 'Mettre cette révision enregistrée en attente de relecture ?'
                    : 'Retirer l’approbation ou la demande de relecture et revenir au brouillon, en conservant les rapports et l’historique ?'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="button"
                  disabled={disabled}
                  onClick={run}
                >
                  {busy ? 'Enregistrement…' : 'Confirmer'}
                </button>
                <button
                  type="button"
                  className="px-3 text-sm"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {mustReload && (
        <div className="notice space-y-3">
          <p>
            Aucune nouvelle confirmation ne sera envoyée avant rechargement. Vos
            notes restent dans ce formulaire ; conservez-les si nécessaire avant
            de quitter la fiche.
          </p>
          <button
            type="button"
            className="font-semibold text-blue-700 underline"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            Recharger la fiche et son historique
          </button>
        </div>
      )}
    </section>
  );
}
