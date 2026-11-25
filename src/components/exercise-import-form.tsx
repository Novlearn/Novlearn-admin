'use client';

import { useMemo, useState, type ChangeEvent } from 'react';

type BatchItem = {
  sourceKey: string;
  definition: {
    schemaVersion: number;
    kind: string;
    catalogue?: { chapter?: unknown };
  };
};
type Batch = { schemaVersion: number; batchId: string; items: BatchItem[] };
type ImportResult =
  | { state: 'created' | 'reused'; href: string }
  | { state: 'failed'; message: string };
const uuidV4 =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxItemBytes = 262144;
const maxBatchBytes = 20 * maxItemBytes;

function parseBatch(source: string): Batch {
  const input = source.replace(/^\uFEFF/, '').trim();
  const fenced = input.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i);
  const batch: unknown = JSON.parse(fenced?.[1] ?? input);
  if (
    !batch ||
    typeof batch !== 'object' ||
    Array.isArray(batch) ||
    (batch as Batch).schemaVersion !== 5 ||
    !uuidV4.test((batch as Batch).batchId ?? '') ||
    !Array.isArray((batch as Batch).items) ||
    (batch as Batch).items.length < 1 ||
    (batch as Batch).items.length > 20
  )
    throw new Error(
      'Le lot doit être au schéma 5 et contenir 1 à 20 exercices avec un batchId UUID v4.',
    );

  const items = (batch as Batch).items;
  const sourceKeys = new Set<string>();
  for (const item of items) {
    if (
      !item ||
      typeof item.sourceKey !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(item.sourceKey) ||
      sourceKeys.has(item.sourceKey) ||
      item.definition?.schemaVersion !== 5 ||
      item.definition?.kind !== 'composed' ||
      typeof item.definition.catalogue?.chapter !== 'string' ||
      !item.definition.catalogue.chapter.trim()
    )
      throw new Error(
        'Une sourceKey est invalide ou dupliquée, ou une définition canonique n’a pas de chapitre.',
      );
    sourceKeys.add(item.sourceKey);
    const body = JSON.stringify({
      batchId: (batch as Batch).batchId,
      sourceKey: item.sourceKey,
      definition: item.definition,
    });
    if (new TextEncoder().encode(body).byteLength > maxItemBytes)
      throw new Error(`${item.sourceKey} dépasse la limite de 256 Kio.`);
  }
  return batch as Batch;
}

export function ExerciseImportForm() {
  const [source, setSource] = useState('');
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const parsed = useMemo(() => {
    if (!source.trim()) return null;
    try {
      return { batch: parseBatch(source), error: '' };
    } catch (cause) {
      return {
        batch: null,
        error: cause instanceof Error ? cause.message : 'JSON invalide.',
      };
    }
  }, [source]);

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError('');
    setNotice('');
    if (!file) return;
    if (file.size > maxBatchBytes) {
      setError('Le fichier dépasse 5 Mio.');
      return;
    }
    try {
      setSource(await file.text());
      setResults({});
    } catch {
      setError('Impossible de lire ce fichier.');
    }
  }

  async function importBatch() {
    if (!parsed?.batch || busy) return;
    setBusy(true);
    setError('');
    setNotice('Import Staging en cours…');
    const batch = parsed.batch;
    const nextResults = { ...results };
    for (const item of batch.items) {
      if (
        nextResults[item.sourceKey]?.state === 'created' ||
        nextResults[item.sourceKey]?.state === 'reused'
      )
        continue;
      try {
        const response = await fetch('/api/admin/exercises/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: batch.batchId,
            sourceKey: item.sourceKey,
            definition: item.definition,
          }),
          redirect: 'error',
        });
        const result = await response.json();
        if (
          response.ok &&
          result.environment === 'staging' &&
          /^\d+$/.test(String(result.exerciseId)) &&
          typeof result.reused === 'boolean'
        ) {
          nextResults[item.sourceKey] = {
            state: result.reused ? 'reused' : 'created',
            href: `/admin/exercises/${result.exerciseId}`,
          };
        } else {
          nextResults[item.sourceKey] = {
            state: 'failed',
            message:
              typeof result.error === 'string'
                ? result.error
                : `Échec HTTP ${response.status}.`,
          };
        }
      } catch {
        nextResults[item.sourceKey] = {
          state: 'failed',
          message:
            'Réponse non confirmée. Relance ce lot avec le même batchId.',
        };
      }
      setResults({ ...nextResults });
    }
    const confirmed = batch.items.filter((item) =>
      ['created', 'reused'].includes(nextResults[item.sourceKey]?.state ?? ''),
    ).length;
    setNotice(
      `${confirmed}/${batch.items.length} brouillon(s) confirmé(s) dans Staging.`,
    );
    setBusy(false);
  }

  return (
    <div className="mt-5 space-y-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Coller le JSON du lot
        <textarea
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setResults({});
            setError('');
            setNotice('');
          }}
          disabled={busy}
          rows={8}
          maxLength={maxBatchBytes}
          placeholder={
            '```json\n{"schemaVersion":5,"batchId":"…","items":[…]}\n```'
          }
          className="resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          aria-label="JSON des exercices à importer"
        />
      </label>
      <label className="block text-sm text-slate-700">
        Ou choisir un fichier JSON{' '}
        <input
          type="file"
          accept=".json,application/json"
          onChange={readFile}
          disabled={busy}
          className="mt-2 block w-full rounded-lg border border-slate-300 p-2"
        />
      </label>
      {parsed?.error && (
        <p role="alert" className="text-sm text-rose-800">
          {parsed.error}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-slate-700">
          {notice}
        </p>
      )}
      <button
        type="button"
        onClick={importBatch}
        disabled={busy || !parsed?.batch}
        className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Import en cours…' : 'Importer les brouillons dans Staging'}
      </button>
      {parsed?.batch && (
        <p className="text-xs text-slate-500">
          Lot {parsed.batch.batchId} · {parsed.batch.items.length} exercice(s) ·
          les éléments déjà confirmés seront ignorés lors d’une reprise.
        </p>
      )}
      {parsed?.batch && Object.keys(results).length > 0 && (
        <ul className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
          {parsed.batch.items.map((item) => {
            const result = results[item.sourceKey];
            return (
              <li key={item.sourceKey}>
                <span className="mr-2 font-mono">{item.sourceKey}</span>
                {result?.state === 'created' || result?.state === 'reused' ? (
                  <a
                    className="font-medium text-blue-700 underline"
                    href={result.href}
                  >
                    {result.state === 'created'
                      ? 'Brouillon créé'
                      : 'Déjà importé'}{' '}
                    · ouvrir
                  </a>
                ) : result?.state === 'failed' ? (
                  <span className="text-rose-800">
                    Échec · {result.message}
                  </span>
                ) : (
                  <span className="text-slate-500">En attente</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
