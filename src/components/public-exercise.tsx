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
import {
  clipDrawingLine,
  fitVectorDrawing,
  projectVectorCoordinates,
} from '@/lib/plot-coordinates';
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
  if (![a, b, c, d].every(Number.isFinite) || a >= b || c >= d)
    return (
      <p className="notice">
        La fenêtre ne permet pas un tracé fini dans cet aperçu.
      </p>
    );
  return (
    <figure className="min-w-0">
      <svg
        viewBox="0 0 520 340"
        className="w-full rounded-lg border border-slate-200 bg-white"
        role="img"
        aria-labelledby={`${clip}-title`}
        aria-describedby={`${clip}-description`}
      >
        <title id={`${clip}-title`}>{label}</title>
        <desc id={`${clip}-description`}>
          Les bornes exactes sont indiquées sous la figure. Seuls les objets
          prescrits sont représentés dans cette fenêtre.
        </desc>
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
          x min
        </text>
        <text x="480" y="325" textAnchor="end" fontSize="13">
          x max
        </text>
        <text x="10" y="48" fontSize="13">
          y max
        </text>
        <text x="10" y="300" fontSize="13">
          y min
        </text>
      </svg>
      <figcaption className="mt-2 space-y-2 text-sm text-slate-600">
        <p>
          {label}
          {grid ? ' · Grille de huit intervalles par axe.' : ''}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['x min', w.xMin],
              ['x max', w.xMax],
              ['y min', w.yMin],
              ['y max', w.yMax],
            ] as const
          ).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                <MathDisplay label={`Borne ${name}`} latex={value.latex} />
              </dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  );
}

function GeometryDescription({
  element: e,
}: {
  element: Extract<PublicElement, { type: 'geometry' }>;
}) {
  const label = (id: string) => e.points.find((p) => p.id === id)?.label ?? id;
  return (
    <details className="rounded-lg border border-slate-200 p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        Description et coordonnées de la figure
      </summary>
      <p className="mt-3 text-slate-600">
        Les objets sont ceux prescrits par l’exercice. Les points hors de la
        fenêtre sont conservés dans cette liste.
      </p>
      <ul className="my-3 space-y-3" aria-label="Points de la figure">
        {e.points.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3">
            <span>Point {p.label}</span>
            <MathDisplay
              label={`Coordonnées du point ${p.label}`}
              latex={`\\left(${p.coordinates.map((n) => n.latex).join(';')}\\right)`}
            />
            {(quotient(p.coordinates[0]) < quotient(e.window.xMin) ||
              quotient(p.coordinates[0]) > quotient(e.window.xMax) ||
              quotient(p.coordinates[1]) < quotient(e.window.yMin) ||
              quotient(p.coordinates[1]) > quotient(e.window.yMax)) && (
              <span className="text-slate-500">Hors de la fenêtre</span>
            )}
          </li>
        ))}
      </ul>
      <ul className="space-y-3" aria-label="Objets prescrits">
        {e.objects.map((o) => (
          <li key={o.id}>
            {o.kind === 'polygon' ? (
              `Polygone ${o.id} : sommets ${o.vertices.map(label).join(', ')}.`
            ) : o.kind === 'circle' ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Cercle {o.id} : centre {label(o.center)}, rayon
                </span>
                <MathDisplay
                  label={`Rayon du cercle ${o.id}`}
                  latex={o.radius.latex}
                />
              </div>
            ) : o.kind === 'line' ? (
              `Droite ${o.id} passant par ${label(o.from)} et ${label(o.to)}.`
            ) : (
              `Segment ${o.id} entre ${label(o.from)} et ${label(o.to)}.`
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function VectorFigure({
  element: e,
}: {
  element: Extract<PublicElement, { type: 'vectors' }>;
}) {
  const id = 'vectors-' + useId().replaceAll(':', '');
  const projected = e.vectors.map((v) =>
    projectVectorCoordinates(v.coordinates.map(quotient), e.dimension),
  );
  const points = projected.every((p) => p !== null)
    ? fitVectorDrawing(projected)
    : null;
  const axes =
    e.dimension === 2
      ? [
          { label: 'x', x: 490, y: 170 },
          { label: 'y', x: 260, y: 30 },
        ]
      : [
          { label: 'x', x: 390, y: 245 },
          { label: 'y', x: 130, y: 245 },
          { label: 'z', x: 260, y: 30 },
        ];
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">Vecteurs · dimension {e.dimension}</h4>
      {points ? (
        <figure className="min-w-0">
          <svg
            viewBox="0 0 520 340"
            className="w-full rounded-lg border border-slate-200 bg-white"
            role="img"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
          >
            <title id={`${id}-title`}>
              {e.dimension === 2
                ? 'Vecteurs dans le plan'
                : 'Projection des vecteurs de l’espace'}
            </title>
            <desc id={`${id}-description`}>
              Les flèches partent de l’origine O. Une même échelle est utilisée
              pour toutes les flèches. La liste sous la figure identifie chaque
              vecteur.
            </desc>
            <defs>
              {e.vectors.map((v, i) => (
                <marker
                  key={v.id}
                  id={`${id}-arrow-${i}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="5"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M0,0 L10,5 L0,10 Z" fill={v.color} />
                </marker>
              ))}
            </defs>
            {axes.map((axis) => (
              <g key={axis.label}>
                <line
                  x1="260"
                  y1="170"
                  x2={axis.x}
                  y2={axis.y}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                />
                <text x={axis.x + 6} y={axis.y + 4} fontSize="14">
                  {axis.label}
                </text>
              </g>
            ))}
            <circle cx="260" cy="170" r="3" fill="#475569" />
            <text x="245" y="163" fontSize="14">
              O
            </text>
            {points.map(([x, y], i) => (
              <g key={e.vectors[i].id}>
                {x === 260 && y === 170 ? (
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="none"
                    stroke={e.vectors[i].color}
                    strokeWidth="2"
                  />
                ) : (
                  <line
                    x1="260"
                    y1="170"
                    x2={x}
                    y2={y}
                    stroke={e.vectors[i].color}
                    strokeWidth="2.5"
                    markerEnd={`url(#${id}-arrow-${i})`}
                  />
                )}
                <text x={x + 8} y={y - 8} fontSize="14">
                  {e.vectors[i].label}
                </text>
              </g>
            ))}
          </svg>
          <figcaption className="mt-2 text-sm text-slate-600">
            {e.dimension === 3
              ? 'Projection orthographique 2D d’un repère 3D : des vecteurs distincts peuvent se superposer. Les longueurs spatiales ne se lisent pas sur cette projection.'
              : 'Flèches depuis l’origine, à une échelle commune.'}
          </figcaption>
        </figure>
      ) : (
        <p className="notice">
          Les coordonnées ne permettent pas un tracé fini dans cet aperçu.
        </p>
      )}
      <ul className="space-y-3" aria-label="Liste des vecteurs">
        {e.vectors.map((v, i) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="h-1 w-6"
              style={{ backgroundColor: v.color }}
            />
            <span>{v.label}</span>
            {e.showCoordinates ? (
              <MathDisplay
                label={`Coordonnées du vecteur ${v.label}`}
                latex={`\\left(${v.coordinates.map((n) => n.latex).join(';')}\\right)`}
              />
            ) : (
              <span className="text-sm text-slate-500">
                Coordonnées masquées
              </span>
            )}
            {points?.[i][0] === 260 && points[i][1] === 170 && (
              <span className="text-sm text-slate-500">
                Projection confondue avec l’origine.
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
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
      return <VectorFigure element={e} />;
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
        <div className="space-y-3">
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
                  const clipped = clipDrawingLine(
                    [quotient(a.coordinates[0]), quotient(a.coordinates[1])],
                    [quotient(b.coordinates[0]), quotient(b.coordinates[1])],
                    {
                      xMin: quotient(e.window.xMin),
                      xMax: quotient(e.window.xMax),
                      yMin: quotient(e.window.yMin),
                      yMax: quotient(e.window.yMax),
                    },
                    o.kind,
                  );
                  if (!clipped) return null;
                  const [[ax, ay], [bx, by]] = clipped;
                  return (
                    <line
                      key={o.id}
                      x1={x(ax)}
                      y1={y(ay)}
                      x2={x(bx)}
                      y2={y(by)}
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
          <GeometryDescription element={e} />
        </div>
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
