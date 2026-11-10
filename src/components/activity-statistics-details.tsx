'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  ActivityCounts,
  StatisticsPeriod,
} from '@/lib/activity-statistics';

type DailyRow = { date: string } & ActivityCounts;
type SortKey =
  | 'date-asc'
  | 'date-desc'
  | 'exercise-desc'
  | 'exercise-asc'
  | 'active-desc'
  | 'duels-desc'
  | 'newest-accounts-desc';

const sortLabels: Record<SortKey, string> = {
  'date-asc': 'Date · ancien au récent',
  'date-desc': 'Date · récent à ancien',
  'exercise-desc': 'Tentatives d’exercices · décroissant',
  'exercise-asc': 'Tentatives d’exercices · croissant',
  'active-desc': 'Comptes actifs · décroissant',
  'duels-desc': 'Tentatives de duel · décroissant',
  'newest-accounts-desc': 'Nouveaux comptes · décroissant',
};

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));

export function ActivityStatisticsDetails({
  daily,
  period,
  totals,
  registeredAccounts,
  successRate,
}: {
  daily: DailyRow[];
  period: StatisticsPeriod;
  totals: ActivityCounts;
  registeredAccounts: string;
  successRate: string | null;
}) {
  const [sort, setSort] = useState<SortKey>('date-asc');
  const sorted = useMemo(() => {
    const rows = [...daily];
    rows.sort((a, b) => {
      if (sort === 'date-desc') return b.date.localeCompare(a.date);
      if (sort === 'exercise-desc')
        return byCount(b.exerciseAttempts, a.exerciseAttempts, a.date, b.date);
      if (sort === 'exercise-asc')
        return byCount(a.exerciseAttempts, b.exerciseAttempts, a.date, b.date);
      if (sort === 'active-desc')
        return byCount(b.activeAccounts, a.activeAccounts, a.date, b.date);
      if (sort === 'duels-desc')
        return byCount(b.duelAttempts, a.duelAttempts, a.date, b.date);
      if (sort === 'newest-accounts-desc')
        return byCount(b.accountsCreated, a.accountsCreated, a.date, b.date);
      return a.date.localeCompare(b.date);
    });
    return rows;
  }, [daily, sort]);

  function exportCsv() {
    const fields = [
      ['Date UTC', (row: DailyRow) => row.date],
      ['Comptes actifs', (row: DailyRow) => row.activeAccounts],
      ['Nouveaux comptes', (row: DailyRow) => row.accountsCreated],
      ['Tentatives exercices', (row: DailyRow) => row.exerciseAttempts],
      ['Verdicts positifs', (row: DailyRow) => row.correct],
      ['Verdicts négatifs', (row: DailyRow) => row.incorrect],
      ['Abandons', (row: DailyRow) => row.abandoned],
      ['Non classés', (row: DailyRow) => row.unclassified],
      ['Tentatives duel', (row: DailyRow) => row.duelAttempts],
      ['Duels terminés', (row: DailyRow) => row.completedDuels],
    ] as const;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [
      ['Indicateur', 'Valeur'].map(escape).join(';'),
      ...[
        ['Période du', period.from],
        ['Période au (incluse)', period.to],
        ['Comptes inscrits (stock au relevé)', registeredAccounts],
        ['Comptes actifs sur la période', totals.activeAccounts],
        ['Tentatives exercices sur la période', totals.exerciseAttempts],
        ['Tentatives duel sur la période', totals.duelAttempts],
        ['Taux de réussite déclaré', successRate ?? 'Non calculable'],
        ['Verdicts positifs', totals.correct],
        ['Verdicts négatifs', totals.incorrect],
        ['Abandons', totals.abandoned],
        ['Tentatives non classées', totals.unclassified],
        ['Nouveaux comptes sur la période', totals.accountsCreated],
        ['Duels terminés sur la période', totals.completedDuels],
      ].map((row) => row.map(escape).join(';')),
      '',
      fields.map(([label]) => escape(label)).join(';'),
      ...daily.map((row) =>
        fields.map(([, get]) => escape(get(row))).join(';'),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `novlearn-statistiques-${period.from}-${period.to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/statistics?from=${period.from}&to=${period.to}`}
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← Retour aux statistiques
        </Link>
        <button
          type="button"
          onClick={exportCsv}
          className="button inline-flex items-center gap-2"
        >
          <DownloadIcon /> Exporter en CSV
        </button>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Activité quotidienne</h2>
            <p className="mt-1 text-sm text-slate-500">
              {dateLabel(period.from)} – {dateLabel(period.to)} · {daily.length}{' '}
              jours
            </p>
          </div>
          <label className="label">
            Trier par
            <select
              className="field"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-h-[calc(100vh-17rem)] min-h-80 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Activité quotidienne, triée par {sortLabels[sort].toLowerCase()}.
            </caption>
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                {[
                  'Date UTC',
                  'Comptes actifs',
                  'Nouveaux comptes',
                  'Tentatives exercices',
                  'Tentatives duel',
                  'Duels terminés',
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.date}
                  className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50"
                >
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    {dateLabel(row.date)}
                  </th>
                  {[
                    row.activeAccounts,
                    row.accountsCreated,
                    row.exerciseAttempts,
                    row.duelAttempts,
                    row.completedDuels,
                  ].map((value, index) => (
                    <td
                      className="whitespace-nowrap px-3 py-3 tabular-nums"
                      key={`${row.date}-${index}`}
                    >
                      {formatCount(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function byCount(a: string, b: string, aDate: string, bDate: string) {
  const left = BigInt(a);
  const right = BigInt(b);
  return left === right ? aDate.localeCompare(bDate) : left < right ? -1 : 1;
}

const formatCount = (value: string) =>
  new Intl.NumberFormat('fr-FR').format(BigInt(value));

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path
        d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13.5v2A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
