import React from 'react';
import { createRoot } from 'react-dom/client';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { DraftMetadataForm } from '../../src/components/draft-metadata-form';
import { WorkspaceNav } from './workspace-nav';
import fixture from '../fixtures/preview-definition.json';
import { EditorRecoveryScope } from '../../src/components/editor-recovery-scope';

function Creator() {
  return (
    <>
      <WorkspaceNav />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <span className="badge">Exercice fictif · essai local</span>
        <h1 className="text-3xl font-semibold">Créer et tester un exercice</h1>
        <div className="notice">
          <p>
            Modifiez cet exemple, puis utilisez la validation et l’aperçu plus
            bas. Le moteur Linux doit être lancé pour les calculs. La sauvegarde
            en base reste indisponible. Activez la copie de récupération si vous
            souhaitez retrouver votre saisie après un rechargement de cet
            onglet.
          </p>
          <p className="mt-2">
            Pour le premier essai, générez une instance, répondez à la question
            puis lancez les tests avec une réponse volontairement incorrecte,
            par exemple 0 pour cet exemple initial.
          </p>
        </div>
        <EditorRecoveryScope scope="synthetic-creator-bench">
          <DraftMetadataForm definition={fixture as ExerciseDefinition} />
        </EditorRecoveryScope>
      </main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Creator />);
