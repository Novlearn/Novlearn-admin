import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExercisePromptForm } from '@/components/exercise-prompt-form';

describe('ExercisePromptForm', () => {
  it('uses the selected chapter coverage and describes a canonical JSON output', () => {
    const html = renderToStaticMarkup(
      createElement(ExercisePromptForm, {
        chapters: [
          {
            id: 'chapter-1',
            name: 'Suites numériques',
            aliases: [],
            coverage: {
              total: 12,
              byDifficulty: {
                Facile: 4,
                Moyen: 6,
                Difficile: 2,
                Inconnue: 0,
              },
              examples: [
                {
                  title: 'Étudier une suite',
                  difficulty: 'Moyen',
                  status: 'Autre statut',
                  skills: ['calculer_des_termes'],
                },
              ],
              skills: [{ id: 'calculer_des_termes', count: 4 }],
            },
          },
          {
            id: 'chapter-2',
            name: 'Fonctions',
            aliases: [],
            coverage: {
              total: 3,
              byDifficulty: {
                Facile: 1,
                Moyen: 1,
                Difficile: 1,
                Inconnue: 0,
              },
              examples: [],
              skills: [{ id: 'calculer_une_derivee', count: 2 }],
            },
          },
        ],
      }),
    );

    expect(html).toContain('Suites numériques');
    expect(html).toContain('Fonctions');
    expect(html).toContain('12');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('max="20"');
    expect(html).toContain('Maximum 20 exercices par demande.');
    expect(html).toContain('Répartition par chapitre');
    expect(html).toContain('Étudier une suite');
    expect(html).toContain('&quot;schemaVersion&quot;:5');
    expect(html).toContain('Format');
    expect(html).toContain('Calculatrice');
    expect(html).toContain('Aucune pr\u00e9f\u00e9rence');
    expect(html).toContain(
      'node_modules/novlearn-exercise-engine/dist/contracts/types.d.ts',
    );
    expect(html).toContain('docs/engine/engine-library.md');
    expect(html).toContain(
      'Génération aléatoire obligatoire pour chaque exercice',
    );
    expect(html).toContain('generation.definitions');
    expect(html).toContain('@a');
    expect(html).toContain(String.raw`4+\\mathrm{a}`);
    expect(html).toContain('Rendu LaTeX obligatoire');
    expect(html).toContain('&quot;type&quot;:&quot;expression&quot;');
    expect(html).toContain(String.raw`\\frac{1}{x^{2}}`);
    expect(html).toContain('les données visibles de la question varient');
    expect(html).toContain('validateDefinition');
    expect(html).toContain('Cette validation technique ne remplace pas');
    expect(html).toContain('renvoie le lot JSON complet');
    expect(html).toContain('le collera dans la page Admin web');
    expect(html).not.toContain('exercises:import');
    expect(html).toContain('batchId');
  });
});
