'use client';

import type { ActivityCounts } from '@/lib/activity-statistics';
import { formatCount } from '@/lib/dashboard';

type DailyRow = { date: string } & ActivityCounts;

const charts = [
  {
    key: 'exerciseAttempts',
    title: 'Tentatives d’exercices',
    color: '#6366f1',
  },
  {
    key: 'activeAccounts',
    title: 'Comptes actifs par jour',
    color: '#06b6d4',
  },
  { key: 'duelAttempts', title: 'Tentatives de duel', color: '#d946ef' },
  {
    key: 'accountsCreated',
    title: 'Nouveaux comptes',
    color: '#10b981',
  },
] as const;

const chartWidth = 720;
const chartHeight = 210;
const plot = { left: 58, right: 704, top: 14, bottom: 154 };

export function ActivityStatisticsCharts({ daily }: { daily: DailyRow[] }) {
  return (
    <section
      aria-label="Graphiques d’activité"
      className="grid gap-4 lg:grid-cols-2"
    >
      {charts.map(({ key, title, color }) => {
        const max = daily.reduce(
          (largest, row) =>
            BigInt(row[key]) > BigInt(largest) ? row[key] : largest,
          '0',
        );
        const half = (BigInt(max) + BigInt('1')) / BigInt('2');
        const ticks = [...new Set(['0', half.toString(), max])];
        const xIndexes = dateTickIndexes(daily.length);
        const plotHeight = plot.bottom - plot.top;
        const step =
          daily.length > 1 ? (plot.right - plot.left) / daily.length : 0;
        const barWidth = Math.max(2, Math.min(22, step * 0.62));

        return (
          <article className="card space-y-3" key={key}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{title}</h2>
              <span className="text-xs text-slate-500">
                Valeur quotidienne · UTC
              </span>
            </div>
            <svg
              className="h-auto w-full overflow-visible"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`${title}, du ${formatDate(daily[0]?.date ?? '')} au ${formatDate(daily.at(-1)?.date ?? '')}. Axe horizontal : date. Axe vertical : nombre par jour, de 0 à ${formatCount(max)}.`}
              preserveAspectRatio="none"
            >
              {ticks.map((tick) => {
                const y = plot.bottom - ratio(tick, max) * plotHeight;
                return (
                  <g key={tick}>
                    <line
                      x1={plot.left}
                      x2={plot.right}
                      y1={y}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeDasharray={tick === '0' ? undefined : '3 5'}
                      strokeWidth={tick === '0' ? 1.25 : 1}
                    />
                    <text
                      x={plot.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500"
                      fontSize="11"
                    >
                      {formatCount(tick)}
                    </text>
                  </g>
                );
              })}
              <text
                x="14"
                y={(plot.top + plot.bottom) / 2}
                transform={`rotate(-90 14 ${(plot.top + plot.bottom) / 2})`}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="10"
              >
                Nombre
              </text>
              {daily.map((row, index) => {
                const value = row[key];
                const barHeight = ratio(value, max) * plotHeight;
                const center =
                  daily.length === 1
                    ? (plot.left + plot.right) / 2
                    : plot.left + step * (index + 0.5);
                return (
                  <rect
                    key={row.date}
                    x={center - barWidth / 2}
                    y={plot.bottom - barHeight}
                    width={barWidth}
                    height={Math.max(value === '0' ? 0 : 2, barHeight)}
                    rx="2"
                    fill={color}
                  >
                    <title>{`${formatDate(row.date)} : ${formatCount(value)}`}</title>
                  </rect>
                );
              })}
              {xIndexes.map((index) => {
                const center =
                  daily.length === 1
                    ? (plot.left + plot.right) / 2
                    : plot.left +
                      (plot.right - plot.left) * (index / (daily.length - 1));
                const anchor =
                  index === 0
                    ? 'start'
                    : index === daily.length - 1
                      ? 'end'
                      : 'middle';
                return (
                  <text
                    key={daily[index]?.date ?? index}
                    x={center}
                    y={178}
                    textAnchor={anchor}
                    className="fill-slate-500"
                    fontSize="11"
                  >
                    {formatShortDate(daily[index]?.date ?? '')}
                  </text>
                );
              })}
              <text
                x={(plot.left + plot.right) / 2}
                y="202"
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="10"
              >
                Date (UTC)
              </text>
            </svg>
          </article>
        );
      })}
    </section>
  );
}

function ratio(value: string, max: string) {
  if (max === '0') return 0;
  return Number((BigInt(value) * BigInt('10000')) / BigInt(max)) / 10000;
}

function dateTickIndexes(length: number) {
  if (length <= 1) return [0];
  const last = length - 1;
  return [
    ...new Set([
      0,
      Math.round(last / 4),
      Math.round(last / 2),
      Math.round((last * 3) / 4),
      last,
    ]),
  ];
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDate(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
