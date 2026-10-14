'use client';
import { useId, useRef, useState } from 'react';
import type {
  AnswerSubmission,
  CorrectionResult,
  PublicElement,
  PublicInstance,
} from 'novlearn-exercise-engine';
import { MathInput } from './math-input';
import { correctionLabels } from '@/lib/preview';
type PlotWindow = Extract<PublicElement, { type: 'function-graph' }>['window'];
type RenderNumber = PlotWindow['xMin'];
type Endpoint = Extract<
  PublicElement,
  { type: 'sign-table' }
>['points'][number];
type RichFragment = Extract<
  PublicElement,
  { type: 'rich-text' }
>['content'][number];

export function MathDisplay({
  latex,
  label = 'Expression mathématique',
}: {
  latex: string;
  label?: string;
}) {
  return (
    <div className="math-display min-w-0 overflow-x-auto">
      <MathInput label={label} value={latex} onChange={() => {}} readOnly />
    </div>
  );
}
const number = (v: RenderNumber) => <MathDisplay latex={v.latex} />;
function endpoint(v?: Endpoint) {
  if (!v) return '—';
  return v.kind === 'finite' ? (
    number(v.value)
  ) : (
    <MathDisplay
      latex={v.kind === 'negative-infinity' ? '-\\infty' : '+\\infty'}
    />
  );
}
function RichText({ content }: { content: RichFragment[] }) {
  return (
    <div className="space-y-2 leading-7">
      {content.map((f, i) =>
        f.type === 'math' ? (
          <span
            key={i}
            className={
              f.display === 'block' ? 'block' : 'inline-block align-middle'
            }
          >
            <MathDisplay latex={f.latex} />
          </span>
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {f.emphasis === 'strong' ? (
              <strong>{f.text}</strong>
            ) : f.emphasis === 'emphasis' ? (
              <em>{f.text}</em>
            ) : (
              f.text
            )}
          </span>
        ),
      )}
    </div>
  );
}
const quotient = (n: RenderNumber) => n.numerator / n.denominator;
/** Coordinate mapping only: no formula evaluation, sampling or correction. */
function Plot({
  window: w,
  grid,
  children,
  label,
}: {
  window: PlotWindow;
  grid: boolean;
  children: (
    x: (n: number) => number,
    y: (n: number) => number,
  ) => React.ReactNode;
  label: string;
}) {
  const a = quotient(w.xMin),
    b = quotient(w.xMax),
    c = quotient(w.yMin),
    d = quotient(w.yMax);
  const x = (n: number) => 40 + ((n - a) * 440) / (b - a),
    y = (n: number) => 300 - ((n - c) * 260) / (d - c);
  const clip = 'plot-' + useId().replaceAll(':', '');
  return (
    <figure className="min-w-0">
      <svg
        viewBox="0 0 520 340"
        className="w-full rounded-lg border border-slate-200 bg-white"
        role="img"
        aria-label={label}
      >
        <defs>
          <clipPath id={clip}>
            <rect x="40" y="40" width="440" height="260" />
          </clipPath>
        </defs>
        {grid &&
          Array.from({ length: 9 }, (_, i) => (
            <g key={i} stroke="#e2e8f0">
              <line x1={40 + i * 55} x2={40 + i * 55} y1="40" y2="300" />
              <line x1="40" x2="480" y1={40 + i * 32.5} y2={40 + i * 32.5} />
            </g>
          ))}
        <rect
          x="40"
          y="40"
          width="440"
          height="260"
          fill="none"
          stroke="#94a3b8"
        />
        <g clipPath={`url(#${clip})`}>
          <line x1={x(0)} x2={x(0)} y1="40" y2="300" stroke="#64748b" />
          <line x1="40" x2="480" y1={y(0)} y2={y(0)} stroke="#64748b" />
          {children(x, y)}
        </g>
        <text x="40" y="325" fontSize="13">
          {w.xMin.latex}
        </text>
        <text x="480" y="325" textAnchor="end" fontSize="13">
          {w.xMax.latex}
        </text>
        <text x="10" y="48" fontSize="13">
          {w.yMax.latex}
        </text>
        <text x="10" y="300" fontSize="13">
          {w.yMin.latex}
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-slate-500">{label}</figcaption>
    </figure>
  );
}
type Question = Extract<PublicElement, { type: 'question' | 'mcq' }>;
type Submit = (
  questionId: string,
  answer: AnswerSubmission['answer'],
) => Promise<CorrectionResult>;
function PreviewQuestion({
  question: q,
  submit,
  disabled,
}: {
  question: Question;
  submit?: Submit;
  disabled: boolean;
}) {
  const initial: AnswerSubmission['answer'] =
    q.type === 'mcq'
      ? { format: 'selection', optionIds: [] }
      : { format: q.response.format, source: '' };
  const [answer, setAnswer] = useState(initial);
  const latest = useRef(answer);
  latest.current = answer;
  const [result, setResult] = useState<CorrectionResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = (v: AnswerSubmission['answer']) => {
    latest.current = v;
    setAnswer(v);
    setResult(null);
    setError('');
  };
  const check = async () => {
    if (!submit) return;
    const source = JSON.stringify(answer);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const next = await submit(q.id, answer);
      if (source === JSON.stringify(latest.current)) setResult(next);
    } catch {
      setError('Correction indisponible. La réponse reste conservée.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 p-5"
      aria-label={`Question ${q.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="whitespace-pre-wrap leading-7">{q.text}</p>
        <span className="badge shrink-0">
          {q.points} point{q.points > 1 ? 's' : ''}
        </span>
      </div>
      {q.type === 'mcq' && answer.format === 'selection' ? (
        <fieldset disabled={disabled || busy} className="space-y-3">
          <legend className="mb-2 text-sm text-slate-500">
            {q.mode === 'single'
              ? 'Choisissez une réponse'
              : 'Choisissez les réponses'}
          </legend>
          {q.options.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
            >
              <input
                type={q.mode === 'single' ? 'radio' : 'checkbox'}
                name={q.id}
                checked={answer.optionIds.includes(o.id)}
                onChange={(e) =>
                  change({
                    format: 'selection',
                    optionIds:
                      q.mode === 'single'
                        ? [o.id]
                        : e.target.checked
                          ? [...answer.optionIds, o.id]
                          : answer.optionIds.filter((id) => id !== o.id),
                  })
                }
              />
              {o.content.format === 'text' ? (
                <span>{o.content.text}</span>
              ) : (
                <MathDisplay latex={o.content.latex} />
              )}
            </label>
          ))}
        </fieldset>
      ) : (
        answer.format !== 'selection' &&
        (answer.format === 'latex' ? (
          <MathInput
            label="Votre réponse"
            value={answer.source}
            onChange={(source) => change({ format: 'latex', source })}
            disabled={disabled || busy}
          />
        ) : (
          <label className="label">
            Votre réponse
            <input
              className="field"
              value={answer.source}
              disabled={disabled || busy}
              maxLength={8192}
              onChange={(e) =>
                change({ format: 'text', source: e.target.value })
              }
            />
          </label>
        ))
      )}
      {submit && (
        <button
          type="button"
          className="button"
          disabled={disabled || busy}
          onClick={check}
        >
          {busy ? 'Correction…' : 'Tester cette réponse'}
        </button>
      )}
      {result && (
        <div
          role="status"
          className={`rounded-lg p-3 text-sm ${result.state === 'correct' ? 'bg-green-50 text-green-800' : result.state === 'incorrect' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}
        >
          <p className="font-semibold">{correctionLabels[result.state]}</p>
          <details className="mt-2">
            <summary>Diagnostic de correction</summary>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <dt>Code</dt>
              <dd>{result.code}</dd>
              <dt>Forme</dt>
              <dd>{result.form}</dd>
              <dt>Domaine</dt>
              <dd>{result.domain}</dd>
              <dt>Preuve</dt>
              <dd>{result.proof}</dd>
            </dl>
          </details>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
function DisplayElement({
  element: e,
}: {
  element: Exclude<PublicElement, Question>;
}) {
  switch (e.type) {
    case 'text':
      return <p className="whitespace-pre-wrap leading-7">{e.text}</p>;
    case 'section':
      return (
        <h3 className="border-b border-slate-200 pb-3 font-brand text-xl">
          {e.text}
        </h3>
      );
    case 'expression':
    case 'equation':
      return (
        <div>
          {e.label && <p className="mb-2 text-sm text-slate-500">{e.label}</p>}
          <MathDisplay latex={e.latex} />
        </div>
      );
    case 'rich-text':
      return <RichText content={e.content} />;
    case 'system':
      return (
        <div
          className="space-y-1 border-l-4 border-slate-300 pl-4"
          aria-label="Système"
        >
          {e.relations.map((r) => (
            <MathDisplay key={r.id} latex={r.latex} />
          ))}
        </div>
      );
    case 'value-table':
      return (
        <div className="overflow-x-auto">
          <table className="preview-table">
            <caption>Tableau de valeurs</caption>
            <thead>
              <tr>
                {e.columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      {c.kind === 'text' ? (
                        c.text
                      ) : c.kind === 'number' ? (
                        number(c.value)
                      ) : (
                        <MathDisplay latex={c.latex} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'statistics-table':
      return (
        <div className="overflow-x-auto">
          <table className="preview-table">
            <caption>Tableau statistique</caption>
            <thead>
              <tr>
                <th>Modalité</th>
                <th>Valeur</th>
                <th>Fréquence</th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r.label}</th>
                  <td>{number(r.value)}</td>
                  <td>{number(r.frequency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'sign-table':
      return (
        <div className="overflow-x-auto">
          <table className="preview-table">
            <caption>Tableau de signes</caption>
            <thead>
              <tr>
                <th>{e.variable}</th>
                {e.points.flatMap((p, i) => [
                  <th key={'p' + i}>{endpoint(p)}</th>,
                  ...(i < e.points.length - 1
                    ? [<th key={'i' + i} aria-label="Intervalle" />]
                    : []),
                ])}
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.label}</th>
                  {e.points.flatMap((_, i) => [
                    <td key={'p' + i}>
                      {r.pointSigns[i] === 'excluded'
                        ? '∥'
                        : (r.pointSigns[i] ?? '')}
                    </td>,
                    ...(i < e.points.length - 1
                      ? [<td key={'i' + i}>{r.signs[i]}</td>]
                      : []),
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'variation-table':
      return (
        <div className="overflow-x-auto">
          <table className="preview-table">
            <caption>Tableau de variations</caption>
            <thead>
              <tr>
                <th>{e.variable}</th>
                {e.points.flatMap((p, i) => [
                  <th key={'p' + i}>{endpoint(p.x)}</th>,
                  ...(i < e.points.length - 1
                    ? [<th key={'i' + i} aria-label="Intervalle" />]
                    : []),
                ])}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Valeurs et variations</th>
                {e.points.flatMap((p, i) => [
                  <td key={'p' + i}>
                    <div className="space-y-2">
                      {p.excluded && <span aria-label="Point exclu">∥</span>}
                      {p.value && endpoint(p.value)}
                      {p.leftLimit && (
                        <div>
                          <span className="text-xs">Limite à gauche</span>
                          {endpoint(p.leftLimit)}
                        </div>
                      )}
                      {p.rightLimit && (
                        <div>
                          <span className="text-xs">Limite à droite</span>
                          {endpoint(p.rightLimit)}
                        </div>
                      )}
                    </div>
                  </td>,
                  ...(i < e.points.length - 1
                    ? [
                        <td key={'i' + i}>
                          <span
                            aria-label={
                              e.directions[i] === 'increasing'
                                ? 'Croissante'
                                : e.directions[i] === 'decreasing'
                                  ? 'Décroissante'
                                  : 'Constante'
                            }
                            className="text-2xl"
                          >
                            {e.directions[i] === 'increasing'
                              ? '↗'
                              : e.directions[i] === 'decreasing'
                                ? '↘'
                                : '→'}
                          </span>
                        </td>,
                      ]
                    : []),
                ])}
              </tr>
            </tbody>
          </table>
        </div>
      );
    case 'function-graph':
      return (
        <div className="space-y-3">
          <Plot
            window={e.window}
            grid={e.showGrid}
            label="Fenêtre du graphe de fonction"
          >
            {() => null}
          </Plot>
          {e.functions.map((f) => (
            <div key={f.id} className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: f.color }}
              />
              {f.label && <span>{f.label}</span>}
              {f.showExpression && <MathDisplay latex={f.latex} />}
            </div>
          ))}
          <p className="text-sm text-amber-900">
            La formule est affichée. Le calcul et le tracé de sa courbe restent
            à réaliser dans cet aperçu.
          </p>
        </div>
      );
    case 'sequence-graph': {
      const s = e.sequence;
      return (
        <div className="space-y-3">
          <Plot window={e.window} grid={e.showGrid} label="Graphe de suite">
            {(x, y) =>
              s.mode === 'points' ? (
                <>
                  {e.connectPoints && (
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      points={s.points
                        .map((p) => `${x(p.index)},${y(quotient(p.value))}`)
                        .join(' ')}
                    />
                  )}{' '}
                  {s.points.map((p, i) => (
                    <circle
                      key={i}
                      cx={x(p.index)}
                      cy={y(quotient(p.value))}
                      r="4"
                      fill="#2563eb"
                    />
                  ))}
                </>
              ) : null
            }
          </Plot>
          {s.mode === 'points' ? (
            <dl className="flex flex-wrap gap-4">
              {s.points.map((p) => (
                <div key={p.index}>
                  <dt className="text-xs text-slate-500">Indice {p.index}</dt>
                  <dd>{number(p.value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <MathDisplay
                latex={s.mode === 'explicit' ? s.latex : s.recurrence}
              />
              <p className="text-sm text-amber-900">
                Les termes de cette formule ne sont pas encore calculés dans
                l’aperçu. Les suites données par points sont tracées.
              </p>
            </>
          )}
        </div>
      );
    }
    case 'vectors':
      return (
        <div className="space-y-3">
          <h4 className="font-semibold">Vecteurs · dimension {e.dimension}</h4>
          {e.vectors.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3">
              <span style={{ color: v.color }}>{v.label}</span>
              {e.showCoordinates ? (
                <MathDisplay
                  latex={`\\left(${v.coordinates.map((n) => n.latex).join(';')}\\right)`}
                />
              ) : (
                <span className="text-sm text-slate-500">
                  Coordonnées masquées
                </span>
              )}
            </div>
          ))}
        </div>
      );
    case 'complex-plane':
      return (
        <div className="space-y-3">
          <Plot window={e.window} grid={e.showGrid} label="Plan complexe">
            {(x, y) =>
              e.points.map((p) => (
                <g key={p.id}>
                  <circle
                    cx={x(quotient(p.real))}
                    cy={y(quotient(p.imaginary))}
                    r="4"
                    fill={p.color}
                  />
                  <text
                    x={x(quotient(p.real)) + 8}
                    y={y(quotient(p.imaginary)) - 8}
                    fontSize="14"
                  >
                    {p.label}
                  </text>
                </g>
              ))
            }
          </Plot>
          {e.showCoordinates &&
            e.points.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span>{p.label}</span>
                <MathDisplay
                  latex={`\\left(${p.real.latex};${p.imaginary.latex}\\right)`}
                />
              </div>
            ))}
        </div>
      );
    case 'geometry': {
      const point = (id: string) => e.points.find((p) => p.id === id)!;
      return (
        <Plot window={e.window} grid={e.showGrid} label="Figure géométrique">
          {(x, y) => (
            <>
              {e.objects.map((o) => {
                if (o.kind === 'polygon')
                  return (
                    <polygon
                      key={o.id}
                      points={o.vertices
                        .map((id) => {
                          const p = point(id);
                          return `${x(quotient(p.coordinates[0]))},${y(quotient(p.coordinates[1]))}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke={o.color}
                      strokeWidth="2"
                    />
                  );
                if (o.kind === 'circle') {
                  const p = point(o.center),
                    radius = quotient(o.radius);
                  return (
                    <ellipse
                      key={o.id}
                      cx={x(quotient(p.coordinates[0]))}
                      cy={y(quotient(p.coordinates[1]))}
                      rx={Math.abs(x(radius) - x(0))}
                      ry={Math.abs(y(radius) - y(0))}
                      fill="none"
                      stroke={o.color}
                      strokeWidth="2"
                    />
                  );
                }
                const a = point(o.from),
                  b = point(o.to);
                let ax = x(quotient(a.coordinates[0])),
                  ay = y(quotient(a.coordinates[1])),
                  bx = x(quotient(b.coordinates[0])),
                  by = y(quotient(b.coordinates[1]));
                if (o.kind === 'line') {
                  const dx = bx - ax,
                    dy = by - ay,
                    len = Math.hypot(dx, dy);
                  if (!len) return null;
                  ax -= (dx / len) * 1000;
                  ay -= (dy / len) * 1000;
                  bx += (dx / len) * 1000;
                  by += (dy / len) * 1000;
                }
                return (
                  <line
                    key={o.id}
                    x1={ax}
                    y1={ay}
                    x2={bx}
                    y2={by}
                    stroke={o.color}
                    strokeWidth="2"
                  />
                );
              })}
              {e.points.map((p) => (
                <g key={p.id}>
                  <circle
                    cx={x(quotient(p.coordinates[0]))}
                    cy={y(quotient(p.coordinates[1]))}
                    r="4"
                    fill="#2563eb"
                  />
                  <text
                    x={x(quotient(p.coordinates[0])) + 8}
                    y={y(quotient(p.coordinates[1])) - 8}
                    fontSize="14"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </>
          )}
        </Plot>
      );
    }
    case 'probability-tree': {
      const node = (parent?: string, depth = 0): React.ReactNode => (
        <ul className="space-y-3 border-l border-slate-300 pl-5">
          {e.nodes
            .filter((n) => n.parentId === parent)
            .map((n) => (
              <li key={n.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <span>{n.label}</span>
                  {n.probability && number(n.probability)}
                </div>
                {depth < 64 && node(n.id, depth + 1)}
              </li>
            ))}
        </ul>
      );
      return (
        <div className="space-y-3">
          <h4 className="font-semibold">Arbre de probabilités</h4>
          {node()}
          <p className="text-xs text-slate-500">
            {e.exhaustive
              ? 'Branches déclarées exhaustives'
              : 'Branches non exhaustives'}
          </p>
        </div>
      );
    }
  }
}
/** Only PublicInstance enters this renderer; expected answers and policies have no props here. */
export function PublicExercise({
  instance,
  submit,
  disabled = false,
}: {
  instance: PublicInstance;
  submit?: Submit;
  disabled?: boolean;
}) {
  return (
    <article className="min-w-0 space-y-6" aria-label="Aperçu élève">
      <h2 className="font-brand text-2xl font-medium">{instance.title}</h2>
      {instance.elements.map((e) => (
        <div key={e.id} className="min-w-0">
          {e.type === 'question' || e.type === 'mcq' ? (
            <PreviewQuestion question={e} submit={submit} disabled={disabled} />
          ) : (
            <DisplayElement element={e} />
          )}
        </div>
      ))}
    </article>
  );
}
