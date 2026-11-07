'use client';

import type {
  ComparisonConstraint,
  ComparisonOperand,
  ExerciseDefinition,
  VariableDefinition,
} from 'novlearn-exercise-engine';
import { CanonicalFields } from './canonical-fields';
import { MathInput } from './math-input';
import {
  asEditorObject,
  variableLabels,
  variableTemplate,
  nextParameterName,
} from '@/lib/creator';

const operators: ComparisonConstraint['operator'][] = [
  '!=',
  '==',
  '<',
  '<=',
  '>',
  '>=',
];
const operatorLabels: Record<ComparisonConstraint['operator'], string> = {
  '!=': 'est différent de',
  '==': 'est égal à',
  '<': 'est inférieur à',
  '<=': 'est inférieur ou égal à',
  '>': 'est supérieur à',
  '>=': 'est supérieur ou égal à',
};
const inputClass = 'field';
const variableNames = (variable: VariableDefinition) =>
  variable.kind === 'tuple'
    ? variable.components.map((component) => component.name)
    : 'name' in variable
      ? [variable.name]
      : [];

function parseList(value: string) {
  return value
    .split(',')
    .filter((part) => part.trim() !== '')
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="label">
      {label}
      <input
        className={inputClass}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function OperandEditor({
  label,
  value,
  names,
  onChange,
  disabled,
}: {
  label: string;
  value: ComparisonOperand;
  names: string[];
  onChange: (value: ComparisonOperand) => void;
  disabled: boolean;
}) {
  const mode =
    'variable' in value
      ? 'variable'
      : 'constant' in value
        ? 'constant'
        : 'latex';
  return (
    <div className="space-y-2">
      <label className="label">
        {label}
        <select
          className={inputClass}
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            onChange(
              next === 'variable'
                ? { variable: names[0] ?? '' }
                : next === 'constant'
                  ? { constant: 0 }
                  : { latex: '' },
            );
          }}
        >
          <option value="variable">Une variable tirée</option>
          <option value="constant">Une valeur fixe</option>
          <option value="latex">Une expression (avancé)</option>
        </select>
      </label>
      {mode === 'variable' && (
        <select
          aria-label={`${label} : variable`}
          className={inputClass}
          value={'variable' in value ? value.variable : ''}
          onChange={(event) => onChange({ variable: event.target.value })}
        >
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
      {mode === 'constant' && (
        <input
          aria-label={`${label} : valeur fixe`}
          className={inputClass}
          type="number"
          value={'constant' in value ? value.constant : 0}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) onChange({ constant: next });
          }}
        />
      )}
      {mode === 'latex' && (
        <MathInput
          label={`${label} : expression`}
          value={'latex' in value ? value.latex : ''}
          onChange={(latex) => onChange({ latex })}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ConstraintSummary({
  constraint,
}: {
  constraint: ComparisonConstraint;
}) {
  const operand = (value: ComparisonOperand) =>
    'variable' in value
      ? value.variable
      : 'constant' in value
        ? String(value.constant)
        : 'expression';
  const op = operatorLabels[constraint.operator];
  return (
    <p className="mt-3 text-sm text-slate-600">
      L’Engine garde les tirages où{' '}
      <strong>
        {operand(constraint.left)} {op} {operand(constraint.right)}
      </strong>
      .
    </p>
  );
}

export function GenerationEditor({
  definition,
  onChange,
  disabled,
}: {
  definition: ExerciseDefinition;
  onChange: (definition: ExerciseDefinition) => void;
  disabled: boolean;
}) {
  const generation = definition.generation;
  const names = generation.definitions.flatMap((item) =>
    item.kind === 'tuple'
      ? item.components.map((part) => part.name)
      : 'name' in item
        ? [item.name]
        : [],
  );
  const setGeneration = (next: ExerciseDefinition['generation']) =>
    onChange({ ...definition, generation: next });
  const patchVariable = (index: number, next: VariableDefinition) => {
    const previous = generation.definitions[index];
    const previousName =
      previous && (previous.kind === 'tuple' ? previous.id : previous.name);
    const nextName = next.kind === 'tuple' ? next.id : next.name;
    const constraints =
      previousName && previousName !== nextName
        ? generation.constraints.map((constraint) => ({
            ...constraint,
            left:
              'variable' in constraint.left &&
              constraint.left.variable === previousName
                ? { variable: nextName }
                : constraint.left,
            right:
              'variable' in constraint.right &&
              constraint.right.variable === previousName
                ? { variable: nextName }
                : constraint.right,
          }))
        : generation.constraints;
    setGeneration({
      ...generation,
      definitions: generation.definitions.map((item, i) =>
        i === index ? next : item,
      ),
      constraints,
    });
  };
  const addConstraint = () => {
    if (!names.length) return;
    setGeneration({
      ...generation,
      constraints: [
        ...generation.constraints,
        {
          kind: 'comparison',
          left: { variable: names[0] },
          operator: '!=',
          right: { constant: 0 },
        },
      ],
    });
  };

  return (
    <fieldset disabled={disabled} className="space-y-6">
      <details className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-blue-950">
          Comprendre les variables, les références et les contraintes
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          <p>
            <strong>Variable</strong> : valeur tirée par l’Engine pour créer une
            variante, par exemple un entier entre 1 et 10.
          </p>
          <p>
            <strong>Dans un champ texte</strong> (énoncé, question, choix ou
            réponse attendue en texte), utilisez{' '}
            <code className="rounded bg-white px-1 font-mono">@a</code> pour
            afficher la valeur tirée. Écrivez{' '}
            <code className="rounded bg-white px-1 font-mono">@@</code> pour
            afficher un arobase littéral.
          </p>
          <p>
            <strong>Dans une formule ou une réponse mathématique</strong>,
            utilisez{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">
              \mathrm&#123;a&#125;
            </code>
            . Le nom exact est délimité :{' '}
            <code className="rounded bg-white px-1 font-mono">
              \mathrm&#123;a&#125;
            </code>{' '}
            et{' '}
            <code className="rounded bg-white px-1 font-mono">
              \mathrm&#123;aa&#125;
            </code>{' '}
            désignent deux variables différentes.
            <code className="rounded bg-white px-1 font-mono">@a</code> n’est
            pas une référence mathématique.
          </p>
          <p>
            <strong>Contrainte</strong> : règle qui rejette certains tirages,
            par exemple a doit être différent de b. L’aperçu en bas de page
            montre un tirage concret ; génération et calculs restent exécutés
            par l’Exercise Engine.
          </p>
        </div>
      </details>

      <section aria-labelledby="random-variables-heading" className="space-y-4">
        <div>
          <h3 id="random-variables-heading" className="font-semibold">
            Valeurs qui changent d’un exercice à l’autre
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Définissez le domaine possible de chaque valeur.
          </p>
        </div>
        <AddVariable
          disabled={disabled}
          definition={definition}
          onChange={onChange}
        />
        {!generation.definitions.length && (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Aucune variable aléatoire. L’exercice gardera les mêmes valeurs à
            chaque génération.
          </p>
        )}
        {generation.definitions.map((variable, index) => (
          <article
            key={index}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">
                {variableLabels[variable.kind]} ·{' '}
                {'name' in variable ? variable.name : variable.id}
              </h4>
              <button
                type="button"
                disabled={disabled}
                className="text-sm text-red-700"
                onClick={() =>
                  setGeneration({
                    ...generation,
                    definitions: generation.definitions.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Retirer
              </button>
            </div>
            {!!variableNames(variable).length && (
              <p className="text-sm text-slate-600">
                Référence texte :{' '}
                {variableNames(variable).map((name) => (
                  <code
                    key={`text-${name}`}
                    className="mr-2 rounded bg-slate-100 px-1.5 py-1 font-mono text-emerald-800"
                  >{`@${name}`}</code>
                ))}
                <span className="ml-2">· Formule :</span>{' '}
                {variableNames(variable).map((name) => (
                  <code
                    key={name}
                    className="mr-2 rounded bg-slate-100 px-1.5 py-1 font-mono text-blue-800"
                  >{`\\mathrm{${name}}`}</code>
                ))}
              </p>
            )}
            {variable.kind === 'integer' && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="label">
                    Nom
                    <input
                      className={inputClass}
                      value={variable.name}
                      onChange={(e) =>
                        patchVariable(index, {
                          ...variable,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <NumberField
                    label="Minimum"
                    value={variable.min}
                    onChange={(min) =>
                      patchVariable(index, { ...variable, min })
                    }
                  />
                  <NumberField
                    label="Maximum"
                    value={variable.max}
                    onChange={(max) =>
                      patchVariable(index, { ...variable, max })
                    }
                  />
                </div>
                <label className="label">
                  Valeurs à exclure{' '}
                  <input
                    className={inputClass}
                    placeholder="Ex. 0, -1"
                    value={variable.exclusions.join(', ')}
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        exclusions: parseList(e.target.value),
                      })
                    }
                  />
                  <span className="text-xs font-normal text-slate-500">
                    Facultatif · séparées par des virgules
                  </span>
                </label>
              </>
            )}
            {variable.kind === 'decimal' && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="label">
                    Nom
                    <input
                      className={inputClass}
                      value={variable.name}
                      onChange={(e) =>
                        patchVariable(index, {
                          ...variable,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <NumberField
                    label="Minimum"
                    value={variable.min}
                    onChange={(min) =>
                      patchVariable(index, { ...variable, min })
                    }
                  />
                  <NumberField
                    label="Maximum"
                    value={variable.max}
                    onChange={(max) =>
                      patchVariable(index, { ...variable, max })
                    }
                  />
                  <NumberField
                    label="Décimales"
                    value={variable.precision}
                    min={0}
                    max={6}
                    onChange={(precision) =>
                      patchVariable(index, {
                        ...variable,
                        precision: Math.min(
                          6,
                          Math.max(0, Math.trunc(precision)),
                        ),
                      })
                    }
                  />
                </div>
                <label className="label">
                  Valeurs à exclure{' '}
                  <input
                    className={inputClass}
                    placeholder="Ex. 0, 1.5"
                    value={variable.exclusions.join(', ')}
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        exclusions: parseList(e.target.value),
                      })
                    }
                  />
                </label>
              </>
            )}
            {variable.kind === 'choice' && (
              <>
                <label className="label">
                  Nom
                  <input
                    className={inputClass}
                    value={variable.name}
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="label">
                  Valeurs possibles{' '}
                  <input
                    className={inputClass}
                    value={variable.values.join(', ')}
                    placeholder="Ex. 2, 4, 8"
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        values: parseList(e.target.value),
                      })
                    }
                  />
                  <span className="text-xs font-normal text-slate-500">
                    L’Engine choisit parmi ces nombres.
                  </span>
                </label>
                <label className="label">
                  Valeurs à exclure{' '}
                  <input
                    className={inputClass}
                    value={(variable.exclusions ?? []).join(', ')}
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        exclusions: parseList(e.target.value),
                      })
                    }
                  />
                </label>
              </>
            )}
            {variable.kind === 'computed' && (
              <>
                <label className="label">
                  Nom
                  <input
                    className={inputClass}
                    value={variable.name}
                    onChange={(e) =>
                      patchVariable(index, {
                        ...variable,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <MathInput
                  label="Formule calculée"
                  description="Référencez une variable avec sa forme exacte, par exemple \\mathrm{a}+1."
                  value={variable.latex}
                  onChange={(latex) =>
                    patchVariable(index, { ...variable, latex })
                  }
                  disabled={disabled}
                />
                <details className="rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Restrictions du résultat (avancé)
                  </summary>
                  <div className="mt-3">
                    <CanonicalFields
                      value={asEditorObject(
                        variable.restrictions ?? { domain: 'rational' },
                      )}
                      path={`/generation/definitions/${index}/restrictions`}
                      onChange={(value) =>
                        patchVariable(index, {
                          ...variable,
                          restrictions: value as unknown as NonNullable<
                            typeof variable.restrictions
                          >,
                        })
                      }
                    />
                  </div>
                </details>
              </>
            )}
            {variable.kind === 'tuple' && (
              <details className="rounded-lg bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Paramètres du groupe (avancé)
                </summary>
                <div className="mt-3">
                  <CanonicalFields
                    value={asEditorObject(variable)}
                    path={`/generation/definitions/${index}`}
                    onChange={(value) =>
                      patchVariable(
                        index,
                        value as unknown as VariableDefinition,
                      )
                    }
                  />
                </div>
              </details>
            )}
          </article>
        ))}
      </section>

      <section
        aria-labelledby="generation-rules-heading"
        className="space-y-4 border-t border-slate-200 pt-5"
      >
        <div>
          <h3 id="generation-rules-heading" className="font-semibold">
            Règles entre valeurs
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Ajoutez une règle seulement si certains tirages doivent être
            refusés.
          </p>
        </div>
        {generation.constraints.map((constraint, index) => (
          <article
            key={index}
            className="space-y-3 rounded-xl border border-slate-200 p-4"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <OperandEditor
                label="La valeur de gauche"
                value={constraint.left}
                names={names}
                disabled={disabled}
                onChange={(left) =>
                  setGeneration({
                    ...generation,
                    constraints: generation.constraints.map((item, i) =>
                      i === index ? { ...item, left } : item,
                    ),
                  })
                }
              />
              <label className="label">
                Doit être
                <select
                  className={inputClass}
                  value={constraint.operator}
                  onChange={(e) =>
                    setGeneration({
                      ...generation,
                      constraints: generation.constraints.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              operator: e.target
                                .value as ComparisonConstraint['operator'],
                            }
                          : item,
                      ),
                    })
                  }
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {operatorLabels[op]}
                    </option>
                  ))}
                </select>
              </label>
              <OperandEditor
                label="La valeur de droite"
                value={constraint.right}
                names={names}
                disabled={disabled}
                onChange={(right) =>
                  setGeneration({
                    ...generation,
                    constraints: generation.constraints.map((item, i) =>
                      i === index ? { ...item, right } : item,
                    ),
                  })
                }
              />
            </div>
            <ConstraintSummary constraint={constraint} />
            <button
              type="button"
              disabled={disabled}
              className="text-sm text-red-700"
              onClick={() =>
                setGeneration({
                  ...generation,
                  constraints: generation.constraints.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            >
              Retirer cette règle
            </button>
          </article>
        ))}
        <button
          type="button"
          disabled={disabled || !names.length}
          className="button button-secondary"
          onClick={addConstraint}
        >
          ＋ Ajouter une règle
        </button>
      </section>
    </fieldset>
  );
}

function AddVariable({
  definition,
  onChange,
  disabled,
}: {
  definition: ExerciseDefinition;
  onChange: (definition: ExerciseDefinition) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="mb-3">
        <h4 className="font-semibold text-slate-900">Ajouter une variable</h4>
        <p className="mt-1 text-sm text-slate-600">
          Choisissez directement le type de valeur à créer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['integer', '＋ Entier'],
            ['decimal', '＋ Décimal'],
            ['choice', '＋ Liste de valeurs'],
            ['computed', '＋ Valeur calculée'],
            ['tuple', '＋ Doublet'],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            className="button button-secondary"
            onClick={() =>
              onChange({
                ...definition,
                generation: {
                  ...definition.generation,
                  definitions: [
                    ...definition.generation.definitions,
                    variableTemplate(kind, nextParameterName(definition)),
                  ],
                },
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
