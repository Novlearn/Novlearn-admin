'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PublicationResult } from './publication-panel';
import {
  requestPublication,
  type PublicationHistoryItem,
  type PublicationSummary,
} from '@/lib/publication-view';
export function PublicationHistoryActions({
  item,
  enabled,
  localFixture = false,
}: {
  item: PublicationHistoryItem;
  enabled: boolean;
  localFixture?: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<PublicationSummary | null>(null),
    [cancelConfirm, setCancelConfirm] = useState(false);
  const pending = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function run(action: 'recover' | 'cancel') {
    if (pending.current || !enabled) return;
    pending.current = true;
    setBusy(true);
    setError('');
    controller.current = new AbortController();
    try {
      const data = await requestPublication(
        { action, operationId: item.id },
        controller.current.signal,
        localFixture ? 'local-fixture' : 'operational',
      );
      if (!mounted.current) return;
      if (
        'operation' in data ||
        data.sourceVersionId !== item.versionId ||
        data.catalogId !== item.catalogId ||
        data.mode !== item.mode
      )
        throw Error('Le résultat ne correspond pas à cette opération.');
      setResult(data);
      setCancelConfirm(false);
      router.refresh();
    } catch (failure) {
      if (mounted.current) {
        setCancelConfirm(false);
        setError(
          failure instanceof Error
            ? failure.message
            : 'Résultat non confirmé. Vérifiez à nouveau cette opération.',
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3" aria-busy={busy}>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {result && <PublicationResult operation={result} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !enabled}
          className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
          onClick={() => void run('recover')}
        >
          {busy ? 'Vérification…' : 'Vérifier le résultat'}
        </button>
        {(result?.state ?? item.state) === 'planned' && (
          <button
            type="button"
            disabled={busy || !enabled}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={() => setCancelConfirm(true)}
          >
            Annuler ce plan
          </button>
        )}
      </div>
      {cancelConfirm && (
        <div
          role="group"
          aria-label="Confirmer l’annulation du plan"
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
        >
          <p>Annuler ce plan en attente ? Aucun transfert ne sera lancé.</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              className="button"
              disabled={busy || !enabled}
              onClick={() => void run('cancel')}
            >
              Confirmer l’annulation
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCancelConfirm(false)}
            >
              Conserver le plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
