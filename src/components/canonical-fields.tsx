'use client';
import { createContext, useContext } from 'react';
import type { JsonValue, JsonObject } from 'novlearn-exercise-engine';
import { MathInput } from './math-input';
import {
  atomicForms,
  responseKinds,
  isEditorObject,
  variableTemplate,
  asEditorObject,
} from '@/lib/creator';

const labels: Record<string, string> = {
  id: 'Identifiant',
  name: 'Nom',
  text: 'Texte',
  latex: 'Expression',
  label: 'Libellé',
  points: 'Points',
  response: 'Réponse élève',
  policy: 'Correction',
  expectedLatex: 'Réponse attendue',
  expectedTexts: 'Réponses textuelles acceptées',
  expectedOptionIds: 'Choix attendus',
  options: 'Choix proposés',
  content: 'Contenu',
  format: 'Format',
  kind: 'Type',
  mode: 'Mode',
  domain: 'Domaine',
  variable: 'Variable',
  keyboard: 'Clavier conseillé',
  sectionId: 'Section associée',
  questionId: 'Question associée',
  min: 'Minimum',
  max: 'Maximum',
  precision: 'Précision décimale',
  exclusions: 'Exclusions',
  values: 'Valeurs proposées',
  restrictions: 'Restrictions',
  components: 'Composantes',
  left: 'Membre gauche',
  right: 'Membre droit',
  operator: 'Relation',
  form: 'Forme attendue',
  anyOf: 'Formes acceptées',
  comparison: 'Comparaison numérique',
  absolute: 'Tolérance absolue',
  relative: 'Tolérance relative',
  normalization: 'Normalisation du texte',
  trim: 'Retirer les espaces aux extrémités',
  collapseWhitespace: 'Regrouper les espaces',
  ignoreCase: 'Ignorer la casse',
  unicodeNFC: 'Normalisation Unicode',
  comparisonDomain: 'Domaine de comparaison',
  excludedLatex: 'Valeurs exclues',
  window: 'Fenêtre',
  xMin: 'x minimum',
  xMax: 'x maximum',
  yMin: 'y minimum',
  yMax: 'y maximum',
  showGrid: 'Afficher la grille',
  showExpression: 'Afficher la formule',
  showCoordinates: 'Afficher les coordonnées',
  connectPoints: 'Relier les points',
  functions: 'Fonctions',
  sequence: 'Suite',
  indexVariable: 'Variable d’indice',
  termVariable: 'Variable du terme',
  start: 'Premier indice',
  count: 'Nombre de termes',
  initial: 'Terme initial',
  recurrence: 'Relation de récurrence',
  index: 'Indice',
  value: 'Valeur',
  rows: 'Lignes',
  columns: 'Colonnes',
  signs: 'Signes entre les points',
  pointSigns: 'Signes aux points',
  directions: 'Sens de variation',
  x: 'Abscisse',
  leftLimit: 'Limite à gauche',
  rightLimit: 'Limite à droite',
  excluded: 'Point exclu',
  frequency: 'Effectif / fréquence',
  nodes: 'Nœuds',
  parentId: 'Nœud parent',
  probability: 'Probabilité',
  exhaustive: 'Arbre exhaustif',
  dimension: 'Dimension',
  vectors: 'Vecteurs',
  coordinates: 'Coordonnées',
  objects: 'Objets',
  from: 'Point de départ',
  to: 'Point d’arrivée',
  vertices: 'Sommets',
  center: 'Centre',
  radius: 'Rayon',
  real: 'Partie réelle',
  imaginary: 'Partie imaginaire',
  color: 'Couleur',
  relations: 'Relations',
  emphasis: 'Mise en valeur',
  display: 'Affichage',
  extensions: 'Métadonnées privées',
};
const choices: Record<string, readonly string[]> = {
  keyboard: [
    'numeric',
    'algebraic',
    'fractions-roots',
    'sets-intervals',
    'mcq',
  ],
  operator: ['<', '<=', '>', '>=', '==', '!='],
  signs: ['+', '-', '0'],
  directions: ['increasing', 'decreasing', 'constant'],
  emphasis: ['strong', 'emphasis'],
  display: ['inline', 'block'],
  anyOf: atomicForms,
};
const choiceLabels: Record<string, string> = {
  decimal: 'Décimal',
  tuple: 'Tuple',
  computed: 'Variable calculée',
  expression: 'Expression',
  'extended-real': 'Réel avec infinis',
  'log-affine-positive': 'Logarithmes à arguments positifs',
  'rational-expression': 'Expression rationnelle',
  'rational-function': 'Fonction rationnelle',
  polynomial: 'Polynôme',
  equation: 'Équation',
  inequality: 'Inéquation',
  set: 'Ensemble',
  intervals: 'Intervalles',
  single: 'Simple',
  multiple: 'Multiple',
  generate: 'Générer',
  choice: 'Choisir une ligne',
  points: 'Points prescrits',
  explicit: 'Formule explicite',
  recurrent: 'Récurrence',
  exact: 'Exacte',
  approximate: 'Avec tolérance',
  finite: 'Valeur finie',
  'negative-infinity': 'Moins l’infini',
  'positive-infinity': 'Plus l’infini',
  text: 'Texte',
  latex: 'Mathématique',
  number: 'Valeur numérique',
  math: 'Mathématique',
  integer: 'Entier',
  rational: 'Rationnel',
  real: 'Réel',
  increasing: 'Croissante',
  decreasing: 'Décroissante',
  constant: 'Constante',
  'value-only': 'Valeur seule',
  'irreducible-fraction': 'Fraction irréductible',
  expanded: 'Développée',
  reduced: 'Réduite',
  factorized: 'Factorisée',
  'power-of-e': 'Puissance de e',
  'accepted-forms': 'Une des formes proposées',
  'accepted-latex': 'Une des écritures proposées',
  segment: 'Segment',
  line: 'Droite',
  polygon: 'Polygone',
  circle: 'Cercle',
};
type Props = {
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  path: string;
  label?: string;
  parent?: JsonObject;
  depth?: number;
};
const fieldName = (path: string) =>
  path.split('/').filter(Boolean).at(-1) ?? '';
const numberFields = new Set([
  'min',
  'max',
  'precision',
  'points',
  'constant',
  'dimension',
  'start',
  'count',
  'index',
  'maxAttempts',
  'maxDraws',
]);
const mathFields = new Set([
  'latex',
  'expectedLatex',
  'excludedLatex',
  'recurrence',
]);
const buttonStyle =
  'rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700';
const fresh = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const CreatorLockedContext = createContext(false);

function union(
  value: JsonObject,
  path: string,
): {
  key: string;
  choices: readonly string[];
  change: (next: string) => JsonObject;
} | null {
  const key = fieldName(path);
  if (key === 'left' || key === 'right') {
    const current =
      'variable' in value
        ? 'variable'
        : 'constant' in value
          ? 'constant'
          : 'latex';
    return {
      key: current,
      choices: ['variable', 'constant', 'latex'],
      change: (next): JsonObject =>
        next === 'variable'
          ? { variable: '' }
          : next === 'constant'
            ? { constant: 0 }
            : { latex: '' },
    };
  }
  if (key === 'comparison')
    return {
      key: 'mode',
      choices: ['exact', 'approximate'],
      change: (mode): JsonObject =>
        mode === 'exact' ? { mode } : { mode, absolute: '0', relative: '0' },
    };
  if (key === 'sequence')
    return {
      key: 'mode',
      choices: ['points', 'explicit', 'recurrent'],
      change: (mode): JsonObject =>
        mode === 'points'
          ? { mode, points: [{ index: 0, value: { latex: '0' } }] }
          : mode === 'explicit'
            ? { mode, indexVariable: 'n', start: 0, count: 10, latex: '' }
            : {
                mode,
                indexVariable: 'n',
                termVariable: 'u',
                start: 0,
                count: 10,
                initial: { latex: '0' },
                recurrence: '',
              },
    };
  if (
    value.kind === 'finite' ||
    value.kind === 'negative-infinity' ||
    value.kind === 'positive-infinity'
  )
    return {
      key: 'kind',
      choices: ['finite', 'negative-infinity', 'positive-infinity'],
      change: (kind): JsonObject =>
        kind === 'finite' ? { kind, value: { latex: '0' } } : { kind },
    };
  if (path.includes('/components/') || path.includes('/definitions/')) {
    const currentName = String(value.name ?? value.id ?? 'parameter');
    return {
      key: 'kind',
      choices: path.includes('/components/')
        ? ['integer', 'decimal', 'choice']
        : ['integer', 'decimal', 'choice', 'tuple', 'computed'],
      change: (kind): JsonObject =>
        asEditorObject(
          variableTemplate(
            kind as Parameters<typeof variableTemplate>[0],
            currentName,
          ),
        ),
    };
  }
  if (value.kind === 'text' || value.kind === 'number' || value.kind === 'math')
    return {
      key: 'kind',
      choices: ['text', 'number', 'math'],
      change: (kind): JsonObject =>
        kind === 'text'
          ? { kind, text: '' }
          : kind === 'number'
            ? { kind, value: { latex: '0' } }
            : { kind, latex: '' },
    };
  if (
    value.kind === 'segment' ||
    value.kind === 'line' ||
    value.kind === 'polygon' ||
    value.kind === 'circle'
  )
    return {
      key: 'kind',
      choices: ['segment', 'line', 'polygon', 'circle'],
      change: (kind): JsonObject =>
        kind === 'polygon'
          ? {
              id: value.id ?? fresh('object'),
              kind,
              vertices: [],
              color: '#2563eb',
            }
          : kind === 'circle'
            ? {
                id: value.id ?? fresh('object'),
                kind,
                center: '',
                radius: { latex: '1' },
                color: '#2563eb',
              }
            : {
                id: value.id ?? fresh('object'),
                kind,
                from: '',
                to: '',
                color: '#2563eb',
              },
    };
  if (
    (value.type === 'text' || value.type === 'math') &&
    path.includes('/content/')
  )
    return {
      key: 'type',
      choices: ['text', 'math'],
      change: (type): JsonObject =>
        type === 'text'
          ? { type, text: '' }
          : { type, latex: '', display: 'inline' },
    };
  if (
    (value.format === 'text' || value.format === 'latex') &&
    path.includes('/options/')
  )
    return {
      key: 'format',
      choices: ['text', 'latex'],
      change: (format): JsonObject =>
        format === 'text' ? { format, text: '' } : { format, latex: '' },
    };
  return null;
}
function optionalFields(
  value: JsonObject,
  path: string,
): [string, JsonValue][] {
  const entries: [string, JsonValue][] = [];
  if (path.startsWith('/elements/') && path.split('/').length === 3) {
    entries.push(['sectionId', '']);
    if (value.type === 'question' || value.type === 'mcq')
      entries.push(['keyboard', 'algebraic']);
    if (value.type === 'hint' || value.type === 'explanation')
      entries.push(['questionId', '']);
    if (['equation', 'expression'].includes(String(value.type)))
      entries.push(['label', '']);
  }
  if (fieldName(path) === 'response') entries.push(['variable', 'x']);
  if (fieldName(path) === 'policy')
    entries.push(
      ['comparison', { mode: 'exact' }],
      [
        'normalization',
        {
          trim: true,
          collapseWhitespace: false,
          ignoreCase: false,
          unicodeNFC: true,
        },
      ],
      ['comparisonDomain', { variable: 'x', excludedLatex: [''] }],
    );
  if (value.kind === 'computed')
    entries.push(['restrictions', { domain: 'rational' }]);
  if (fieldName(path) === 'restrictions')
    entries.push(['min', 0], ['max', 10], ['exclusions', []]);
  if (value.kind === 'choice') entries.push(['exclusions', []]);
  if (path.includes('/functions/') || path.includes('/vectors/'))
    entries.push(['label', '']);
  if (path.includes('/content/') && value.type === 'text')
    entries.push(['emphasis', 'strong']);
  if (path.includes('/nodes/'))
    entries.push(['parentId', ''], ['probability', { latex: '1' }]);
  if (path.includes('/points/') && 'excluded' in value)
    entries.push(
      ['value', { kind: 'finite', value: { latex: '0' } }],
      ['leftLimit', { kind: 'finite', value: { latex: '0' } }],
      ['rightLimit', { kind: 'finite', value: { latex: '0' } }],
    );
  return entries;
}
function itemTemplate(
  path: string,
  parent?: JsonObject,
  sample?: JsonValue,
): JsonValue {
  const key = fieldName(path);
  if (parent?.type === 'value-table' && /\/rows\/\d+$/.test(path))
    return { kind: 'text', text: '' };
  if (key === 'content') return { type: 'text', text: '' };
  if (key === 'options')
    return { id: fresh('option'), content: { format: 'text', text: '' } };
  if (key === 'relations') return { id: fresh('relation'), latex: '' };
  if (key === 'components')
    return {
      kind: 'integer',
      name: `component${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
      min: 0,
      max: 10,
      exclusions: [],
    };
  if (key === 'functions')
    return {
      id: fresh('function'),
      latex: '',
      color: '#2563eb',
      showExpression: true,
    };
  if (key === 'nodes') return { id: fresh('node'), label: '' };
  if (key === 'vectors')
    return {
      id: fresh('vector'),
      label: '',
      coordinates: Array(Number(parent?.dimension ?? 2))
        .fill(null)
        .map(() => ({ latex: '0' })),
      color: '#2563eb',
    };
  if (key === 'objects')
    return {
      id: fresh('object'),
      kind: 'segment',
      from: '',
      to: '',
      color: '#2563eb',
    };
  if (key === 'rows' && parent?.type === 'sign-table')
    return {
      id: fresh('row'),
      label: '',
      signs: Array(
        Math.max(
          0,
          Array.isArray(parent.points) ? parent.points.length - 1 : 0,
        ),
      ).fill('+'),
      pointSigns: Array(
        Array.isArray(parent.points) ? parent.points.length : 0,
      ).fill(null),
    };
  if (key === 'rows' && parent?.type === 'statistics-table')
    return { label: '', value: { latex: '0' }, frequency: { latex: '1' } };
  if (key === 'rows' && parent?.type === 'value-table')
    return Array(Array.isArray(parent.columns) ? parent.columns.length : 1)
      .fill(null)
      .map(() => ({ kind: 'text', text: '' }));
  if (key === 'points') {
    if (parent?.type === 'sign-table')
      return { kind: 'finite', value: { latex: '0' } };
    if (parent?.type === 'variation-table')
      return {
        x: { kind: 'finite', value: { latex: '0' } },
        value: { kind: 'finite', value: { latex: '' } },
        excluded: false,
      };
    if (parent?.type === 'geometry')
      return {
        id: fresh('point'),
        label: '',
        coordinates: [{ latex: '0' }, { latex: '0' }],
      };
    if (parent?.type === 'complex-plane')
      return {
        id: fresh('complex'),
        label: '',
        real: { latex: '0' },
        imaginary: { latex: '0' },
        color: '#2563eb',
      };
    return { index: 0, value: { latex: '0' } };
  }
  if (key === 'values' && parent?.kind === 'tuple')
    return Array(
      Array.isArray(parent.components) ? parent.components.length : 1,
    ).fill(0);
  if (['values', 'exclusions'].includes(key)) return 0;
  if (key === 'coordinates') return { latex: '0' };
  if (key === 'pointSigns') return null;
  if (key === 'signs') return '+';
  if (key === 'directions') return 'increasing';
  if (key === 'anyOf') return 'expanded';
  if (Array.isArray(sample)) return structuredClone(sample);
  if (isEditorObject(sample ?? null)) return structuredClone(sample!);
  return '';
}

export function CanonicalFields({
  value,
  onChange,
  path,
  label,
  parent,
  depth = 0,
}: Props) {
  const locked = useContext(CreatorLockedContext);
  const key = fieldName(path);
  const title = label ?? labels[key] ?? key;
  const numericObject =
    isEditorObject(value) &&
    Object.keys(value).length === 1 &&
    typeof value.latex === 'string' &&
    key !== 'left' &&
    key !== 'right';
  if (numericObject)
    return (
      <MathInput
        label={title}
        value={String(value.latex)}
        onChange={(latex) => onChange({ latex })}
        disabled={locked}
      />
    );
  if (depth > 12)
    return (
      <p className="notice">
        Cette structure dépasse la profondeur de l’éditeur visuel. Elle est
        conservée.
      </p>
    );
  if (key === 'form' && path.endsWith('/policy/form')) {
    const selected =
      typeof value === 'string'
        ? value
        : isEditorObject(value)
          ? String(value.kind)
          : 'value-only';
    return (
      <div className="space-y-3">
        <label className="label">
          {title}
          <select
            className="field"
            value={selected}
            onChange={(event) =>
              onChange(
                event.target.value === 'accepted-forms'
                  ? { kind: 'accepted-forms', anyOf: ['expanded'] }
                  : event.target.value === 'accepted-latex'
                    ? { kind: 'accepted-latex', latex: [''] }
                    : event.target.value,
              )
            }
          >
            {[
              'value-only',
              ...atomicForms,
              'accepted-forms',
              'accepted-latex',
            ].map((option) => (
              <option key={option} value={option}>
                {choiceLabels[option] ?? option}
              </option>
            ))}
          </select>
        </label>
        {isEditorObject(value) &&
          Object.entries(value)
            .filter(([name]) => name !== 'kind')
            .map(([name, data]) => (
              <CanonicalFields
                key={name}
                path={`${path}/${name}`}
                value={data}
                onChange={(next) => onChange({ ...value, [name]: next })}
                depth={depth + 1}
              />
            ))}
      </div>
    );
  }
  if (Array.isArray(value))
    return (
      <fieldset className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          {title}
        </legend>
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {title} · {index + 1}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={buttonStyle}
                  disabled={index === 0}
                  aria-label={`Monter ${title} ${index + 1}`}
                  onClick={() => {
                    const next = [...value];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    onChange(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={buttonStyle}
                  disabled={index === value.length - 1}
                  aria-label={`Descendre ${title} ${index + 1}`}
                  onClick={() => {
                    const next = [...value];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    onChange(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={buttonStyle}
                  onClick={() =>
                    onChange(value.filter((_, position) => position !== index))
                  }
                >
                  Retirer
                </button>
              </div>
            </div>
            <CanonicalFields
              path={`${path}/${index}`}
              label={`${title} ${index + 1}`}
              value={item}
              parent={parent}
              depth={depth + 1}
              onChange={(next) =>
                onChange(
                  value.map((old, position) =>
                    position === index ? next : old,
                  ),
                )
              }
            />
          </div>
        ))}
        <button
          type="button"
          className={buttonStyle}
          onClick={() =>
            onChange([...value, itemTemplate(path, parent, value[0])])
          }
        >
          ＋ Ajouter
        </button>
      </fieldset>
    );
  if (isEditorObject(value)) {
    const discriminant = union(value, path);
    const optional = optionalFields(value, path);
    const operand = key === 'left' || key === 'right';
    const displayed = Object.entries(value).filter(
      ([name]) =>
        name !== 'schemaVersion' &&
        name !== 'type' &&
        (operand || name !== discriminant?.key) &&
        name !== 'expectedOptionIds' &&
        !(name === 'kind' && value.kind === 'comparison') &&
        !(value.kind === 'tuple' && name === 'mode'),
    );
    const missing = optional.filter(([name]) => !(name in value));
    return (
      <div className="min-w-0 space-y-4">
        {discriminant && (
          <label className="label">
            {title} · type
            <select
              className="field"
              value={
                operand ? discriminant.key : String(value[discriminant.key])
              }
              onChange={(event) =>
                onChange(discriminant.change(event.target.value))
              }
            >
              {discriminant.choices.map((option) => (
                <option key={option} value={option}>
                  {choiceLabels[option] ?? option}
                </option>
              ))}
            </select>
          </label>
        )}
        {displayed.map(([name, data]) => (
          <div key={name}>
            {isEditorObject(data) &&
              !(
                Object.keys(data).length === 1 && typeof data.latex === 'string'
              ) && (
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  {labels[name] ?? name}
                </h3>
              )}
            <CanonicalFields
              path={`${path}/${name}`}
              value={data}
              parent={value}
              depth={depth + 1}
              onChange={(next) => onChange({ ...value, [name]: next })}
            />
            {optional.some(([optionalName]) => optionalName === name) && (
              <button
                type="button"
                className="mt-2 text-xs text-slate-500 hover:text-red-700"
                onClick={() => {
                  const next = { ...value };
                  delete next[name];
                  onChange(next);
                }}
              >
                Retirer ce paramètre facultatif
              </button>
            )}
          </div>
        ))}
        {value.kind === 'tuple' && (
          <label className="label">
            Mode du tuple
            <select
              className="field"
              value={String(value.mode)}
              onChange={(event) => {
                const next: JsonObject = { ...value, mode: event.target.value };
                if (event.target.value === 'choice') next.values = [];
                else delete next.values;
                onChange(next);
              }}
            >
              <option value="generate">Générer</option>
              <option value="choice">Choisir une ligne</option>
            </select>
          </label>
        )}
        {value.type === 'mcq' && Array.isArray(value.options) && (
          <fieldset className="rounded-lg bg-blue-50 p-4">
            <legend className="px-1 text-sm font-semibold">
              Réponses attendues · privées
            </legend>
            {value.options.filter(isEditorObject).map((option, optionIndex) => (
              <label
                key={String(option.id)}
                className="mb-2 flex items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={
                    Array.isArray(value.expectedOptionIds) &&
                    value.expectedOptionIds.includes(option.id)
                  }
                  onChange={(event) =>
                    onChange({
                      ...value,
                      expectedOptionIds: event.target.checked
                        ? value.mode === 'single'
                          ? [option.id]
                          : [
                              ...(Array.isArray(value.expectedOptionIds)
                                ? value.expectedOptionIds
                                : []),
                              option.id,
                            ]
                        : (Array.isArray(value.expectedOptionIds)
                            ? value.expectedOptionIds
                            : []
                          ).filter((id) => id !== option.id),
                    })
                  }
                />
                Choix {optionIndex + 1} ·{' '}
                {isEditorObject(option.content)
                  ? String(option.content.text ?? option.content.latex ?? '')
                  : String(option.id)}
              </label>
            ))}
          </fieldset>
        )}
        {missing.length > 0 && (
          <details className="rounded-lg border border-dashed border-slate-200 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">
              Paramètres facultatifs
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {missing.map(([name, initial]) => (
                <button
                  key={name}
                  type="button"
                  className={buttonStyle}
                  onClick={() =>
                    onChange({ ...value, [name]: structuredClone(initial) })
                  }
                >
                  ＋ {labels[name] ?? name}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }
  const listKey =
    parent && Array.isArray(parent[key])
      ? key
      : path.match(
          /\/(signs|pointSigns|directions|anyOf|values|exclusions|expectedTexts|excludedLatex|latex)(?:\/\d+)+$/,
        )?.[1];
  const selectOptions =
    choices[listKey ?? key] ??
    (path.endsWith('/response/kind') ? responseKinds : undefined) ??
    (path.endsWith('/response/format') ? ['latex', 'text'] : undefined) ??
    (key === 'domain'
      ? path.endsWith('/policy/domain')
        ? [
            'rational',
            'real',
            'extended-real',
            'polynomial',
            'log-affine-positive',
            'text',
            'rational-function',
            'equation',
            'inequality',
            'set',
            'intervals',
          ]
        : path.endsWith('/restrictions/domain')
          ? ['integer', 'rational']
          : ['integer', 'real']
      : undefined) ??
    (key === 'mode' && parent?.type === 'mcq'
      ? ['single', 'multiple']
      : undefined) ??
    (key === 'dimension' ? ['2', '3'] : undefined);
  if (listKey === 'pointSigns')
    return (
      <label className="label">
        {title}
        <select
          className="field"
          value={value === null ? 'none' : String(value)}
          onChange={(event) =>
            onChange(event.target.value === 'none' ? null : event.target.value)
          }
        >
          <option value="none">Aucun signe prescrit</option>
          <option value="0">0</option>
          <option value="excluded">Point exclu</option>
        </select>
      </label>
    );
  if (selectOptions)
    return (
      <label className="label">
        {title}
        <select
          className="field"
          value={String(value ?? '')}
          onChange={(event) =>
            onChange(
              key === 'dimension'
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        >
          {selectOptions.map((option) => (
            <option key={option} value={option}>
              {choiceLabels[option] ?? option}
            </option>
          ))}
        </select>
      </label>
    );
  if (typeof value === 'boolean')
    return (
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-600"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
        />
        {title}
      </label>
    );
  if (
    typeof value === 'number' ||
    numberFields.has(key) ||
    ['values', 'exclusions'].includes(listKey ?? '')
  )
    return (
      <label className="label">
        {title}
        <input
          type="number"
          step="any"
          className="field"
          value={
            typeof value === 'number' && Number.isFinite(value) ? value : ''
          }
          aria-invalid={typeof value !== 'number' || !Number.isFinite(value)}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
      </label>
    );
  if (mathFields.has(key) || mathFields.has(listKey ?? ''))
    return (
      <MathInput
        label={title}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        disabled={locked}
      />
    );
  if (key === 'color')
    return (
      <label className="label">
        {title}
        <input
          type="color"
          className="mt-2 block h-10 w-20 rounded border border-slate-200"
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  const multiline =
    ['text', 'expectedTexts'].includes(key) || listKey === 'expectedTexts';
  return (
    <label className="label">
      {title}
      {multiline ? (
        <textarea
          className="field min-h-24"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="field"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
