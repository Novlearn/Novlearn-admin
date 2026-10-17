import type { PreviewTestReport } from '@/lib/preview';
import { isCurrentTestReceipt } from '@/lib/test-receipt-state';
type Run = {
  id: string;
  recorded_at: string;
  fingerprint: string;
  test_epoch: number;
  passed: boolean;
  payload: string;
};
export function TestHistory({
  runs,
  fingerprint,
  epoch,
  unavailable = false,
}: {
  runs: Run[];
  fingerprint: string;
  epoch: number;
  unavailable?: boolean;
}) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">Rapports Engine enregistrés</h2>
      <p className="text-sm text-slate-500">
        Les rapports portent sur la révision enregistrée. Une modification
        invalide leur état courant et conserve leur historique.
      </p>
      {unavailable ? (
        <p role="alert" className="text-sm text-red-700">
          Historique des rapports indisponible.
        </p>
      ) : !runs.length ? (
        <p className="text-sm text-slate-500">
          Aucun rapport consigné pour cette révision.
        </p>
      ) : (
        <ul className="space-y-4">
          {runs.map((run) => {
            let report: PreviewTestReport | null = null;
            try {
              report = JSON.parse(run.payload).report;
            } catch {}
            const sameContent =
              run.fingerprint === fingerprint && run.test_epoch === epoch;
            const current = isCurrentTestReceipt(run, fingerprint, epoch);
            return (
              <li
                key={run.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={`text-sm font-semibold ${run.passed ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {run.passed ? 'Tests réussis' : 'Tests en échec'} ·{' '}
                    {current ? 'état courant' : 'ancien état'}
                  </p>
                  <time
                    className="text-xs text-slate-500"
                    dateTime={run.recorded_at}
                  >
                    {new Date(run.recorded_at).toLocaleString('fr-FR', {
                      timeZone: 'Europe/Paris',
                    })}
                  </time>
                </div>
                {sameContent && !current && (
                  <p className="notice mt-3 text-sm">
                    Le moteur a été mis à jour ou ce rapport ne permet pas
                    d’identifier sa version. Relancez les tests avant la
                    relecture.
                  </p>
                )}
                <p className="mt-2 break-all font-mono text-xs text-slate-500">
                  {run.id}
                </p>
                {report && (
                  <>
                    <p className="mt-2 text-sm text-slate-600">
                      Engine {report.engineVersion} · seeds{' '}
                      {report.seeds.map((s) => s.seed).join(', ')}
                    </p>
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer font-semibold text-blue-700">
                        Détails des vérifications
                      </summary>
                      <div className="mt-3 space-y-4">
                        {report.seeds.map((s) => (
                          <div key={s.seed}>
                            <h3 className="font-semibold">
                              Seed {s.seed} ·{' '}
                              {s.passed ? 'réussie' : 'en échec'}
                            </h3>
                            {s.diagnostics.map((d, i) => (
                              <p key={i} className="mt-1 text-red-700">
                                {d.questionId || d.path} · {d.message}
                              </p>
                            ))}
                            <ul className="mt-2 space-y-1">
                              {s.checks.map((c, i) => (
                                <li
                                  key={i}
                                  className={
                                    c.passed ? 'text-slate-700' : 'text-red-700'
                                  }
                                >
                                  {c.questionId} · {c.label} · {c.result.state}{' '}
                                  ({c.result.code})
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Dix rapports les plus récents. Un résultat réussi ne remplace pas la
        relecture humaine.
      </p>
    </section>
  );
}
