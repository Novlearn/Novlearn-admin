'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewChecklistLabels, type ReviewAction } from '@/lib/review';
import { requestEditorLeave } from '@/lib/editor-navigation';
export function EditorialReview({
  versionId,
  fingerprint,
  epoch,
  status,
  receiptId,
  enabled,
  archived = false,
}: {
  versionId: string;
  fingerprint: string;
  epoch: number;
  status: string;
  receiptId: string | null;
  enabled: boolean;
  archived?: boolean;
}) {
  const router = useRouter(),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<ReviewAction | null>(null);
  const checked = Object.keys(reviewChecklistLabels).every((k) => checks[k]);
  const run = async () => {
    if (!confirm || !requestEditorLeave()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          versionId,
          fingerprint,
          epoch,
          expectedStatus: status,
          action: confirm,
          receiptId: confirm === 'return_to_draft' ? null : receiptId,
          checklist: confirm === 'approve' ? checks : {},
          comment,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Relecture impossible.');
        return;
      }
      setConfirm(null);
      router.refresh();
    } catch {
      setError(
        'Résultat incertain. Rechargez pour vérifier l’état avant de réessayer.',
      );
    } finally {
      setBusy(false);
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
            <fieldset disabled={busy || !enabled} className="space-y-3">
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
              disabled={busy || !enabled}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {status === 'draft' && (
              <button
                type="button"
                className="button"
                disabled={busy || !enabled || !receiptId}
                onClick={() => setConfirm('request_review')}
              >
                Soumettre à la relecture
              </button>
            )}
            {status === 'in_review' && (
              <button
                type="button"
                className="button"
                disabled={busy || !enabled || !receiptId || !checked}
                onClick={() => setConfirm('approve')}
              >
                Approuver cette révision
              </button>
            )}
            {['in_review', 'approved'].includes(status) && (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold"
                disabled={busy || !enabled || !comment.trim()}
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
                  disabled={busy}
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
    </section>
  );
}
