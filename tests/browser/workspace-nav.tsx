import React from 'react';

export const workspaceLinks = [
  ['Accueil des essais', 'index.html'],
  ['Catalogue', 'catalogue.html'],
  ['Creator et tests', 'creator.html'],
  ['Figures et vecteurs', 'coordinates.html'],
  ['Statistiques de démonstration', 'statistics.html'],
  ['Publication simulée', 'publication.html'],
  ['Lots simulés', 'publication-batch.html'],
  ['Chapitres et compétences', 'taxonomy.html'],
  ['Flashcards', 'flashcards.html'],
  ['Saisie mathématique', 'math-input.html'],
] as const;

export function WorkspaceNav() {
  return (
    <nav
      aria-label="Essais locaux NovLearn Admin"
      className="flex flex-wrap gap-x-5 gap-y-3 border-b border-blue-100 bg-blue-50 px-6 py-4 text-sm font-medium text-brand-700"
    >
      {workspaceLinks.map(([label, file]) => (
        <a
          key={file}
          href={'/tests/browser/' + file}
          className="underline underline-offset-4"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
