'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  AnswerSubmission,
  CorrectionResult,
  ExerciseDefinition,
} from 'novlearn-exercise-engine';
import type {
  PreviewCase,
  PreviewDiagnostic,
  PreviewResult,
  PreviewTestReport,
} from '@/lib/preview';
import { PublicExercise, MathDisplay } from './public-exercise';
import { MathInput } from './math-input';

const testSeeds = [0, 1, 42];
type PreviewPost = <Result>(
  url: string,
  body: unknown,
) => Promise<{
  result: Result;
  valid?: boolean;
  diagnostics?: PreviewDiagnostic[];
}>;

export function ExercisePreview({
  definition,
  disabled = false,
  engineEnabled = false,
}: {
  definition: ExerciseDefinition;
  disabled?: boolean;
  engineEnabled?: boolean;
}) {
  const source = JSON.stringify(definition);
  const latest = useRef(source);
  latest.current = source;
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [report, setReport] = useState<PreviewTestReport | null>(null);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<PreviewDiagnostic[]>([]);
  const [showCases, setShowCases] = useState(false);
  const [answers, setAnswers] = useState<Record<string, PreviewCase['answer']>>(
    {},
  );
  const questions = definition.elements.filter(
    (item) => item.type === 'question' || item.type === 'mcq',
  );

  useEffect(() => {
    controller.current?.abort();
    setPreview(null);
    setReport(null);
    setError('');
    setDiagnostics([]);
    return () => controller.current?.abort();
  }, [source]);

  async function request<T>(
    run: (post: PreviewPost) => Promise<T>,
  ): Promise<T> {
    if (controller.current) throw Error('busy');
    const cancel = new AbortController();
    controller.current = cancel;
    setBusy(true);
    setError('');
    setDiagnostics([]);
    const post: PreviewPost = async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: cancel.signal,
      });
      const data = await response.json();
      if (source !== latest.current || cancel.signal.aborted)
        throw Error('stale');
      if (!response.ok) {
        setError(data.error ?? 'Calcul indisponible.');
        setDiagnostics(data.diagnostics ?? []);
        throw Error('request');
      }
      return data;
    };
    try {
      return await run(post);
    } catch (failure) {
      if (
        !cancel.signal.aborted &&
        source === latest.current &&
        (!(failure instanceof Error) || failure.message !== 'request')
      )
        setError('Calcul indisponible. Réessayez.');
      throw failure;
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  async function verify() {
    if (disabled || controller.current) return;
    const cases = questions.flatMap((question): PreviewCase[] => {
      const answer = answers[question.id];
      const format =
        question.type === 'mcq' ? 'selection' : question.response.format;
      if (!answer || answer.format !== format) return [];
      if (
        answer.format === 'selection'
          ? !answer.optionIds.length
          : !answer.source.trim()
      )
        return [];
      return [{ questionId: question.id, expectedState: 'incorrect', answer }];
    });
    if (cases.length > 16) {
      setError('Testez au maximum 16 réponses incorrectes à la fois.');
      return;
    }
    setReport(null);
    try {
      await request(async (post) => {
        const validation = await post('/api/admin/engine', { definition });
        if (validation.valid !== true) {
          setError('Corrigez la définition avant de vérifier l’exercice.');
          setDiagnostics(validation.diagnostics ?? []);
          return;
        }
        const next = (
          await post<PreviewTestReport>('/api/admin/preview', {
            action: 'test',
            definition,
            seeds: testSeeds,
            cases,
          })
        ).result;
        setReport(next);
        if (
          next.seeds.some((item) =>
            item.diagnostics.some(
              (issue) => issue.code === 'negative-case-required',
            ),
          )
        )
          setShowCases(true);
      });
    } catch {}
  }

  async function generate() {
    if (disabled || controller.current) return;
    const seed = preview ? crypto.getRandomValues(new Uint32Array(1))[0] : 42;
    try {
      const result = await request((post) =>
        post<PreviewResult>('/api/admin/preview', {
          action: 'generate',
          definition,
          seed,
        }),
      );
      setPreview(result.result);
    } catch {}
  }

  async function submit(
    questionId: string,
    answer: AnswerSubmission['answer'],
  ): Promise<CorrectionResult> {
    if (!preview) throw Error('Aperçu indisponible');
    const result = await request((post) =>
      post<CorrectionResult>('/api/admin/preview', {
        action: 'grade',
        previewId: preview.previewId,
        questionId,
        answer,
      }),
    );
    return result.result;
  }

  function updateAnswer(id: string, answer: PreviewCase['answer']) {
    setAnswers((current) => ({ ...current, [id]: answer }));
    setReport(null);
  }

  if (!engineEnabled)
    return (
      <p className="notice">Les aperçus et tests ne sont pas disponibles.</p>
    );

  const reportIssues = report?.seeds.flatMap((item) => item.diagnostics) ?? [];
  const missingCase = reportIssues.some(
    (item) => item.code === 'negative-case-required',
  );
  const failedChecks =
    report?.seeds.flatMap((item) =>
      item.checks
        .filter((check) => !check.passed)
        .map((check) => {
          const position = questions.findIndex(
            (question) => question.id === check.questionId,
          );
          const label =
            check.label === 'Cas administrateur'
              ? 'La réponse de test n’a pas été reconnue comme incorrecte.'
              : check.label === 'Attendu officiel'
                ? 'La réponse attendue n’a pas été reconnue comme correcte.'
                : 'Le format invalide n’a pas été reconnu.';
          return position < 0 ? label : `Question ${position + 1} · ${label}`;
        }),
    ) ?? [];
  const messages = [
    ...new Set([
      ...diagnostics.map((item) => item.message),
      ...reportIssues
        .filter((item) => item.code !== 'negative-case-required')
        .map((item) => item.message),
      ...failedChecks,
    ]),
  ];

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
      aria-label="Aperçu et vérification"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button"
          disabled={disabled || busy}
          onClick={() => void verify()}
        >
          Vérifier l’exercice
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled || busy}
          onClick={() => void generate()}
        >
          {preview ? 'Générer un autre aperçu' : 'Prévisualiser'}
        </button>
        {busy && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => controller.current?.abort()}
          >
            Annuler
          </button>
        )}
      </div>
      {busy && (
        <p role="status" className="text-sm text-slate-600">
          Calcul en cours…
        </p>
      )}
      {report && (
        <p
          role="status"
          className={
            report.passed && report.complete
              ? 'text-green-700'
              : 'text-amber-800'
          }
        >
          {report.passed && report.complete
            ? 'Vérification réussie.'
            : missingCase && !messages.length
              ? 'Ajoutez une réponse incorrecte pour chaque question, puis relancez la vérification.'
              : 'Certains contrôles sont à corriger.'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {!!messages.length && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {questions.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showCases}
            className="text-sm font-medium text-blue-700"
            onClick={() => setShowCases(!showCases)}
          >
            Réponses incorrectes à tester
          </button>
          {showCases && (
            <fieldset disabled={disabled || busy} className="space-y-3">
              {questions.map((question, index) => {
                const label = `Réponse incorrecte · question ${index + 1}`;
                const answer = answers[question.id];
                if (question.type === 'mcq')
                  return (
                    <fieldset
                      key={question.id}
                      className="space-y-2 rounded-lg border border-slate-200 p-3"
                    >
                      <legend className="px-1 text-sm font-medium">
                        {label}
                      </legend>
                      {question.options.map((option) => {
                        const selected =
                          answer?.format === 'selection'
                            ? answer.optionIds
                            : [];
                        return (
                          <label
                            key={option.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type={
                                question.mode === 'single'
                                  ? 'radio'
                                  : 'checkbox'
                              }
                              name={`test-${question.id}`}
                              checked={selected.includes(option.id)}
                              onChange={(event) =>
                                updateAnswer(question.id, {
                                  format: 'selection',
                                  optionIds: event.target.checked
                                    ? question.mode === 'single'
                                      ? [option.id]
                                      : [...selected, option.id]
                                    : selected.filter((id) => id !== option.id),
                                })
                              }
                            />
                            {option.content.format === 'text' ? (
                              option.content.text
                            ) : (
                              <MathDisplay latex={option.content.latex} />
                            )}
                          </label>
                        );
                      })}
                    </fieldset>
                  );
                return question.response.format === 'text' ? (
                  <label key={question.id} className="label">
                    {label}
                    <input
                      className="field"
                      value={answer?.format === 'text' ? answer.source : ''}
                      onChange={(event) =>
                        updateAnswer(question.id, {
                          format: 'text',
                          source: event.target.value,
                        })
                      }
                    />
                  </label>
                ) : (
                  <MathInput
                    key={question.id}
                    label={label}
                    disabled={disabled || busy}
                    value={answer?.format === 'latex' ? answer.source : ''}
                    onChange={(value) =>
                      updateAnswer(question.id, {
                        format: 'latex',
                        source: value,
                      })
                    }
                  />
                );
              })}
            </fieldset>
          )}
        </>
      )}
      {preview && (
        <div
          className="rounded-xl border border-slate-200 bg-white p-5"
          aria-label="Vue élève"
        >
          <PublicExercise
            key={preview.instance.instanceId}
            instance={preview.instance}
            submit={submit}
            disabled={disabled || busy}
          />
        </div>
      )}
    </section>
  );
}
