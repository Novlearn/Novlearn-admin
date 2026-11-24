import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { ExercisePreview } from '@/components/exercise-preview';
import definition from './fixtures/preview-definition.json';

const props = {
  engineEnabled: true,
  definition: definition as unknown as ExerciseDefinition,
  saved: { id: 'saved-version', fingerprint: 'a'.repeat(64), epoch: 0 },
};

it('keeps Engine tests available without offering report persistence by default', () => {
  const html = renderToStaticMarkup(createElement(ExercisePreview, props));
  expect(html).toContain('Vérifier l’exercice');
  expect(html).toContain('Prévisualiser');
  expect(html).not.toContain('Tester et consigner');
});

it('does not offer native previews or report persistence when Engine is disabled', () => {
  const html = renderToStaticMarkup(
    createElement(ExercisePreview, {
      ...props,
      engineEnabled: false,
      canRecordTests: true,
    }),
  );
  expect(html).toContain('Les aperçus et tests ne sont pas disponibles');
  expect(html).not.toContain('Vérifier l’exercice');
  expect(html).not.toContain('Tester et consigner');
});

it('keeps signing capability behind the same concise verification action', () => {
  const html = renderToStaticMarkup(
    createElement(ExercisePreview, { ...props, canRecordTests: true }),
  );
  expect(html).toContain('Vérifier l’exercice');
  expect(html).not.toContain('Tester et consigner');
  expect(html).not.toContain('Seeds de test');
  expect(html).not.toContain('Rapport enregistré');
});
