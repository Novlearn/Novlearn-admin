import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fredoka';
import '../../src/app/globals.css';
import { WorkspaceNav } from './workspace-nav';
import { ActivityStatisticsView } from '../../src/components/activity-statistics';
import {
  statisticsPeriod,
  readStatisticsPeriod,
  decodeActivityStatistics,
} from '../../src/lib/activity-statistics';
import fixture from '../fixtures/activity-statistics.json';

const example = statisticsPeriod('2026-10-15', '2026-10-17')!;
const params = new URLSearchParams(window.location.search);
const selected = params.size
  ? readStatisticsPeriod(params)
  : { ok: true as const, period: example };
const period = selected.ok ? selected.period : example;
const data = selected.ok
  ? decodeActivityStatistics(fixture, { environment: 'local-fixture', period })
  : null;
const error = !selected.ok
  ? selected.error
  : data
    ? undefined
    : 'Cet exemple figé ne contient pas de données pour la période demandée. Aucun lecteur de base n’est appelé.';
createRoot(document.getElementById('root')!).render(
  <>
    <WorkspaceNav />
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <a
        href="/tests/browser/statistics.html"
        className="text-sm font-semibold text-blue-700 underline"
      >
        Revenir à l’exemple fictif du 15 au 17 octobre 2026
      </a>
      <ActivityStatisticsView
        data={data}
        period={period}
        environment="local-fixture"
        action="/tests/browser/statistics.html"
        error={error}
      />
    </main>
  </>,
);
