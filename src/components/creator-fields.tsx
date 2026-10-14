'use client';
import { useState } from 'react';
import type {
  ExerciseDefinition,
  ExerciseElement,
  VariableDefinition,
  JsonValue,
} from 'novlearn-exercise-engine';
import { CanonicalFields, CreatorLockedContext } from './canonical-fields';
import {
  asEditorObject,
  elementLabels,
  elementTemplate,
  variableLabels,
  variableTemplate,
  moveItem,
  duplicateElement,
  changeQuestionKind,
  nextParameterName,
} from '@/lib/creator';

export function CreatorFields({
  definition,
  onChange,
  disabled = false,
}: {
  definition: ExerciseDefinition;
  onChange: (definition: ExerciseDefinition) => void;
  disabled?: boolean;
}) {
  const [type, setType] = useState<ExerciseElement['type']>('question');
  const [kind, setKind] = useState<VariableDefinition['kind']>('integer');
  const fresh = () => `element-${crypto.randomUUID()}`;
  const updateElements = (elements: ExerciseElement[]) =>
    onChange({ ...definition, elements });
  const updateGeneration = (generation: ExerciseDefinition['generation']) =>
    onChange({ ...definition, generation });
  const patchElement = (index: number, value: JsonValue) => {
    let next = value as unknown as ExerciseElement;
    const previous = definition.elements[index];
    if (
      previous.type === 'question' &&
      next.type === 'question' &&
      previous.response &&
      next.response &&
      next.response.kind !== previous.response.kind
    )
      next = changeQuestionKind(next, next.response.kind);
    updateElements(
      definition.elements.map((old, position) =>
        position === index ? next : old,
      ),
    );
  };
  return (
    <CreatorLockedContext.Provider value={disabled}>
      <div className="mt-8 space-y-8 border-t border-slate-200 pt-8">
        <section aria-labelledby="variables-heading">
          <div className="mb-5">
            <h2 id="variables-heading" className="text-xl font-semibold">
              Variables et génération
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Définissez vos paramètres, leurs exclusions et les contraintes.
              L’Engine vérifie leurs dépendances et réalise les calculs.
            </p>
          </div>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label className="label">
              Nouveau paramètre
              <select
                className="field"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as VariableDefinition['kind'])
                }
              >
                {Object.entries(variableLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button"
              onClick={() =>
                updateGeneration({
                  ...definition.generation,
                  definitions: [
                    ...definition.generation.definitions,
                    variableTemplate(kind, nextParameterName(definition)),
                  ],
                })
              }
            >
              ＋ Ajouter un paramètre
            </button>
          </div>
          <div className="space-y-4">
            {definition.generation.definitions.map((variable, index) => (
              <details
                key={index}
                open
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <summary className="cursor-pointer font-semibold text-slate-700">
                  {variableLabels[variable.kind]} ·{' '}
                  {'name' in variable ? variable.name : variable.id}
                </summary>
                <div className="mt-4">
                  <CanonicalFields
                    value={asEditorObject(variable)}
                    path={`/generation/definitions/${index}`}
                    label="Famille du paramètre"
                    onChange={(value) =>
                      updateGeneration({
                        ...definition.generation,
                        definitions: definition.generation.definitions.map(
                          (old, position) =>
                            position === index
                              ? (value as unknown as VariableDefinition)
                              : old,
                        ),
                      })
                    }
                  />
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      className="text-sm text-blue-700"
                      disabled={index === 0}
                      onClick={() =>
                        updateGeneration({
                          ...definition.generation,
                          definitions: moveItem(
                            definition.generation.definitions,
                            index,
                            -1,
                          ),
                        })
                      }
                    >
                      ↑ Monter
                    </button>
                    <button
                      type="button"
                      className="text-sm text-blue-700"
                      disabled={
                        index === definition.generation.definitions.length - 1
                      }
                      onClick={() =>
                        updateGeneration({
                          ...definition.generation,
                          definitions: moveItem(
                            definition.generation.definitions,
                            index,
                            1,
                          ),
                        })
                      }
                    >
                      ↓ Descendre
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-700"
                      onClick={() =>
                        updateGeneration({
                          ...definition.generation,
                          definitions: definition.generation.definitions.filter(
                            (_, position) => position !== index,
                          ),
                        })
                      }
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <details className="mt-5 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Contraintes de génération
            </summary>
            <div className="mt-4 space-y-4">
              {definition.generation.constraints.map((constraint, index) => (
                <div key={index} className="rounded-lg bg-slate-50 p-4">
                  <CanonicalFields
                    value={asEditorObject(constraint)}
                    path={`/generation/constraints/${index}`}
                    onChange={(value) =>
                      updateGeneration({
                        ...definition.generation,
                        constraints: definition.generation.constraints.map(
                          (old, position) =>
                            position === index
                              ? (value as unknown as typeof constraint)
                              : old,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="mt-4 text-sm text-red-700"
                    onClick={() =>
                      updateGeneration({
                        ...definition.generation,
                        constraints: definition.generation.constraints.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    Retirer cette contrainte
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button"
                onClick={() =>
                  updateGeneration({
                    ...definition.generation,
                    constraints: [
                      ...definition.generation.constraints,
                      {
                        kind: 'comparison',
                        left: { variable: '' },
                        operator: '!=',
                        right: { constant: 0 },
                      },
                    ],
                  })
                }
              >
                ＋ Ajouter une contrainte
              </button>
            </div>
          </details>
          <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Variables formelles et budgets
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Les variables formelles, comme x, ne sont pas tirées au hasard.
              Les budgets limitent les essais de génération.
            </p>
            <div className="mt-4 space-y-4">
              {definition.variables.map((variable, index) => (
                <div key={index} className="rounded-lg bg-slate-50 p-4">
                  <CanonicalFields
                    value={asEditorObject(variable)}
                    path={`/variables/${index}`}
                    onChange={(value) =>
                      onChange({
                        ...definition,
                        variables: definition.variables.map((old, position) =>
                          position === index
                            ? (value as unknown as typeof variable)
                            : old,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="mt-3 text-sm text-red-700"
                    onClick={() =>
                      onChange({
                        ...definition,
                        variables: definition.variables.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button"
                onClick={() =>
                  onChange({
                    ...definition,
                    variables: [
                      ...definition.variables,
                      { name: 'x', domain: 'real' },
                    ],
                  })
                }
              >
                ＋ Ajouter une variable formelle
              </button>
              <div className="grid gap-4 md:grid-cols-2">
                <CanonicalFields
                  value={definition.generation.maxAttempts}
                  path="/generation/maxAttempts"
                  onChange={(value) =>
                    updateGeneration({
                      ...definition.generation,
                      maxAttempts: Number(value),
                    })
                  }
                />
                <CanonicalFields
                  value={definition.generation.maxDraws}
                  path="/generation/maxDraws"
                  onChange={(value) =>
                    updateGeneration({
                      ...definition.generation,
                      maxDraws: Number(value),
                    })
                  }
                />
              </div>
            </div>
          </details>
        </section>
        <section aria-labelledby="elements-heading">
          <h2 id="elements-heading" className="text-xl font-semibold">
            Énoncé et questions
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajoutez et organisez les éléments. Réponses attendues, indications
            et explications restent privées.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="label">
              Nouvel élément
              <select
                className="field"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as ExerciseElement['type'])
                }
              >
                {Object.entries(elementLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button"
              onClick={() =>
                updateElements([
                  ...definition.elements,
                  elementTemplate(type, fresh()),
                ])
              }
            >
              ＋ Ajouter un élément
            </button>
          </div>
          {definition.elements.length === 0 && (
            <p className="mt-5 rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
              Ajoutez votre premier élément pour composer l’exercice.
            </p>
          )}
          <div className="mt-5 space-y-5">
            {definition.elements.map((element, index) => (
              <details
                key={index}
                open
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <summary className="cursor-pointer font-semibold">
                  {index + 1}. {elementLabels[element.type]}
                </summary>
                <div className="mt-5">
                  <CanonicalFields
                    value={asEditorObject(element)}
                    path={`/elements/${index}`}
                    onChange={(value) => patchElement(index, value)}
                  />
                  {element.type === 'question' && (
                    <p className="mt-4 text-xs leading-5 text-slate-500">
                      Changer le type de réponse réinitialise l’attendu et la
                      politique de correction. La validation officielle vérifie
                      leur compatibilité.
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-700"
                      disabled={index === 0}
                      onClick={() =>
                        updateElements(moveItem(definition.elements, index, -1))
                      }
                    >
                      ↑ Monter
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-700"
                      disabled={index === definition.elements.length - 1}
                      onClick={() =>
                        updateElements(moveItem(definition.elements, index, 1))
                      }
                    >
                      ↓ Descendre
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-blue-700"
                      onClick={() =>
                        updateElements([
                          ...definition.elements.slice(0, index + 1),
                          duplicateElement(element, fresh()),
                          ...definition.elements.slice(index + 1),
                        ])
                      }
                    >
                      Dupliquer
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-700"
                      onClick={() =>
                        updateElements(
                          definition.elements.filter(
                            (_, position) => position !== index,
                          ),
                        )
                      }
                    >
                      Retirer cet élément
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </CreatorLockedContext.Provider>
  );
}
