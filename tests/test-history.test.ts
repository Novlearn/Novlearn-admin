import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TestHistory } from '@/components/test-history';
const run = {
  id: 'fixture',
  recorded_at: '2026-10-14T12:00:00Z',
  fingerprint: 'a'.repeat(64),
  test_epoch: 0,
  passed: true,
  payload: JSON.stringify({
    report: {
      engineVersion: '0.1.0',
      seeds: [{ seed: 42, passed: true, diagnostics: [], checks: [] }],
    },
  }),
};
it('ne présente pas un reçu comme courant après une modification suivie du retour au même contenu', () => {
  const old = renderToStaticMarkup(
    createElement(TestHistory, {
      runs: [run],
      fingerprint: run.fingerprint,
      epoch: 2,
    }),
  );
  expect(old).toContain('ancien état');
  expect(old).not.toContain('· état courant');
  const current = renderToStaticMarkup(
    createElement(TestHistory, {
      runs: [run],
      fingerprint: run.fingerprint,
      epoch: 0,
    }),
  );
  expect(current).toContain('état courant');
  expect(current).toContain('42');
});
it('distingue absence de rapport et lecture indisponible', () => {
  expect(
    renderToStaticMarkup(
      createElement(TestHistory, {
        runs: [],
        fingerprint: run.fingerprint,
        epoch: 0,
      }),
    ),
  ).toContain('Aucun rapport');
  expect(
    renderToStaticMarkup(
      createElement(TestHistory, {
        runs: [],
        fingerprint: run.fingerprint,
        epoch: 0,
        unavailable: true,
      }),
    ),
  ).toContain('indisponible');
});
