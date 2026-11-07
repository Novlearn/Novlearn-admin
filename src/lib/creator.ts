import type {
  ExerciseDefinition,
  ExerciseElement,
  VariableDefinition,
  JsonValue,
  JsonObject,
} from 'novlearn-exercise-engine';

export const elementLabels: Record<ExerciseElement['type'], string> = {
  text: 'Texte',
  section: 'Section',
  expression: 'Expression mathématique',
  question: 'Question',
  mcq: 'QCM',
  'rich-text': 'Texte',
  equation: 'Équation',
  system: 'Système',
  hint: 'Indication',
  explanation: 'Explication',
  'function-graph': 'Graphe de fonction',
  'sequence-graph': 'Graphe de suite',
  'sign-table': 'Tableau de signes',
  'variation-table': 'Tableau de variations',
  'value-table': 'Tableau de valeurs',
  'statistics-table': 'Tableau statistique',
  'probability-tree': 'Arbre de probabilités',
  vectors: 'Vecteurs',
  geometry: 'Géométrie',
  'complex-plane': 'Plan complexe',
};
export const variableLabels: Record<VariableDefinition['kind'], string> = {
  integer: 'Entier',
  decimal: 'Décimal',
  choice: 'Choix',
  tuple: 'Tuple',
  computed: 'Variable calculée',
};
const numeric = (latex: string) => ({ latex });
const windowTemplate = () => ({
  xMin: numeric('-5'),
  xMax: numeric('5'),
  yMin: numeric('-5'),
  yMax: numeric('5'),
});
const richTemplate = () => [{ type: 'text' as const, text: '' }];

/** Editor defaults contain canonical data only; no evaluation or generation. */
export function elementTemplate(
  type: ExerciseElement['type'],
  id: string,
): ExerciseElement {
  switch (type) {
    case 'text':
    case 'section':
      return { id, type, text: '' };
    case 'expression':
      return { id, type, latex: '' };
    case 'question':
      return {
        id,
        type,
        text: '',
        points: 1,
        response: { format: 'latex', kind: 'rational' },
        expectedLatex: '',
        policy: { domain: 'rational', form: 'value-only' },
      };
    case 'mcq':
      return {
        id,
        type,
        text: '',
        points: 1,
        mode: 'single',
        options: [
          { id: 'option-1', content: { format: 'text', text: '' } },
          { id: 'option-2', content: { format: 'text', text: '' } },
        ],
        expectedOptionIds: [],
      };
    case 'rich-text':
      return { id, type, content: richTemplate() };
    case 'hint':
    case 'explanation':
      return { id, type, content: richTemplate() };
    case 'equation':
      return { id, type, latex: '' };
    case 'system':
      return {
        id,
        type,
        relations: [
          { id: 'relation-1', latex: '' },
          { id: 'relation-2', latex: '' },
        ],
      };
    case 'function-graph':
      return {
        id,
        type,
        variable: 'x',
        window: windowTemplate(),
        showGrid: true,
        functions: [
          {
            id: 'function-1',
            latex: '',
            color: '#2563eb',
            showExpression: true,
          },
        ],
      };
    case 'sequence-graph':
      return {
        id,
        type,
        window: windowTemplate(),
        showGrid: true,
        connectPoints: false,
        sequence: {
          mode: 'points',
          points: [{ index: 0, value: numeric('0') }],
        },
      };
    case 'sign-table':
      return {
        id,
        type,
        variable: 'x',
        points: [{ kind: 'negative-infinity' }, { kind: 'positive-infinity' }],
        rows: [
          {
            id: 'sign-row-1',
            label: '',
            signs: ['+'],
            pointSigns: [null, null],
          },
        ],
      };
    case 'variation-table':
      return {
        id,
        type,
        variable: 'x',
        points: [
          {
            x: { kind: 'negative-infinity' },
            value: { kind: 'finite', value: numeric('') },
            excluded: false,
          },
          {
            x: { kind: 'positive-infinity' },
            value: { kind: 'finite', value: numeric('') },
            excluded: false,
          },
        ],
        directions: ['increasing'],
      };
    case 'value-table':
      return {
        id,
        type,
        columns: ['x', 'f(x)'],
        rows: [
          [
            { kind: 'text', text: '' },
            { kind: 'number', value: numeric('0') },
          ],
        ],
      };
    case 'statistics-table':
      return {
        id,
        type,
        rows: [{ label: '', value: numeric('0'), frequency: numeric('1') }],
      };
    case 'probability-tree':
      return {
        id,
        type,
        exhaustive: false,
        nodes: [{ id: 'root', label: '' }],
      };
    case 'vectors':
      return {
        id,
        type,
        dimension: 2,
        showCoordinates: true,
        vectors: [
          {
            id: 'vector-1',
            label: '',
            coordinates: [numeric('0'), numeric('0')],
            color: '#2563eb',
          },
        ],
      };
    case 'geometry':
      return {
        id,
        type,
        window: windowTemplate(),
        showGrid: true,
        points: [
          {
            id: 'point-1',
            label: 'A',
            coordinates: [numeric('0'), numeric('0')],
          },
        ],
        objects: [],
      };
    case 'complex-plane':
      return {
        id,
        type,
        window: windowTemplate(),
        showGrid: true,
        showCoordinates: true,
        points: [
          {
            id: 'complex-1',
            label: '',
            real: numeric('0'),
            imaginary: numeric('0'),
            color: '#2563eb',
          },
        ],
      };
  }
}
export function variableTemplate(
  kind: VariableDefinition['kind'],
  name: string,
): VariableDefinition {
  switch (kind) {
    case 'integer':
      return { kind, name, min: 0, max: 10, exclusions: [] };
    case 'decimal':
      return { kind, name, min: 0, max: 10, precision: 2, exclusions: [] };
    case 'choice':
      return { kind, name, values: [1, 2, 3], exclusions: [] };
    case 'computed':
      return { kind, name, latex: '' };
    case 'tuple':
      return {
        kind,
        id: name,
        mode: 'generate',
        components: [
          {
            kind: 'integer',
            name: `${name}a`,
            min: 0,
            max: 10,
            exclusions: [],
          },
          {
            kind: 'integer',
            name: `${name}b`,
            min: 0,
            max: 10,
            exclusions: [],
          },
        ],
      };
  }
}
export function moveItem<T>(
  items: readonly T[],
  index: number,
  step: -1 | 1,
): T[] {
  const target = index + step;
  const next = [...items];
  if (
    index < 0 ||
    index >= items.length ||
    target < 0 ||
    target >= items.length
  )
    return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function nextParameterName(definition: ExerciseDefinition): string {
  const names = new Set([
    ...definition.variables.map((item) => item.name),
    ...definition.generation.definitions.flatMap((item) =>
      item.kind === 'tuple'
        ? [
            item.id,
            ...(Array.isArray(item.components)
              ? item.components.map((component) => component?.name)
              : []),
          ]
        : [item.name],
    ),
  ]);
  let index = 1;
  while (
    names.has(`n${index}`) ||
    names.has(`n${index}a`) ||
    names.has(`n${index}b`)
  )
    index++;
  return `n${index}`;
}
export function duplicateElement(
  element: ExerciseElement,
  id: string,
): ExerciseElement {
  return { ...structuredClone(element), id };
}
export const responseKinds = [
  'rational',
  'real',
  'extended-real',
  'expression',
  'log-affine-positive',
  'geometric-expression',
  'elementary-positive',
  'text',
  'rational-expression',
  'equation',
  'inequality',
  'set',
  'intervals',
] as const;
export const policyDomains = [
  'rational',
  'real',
  'extended-real',
  'polynomial',
  'log-affine-positive',
  'geometric-expression',
  'elementary-positive',
  'text',
  'rational-function',
  'equation',
  'inequality',
  'set',
  'intervals',
] as const;
export const atomicForms = [
  'irreducible-fraction',
  'expanded',
  'reduced',
  'factorized',
  'power-of-e',
] as const;
export function changeQuestionKind(
  question: Extract<ExerciseElement, { type: 'question' }>,
  kind: (typeof responseKinds)[number],
): Extract<ExerciseElement, { type: 'question' }> {
  const copy: Omit<
    Extract<ExerciseElement, { type: 'question' }>,
    'expectedLatex' | 'expectedTexts'
  > = structuredClone(question);
  delete (copy as { expectedLatex?: string }).expectedLatex;
  delete (copy as { expectedTexts?: string[] }).expectedTexts;
  const domain =
    kind === 'expression'
      ? 'polynomial'
      : kind === 'rational-expression'
        ? 'rational-function'
        : kind;
  return kind === 'text'
    ? {
        ...copy,
        response: { format: 'text', kind },
        policy: { domain, form: 'value-only' },
        expectedTexts: [''],
      }
    : {
        ...copy,
        response: { format: 'latex', kind },
        policy: { domain, form: 'value-only' },
        expectedLatex: '',
      };
}

/** Field trees below edit the Engine's existing JSON keys, never a second exercise format. */
export function asEditorObject(value: unknown): JsonObject {
  return value as JsonObject;
}
export function asDefinition(value: JsonObject): ExerciseDefinition {
  return value as unknown as ExerciseDefinition;
}
export function isEditorObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
