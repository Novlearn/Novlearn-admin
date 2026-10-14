'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  AnswerSubmission,
  CorrectionResult,
  ExerciseDefinition,
} from 'novlearn-exercise-engine';
import type {
  PreviewCase,
  PreviewDetails,
  PreviewDiagnostic,
  PreviewResult,
  PreviewTestReport,
} from '@/lib/preview';
import { correctionLabels } from '@/lib/preview';
import { PublicExercise, MathDisplay } from './public-exercise';
import { MathInput } from './math-input';

function Diagnostics({ items }: { items: PreviewDiagnostic[] }) {
  return (
    <ul className="space-y-2 text-sm text-red-800">
      {items.map((d, i) => (
        <li key={i}>
          <p className="font-mono text-xs text-slate-500">
            {d.path || 'Définition'} · {d.stage} {d.questionId || d.elementId} ·{' '}
            {d.code}
          </p>
          <p>{d.message}</p>
        </li>
      ))}
    </ul>
  );
}
export function ExercisePreview({
  definition,
  disabled = false,
}: {
  definition: ExerciseDefinition;
  disabled?: boolean;
}) {
  const source = JSON.stringify(definition),
    latest = useRef(source);
  latest.current = source;
  const [seed, setSeed] = useState('42'),
    [seeds, setSeeds] = useState('0, 1, 42');
  const [preview, setPreview] = useState<PreviewResult | null>(null),
    [details, setDetails] = useState<PreviewDetails | null>(null),
    [report, setReport] = useState<PreviewTestReport | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [diagnostics, setDiagnostics] = useState<PreviewDiagnostic[]>([]),
    [cases, setCases] = useState<PreviewCase[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setPreview(null);
    setDetails(null);
    setReport(null);
    setError('');
    setDiagnostics([]);
  }, [source]);
  useEffect(() => () => controller.current?.abort(), []);
  const numericSeed = (text: string) =>
    /^\d+$/.test(text.trim()) && Number(text) <= 0xffffffff
      ? Number(text)
      : null;
  const request = async (body: unknown) => {
    const started = latest.current;
    const cancel = new AbortController();
    controller.current = cancel;
    setBusy(true);
    setError('');
    setDiagnostics([]);
    try {
      const response = await fetch('/api/admin/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: cancel.signal,
      });
      const data = await response.json();
      if (started !== latest.current) throw new Error('stale');
      if (!response.ok) {
        setError(data.error ?? 'Calcul indisponible.');
        setDiagnostics(data.diagnostics ?? []);
        throw new Error('request');
      }
      return data.result;
    } catch (e) {
      if (
        started === latest.current &&
        !cancel.signal.aborted &&
        (!(e instanceof Error) || e.message !== 'request')
      )
        setError('Calcul indisponible. Votre définition reste conservée.');
      throw e;
    } finally {
      if (controller.current === cancel) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const generate = async () => {
    const value = numericSeed(seed);
    if (value === null) {
      setError('La seed doit être un entier entre 0 et 4294967295.');
      return;
    }
    setDetails(null);
    setReport(null);
    setPreview(null);
    try {
      setPreview(
        await request({ action: 'generate', definition, seed: value }),
      );
    } catch {}
  };
  const inspect = async () => {
    if (details) {
      setDetails(null);
      return;
    }
    if (!preview) return;
    try {
      setDetails(
        await request({ action: 'inspect', previewId: preview.previewId }),
      );
    } catch {}
  };
  const test = async () => {
    const list = seeds.split(',').map(numericSeed);
    if (
      !list.length ||
      list.length > 5 ||
      list.some((v) => v === null) ||
      new Set(list).size !== list.length
    ) {
      setError(
        'Saisissez une à cinq seeds distinctes, séparées par des virgules.',
      );
      return;
    }
    setReport(null);
    try {
      setReport(
        await request({ action: 'test', definition, seeds: list, cases }),
      );
    } catch {}
  };
  const submit = async (
    questionId: string,
    answer: AnswerSubmission['answer'],
  ): Promise<CorrectionResult> => {
    if (!preview) throw Error('No preview');
    return request({
      action: 'grade',
      previewId: preview.previewId,
      questionId,
      answer,
    });
  };
  const questions = definition.elements.filter(
    (e) => e.type === 'question' || e.type === 'mcq',
  );
  const [questionId, setQuestionId] = useState('');
  const addCase = () => {
    const q = questions.find((q) => q.id === questionId) ?? questions[0];
    if (!q || cases.length >= 16) return;
    setCases([
      ...cases,
      {
        questionId: q.id,
        expectedState: 'incorrect',
        answer:
          q.type === 'mcq'
            ? { format: 'selection', optionIds: [] }
            : { format: q.response.format, source: '' },
      },
    ]);
    setReport(null);
  };
  const patchCase = (index: number, fields: Partial<PreviewCase>) => {
    setCases(cases.map((c, i) => (i === index ? { ...c, ...fields } : c)));
    setReport(null);
  };
  return (
    <section
      className="space-y-6 rounded-xl border border-slate-200 bg-slate-50 p-5"
      aria-labelledby="preview-heading"
    >
      <div>
        <h2 id="preview-heading" className="text-lg font-semibold">
          Aperçu et tests Engine
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Générez votre exercice, testez les réponses et les seeds. Modifier la
          définition invalide cet aperçu et ses résultats. Ces tests
          n’approuvent ni ne publient le brouillon.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="label">
          Seed
          <input
            className="field max-w-48"
            inputMode="numeric"
            value={seed}
            disabled={disabled || busy}
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={disabled || busy}
          onClick={generate}
        >
          Générer l’aperçu
        </button>
        {busy && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-3 text-sm"
            onClick={() => {
              controller.current?.abort();
              setError('Calcul annulé. Aucun résultat positif n’est ajouté.');
            }}
          >
            Annuler le calcul
          </button>
        )}
      </div>
      {busy && (
        <p role="status" className="text-sm text-brand-700">
          Calcul officiel en cours…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!!diagnostics.length && <Diagnostics items={diagnostics} />}
      {preview && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="badge">Vue élève · seed {preview.seed}</span>
              <p className="mt-2 text-xs text-slate-500">
                Engine {preview.engineVersion} · aperçu temporaire, valable dix
                minutes
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
              disabled={disabled || busy}
              onClick={inspect}
            >
              {details
                ? 'Masquer les attendus privés'
                : 'Afficher les attendus privés Admin'}
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <PublicExercise
              key={preview.instance.instanceId}
              instance={preview.instance}
              submit={submit}
              disabled={disabled || busy}
            />
          </div>
          {details && (
            <aside
              className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5"
              aria-label="Données privées Admin"
            >
              <h3 className="font-semibold text-amber-950">
                Données privées · Admin
              </h3>
              <p className="text-sm text-amber-900">
                {details.attempts} essais de génération · {details.draws}{' '}
                tirages. Ces données sont absentes de la projection élève.
              </p>
              <dl className="grid gap-4 sm:grid-cols-2">
                {Object.entries(details.values).map(([name, v]) => (
                  <div key={name}>
                    <dt className="text-sm font-semibold">{name}</dt>
                    <dd>
                      <MathDisplay
                        latex={
                          v.kind === 'rational'
                            ? `\\frac{${v.numerator}}{${v.denominator}}`
                            : v.kind === 'decimal'
                              ? `\\frac{${v.coefficient}}{${10 ** v.precision}}`
                              : String(v.value)
                        }
                      />
                    </dd>
                  </div>
                ))}
              </dl>
              {details.expected.map((q) => (
                <div key={q.questionId}>
                  <p className="mb-2 font-mono text-xs text-amber-900">
                    Question {q.questionId}
                  </p>
                  {q.answer.format === 'latex' ? (
                    <MathDisplay latex={q.answer.source} />
                  ) : (
                    <p>
                      {q.answer.format === 'selection'
                        ? q.answer.optionIds.join(', ')
                        : (q.variants ?? [q.answer.source]).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </aside>
          )}
        </div>
      )}
      <details className="rounded-xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Tests sur plusieurs seeds
        </summary>
        <div className="mt-5 space-y-5">
          <p className="text-sm leading-6 text-slate-500">
            Le serveur vérifie la génération, le rejeu, la projection élève,
            l’attendu officiel et un format volontairement invalide. Ajoutez au
            moins un cas incorrect par question pour couvrir les réponses
            fausses. Aucun verdict indéterminé n’est accepté comme réussite.
          </p>
          <label className="label">
            Seeds de test
            <input
              className="field"
              value={seeds}
              disabled={disabled || busy}
              maxLength={100}
              onChange={(e) => {
                setSeeds(e.target.value);
                setReport(null);
              }}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label">
              Question du nouveau cas
              <select
                className="field"
                value={questionId || questions[0]?.id || ''}
                disabled={disabled || busy}
                onChange={(e) => setQuestionId(e.target.value)}
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text || q.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold"
              disabled={
                disabled || busy || !questions.length || cases.length >= 16
              }
              onClick={addCase}
            >
              Ajouter un cas de réponse
            </button>
          </div>
          {cases.map((c, i) => {
            const q = questions.find((q) => q.id === c.questionId);
            return (
              <fieldset
                key={i}
                disabled={disabled || busy}
                className="space-y-3 rounded-lg border border-slate-200 p-4"
              >
                <legend className="px-2 text-sm font-semibold">
                  Cas {i + 1} · {q?.text || c.questionId}
                </legend>
                <label className="label">
                  Résultat attendu
                  <select
                    className="field"
                    value={c.expectedState}
                    onChange={(e) =>
                      patchCase(i, {
                        expectedState: e.target
                          .value as PreviewCase['expectedState'],
                      })
                    }
                  >
                    <option value="incorrect">Incorrecte</option>
                    <option value="correct">Correcte</option>
                    <option value="invalid">Format invalide</option>
                  </select>
                </label>
                {c.answer.format === 'selection' ? (
                  q?.type === 'mcq' ? (
                    <div className="space-y-2">
                      {q.options.map((o) => (
                        <label key={o.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={
                              c.answer.format === 'selection' &&
                              c.answer.optionIds.includes(o.id)
                            }
                            onChange={(e) => {
                              if (c.answer.format === 'selection')
                                patchCase(i, {
                                  answer: {
                                    format: 'selection',
                                    optionIds: e.target.checked
                                      ? [...c.answer.optionIds, o.id]
                                      : c.answer.optionIds.filter(
                                          (id) => id !== o.id,
                                        ),
                                  },
                                });
                            }}
                          />
                          {o.content.format === 'text' ? (
                            o.content.text
                          ) : (
                            <MathDisplay latex={o.content.latex} />
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-red-700">
                      Cette question n’existe plus. Retirez ce cas.
                    </p>
                  )
                ) : c.answer.format === 'latex' ? (
                  <MathInput
                    label="Réponse du cas"
                    value={c.answer.source}
                    disabled={disabled || busy}
                    onChange={(source) =>
                      patchCase(i, { answer: { format: 'latex', source } })
                    }
                  />
                ) : (
                  <label className="label">
                    Réponse du cas
                    <input
                      className="field"
                      value={c.answer.source}
                      maxLength={8192}
                      onChange={(e) =>
                        patchCase(i, {
                          answer: { format: 'text', source: e.target.value },
                        })
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="text-sm font-medium text-red-700"
                  onClick={() => {
                    setCases(cases.filter((_, index) => index !== i));
                    setReport(null);
                  }}
                >
                  Retirer ce cas
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            className="button"
            disabled={disabled || busy}
            onClick={test}
          >
            Lancer les tests Engine
          </button>
          {report && (
            <div className="space-y-4" role="status">
              <p
                className={`font-semibold ${report.passed && report.complete ? 'text-green-700' : 'text-red-700'}`}
              >
                {report.passed && report.complete
                  ? 'Tests Engine réussis pour ces seeds et ces cas. La relecture reste nécessaire.'
                  : 'Tests en échec ou couverture incomplète.'}
              </p>
              <p className="break-all font-mono text-xs text-slate-500">
                Empreinte de définition : {report.definitionDigest}
              </p>
              {report.seeds.map((r) => (
                <section
                  key={r.seed}
                  className="space-y-3 rounded-lg border border-slate-200 p-4"
                >
                  <h3 className="font-semibold">
                    Seed {r.seed} · {r.passed ? 'Réussie' : 'À corriger'}
                  </h3>
                  <p className="text-sm">
                    Rejeu : {r.reproducible ? 'identique' : 'non validé'} ·
                    Projection élève :{' '}
                    {r.publicProjectionSafe ? 'contrôlée' : 'non validée'}
                  </p>
                  <Diagnostics items={r.diagnostics} />
                  <div className="overflow-x-auto">
                    <table className="preview-table text-sm">
                      <caption>Vérifications de correction</caption>
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Cas</th>
                          <th>Attendu</th>
                          <th>Résultat Engine</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.checks.map((c, i) => (
                          <tr key={i}>
                            <td className="font-mono text-xs">
                              {c.questionId}
                            </td>
                            <td>{c.label}</td>
                            <td>
                              {
                                correctionLabels[
                                  c.expectedState as keyof typeof correctionLabels
                                ]
                              }
                            </td>
                            <td
                              className={
                                c.passed ? 'text-green-700' : 'text-red-700'
                              }
                            >
                              {correctionLabels[c.result.state]}
                              <p className="mt-1 text-xs">{c.result.code}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
