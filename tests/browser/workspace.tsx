import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { WorkspaceNav } from './workspace-nav';

function Workspace() {
  const [engine, setEngine] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/__local/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => {
        if (active)
          setEngine(
            status?.synthetic === true &&
              status?.database === false &&
              status?.engine === true,
          );
      })
      .catch(() => {
        if (active) setEngine(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const cards = [
    [
      'Figures et vecteurs',
      'coordinates.html',
      'Examiner les projections publiques réellement capturées du moteur : vecteurs 2D/3D, droite traversant la fenêtre, fractions et description des objets. Cette page ne lance aucun calcul.',
    ],
    [
      'Lot de publication simulé',
      'publication-batch.html',
      'Préparer trois diffs, confirmer les exercices relus et observer un résultat partiel. Aucune donnée n’est transférée par cette simulation.',
    ],
    [
      'Publication simulée',
      'publication.html',
      'Relire un diff, confirmer et essayer les états de réponse perdue ou de reprise. Tous les résultats de ce parcours sont simulés ; aucun exercice n’est transféré.',
    ],
    [
      'Creator et tests',
      'creator.html',
      'Modifier un exercice exemple, saisir les expressions avec MathLive, générer une instance, répondre et lancer les tests par seed.',
    ],
    [
      'Catalogue',
      'catalogue.html',
      'Examiner la liste et ses statuts, le formulaire de brouillon et les états vide ou indisponible. Les liens vers les fiches réelles ne sont pas reliés.',
    ],
    [
      'Chapitres et compétences',
      'taxonomy.html',
      'Essayer les formulaires, les confirmations et la conservation des champs en cas de conflit simulé.',
    ],
    [
      'Flashcards',
      'flashcards.html',
      'Modifier le recto et le verso, insérer des expressions et vérifier l’aperçu ainsi que les différents états.',
    ],
    [
      'Saisie mathématique',
      'math-input.html',
      'Essayer le clavier scientifique, les fractions, racines, puissances et intervalles.',
    ],
  ];
  return (
    <>
      <WorkspaceNav />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <header>
          <div className="flex items-center gap-3">
            <object
              data="/logo/novlearn-logo-ui.svg"
              type="image/svg+xml"
              aria-label="Logo NovLearn"
              className="h-9 w-9"
            >
              NovLearn
            </object>
            <span className="font-brand text-2xl font-medium">
              NovLearn Admin
            </span>
            <span className="badge">Essai local</span>
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight">
            Essayer les écrans au fil du développement
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">
            Cet espace utilise les composants de l’Admin avec des exemples
            fictifs. Il ne demande aucun compte et ne se connecte à aucune base
            Staging ou Production.
          </p>
        </header>
        <section className="notice" aria-labelledby="workspace-status">
          <h2 id="workspace-status" className="font-semibold">
            Ce que vous pouvez tester ici
          </h2>
          <p className="mt-2" role="status">
            {engine === null
              ? 'Vérification du moteur local…'
              : engine
                ? 'Le vrai moteur Linux est prêt : validation, génération, correction et tests par seed sont disponibles dans le Creator.'
                : 'Le moteur Linux n’est pas connecté : les formulaires et MathLive restent disponibles, les calculs afficheront une indisponibilité.'}
          </p>
          <p className="mt-3">
            Les enregistrements des chapitres et flashcards sont simulés. Les
            modifications ne sont pas sauvegardées dans une base et
            disparaissent au rechargement. La sauvegarde d’un exercice, sa
            validation éditoriale et sa publication ne sont pas reliées dans cet
            essai.
          </p>
        </section>
        <section
          className="grid gap-5 md:grid-cols-2"
          aria-label="Parcours disponibles"
        >
          {cards.map(([label, file, description]) => (
            <article className="card flex flex-col items-start" key={file}>
              <h2 className="text-xl font-semibold">{label}</h2>
              <p className="mb-6 mt-3 flex-1 leading-7 text-slate-600">
                {description}
              </p>
              <a className="button" href={'/tests/browser/' + file}>
                Essayer {label.toLowerCase()}
              </a>
            </article>
          ))}
        </section>
        <p className="text-sm leading-6 text-slate-500">
          Cet espace facilite vos retours sur l’interface. Il ne certifie pas la
          connexion, les permissions réelles, les sauvegardes ou la publication
          de l’application complète.
        </p>
      </main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Workspace />);
