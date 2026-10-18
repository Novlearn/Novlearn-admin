import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import {
  statisticsDate,
  statisticsPeriod,
  readStatisticsPeriod,
  decodeActivityStatistics,
  recordedSuccessRate,
  dailyBarHeight,
} from '@/lib/activity-statistics';
import { ActivityStatisticsView } from '@/components/activity-statistics';
import fixture from './fixtures/activity-statistics.json';
const period = statisticsPeriod('2026-10-15', '2026-10-17')!;
const expected = { environment: 'local-fixture' as const, period };
const copy = () => structuredClone(fixture);
it('distingue une vraie lecture SQL synthétique de la démonstration sans base', () => {
  const data = decodeActivityStatistics(
    { ...copy(), environment: 'local-copy' },
    { environment: 'local-copy', period },
  );
  expect(data).not.toBeNull();
  const html = renderToStaticMarkup(
    createElement(ActivityStatisticsView, {
      data,
      period,
      environment: 'local-copy',
    }),
  );
  expect(html).toContain('Base locale synthétique');
  expect(html).toContain('base SQL locale de test');
  expect(html).not.toContain('ne lit aucune base');
  expect(html).not.toContain('Production · consultation');
  expect(
    decodeActivityStatistics(data, { environment: 'production', period }),
  ).toBeNull();
});
it('choisit trente jours UTC inclusifs même près d’un changement de jour local', () => {
  expect(
    readStatisticsPeriod(
      new URLSearchParams(),
      new Date('2026-10-18T00:30:00+02:00'),
    ),
  ).toEqual({ ok: true, period: statisticsPeriod('2026-09-18', '2026-10-17') });
});
it('garde les jours calendaires et les bornes exclusives lors des changements d’heure', () => {
  expect(statisticsPeriod('2026-10-24', '2026-10-26')).toEqual({
    from: '2026-10-24',
    to: '2026-10-26',
    until: '2026-10-27',
    days: 3,
  });
  expect(statisticsPeriod('2024-02-28', '2024-03-01')?.days).toBe(3);
  expect(statisticsDate('2026-02-29')).toBeNull();
  expect(statisticsDate('2026-02-30')).toBeNull();
});
it.each([
  'from=2026-10-15',
  'to=2026-10-17',
  'from=2026-10-17&to=2026-10-15',
  'from=2026-07-01&to=2026-10-17',
  'from=2026-10-17&to=2026-10-18',
  'from=2026-10-15&from=2026-10-16&to=2026-10-17',
  'from=2026-10-15&to=2026-10-17&target=https://remote.example',
  'from=2026-02-30&to=2026-03-01',
  'from=2026-10-15&to=2026-10-17&chapter=unimplemented',
])(
  'refuse les périodes ambiguës, futures ou filtres non implémentés %#',
  (query) => {
    expect(
      readStatisticsPeriod(
        new URLSearchParams(query),
        new Date('2026-10-17T20:00:00Z'),
      ).ok,
    ).toBe(false);
  },
);
it('accepte au plus 90 jours sans borner silencieusement une demande plus large', () => {
  expect(statisticsPeriod('2026-07-20', '2026-10-17')?.days).toBe(90);
  expect(statisticsPeriod('2026-07-19', '2026-10-17')).toBeNull();
});
it('décode l’exemple sans le présenter comme Production et projette seulement les agrégats', () => {
  const result = decodeActivityStatistics(copy(), expected);
  expect(result?.totals.activeAccounts).toBe('3');
  expect(decodeActivityStatistics(result, expected)).toEqual(result);
  expect(
    result?.daily.reduce((n, row) => n + BigInt(row.activeAccounts), BigInt(0)),
  ).toBe(BigInt(5));
  expect(
    decodeActivityStatistics(copy(), {
      ...expected,
      environment: 'production',
    }),
  ).toBeNull();
  expect(
    decodeActivityStatistics(copy(), {
      ...expected,
      period: statisticsPeriod('2026-10-14', '2026-10-16')!,
    }),
  ).toBeNull();
});
it.each([
  (x: ReturnType<typeof copy>) => {
    x.schemaVersion = 2;
  },
  (x: ReturnType<typeof copy>) => {
    x.accounts.anonymous = '11';
  },
  (x: ReturnType<typeof copy>) => {
    x.totals.activeAccounts = '11';
  },
  (x: ReturnType<typeof copy>) => {
    x.totals.accountsCreated = '11';
  },
  (x: ReturnType<typeof copy>) => {
    x.totals.exerciseAttempts = '10';
  },
  (x: ReturnType<typeof copy>) => {
    x.daily[0].date = '2026-10-16';
  },
  (x: ReturnType<typeof copy>) => {
    x.daily.reverse();
  },
  (x: ReturnType<typeof copy>) => {
    x.daily.pop();
  },
  (x: ReturnType<typeof copy>) => {
    x.daily[1].activeAccounts = '4';
  },
  (x: ReturnType<typeof copy>) => {
    x.daily[0].accountsCreated = '2';
  },
  (x: ReturnType<typeof copy>) => {
    x.totals.activeAccounts = '6';
  },
  (x: ReturnType<typeof copy>) => {
    x.totals.completedDuels = '3';
  },
  (x: ReturnType<typeof copy>) => {
    x.asOf = '2026-02-30T12:00:00Z';
  },
  (x: ReturnType<typeof copy>) => {
    x.asOf = '2026-10-15T12:00:00Z';
  },
  (x: ReturnType<typeof copy>) => {
    x.asOf = '2026-10-17T25:00:00Z';
  },
  (x: ReturnType<typeof copy>) => {
    x.accounts.total = '01';
  },
  (x: ReturnType<typeof copy>) => {
    x.accounts.total = '9223372036854775808';
  },
])(
  'refuse une incohérence, un doublon de jour ou un compteur non représentable %#',
  (change) => {
    const data = copy();
    change(data);
    expect(decodeActivityStatistics(data, expected)).toBeNull();
  },
);
it('refuse les champs personnels ajoutés au lieu de les transmettre au navigateur', () => {
  expect(
    decodeActivityStatistics(
      { ...copy(), profiles: [{ email: 'PRIVATE@example.invalid' }] },
      expected,
    ),
  ).toBeNull();
  const data = copy();
  (data.daily[0] as unknown as Record<string, unknown>).userIds = ['PRIVATE'];
  expect(decodeActivityStatistics(data, expected)).toBeNull();
});
it('conserve les compteurs SQL au-delà de la précision JavaScript', () => {
  const data = copy();
  data.accounts.total = '9007199254740993';
  expect(decodeActivityStatistics(data, expected)?.accounts.total).toBe(
    '9007199254740993',
  );
  expect(recordedSuccessRate('9007199254740993', '9007199254740993')).toBe(
    '50,0 %',
  );
});
it('ne fabrique pas de réussite à zéro et arrondit une seule fois', () => {
  expect(recordedSuccessRate('0', '0')).toBeNull();
  expect(recordedSuccessRate('1', '2')).toBe('33,3 %');
  expect(recordedSuccessRate('9949', '90051')).toBe('9,9 %');
  expect(recordedSuccessRate('9950', '90050')).toBe('10,0 %');
  expect(recordedSuccessRate('-1', '3')).toBeNull();
});
it('calcule des hauteurs finies avec de grands compteurs et un maximum nul', () => {
  expect(dailyBarHeight('9007199254740993', '9007199254740993')).toBe(100);
  expect(dailyBarHeight('0', '0')).toBe(0);
  expect(dailyBarHeight('5', '4')).toBe(0);
});
it('affiche une indisponibilité explicite sans inventer des zéros ni un taux', () => {
  const html = renderToStaticMarkup(
    createElement(ActivityStatisticsView, {
      data: null,
      period,
      environment: 'production',
    }),
  );
  expect(html).toContain('Statistiques indisponibles');
  expect(html).not.toContain('0,0');
  expect(html).not.toContain('Comptes Auth présents');
});
it('distingue un relevé réellement vide de l’absence de relevé', () => {
  const data = copy();
  data.accounts = { total: '0', anonymous: '0' };
  for (const key of Object.keys(data.totals))
    data.totals[key as keyof typeof data.totals] = '0';
  for (const row of data.daily)
    for (const key of Object.keys(data.totals))
      row[key as keyof typeof data.totals] = '0';
  const decoded = decodeActivityStatistics(data, expected);
  expect(decoded).not.toBeNull();
  const html = renderToStaticMarkup(
    createElement(ActivityStatisticsView, {
      data: decoded,
      period,
      environment: 'local-fixture',
    }),
  );
  expect(html).toContain('Comptes Auth présents');
  expect(html).toContain('Non calculable');
  expect(html).not.toContain('Statistiques indisponibles');
});
it('accepte les 90 jours vides exacts et refuse un jour supplémentaire', () => {
  const span = statisticsPeriod('2026-07-20', '2026-10-17')!;
  const zero = Object.fromEntries(
    Object.keys(fixture.totals).map((key) => [key, '0']),
  );
  const data = {
    ...copy(),
    period: { from: span.from, until: span.until },
    accounts: { total: '0', anonymous: '0' },
    totals: zero,
    daily: Array.from({ length: 90 }, (_, index) => ({
      date: new Date(Date.parse(span.from + 'T00:00:00Z') + index * 86400000)
        .toISOString()
        .slice(0, 10),
      ...zero,
    })),
  };
  expect(
    decodeActivityStatistics(data, {
      environment: 'local-fixture',
      period: span,
    })?.daily,
  ).toHaveLength(90);
  data.daily.push({ ...data.daily[0] });
  expect(
    decodeActivityStatistics(data, {
      environment: 'local-fixture',
      period: span,
    }),
  ).toBeNull();
});
it('refuse un compteur JSON numérique qui aurait pu perdre sa précision', () => {
  const data = copy();
  (data.accounts as unknown as Record<string, unknown>).total =
    9007199254740992;
  expect(decodeActivityStatistics(data, expected)).toBeNull();
});
it('étiquette la démonstration, expose une table accessible et ne mélange pas les sources', () => {
  const data = decodeActivityStatistics(copy(), expected)!;
  const html = renderToStaticMarkup(
    createElement(ActivityStatisticsView, {
      data,
      period,
      environment: 'local-fixture',
    }),
  );
  expect(html).toContain('chiffres fictifs');
  expect(html).toContain('ne lit aucune base');
  expect(html).toContain('<caption');
  expect(html).toContain('scope="row"');
  expect(html).toContain('66,7');
  const wrong = renderToStaticMarkup(
    createElement(ActivityStatisticsView, {
      data,
      period,
      environment: 'production',
    }),
  );
  expect(wrong).toContain('Statistiques indisponibles');
  expect(wrong).not.toContain('66,7');
});
