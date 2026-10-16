import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { WorkspaceNav } from './workspace-nav';
import { PublicationBatchPanel } from '../../src/components/publication-batch-panel';
import type { BatchCandidate } from '../../src/lib/publication-batch';
import type {
  PublicationCommand,
  PublicationSummary,
} from '../../src/lib/publication-view';
import { planPublication } from '../../src/lib/publication';
import native from '../fixtures/publication-journal-sql.json';
const id = (i: number, family = 1) =>
  `a7200000-0000-4000-800${family}-${String(i).padStart(12, '0')}`;
const batch = id(1, 9);
const candidates: BatchCandidate[] = [1, 2, 3].map((i) => ({
  versionId: id(i),
  exerciseId: String(i),
  catalogId: id(i, 2),
  title: 'Exercice de démonstration ' + i,
  revision: 1,
  fingerprint: 'a'.repeat(64),
  epoch: '0',
  status: 'approved',
  archived: false,
}));
const items = candidates.map((c) => ({
  versionId: c.versionId,
  operationId: null,
}));
function Fixture() {
  const [scenario, setScenario] = useState('partial'),
    [ready, setReady] = useState(false),
    [trace, setTrace] = useState<string[]>([]);
  useEffect(() => {
    const original = window.fetch,
      operations = new Map<string, PublicationSummary>();
    setTrace([]);
    window.fetch = async (input, init) => {
      if (String(input) !== '/api/admin/publication')
        return original(input, init);
      const command = JSON.parse(String(init?.body)) as PublicationCommand;
      const i = Number(
        ('versionId' in command
          ? command.versionId
          : command.operationId
        ).slice(-12),
      );
      setTrace((previous) => [
        ...previous,
        command.action + ' · exercice ' + i,
      ]);
      const packet = (result: unknown, status = 200) =>
        new Response(
          JSON.stringify({
            sourceEnvironment: 'staging',
            targetEnvironment: 'production',
            result,
          }),
          { status, headers: { 'content-type': 'application/json' } },
        );
      if (command.action === 'prepare') {
        const operation: PublicationSummary = {
          id: id(i, 3),
          batchId: command.batchId,
          sourceVersionId: id(i),
          catalogId: id(i, 2),
          revision: 1,
          mode: 'publish',
          state: 'planned',
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          outcome: null,
          error: null,
        };
        operations.set(operation.id, operation);
        return packet({
          operation,
          plan: {
            ...planPublication(native.payload, native.inspection, 'publish'),
            catalogId: id(i, 2),
          },
          confirmation: 'Zml4dHVyZQ.' + 'a'.repeat(64),
        });
      }
      const current = operations.get(command.operationId);
      if (!current)
        return new Response(
          JSON.stringify({ error: 'Opération simulée introuvable.' }),
          { status: 404 },
        );
      const committed = (): PublicationSummary => ({
        ...current,
        state: 'committed',
        outcome: {
          ...native.outcome,
          result: 'published',
          catalogId: id(i, 2),
        },
        error: null,
      });
      if (command.action === 'confirm') {
        if (scenario === 'partial' && i === 2)
          operations.set(current.id, { ...current, state: 'uncertain' });
        else if (scenario === 'failed' && i === 2)
          operations.set(current.id, {
            ...current,
            state: 'failed',
            error: 'not_applied',
          });
        else operations.set(current.id, committed());
        if (scenario === 'lost' && i === 2)
          throw Error('Simulation : réponse perdue après confirmation.');
      } else if (command.action === 'recover' && current.state === 'uncertain')
        operations.set(current.id, committed());
      else if (command.action === 'cancel' && current.state === 'planned')
        operations.set(current.id, { ...current, state: 'cancelled' });
      const result = operations.get(current.id)!;
      return packet(result, result.state === 'uncertain' ? 202 : 200);
    };
    setReady(true);
    return () => {
      window.fetch = original;
    };
  }, [scenario]);
  return (
    <>
      <WorkspaceNav />
      <main className="mx-auto max-w-6xl space-y-7 px-6 py-10">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            Essai local · simulation d’interface
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Publication par lots</h1>
        </header>
        <section className="notice space-y-2">
          <p className="font-semibold">
            Tous les résultats de cette page sont simulés.
          </p>
          <p>
            Aucun compte Auth, calcul Engine, rapport, journal ou transfert SQL
            n’est exécuté. Le rechargement efface cette simulation. La
            publication réelle reste fermée.
          </p>
        </section>
        <section className="card">
          <label className="label">
            Situation à essayer
            <select
              className="field"
              value={scenario}
              onChange={(e) => {
                setReady(false);
                setScenario(e.target.value);
              }}
            >
              <option value="partial">Deuxième résultat incertain</option>
              <option value="lost">
                Réponse perdue après le deuxième transfert
              </option>
              <option value="failed">Deuxième transfert non appliqué</option>
              <option value="success">Trois résultats confirmés</option>
            </select>
          </label>
        </section>
        {ready && (
          <PublicationBatchPanel
            key={scenario}
            batchId={batch}
            items={items}
            candidates={candidates}
            enabled
            persistCheckpoint={false}
          />
        )}
        <section className="card">
          <h2 className="font-semibold">Requêtes de cette simulation</h2>
          <p className="mt-2 text-sm text-slate-600">
            Après un résultat incertain ou une réponse perdue, la troisième
            confirmation ne doit pas être envoyée. La vérification utilise
            seulement recover.
          </p>
          <ol className="mt-3 list-inside list-decimal text-sm">
            {trace.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
