'use client';
import type {
  ExerciseDefinition,
  ExerciseElement,
  JsonValue,
  RichFragment,
} from 'novlearn-exercise-engine';
import {
  CanonicalFields,
  choiceLabels,
  CreatorLockedContext,
} from './canonical-fields';
import { GenerationEditor } from './generation-editor';
import { MathInput, MathParameters } from './math-input';
import {
  asEditorObject,
  elementLabels,
  elementTemplate,
  duplicateElement,
  changeQuestionKind,
  responseKinds,
} from '@/lib/creator';

type QuestionSupport = Extract<
  ExerciseElement,
  { type: 'hint' | 'explanation' }
>;

function isQuestionSupport(
  element: ExerciseElement,
): element is QuestionSupport {
  return element.type === 'hint' || element.type === 'explanation';
}

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
  const parameters = [
    ...new Set(
      definition.generation.definitions.flatMap((variable) =>
        variable.kind === 'tuple'
          ? (variable.components?.map((part) => part.name) ?? [])
          : [variable.name],
      ),
    ),
  ].filter(
    (name) => typeof name === 'string' && /^[a-z][A-Za-z0-9]{0,31}$/.test(name),
  );
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
    const next = value as unknown as ExerciseElement;
    updateElements(
      definition.elements.map((old, position) =>
        position === index ? next : old,
      ),
    );
  };
  const questionIds = new Set(
    definition.elements
      .filter(
        (element) => element.type === 'question' || element.type === 'mcq',
      )
      .map((element) => element.id),
  );
  const linkedSupport = new Map<
    string,
    { element: QuestionSupport; index: number }[]
  >();
  const visible = definition.elements.flatMap((element, index) => {
    if (
      isQuestionSupport(element) &&
      element.questionId &&
      questionIds.has(element.questionId) &&
      Array.isArray(element.content) &&
      element.content.every(
        (fragment) =>
          fragment && (fragment.type === 'text' || fragment.type === 'math'),
      )
    ) {
      const linked = linkedSupport.get(element.questionId) ?? [];
      linked.push({ element, index });
      linkedSupport.set(element.questionId, linked);
      return [];
    }
    return [{ element, index }];
  });
  function moveVisible(position: number, step: -1 | 1) {
    const target = visible[position + step];
    if (!target) return;
    const current = visible[position];
    const next = [...definition.elements];
    next[current.index] = target.element;
    next[target.index] = current.element;
    updateElements(next);
  }
  function addQuestionSupport(
    question: ExerciseElement,
    type: QuestionSupport['type'],
  ) {
    const support: QuestionSupport = {
      id: fresh(),
      type,
      questionId: question.id,
      content: [{ type: 'text', text: '' }],
    };
    updateElements([...definition.elements, support]);
  }
  return (
    <CreatorLockedContext.Provider value={disabled}>
      <div className="mt-8 flex flex-col gap-8 border-t border-slate-200 pt-8">
        <details
          open={
            !!(
              parameters.length ||
              definition.generation.constraints.length ||
              definition.variables.length
            )
          }
          aria-labelledby="variables-heading"
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-5"
        >
          <summary className="cursor-pointer list-none">
            <span
              className="block text-base font-semibold"
              id="variables-heading"
            >
              Variables et contraintes
            </span>
            <span className="mt-1 block text-sm font-normal text-slate-500">
              {definition.generation.definitions.length ||
              definition.generation.constraints.length ||
              definition.variables.length
                ? `${definition.generation.definitions.length} variable(s) · ${definition.generation.constraints.length} règle(s)`
                : null}
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
          {parameters.length > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              Dans le texte, utilisez <code>@{parameters[0]}</code>. Dans une
              formule, choisissez la variable sous le champ.
            </p>
          )}
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
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
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-800">
                Autres éléments
              </summary>
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
          <MathParameters.Provider value={parameters}>
            <div className="mt-5 space-y-5">
              {visible.map(({ element, index }, position) => (
                <details
                  key={element.id}
                  open
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <summary className="cursor-pointer font-semibold">
                    {position + 1}. {elementLabels[element.type]}
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
                        <label className="label max-w-sm">
                          Type de réponse
                          <select
                            className="field"
                            value={element.response.kind}
                            disabled={disabled}
                            onChange={(event) => {
                              const kind = event.target
                                .value as (typeof responseKinds)[number];
                              const switchesToOrFromText =
                                kind === 'text' ||
                                element.response.kind === 'text';
                              const hasAnswer =
                                element.expectedLatex?.trim() ||
                                element.expectedTexts?.some((text) =>
                                  text.trim(),
                                );
                              const hasRules =
                                element.policy.form !== 'value-only' ||
                                Object.keys(element.policy).length > 2 ||
                                element.response.variable;
                              if (
                                (hasRules ||
                                  (switchesToOrFromText && hasAnswer)) &&
                                !window.confirm(
                                  'Changer le type réinitialise les règles de correction et peut effacer une réponse incompatible. Continuer ?',
                                )
                              )
                                return;
                              patchElement(
                                index,
                                changeQuestionKind(
                                  element,
                                  kind,
                                ) as unknown as JsonValue,
                              );
                            }}
                          >
                            {responseKinds.map((kind) => (
                              <option key={kind} value={kind}>
                                {kind === 'rational'
                                  ? 'Nombre entier ou fraction'
                                  : kind === 'real'
                                    ? 'Nombre réel'
                                    : (choiceLabels[kind] ?? kind)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {element.response.kind !== 'text' ? (
                          <MathInput
                            label="Réponse attendue"
                            value={element.expectedLatex ?? ''}
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
                                        expectedTexts: (
                                          element.expectedTexts ?? ['']
                                        ).map((text, position) =>
                                          position === answerIndex
                                            ? event.target.value
                                            : text,
                                        ),
                                      } as unknown as JsonValue)
                                    }
                                  />
                                  {(element.expectedTexts?.length ?? 0) > 1 && (
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      className="text-sm text-red-700"
                                      aria-label={`Retirer la réponse ${answerIndex + 1}`}
                                      onClick={() =>
                                        patchElement(index, {
                                          ...element,
                                          expectedTexts: (
                                            element.expectedTexts ?? []
                                          ).filter(
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
                                  expectedTexts: [
                                    ...(element.expectedTexts ?? ['']),
                                    '',
                                  ],
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
                            Règles de correction
                          </summary>
                          <div className="mt-4 space-y-4">
                            {[
                              'expression',
                              'rational-expression',
                              'log-affine-positive',
                              'geometric-expression',
                              'elementary-positive',
                              'equation',
                              'inequality',
                            ].includes(element.response.kind) && (
                              <CanonicalFields
                                value={asEditorObject(
                                  element.response.variable === undefined
                                    ? {}
                                    : { variable: element.response.variable },
                                )}
                                path={`/elements/${index}/response`}
                                onChange={(value) => {
                                  const response = { ...element.response };
                                  const { variable } = value as {
                                    variable?: string;
                                  };
                                  if (variable === undefined)
                                    delete response.variable;
                                  else response.variable = variable;
                                  patchElement(index, {
                                    ...element,
                                    response,
                                  } as unknown as JsonValue);
                                }}
                              />
                            )}
                            <CanonicalFields
                              value={asEditorObject(element.policy)}
                              path={`/elements/${index}/policy`}
                              onChange={(value) =>
                                patchElement(index, {
                                  ...element,
                                  policy: value,
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
                    {questionIds.has(element.id) && (
                      <details className="mt-5 rounded-lg border border-slate-200 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                          Indications et correction expliquée
                        </summary>
                        <div className="mt-4 space-y-4">
                          {linkedSupport
                            .get(element.id)
                            ?.map(
                              ({ element: support, index: supportIndex }) => {
                                const label =
                                  support.type === 'hint'
                                    ? 'Indication'
                                    : 'Correction expliquée';
                                const fragment = support.content[0];
                                const setContent = (content: RichFragment[]) =>
                                  patchElement(supportIndex, {
                                    ...support,
                                    content,
                                  } as unknown as JsonValue);
                                return (
                                  <fieldset
                                    key={support.id}
                                    className="space-y-3 rounded-lg border border-slate-200 p-3"
                                  >
                                    <legend className="px-1 text-sm font-medium">
                                      {label}
                                    </legend>
                                    {support.content.length === 1 &&
                                    fragment?.type === 'text' &&
                                    !fragment.emphasis ? (
                                      <>
                                        <textarea
                                          aria-label={label}
                                          className="field min-h-20"
                                          value={fragment.text}
                                          disabled={disabled}
                                          onChange={(event) =>
                                            setContent([
                                              {
                                                ...fragment,
                                                text: event.target.value,
                                              },
                                            ])
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="text-sm text-blue-700"
                                          disabled={disabled}
                                          onClick={() =>
                                            setContent([
                                              fragment,
                                              {
                                                type: 'math',
                                                latex: '',
                                                display: 'inline',
                                              },
                                            ])
                                          }
                                        >
                                          + Ajouter une formule
                                        </button>
                                      </>
                                    ) : (
                                      <RichTextEditor
                                        value={support.content}
                                        onChange={setContent}
                                        disabled={disabled}
                                      />
                                    )}
                                    <button
                                      type="button"
                                      className="block text-sm text-red-700"
                                      disabled={disabled}
                                      onClick={() =>
                                        updateElements(
                                          definition.elements.filter(
                                            (_, i) => i !== supportIndex,
                                          ),
                                        )
                                      }
                                    >
                                      Retirer cette {label.toLowerCase()}
                                    </button>
                                  </fieldset>
                                );
                              },
                            )}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={disabled}
                              onClick={() =>
                                addQuestionSupport(element, 'hint')
                              }
                            >
                              + Indication
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={disabled}
                              onClick={() =>
                                addQuestionSupport(element, 'explanation')
                              }
                            >
                              + Correction expliquée
                            </button>
                          </div>
                        </div>
                      </details>
                    )}
                    <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-700"
                        disabled={disabled || position === 0}
                        onClick={() => moveVisible(position, -1)}
                      >
                        ↑ Monter
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-700"
                        disabled={disabled || position === visible.length - 1}
                        onClick={() => moveVisible(position, 1)}
                      >
                        ↓ Descendre
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-blue-700"
                        disabled={disabled}
                        onClick={() => {
                          const copy = duplicateElement(element, fresh());
                          const supportCopies = (
                            linkedSupport.get(element.id) ?? []
                          ).map(({ element: support }) => ({
                            ...structuredClone(support),
                            id: fresh(),
                            questionId: copy.id,
                          }));
                          updateElements([
                            ...definition.elements.slice(0, index + 1),
                            copy,
                            ...supportCopies,
                            ...definition.elements.slice(index + 1),
                          ]);
                        }}
                      >
                        Dupliquer
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-700"
                        disabled={disabled}
                        onClick={() => {
                          const linked = linkedSupport.get(element.id) ?? [];
                          if (
                            linked.length &&
                            !window.confirm(
                              'Retirer cette question et ses indications et corrections associées ?',
                            )
                          )
                            return;
                          updateElements(
                            definition.elements.filter(
                              (_, position) =>
                                position !== index &&
                                !linked.some(
                                  (support) => support.index === position,
                                ),
                            ),
                          );
                        }}
                      >
                        Retirer cet élément
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </MathParameters.Provider>
        </section>
      </div>
    </CreatorLockedContext.Provider>
  );
}
