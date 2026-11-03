'use client';
import { useState } from 'react';

export function EngineQualificationPanel() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState('');
  return (
    <section className="card space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Banc synthétique protégé : validation, instanciation, rejeu, projection
        et correction par le host officiel, avec les quotas Engine habituels.
        Les résultats décrivent uniquement cet hôte et cette archive.
      </p>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setReport(null);
          setError('');
          try {
            const response = await fetch('/api/admin/engine/qualification', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
              signal: AbortSignal.timeout(25000),
            });
            const body = await response.json();
            if (!response.ok) {
              setError(body.error ?? 'Qualification indisponible.');
              return;
            }
            setReport(body.result);
          } catch {
            setError('Qualification interrompue ou indisponible.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? 'Qualification en cours…'
          : 'Qualifier cet hôte avec la fixture synthétique'}
      </button>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {report !== null && (
        <div role="status">
          <h2 className="mb-3 font-semibold">Résultat du banc sur cet hôte</h2>
          <pre className="max-h-[40rem] overflow-auto rounded-lg bg-slate-50 p-4 text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
