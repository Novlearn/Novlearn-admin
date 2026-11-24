import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  instantiateExercise,
  projectPublicInstance,
  validateDefinition,
} from 'novlearn-exercise-engine';
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
import { CreatorFields } from '@/components/creator-fields';

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
    const real = changeQuestionKind(original, 'real');
    expect(real.expectedLatex).toBe('2');
    expect(real.response).toEqual({ format: 'latex', kind: 'real' });
    expect(real.policy.domain).toBe('real');
  });

  it('expose un seul type de réponse, les formes compatibles et une insertion de variable', () => {
    const definition = newDraft('Variables');
    definition.elements = [elementTemplate('question', 'question-1')];
    definition.generation.definitions = [variableTemplate('integer', 'b')];
    const html = renderToStaticMarkup(
      createElement(CreatorFields, { definition, onChange: () => {} }),
    );
    expect(html.match(/Type de réponse/g)).toHaveLength(1);
    expect(html).toContain('Nombre entier ou fraction');
    expect(html).toContain('Règles de correction');
    expect(html).not.toContain('value="power-of-e"');
    expect(html).not.toContain('value="expanded"');
    expect(html).toContain('Insérer une variable dans Réponse attendue');
    expect(html).toContain('value="b">@b</option>');
  });

  it('masque les données historiques et garde les autres métadonnées privées visibles', () => {
    const definition = newDraft('Graphes importés');
    const imported = {
      legacyPath: '/elements/1',
      legacy: { expression: 'historique @a' },
    };
    definition.elements = [
      { ...elementTemplate('function-graph', 'graph'), extensions: imported },
      {
        ...elementTemplate('function-graph', 'graph-custom'),
        extensions: { ...imported, editorialNote: 'Note interne' },
      },
    ];
    const html = renderToStaticMarkup(
      createElement(CreatorFields, { definition, onChange: () => {} }),
    );
    expect(html).not.toContain('legacyPath');
    expect(html).not.toContain('/elements/1');
    expect(html).not.toContain('historique @a');
    expect(html).toContain('Expression');
    expect(html).toContain('Note interne');
    expect(html.match(/Métadonnées privées/g)).toHaveLength(1);
    expect(definition.elements[0].extensions).toEqual(imported);
  });

  it('affiche la même variable générée dans le texte et dans une formule', () => {
    const definition = newDraft('Variables');
    definition.generation.definitions = [
      { kind: 'integer', name: 'b', min: 2, max: 2, exclusions: [] },
    ];
    definition.elements = [
      { id: 'text', type: 'text', text: 'Valeur @b' },
      { id: 'math', type: 'expression', latex: '\\mathrm{b}+1' },
    ];
    const instance = instantiateExercise(definition, {
      instanceId: 'notation',
      seed: 42,
    });
    expect(instance.ok, JSON.stringify(instance)).toBe(true);
    if (!instance.ok) return;
    const projection = projectPublicInstance(instance.value);
    expect(projection.elements[0]).toMatchObject({
      type: 'text',
      text: 'Valeur 2',
    });
    expect(projection.elements[1]).toMatchObject({ type: 'expression' });
    expect(JSON.stringify(projection.elements[1])).not.toContain('mathrm');
  });

  it('édite les contenus associés dans la question et le QCM en préservant les éléments globaux', () => {
    const definition = newDraft('Aides');
    const mcq = elementTemplate('mcq', 'mcq');
    if (mcq.type !== 'mcq') throw Error('Fixture');
    definition.elements = [
      {
        id: 'hint',
        type: 'hint',
        questionId: 'q',
        content: [{ type: 'text', text: 'Indice de la question' }],
      },
      {
        id: 'q',
        type: 'question',
        text: 'Calculer',
        points: 1,
        response: { kind: 'rational', format: 'latex' },
        policy: { domain: 'rational', form: 'value-only' },
        expectedLatex: '1',
      },
      {
        id: 'correction',
        type: 'explanation',
        questionId: 'mcq',
        content: [{ type: 'text', text: 'Correction du QCM' }],
      },
      {
        ...mcq,
        text: 'Choisir',
        options: mcq.options.map((option, index) => ({
          ...option,
          content: { format: 'text', text: String(index + 1) },
        })),
        expectedOptionIds: [mcq.options[0].id],
      },
      {
        id: 'global',
        type: 'hint',
        content: [{ type: 'text', text: 'Indice global' }],
      },
    ];
    const html = renderToStaticMarkup(
      createElement(CreatorFields, { definition, onChange: () => {} }),
    );
    expect(html).toContain('1. Question');
    expect(html).toContain('2. QCM');
    expect(html).toContain('3. Indication');
    expect(html).not.toContain('4. ');
    for (const text of [
      'Indice de la question',
      'Correction du QCM',
      'Indice global',
    ])
      expect(html).toContain(text);
    const instance = instantiateExercise(definition, {
      instanceId: 'aides',
      seed: 42,
    });
    expect(instance.ok, JSON.stringify(instance)).toBe(true);
    if (instance.ok)
      expect(
        projectPublicInstance(instance.value).elements.map(({ id }) => id),
      ).toEqual(['q', 'mcq']);
  });
});
