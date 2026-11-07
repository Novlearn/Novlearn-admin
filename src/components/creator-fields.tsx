'use client';
import type {
  ExerciseDefinition,
  ExerciseElement,
  JsonValue,
  RichFragment,
} from 'novlearn-exercise-engine';
import { CanonicalFields, CreatorLockedContext } from './canonical-fields';
import { GenerationEditor } from './generation-editor';
import { MathInput } from './math-input';
import {
  asEditorObject,
  elementLabels,
  elementTemplate,
  moveItem,
  duplicateElement,
  changeQuestionKind,
} from '@/lib/creator';

function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: RichFragment[];
  onChange: (value: RichFragment[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, next: RichFragment) =>
    onChange(
      value.map((fragment, position) => (position === index ? next : fragment)),
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Assemblez du texte et des formules. Vous pouvez mettre un fragment de
        texte en gras ou en italique.
      </p>
      {value.map((fragment, index) => (
        <article
          key={index}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <strong className="text-sm">
              {fragment.type === 'text'
                ? 'Texte'
                : fragment.display === 'block'
                  ? 'Formule sur sa ligne'
                  : 'Formule dans le texte'}
            </strong>
            <button
              type="button"
              className="text-sm text-red-700"
              disabled={disabled || value.length === 1}
              onClick={() =>
                onChange(value.filter((_, position) => position !== index))
              }
            >
              Retirer
            </button>
          </div>
          {fragment.type === 'text' ? (
            <>
              <textarea
                className="field min-h-20"
                aria-label={`Texte ${index + 1}`}
                value={fragment.text}
                disabled={disabled}
                onChange={(event) =>
                  update(index, { ...fragment, text: event.target.value })
                }
              />
              <label className="label max-w-xs">
                Mise en forme
                <select
                  className="field"
                  value={fragment.emphasis ?? 'normal'}
                  disabled={disabled}
                  onChange={(event) => {
                    const plain: Extract<RichFragment, { type: 'text' }> = {
                      type: 'text',
                      text: fragment.text,
                    };
                    const emphasis = event.target.value;
                    update(
                      index,
                      emphasis === 'normal'
                        ? plain
                        : {
                            ...plain,
                            emphasis: emphasis as 'strong' | 'emphasis',
                          },
                    );
                  }}
                >
                  <option value="normal">Normale</option>
                  <option value="strong">Gras</option>
                  <option value="emphasis">Italique</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <MathInput
                label={`Formule ${index + 1}`}
                value={fragment.latex}
                disabled={disabled}
                onChange={(latex) => update(index, { ...fragment, latex })}
              />
              <label className="label max-w-xs">
                Disposition
                <select
                  className="field"
                  value={fragment.display}
                  disabled={disabled}
                  onChange={(event) =>
                    update(index, {
                      ...fragment,
                      display: event.target.value as 'inline' | 'block',
                    })
                  }
                >
                  <option value="inline">Dans le texte</option>
                  <option value="block">Sur sa ligne</option>
                </select>
              </label>
            </>
          )}
        </article>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled}
          onClick={() => onChange([...value, { type: 'text', text: '' }])}
        >
          ＋ Ajouter du texte
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled}
          onClick={() =>
            onChange([...value, { type: 'math', latex: '', display: 'inline' }])
          }
        >
          ＋ Ajouter une formule
        </button>
      </div>
    </div>
  );
}

function MultipleChoiceEditor({
  element,
  onChange,
  disabled,
}: {
  element: Extract<ExerciseElement, { type: 'mcq' }>;
  onChange: (value: Extract<ExerciseElement, { type: 'mcq' }>) => void;
  disabled: boolean;
}) {
  const toggleAnswer = (id: string, selected: boolean) =>
    onChange({
      ...element,
      expectedOptionIds: selected
        ? element.mode === 'single'
          ? [id]
          : [...element.expectedOptionIds, id]
        : element.expectedOptionIds.filter((optionId) => optionId !== id),
    });
  return (
    <div className="space-y-5">
      <label className="label">
        Question
        <textarea
          className="field min-h-24"
          value={element.text}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...element, text: event.target.value })
          }
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="label">
          Type de QCM
          <select
            className="field"
            value={element.mode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...element,
                mode: event.target.value as 'single' | 'multiple',
                expectedOptionIds:
                  event.target.value === 'single'
                    ? element.expectedOptionIds.slice(0, 1)
                    : element.expectedOptionIds,
              })
            }
          >
            <option value="single">Une seule bonne réponse</option>
            <option value="multiple">Plusieurs bonnes réponses</option>
          </select>
        </label>
        <label className="label">
          Points
          <input
            className="field"
            type="number"
            min={0}
            step="any"
            value={element.points}
            disabled={disabled}
            onChange={(event) => {
              const points = event.currentTarget.valueAsNumber;
              if (Number.isFinite(points)) onChange({ ...element, points });
            }}
          />
        </label>
      </div>
      <fieldset className="space-y-3">
        <legend className="label">
          Choix proposés · cochez la ou les bonnes réponses
        </legend>
        {element.options.map((option, index) => (
          <div
            key={option.id}
            className="flex gap-3 rounded-lg border border-slate-200 p-3"
          >
            <input
              type={element.mode === 'single' ? 'radio' : 'checkbox'}
              name={`correct-${element.id}`}
              aria-label={`Choix ${index + 1} correct`}
              checked={element.expectedOptionIds.includes(option.id)}
              disabled={disabled}
              onChange={(event) =>
                toggleAnswer(option.id, event.target.checked)
              }
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Choix {index + 1}</span>
                <button
                  type="button"
                  className="text-sm text-red-700"
                  disabled={disabled || element.options.length <= 2}
                  onClick={() =>
                    onChange({
                      ...element,
                      options: element.options.filter(
                        (_, position) => position !== index,
                      ),
                      expectedOptionIds: element.expectedOptionIds.filter(
                        (id) => id !== option.id,
                      ),
                    })
                  }
                >
                  Retirer
                </button>
              </div>
              <label className="label">
                Contenu
                <select
                  className="field"
                  value={option.content.format}
                  disabled={disabled}
                  onChange={(event) => {
                    const content =
                      event.target.value === 'latex'
                        ? { format: 'latex' as const, latex: '' }
                        : { format: 'text' as const, text: '' };
                    onChange({
                      ...element,
                      options: element.options.map((old, position) =>
                        position === index ? { ...old, content } : old,
                      ),
                    });
                  }}
                >
                  <option value="text">Texte</option>
                  <option value="latex">Formule</option>
                </select>
              </label>
              {option.content.format === 'text' ? (
                <textarea
                  className="field min-h-16"
                  aria-label={`Contenu du choix ${index + 1}`}
                  value={option.content.text}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...element,
                      options: element.options.map((old, position) =>
                        position === index
                          ? {
                              ...old,
                              content: {
                                ...option.content,
                                text: event.target.value,
                              },
                            }
                          : old,
                      ),
                    })
                  }
                />
              ) : (
                <MathInput
                  label={`Formule du choix ${index + 1}`}
                  value={option.content.latex}
                  disabled={disabled}
                  onChange={(latex) =>
                    onChange({
                      ...element,
                      options: element.options.map((old, position) =>
                        position === index
                          ? { ...old, content: { ...option.content, latex } }
                          : old,
                      ),
                    })
                  }
                />
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...element,
              options: [
                ...element.options,
                {
                  id: `option-${crypto.randomUUID()}`,
                  content: { format: 'text', text: '' },
                },
              ],
            })
          }
        >
          ＋ Ajouter un choix
        </button>
      </fieldset>
    </div>
  );
}

export function CreatorFields({
  definition,
  onChange,
  disabled = false,
}: {
  definition: ExerciseDefinition;
  onChange: (definition: ExerciseDefinition) => void;
  disabled?: boolean;
}) {
  const fresh = () => `element-${crypto.randomUUID()}`;
  const addElement = (elementType: ExerciseElement['type']) =>
    updateElements([
      ...definition.elements,
      elementTemplate(elementType, fresh()),
    ]);
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
      <div className="mt-8 flex flex-col gap-8 border-t border-slate-200 pt-8">
        <details
          open
          aria-labelledby="variables-heading"
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-5"
        >
          <summary className="cursor-pointer list-none">
            <span
              className="block text-base font-semibold"
              id="variables-heading"
            >
              Variables aléatoires et contraintes
            </span>
            <span className="mt-1 block text-sm font-normal text-slate-500">
              {definition.generation.definitions.length ||
              definition.generation.constraints.length ||
              definition.variables.length
                ? `${definition.generation.definitions.length} variable(s) · ${definition.generation.constraints.length} règle(s)`
                : 'Créez des variables pour faire varier les valeurs de cet exercice.'}
            </span>
          </summary>
          <div className="mt-5 space-y-6">
            <GenerationEditor
              definition={definition}
              onChange={onChange}
              disabled={disabled}
            />
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
                          variables: definition.variables.map(
                            (old, position) =>
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
          </div>
        </details>
        <section aria-labelledby="elements-heading">
          <h2 id="elements-heading" className="text-xl font-semibold">
            Énoncé et questions
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajoutez le texte de l’énoncé, les questions et leurs réponses
            attendues. Les réponses restent privées.
          </p>
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              Ajouter à l’exercice
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['question', '＋ Question'],
                  ['rich-text', '＋ Texte'],
                  ['mcq', '＋ QCM'],
                ] as const
              ).map(([elementType, label]) => (
                <button
                  key={elementType}
                  type="button"
                  disabled={disabled}
                  className="button button-secondary"
                  onClick={() => addElement(elementType)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Dans ce bloc, vous pouvez mélanger texte, formules, gras et
              italique.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-800">
                Autres éléments pédagogiques
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Les autres éléments ajoutent des tableaux, graphiques ou schémas
                structurés.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(elementLabels)
                  .filter(
                    ([elementType]) =>
                      ![
                        'question',
                        'text',
                        'rich-text',
                        'mcq',
                        'expression',
                      ].includes(elementType) &&
                      !['hint', 'explanation'].includes(elementType),
                  )
                  .map(([elementType, label]) => (
                    <button
                      key={elementType}
                      type="button"
                      disabled={disabled}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                      onClick={() =>
                        addElement(elementType as ExerciseElement['type'])
                      }
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </details>
          </div>
          {definition.elements.length === 0 && (
            <p className="mt-5 rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
              Ajoutez votre premier élément pour composer l’exercice.
            </p>
          )}
          <div className="mt-5 space-y-5">
            {definition.elements.map((element, index) => (
              <details
                key={element.id}
                open
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <summary className="cursor-pointer font-semibold">
                  {index + 1}. {elementLabels[element.type]}
                </summary>
                <div className="mt-5">
                  {element.type === 'text' || element.type === 'section' ? (
                    <label className="label">
                      {element.type === 'section'
                        ? 'Titre de section'
                        : 'Texte de l’énoncé'}
                      <textarea
                        className="field min-h-28"
                        value={element.text}
                        disabled={disabled}
                        onChange={(event) =>
                          patchElement(index, {
                            ...element,
                            text: event.target.value,
                          })
                        }
                      />
                    </label>
                  ) : element.type === 'expression' ||
                    element.type === 'equation' ? (
                    <div className="space-y-4">
                      {element.type === 'expression' && (
                        <label className="label">
                          Légende (facultative)
                          <input
                            className="field"
                            value={element.label ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                              patchElement(index, {
                                ...element,
                                label: event.target.value,
                              } as unknown as JsonValue)
                            }
                          />
                        </label>
                      )}
                      <MathInput
                        label={
                          element.type === 'equation' ? 'Équation' : 'Formule'
                        }
                        value={element.latex}
                        disabled={disabled}
                        onChange={(latex) =>
                          patchElement(index, {
                            ...element,
                            latex,
                          } as unknown as JsonValue)
                        }
                      />
                    </div>
                  ) : element.type === 'rich-text' ? (
                    <RichTextEditor
                      value={element.content}
                      disabled={disabled}
                      onChange={(content) =>
                        patchElement(index, {
                          ...element,
                          content,
                        } as unknown as JsonValue)
                      }
                    />
                  ) : element.type === 'question' ? (
                    <div className="space-y-5">
                      <label className="label">
                        Question
                        <textarea
                          className="field min-h-24"
                          value={element.text}
                          disabled={disabled}
                          onChange={(event) =>
                            patchElement(index, {
                              ...element,
                              text: event.target.value,
                            } as unknown as JsonValue)
                          }
                        />
                      </label>
                      {element.expectedLatex !== undefined ? (
                        <MathInput
                          label="Réponse attendue"
                          value={element.expectedLatex}
                          disabled={disabled}
                          onChange={(expectedLatex) =>
                            patchElement(index, {
                              ...element,
                              expectedLatex,
                            } as unknown as JsonValue)
                          }
                        />
                      ) : (
                        <fieldset className="space-y-3">
                          <legend className="label">
                            Réponse(s) attendue(s)
                          </legend>
                          {(element.expectedTexts ?? ['']).map(
                            (expectedText, answerIndex) => (
                              <div
                                key={answerIndex}
                                className="flex items-center gap-2"
                              >
                                <input
                                  className="field mt-0"
                                  value={expectedText}
                                  disabled={disabled}
                                  aria-label={`Réponse textuelle attendue ${answerIndex + 1}`}
                                  onChange={(event) =>
                                    patchElement(index, {
                                      ...element,
                                      expectedTexts: element.expectedTexts.map(
                                        (text, position) =>
                                          position === answerIndex
                                            ? event.target.value
                                            : text,
                                      ),
                                    } as unknown as JsonValue)
                                  }
                                />
                                {element.expectedTexts.length > 1 && (
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    className="text-sm text-red-700"
                                    aria-label={`Retirer la réponse ${answerIndex + 1}`}
                                    onClick={() =>
                                      patchElement(index, {
                                        ...element,
                                        expectedTexts:
                                          element.expectedTexts.filter(
                                            (_, position) =>
                                              position !== answerIndex,
                                          ),
                                      } as unknown as JsonValue)
                                    }
                                  >
                                    Retirer
                                  </button>
                                )}
                              </div>
                            ),
                          )}
                          <button
                            type="button"
                            disabled={disabled}
                            className="text-sm font-medium text-blue-700"
                            onClick={() =>
                              patchElement(index, {
                                ...element,
                                expectedTexts: [...element.expectedTexts, ''],
                              } as unknown as JsonValue)
                            }
                          >
                            ＋ Accepter une autre réponse
                          </button>
                        </fieldset>
                      )}
                      <label className="label max-w-40">
                        Points
                        <input
                          className="field"
                          type="number"
                          min={0}
                          step="any"
                          value={element.points}
                          disabled={disabled}
                          onChange={(event) => {
                            const points = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(points))
                              patchElement(index, {
                                ...element,
                                points,
                              } as unknown as JsonValue);
                          }}
                        />
                      </label>
                      <details className="rounded-lg border border-slate-200 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                          Format de réponse et règles avancées
                        </summary>
                        <p className="mt-2 text-sm text-slate-500">
                          Le format et les règles définissent comment la réponse
                          sera vérifiée. La plupart des questions peuvent garder
                          le réglage proposé.
                        </p>
                        <div className="mt-4">
                          <CanonicalFields
                            value={asEditorObject({
                              response: element.response,
                              policy: element.policy,
                            })}
                            path={`/elements/${index}`}
                            onChange={(value) =>
                              patchElement(index, {
                                ...element,
                                ...(value as unknown as Pick<
                                  typeof element,
                                  'response' | 'policy'
                                >),
                              } as unknown as JsonValue)
                            }
                          />
                        </div>
                      </details>
                    </div>
                  ) : element.type === 'mcq' ? (
                    <MultipleChoiceEditor
                      element={element}
                      disabled={disabled}
                      onChange={(next) =>
                        patchElement(index, next as unknown as JsonValue)
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      <CanonicalFields
                        value={asEditorObject(element)}
                        path={`/elements/${index}`}
                        onChange={(value) => patchElement(index, value)}
                      />
                    </div>
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
