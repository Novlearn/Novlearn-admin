'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CatalogueAction({
  action,
  exerciseId,
  versionId,
  archived,
}: {
  action: 'duplicate' | 'archive';
  exerciseId: string;
  versionId?: string;
  archived?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const label =
    action === 'duplicate' ? 'Dupliquer' : archived ? 'Restaurer' : 'Archiver';
  async function run() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/exercises', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          action === 'duplicate'
            ? { action, versionId }
            : {
                action,
                exerciseId,
                expectedArchived: !!archived,
                archived: !archived,
              },
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Opération impossible.');
        return;
      }
      if (action === 'duplicate')
        router.push(
          `/admin/exercises/${data.result.exerciseId}?version=${data.result.versionId}&saved=1`,
        );
      setConfirm(false);
      router.refresh();
    } catch {
      setError('Connexion interrompue. Réessayez.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-400 disabled:opacity-50"
        onClick={() => setConfirm(true)}
      >
        {label}
      </button>
      {confirm && (
        <div
          className="mt-3 max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4"
          role="group"
          aria-label={`Confirmer : ${label}`}
        >
          <p className="text-sm leading-6">
            {action === 'duplicate'
              ? 'Créer un nouveau brouillon indépendant à partir de cette version ?'
              : archived
                ? 'Rendre cet exercice éditable dans le catalogue Staging ?'
                : 'Archiver cet exercice dans le catalogue Admin ? Ses versions et tentatives seront conservées. Sa version active ne change pas.'}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={run}
            >
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
            <button
              type="button"
              className="px-3 text-sm text-slate-600"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
