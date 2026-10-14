import { describe, expect, it } from 'vitest';
import { validateDefinition } from 'novlearn-exercise-engine';
import type { ExerciseElement } from 'novlearn-exercise-engine';
import {
  elementLabels,
  elementTemplate,
  variableTemplate,
  moveItem,
  duplicateElement,
  changeQuestionKind,
  nextParameterName,
} from '@/lib/creator';
import { newDraft } from '@/lib/catalogue';

describe('données canoniques du Creator', () => {
  it('choisit un nom sans collision avec les paramètres ou composantes de tuple', () => {
    const draft = newDraft('Noms');
    draft.generation.definitions = [
      variableTemplate('integer', 'n1'),
      variableTemplate('tuple', 'n2'),
    ];
    expect(nextParameterName(draft)).toBe('n3');
  });
  it('propose chaque type d’élément du contrat avec son identité propre', () => {
    const types = Object.keys(elementLabels) as ExerciseElement['type'][];
    expect(types).toHaveLength(20);
    for (const type of types) {
      const element = elementTemplate(type, `fixture-${type}`);
      expect(element.type).toBe(type);
      expect(element.id).toBe(`fixture-${type}`);
    }
  });
  it.each(Object.keys(elementLabels) as ExerciseElement['type'][])(
    'soumet un exemple %s au vrai validateur canonique',
    (type) => {
      const fill = (value: unknown, key = ''): unknown => {
        if (value === '')
          return key === 'expectedLatex'
            ? '1'
            : key === 'latex'
              ? 'x'
              : 'Exemple';
        if (Array.isArray(value)) return value.map((item) => fill(item, key));
        if (value && typeof value === 'object')
          return Object.fromEntries(
            Object.entries(value).map(([name, item]) => [
              name,
              fill(item, name),
            ]),
          );
        return value;
      };
      const draft = newDraft(`Exemple ${type}`);
      draft.variables = [{ name: 'x', domain: 'real' }];
      const element = fill(elementTemplate(type, 'element')) as ExerciseElement;
      if (element.type === 'mcq')
        element.expectedOptionIds = [element.options[0].id];
      draft.elements = [element];
      const validation = validateDefinition(draft);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
    },
  );
  it('laisse l’Engine rejeter les attentes encore vides plutôt que de fabriquer des réponses', () => {
    const draft = newDraft('Question incomplète');
    draft.elements = [elementTemplate('question', 'question-1')];
    const result = validateDefinition(draft);
    expect(result.ok).toBe(false);
    if (result.ok) throw Error('Empty expected answer must not validate');
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.path.includes('expectedLatex'),
      ),
    ).toBe(true);
  });
  it('représente les cinq familles de paramètres dans le schéma génération 5 officiel', () => {
    for (const kind of ['integer', 'decimal', 'choice', 'tuple'] as const) {
      const draft = newDraft(`Paramètre ${kind}`);
      draft.elements = [{ id: 'text', type: 'text', text: 'Énoncé' }];
      draft.generation.definitions = [variableTemplate(kind, 'parameter')];
      expect(validateDefinition(draft).ok, kind).toBe(true);
    }
    const computed = variableTemplate('computed', 'b');
    expect(computed).toMatchObject({ kind: 'computed', name: 'b', latex: '' });
  });
  it('duplique et réordonne sans modifier l’original ni réécrire ses expressions', () => {
    const original = elementTemplate('question', 'first');
    if (original.type !== 'question') throw Error('Fixture');
    original.expectedLatex = '\\frac{a}{b}';
    const copy = duplicateElement(original, 'second');
    expect(copy).toMatchObject({ id: 'second', expectedLatex: '\\frac{a}{b}' });
    expect(original.id).toBe('first');
    expect(moveItem([original, copy], 1, -1).map((item) => item.id)).toEqual([
      'second',
      'first',
    ]);
    expect(moveItem([original, copy], 0, -1).map((item) => item.id)).toEqual([
      'first',
      'second',
    ]);
  });
  it('un changement de type remplace les champs d’attendu incompatibles, sans muter la source', () => {
    const original = elementTemplate('question', 'question');
    if (original.type !== 'question') throw Error('Fixture');
    original.text = 'Une question';
    original.expectedLatex = '2';
    const text = changeQuestionKind(original, 'text');
    expect(text).not.toHaveProperty('expectedLatex');
    expect(text).toHaveProperty('expectedTexts', ['']);
    const math = changeQuestionKind(text, 'rational-expression');
    expect(math).not.toHaveProperty('expectedTexts');
    expect(math.policy.domain).toBe('rational-function');
    expect(original.expectedLatex).toBe('2');
  });
});
