import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { WorkspaceNav } from './workspace-nav';
import { PublicationPanel } from '../../src/components/publication-panel';
import { PublicationHistoryActions } from '../../src/components/publication-history-actions';
import type {
  PreparedPublication,
  PublicationSummary,
  PublicationHistoryItem,
} from '../../src/lib/publication-view';
const versionId = '97000000-0000-4000-8000-000000000001',
  catalogId = '97000000-0000-4000-8000-000000000002';
type Scenario =
  | 'normal'
  | 'unchanged'
  | 'lost'
  | 'uncertain'
  | 'failed'
  | 'expired'
  | 'conflict'
  | 'disabled';
function PublicationFixture() {
  const [scenario, setScenario] = useState<Scenario>('normal'),
    [ready, setReady] = useState(false),
    [operation, setOperation] = useState<PublicationSummary | null>(null),
    [history, setHistory] = useState(false),
    [calls, setCalls] = useState<string[]>([]);
  useEffect(() => {
    const original = window.fetch;
    let current: PublicationSummary | null = null,
      observations = 0;
    setReady(false);
    setOperation(null);
    setHistory(false);
    setCalls([]);
    window.fetch = async (input, options) => {
      if (String(input) !== '/api/admin/publication')
        return original(input, options);
      const command = JSON.parse(String(options?.body));
      setCalls((previous) => [...previous, command.action]);
      const respond = (result: unknown, status = 200) =>
        new Response(
          JSON.stringify({
            sourceEnvironment: 'staging',
            targetEnvironment: 'production',
            result,
          }),
          { status, headers: { 'content-type': 'application/json' } },
        );
      if (command.action === 'prepare') {
        if (scenario === 'conflict')
          return new Response(
            JSON.stringify({
              code: 'conflict',
              error:
                'Conflit simulé : le contenu a changé. Rechargez et préparez un nouveau diff.',
            }),
            { status: 409 },
          );
        current = {
          id: crypto.randomUUID(),
          batchId: command.batchId,
          sourceVersionId: versionId,
          catalogId,
          revision: 2,
          mode: command.mode,
          state: 'planned',
          expiresAt: new Date(
            Date.now() + (scenario === 'expired' ? -1000 : 900000),
          ).toISOString(),
          outcome: null,
          error: null,
        };
        const prepared: PreparedPublication = {
          operation: current,
          confirmation: 'c2ltdWxhdGlvbg.' + 'a'.repeat(64),
          plan: {
            action:
              scenario === 'unchanged'
                ? 'unchanged'
                : command.mode === 'rollback'
                  ? 'rollback'
                  : 'append_revision',
            mode: command.mode,
            catalogId,
            revision: 2,
            businessDigest: 'a'.repeat(64),
            stateToken: 'b'.repeat(64),
            targetExerciseId: '9007199254740993',
            previousRevision: command.mode === 'rollback' ? 3 : 1,
            headerChanges:
              scenario === 'unchanged'
                ? []
                : [
                    {
                      path: '/title',
                      before: 'Calculer une expression',
                      after: 'Calculer et expliquer son raisonnement',
                    },
                  ],
            definitionChanges:
              scenario === 'unchanged'
                ? []
                : [
                    {
                      path: '/elements/0/text',
                      before: 'Calculez cette expression.',
                      after:
                        'Calculez cette expression puis justifiez votre réponse.',
                    },
                    { path: '/elements/1/points', before: 1, after: 2 },
                  ],
          },
        };
        setOperation(current);
        return respond(prepared);
      }
      if (!current || current.id !== command.operationId)
        return new Response(
          JSON.stringify({ error: 'Opération simulée introuvable.' }),
          { status: 404 },
        );
      const committed = () => ({
        ...current!,
        state: 'committed' as const,
        outcome: {
          catalogId,
          revision: 2,
          businessDigest: 'a'.repeat(64),
          exerciseId: '9007199254740993',
          versionId: '97000000-0000-4000-8000-000000000003',
          stateToken: 'c'.repeat(64),
          result:
            scenario === 'unchanged' || command.action === 'recover'
              ? ('unchanged' as const)
              : current!.mode === 'rollback'
                ? ('rolled_back' as const)
                : ('published' as const),
        },
        error: null,
      });
      if (command.action === 'cancel')
        current = {
          ...current,
          state: 'cancelled',
          outcome: null,
          error: null,
        };
      else if (command.action === 'confirm') {
        current =
          scenario === 'failed'
            ? { ...current, state: 'failed', error: 'not_applied' }
            : scenario === 'uncertain'
              ? { ...current, state: 'uncertain' }
              : committed();
        setOperation(current);
        if (scenario === 'lost')
          throw Error(
            'SIMULATED ACKNOWLEDGEMENT LOSS: no actual network or transfer',
          );
      } else if (
        command.action === 'recover' &&
        current.state === 'uncertain'
      ) {
        observations++;
        if (observations >= 2) current = committed();
      }
      setOperation(current);
      return respond(current, current.state === 'uncertain' ? 202 : 200);
    };
    setReady(true);
    return () => {
      window.fetch = original;
    };
  }, [scenario]);
  const item: PublicationHistoryItem | null = operation
    ? {
        id: operation.id,
        batchId: operation.batchId,
        versionId: operation.sourceVersionId,
        catalogId: operation.catalogId,
        targetKey: 'local-ui-simulation',
        mode: operation.mode,
        state: operation.state,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorCode: operation.error,
      }
    : null;
  return (
    <>
      <WorkspaceNav />
      <main className="mx-auto max-w-6xl space-y-7 px-6 py-10">
        <header>
          <p className="text-sm font-semibold text-blue-700">
            Essai local · simulation d’interface
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Diff, confirmation et reprise de publication
          </h1>
        </header>
        <section className="notice space-y-2">
          <p className="font-semibold">
            Aucun transfert ni enregistrement en base.
          </p>
          <p>
            Les réponses de ce parcours sont entièrement simulées. Les tests
            Engine, Auth et PostgreSQL ne s’exécutent pas ici. Le rechargement
            efface cette simulation.
          </p>
        </section>
        <section className="card space-y-4">
          <label className="block text-sm font-semibold">
            Situation à essayer
            <select
              className="field mt-2"
              value={scenario}
              onChange={(event) => setScenario(event.target.value as Scenario)}
            >
              {(
                [
                  ['normal', 'Transfert confirmé'],
                  ['unchanged', 'Contenu déjà identique'],
                  ['lost', 'Réponse perdue après confirmation'],
                  [
                    'uncertain',
                    'Résultat incertain, établi à la seconde vérification',
                  ],
                  ['failed', 'Transfert non appliqué'],
                  ['expired', 'Plan expiré'],
                  ['conflict', 'Contenu modifié pendant la préparation'],
                  ['disabled', 'Publication désactivée'],
                ] as const
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-500">
            Préparez le diff, relisez-le, cochez la confirmation puis confirmez.
            Pour une réponse perdue ou incertaine, essayez « Vérifier le
            résultat ».
          </p>
          <button
            type="button"
            className="font-semibold text-blue-700 underline"
            onClick={() => setHistory((value) => !value)}
          >
            {history ? 'Retour au panneau' : 'Afficher l’historique simulé'}
          </button>
        </section>
        {ready && !history && (
          <div
            onClickCapture={(event) => {
              const anchor = (event.target as HTMLElement).closest('a');
              if (anchor?.getAttribute('href') === '/admin/publication') {
                event.preventDefault();
                setHistory(true);
              }
            }}
          >
            <PublicationPanel
              key={scenario}
              versionId={versionId}
              fingerprint={'d'.repeat(64)}
              epoch="0"
              revision={2}
              status="approved"
              enabled={scenario !== 'disabled'}
            />
          </div>
        )}
        {history && (
          <section className="card space-y-4">
            <h2 className="text-xl font-semibold">Historique simulé</h2>
            {item ? (
              <PublicationHistoryActions
                key={item.id}
                item={item}
                enabled={scenario !== 'disabled'}
              />
            ) : (
              <p>Aucun plan dans cette simulation. Préparez d’abord un diff.</p>
            )}
          </section>
        )}
        <section className="card">
          <h2 className="font-semibold">Actions demandées par l’interface</h2>
          <p className="mt-3 break-words text-sm text-slate-600" role="status">
            {calls.length ? calls.join(' → ') : 'Aucune action.'}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            « recover » vérifie un résultat ; cette simulation n’envoie aucune
            requête au serveur de publication.
          </p>
        </section>
      </main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<PublicationFixture />);
