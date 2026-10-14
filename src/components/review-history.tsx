import { reviewChecklistLabels, type ReviewAction } from '@/lib/review';
type Review = {
  id: string;
  actor_id: string;
  recorded_at: string;
  action: ReviewAction;
  comment: string;
  fingerprint: string;
  test_epoch: number;
  receipt_id: string | null;
  checklist: Record<string, boolean>;
};
const labels: Record<ReviewAction, string> = {
  request_review: 'Demande de relecture',
  approve: 'Approbation humaine',
  return_to_draft: 'Retour à corriger',
};
export function ReviewHistory({
  reviews,
  fingerprint,
  epoch,
  unavailable = false,
}: {
  reviews: Review[];
  fingerprint: string;
  epoch: number;
  unavailable?: boolean;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">Historique des relectures</h2>
      <p className="text-sm text-slate-500">
        Les dix derniers événements de cette révision, conservés après une
        modification ou un retour à corriger.
      </p>
      {unavailable ? (
        <p role="alert" className="text-sm text-red-700">
          Historique des relectures indisponible.
        </p>
      ) : !reviews.length ? (
        <p className="text-sm text-slate-500">
          Aucune relecture consignée pour cette révision.
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-slate-200 p-4 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">
                  {labels[review.action]} ·{' '}
                  {review.fingerprint === fingerprint &&
                  review.test_epoch === epoch
                    ? 'contenu courant'
                    : 'ancien contenu'}
                </p>
                <time
                  dateTime={review.recorded_at}
                  className="text-xs text-slate-500"
                >
                  {new Date(review.recorded_at).toLocaleString('fr-FR', {
                    timeZone: 'Europe/Paris',
                  })}
                </time>
              </div>
              <p className="mt-2 break-all text-xs text-slate-500">
                Administrateur : {review.actor_id}
              </p>
              {review.comment && (
                <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">
                  {review.comment}
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold text-blue-700">
                  Traçabilité et attestation
                </summary>
                <div className="mt-3 space-y-2 break-all text-xs text-slate-600">
                  <p>Événement : {review.id}</p>
                  <p>
                    Empreinte : {review.fingerprint} · état {review.test_epoch}
                  </p>
                  {review.receipt_id && (
                    <p>Rapport Engine : {review.receipt_id}</p>
                  )}
                  {review.action === 'approve' && (
                    <ul className="space-y-2">
                      {Object.entries(reviewChecklistLabels).map(
                        ([key, label]) => (
                          <li key={key}>
                            {review.checklist[key] === true
                              ? 'Attesté'
                              : 'Non attesté'}{' '}
                            : {label}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
