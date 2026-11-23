'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  catalogueSyncPage,
  type CatalogueSyncCandidate,
  type CatalogueSyncReceipt,
} from '@/lib/catalogue-sync';

type PreviewItem = {
  kind: string;
  catalogId: string;
  fingerprint: string;
  action: 'upsert' | 'archive';
  status: string;
  revision: number | null;
  expiresAt: string;
  data?: Record<string, unknown>;
  dependencies: Record<string, unknown>[];
};
const kindLabel: Record<string, string> = {
  chapter: 'Chapitre',
  competence: 'Compétence',
  flashcard: 'Flashcard',
  exercise: 'Exercice',
};
const resultLabel: Record<string, string> = {
  applied: 'Appliqué',
  unchanged: 'Déjà identique',
  archived: 'Archivé, ligne conservée',
};

async function request(body: unknown) {
  const response = await fetch('/api/admin/catalogue-sync', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(result?.error ?? 'Synchronisation indisponible.');
  return result;
}

export function CatalogueSyncPanel({
  initialItems,
  next: initialNext,
  resume = null,
}: {
  initialItems: CatalogueSyncCandidate[];
  next: string | null;
  resume?: { batchId: string; payloadDigest: string } | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState(initialNext);
  const [selected, setSelected] = useState<
    Record<string, CatalogueSyncCandidate>
  >({});
  const [preview, setPreview] = useState<{
    batchId: string;
    payloadDigest: string;
    items: PreviewItem[];
  } | null>(resume ? { ...resume, items: [] } : null);
  const [receipt, setReceipt] = useState<CatalogueSyncReceipt | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'uncertain' | 'failed'
  >(resume ? 'uncertain' : 'idle');
  const [error, setError] = useState('');

  const toggle = (item: CatalogueSyncCandidate) =>
    setSelected((current) => {
      const copy = { ...current },
        key = `${item.kind}:${item.catalogId}`;
      if (copy[key]) delete copy[key];
      else if (Object.keys(copy).length < 100) copy[key] = item;
      return copy;
    });
  async function loadMore() {
    if (!next || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const response = await fetch(
        `/api/admin/catalogue-sync?after=${encodeURIComponent(next)}`,
        { cache: 'no-store' },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? 'Lecture Staging indisponible.');
      const page = catalogueSyncPage(body.result);
      if (!page) throw new Error('Réponse du catalogue non reconnue.');
      setItems((old) => [...old, ...page.items]);
      setNext(page.next);
      setStatus('idle');
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Lecture indisponible.',
      );
      setStatus('idle');
    }
  }
  async function prepare() {
    const values = Object.values(selected);
    if (!values.length || preview) return;
    setStatus('loading');
    setError('');
    setReceipt(null);
    const batchId = crypto.randomUUID();
    try {
      const body = await request({ action: 'prepare', batchId, items: values });
      const result = body.result;
      if (
        !result ||
        result.batchId !== batchId ||
        typeof result.payloadDigest !== 'string' ||
        !Array.isArray(result.items)
      )
        throw new Error('Aperçu du lot non reconnu.');
      setPreview(result);
      setStatus('idle');
      window.history.replaceState(
        window.history.state,
        '',
        `/admin/catalogue-sync?batch=${batchId}&digest=${result.payloadDigest}`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Préparation refusée.',
      );
      setStatus('failed');
    }
  }
  async function confirm() {
    if (!preview) return;
    setStatus('loading');
    setError('');
    try {
      const body = await request({
        action: 'confirm',
        batchId: preview.batchId,
        payloadDigest: preview.payloadDigest,
      });
      if (body.result?.state === 'committed' && body.result.receipt) {
        setReceipt(body.result.receipt);
        setStatus('idle');
        router.refresh();
      } else {
        setStatus('uncertain');
        setError(
          'Le lot n’est pas confirmé. Vérifiez son résultat avant toute nouvelle action.',
        );
      }
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : 'Résultat non confirmé.';
      setError(message);
      if (/23503|40001|lot a changé/i.test(message)) {
        setPreview(null);
        setStatus('failed');
        window.history.replaceState(
          window.history.state,
          '',
          '/admin/catalogue-sync',
        );
      } else setStatus('uncertain');
    }
  }
  async function recover() {
    if (!preview) return;
    setStatus('loading');
    setError('');
    try {
      const body = await request({
        action: 'recover',
        batchId: preview.batchId,
        payloadDigest: preview.payloadDigest,
      });
      if (body.result?.state === 'committed' && body.result.receipt) {
        setReceipt(body.result.receipt);
        setStatus('idle');
        router.refresh();
      } else if (body.result?.state === 'failed') {
        setPreview(null);
        setStatus('failed');
        setError(
          'La cible a confirmé que ce lot n’a pas été appliqué. Préparez un nouveau lot après avoir actualisé le catalogue.',
        );
        window.history.replaceState(
          window.history.state,
          '',
          '/admin/catalogue-sync',
        );
      } else {
        setStatus('uncertain');
        setError(
          'La cible ne permet pas encore de conclure. Réessayez la vérification plus tard.',
        );
      }
    } catch (failure) {
      setStatus('uncertain');
      setError(
        failure instanceof Error
          ? failure.message
          : 'Vérification indisponible.',
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Éléments prêts</h2>
            <p className="mt-1 text-sm text-slate-600">
              {Object.keys(selected).length} sélectionné(s) · maximum 100 par
              lot
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className="button"
              type="button"
              disabled={
                !Object.keys(selected).length ||
                status === 'loading' ||
                !!preview
              }
              onClick={() => void prepare()}
            >
              {status === 'loading' && !preview
                ? 'Inspection et préparation…'
                : 'Préparer l’aperçu'}
            </button>
            {next && (
              <button
                className="rounded-lg border border-slate-300 px-4 py-3 font-semibold"
                type="button"
                disabled={status === 'loading'}
                onClick={() => void loadMore()}
              >
                Charger la suite
              </button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {status === 'uncertain' && (
          <button
            className="rounded-lg border border-amber-300 px-4 py-2 font-semibold text-amber-900"
            type="button"
            onClick={() => void recover()}
          >
            Vérifier le résultat du lot
          </button>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun élément prêt à synchroniser.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Inclure</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Identité de catalogue</th>
                  <th className="p-3">État source</th>
                  <th className="p-3">Révision</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const key = `${item.kind}:${item.catalogId}`;
                  return (
                    <tr className="border-t border-slate-100" key={key}>
                      <td className="p-3">
                        <input
                          aria-label={`Inclure ${kindLabel[item.kind]} ${item.catalogId}`}
                          type="checkbox"
                          disabled={
                            item.status === 'blocked' ||
                            status === 'loading' ||
                            (!!preview && !receipt)
                          }
                          checked={!!selected[key]}
                          onChange={() => toggle(item)}
                        />
                      </td>
                      <td className="p-3">
                        {kindLabel[item.kind]}
                        {item.status === 'blocked' ? ' · bloqué' : ''}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {item.catalogId}
                      </td>
                      <td className="p-3">{item.status}</td>
                      <td className="p-3">{item.revision ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && !receipt && preview.items.length > 0 && (
        <section className="card space-y-5">
          <header>
            <h2 className="text-xl font-semibold">
              Aperçu de toutes les opérations
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Le lot est appliqué atomiquement. Une erreur 23503 ou 40001 arrête
              le lot sans succès annoncé.
            </p>
          </header>
          {preview.items.map((item) => (
            <article
              className="rounded-xl border border-slate-200 p-4"
              key={`${item.kind}:${item.catalogId}`}
            >
              <h3 className="font-semibold">
                {kindLabel[item.kind]} ·{' '}
                {item.action === 'archive'
                  ? 'archiver en conservant la ligne'
                  : 'créer ou mettre à jour'}
              </h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-600">
                {item.catalogId}
                {item.revision ? ` · révision ${item.revision}` : ''}
              </p>
              {item.kind === 'chapter' && item.action === 'upsert' && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
                  Si ce chapitre est renommé, incluez toutes ses flashcards
                  actives concernées et chaque exercice concerné avec une
                  nouvelle révision. La cible rejettera un lot incomplet avec
                  23503.
                </p>
              )}
              {!!item.dependencies.length && (
                <p className="mt-3 text-sm">
                  Dépendances stables incluses :{' '}
                  {item.dependencies
                    .map((d) => `${String(d.kind)} ${String(d.catalogId)}`)
                    .join(' · ')}
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Voir les données et l’effet prévu
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs">
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              </details>
              <p className="mt-2 text-xs text-slate-500">
                Plan source valable jusqu’au{' '}
                {new Date(item.expiresAt).toLocaleString('fr-FR', {
                  timeZone: 'Europe/Paris',
                })}
                .
              </p>
            </article>
          ))}
          {status !== 'uncertain' && (
            <div className="flex flex-wrap gap-3">
              <button
                className="button"
                type="button"
                disabled={status === 'loading'}
                onClick={() => void confirm()}
              >
                {status === 'loading'
                  ? 'Vérification et synchronisation…'
                  : `Confirmer les ${preview.items.length} opérations`}
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-3 font-semibold"
                type="button"
                disabled={status === 'loading'}
                onClick={() => {
                  setPreview(null);
                  setSelected({});
                  window.history.replaceState(
                    window.history.state,
                    '',
                    '/admin/catalogue-sync',
                  );
                }}
              >
                Abandonner cet aperçu
              </button>
            </div>
          )}
        </section>
      )}

      {receipt && (
        <section className="card space-y-4" role="status">
          <h2 className="text-xl font-semibold text-green-800">
            Lot confirmé par le reçu cible
          </h2>
          <p className="break-all font-mono text-xs text-slate-600">
            Lot {receipt.batchId} · reçu {receipt.stateToken}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Identité</th>
                  <th className="p-3">Résultat</th>
                  <th className="p-3">Identifiant cible</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => (
                  <tr
                    key={`${item.kind}:${item.catalogId}`}
                    className="border-t border-slate-100"
                  >
                    <td className="p-3">{kindLabel[item.kind]}</td>
                    <td className="p-3 font-mono text-xs">{item.catalogId}</td>
                    <td className="p-3">{resultLabel[item.result]}</td>
                    <td className="p-3 font-mono text-xs">{item.targetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-600">
            Toutes les opérations du reçu sont affichées. Les archives
            conservent leurs lignes; les anciennes révisions publiées restent
            immuables.
          </p>
        </section>
      )}
    </div>
  );
}
