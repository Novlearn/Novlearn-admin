import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TestHistory } from '@/components/test-history';
import { certifiedEngineIdentity } from '@/lib/engine-identity';
import { isCurrentTestReceipt } from '@/lib/test-receipt-state';
const run = {
  id: 'fixture',
  recorded_at: '2026-10-14T12:00:00Z',
  fingerprint: 'a'.repeat(64),
  test_epoch: 0,
  passed: true,
  payload: JSON.stringify({
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
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
it('conserve un succès historique sans le qualifier de courant après rotation du moteur', () => {
  const historical = {
    ...run,
    payload: JSON.stringify({
      ...JSON.parse(run.payload),
      engineArchiveSha256:
        '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290',
    }),
  };
  const html = renderToStaticMarkup(
    createElement(TestHistory, {
      runs: [historical],
      fingerprint: run.fingerprint,
      epoch: 0,
    }),
  );
  expect(html).toContain('Tests réussis');
  expect(html).toContain('ancien état');
  expect(html).toContain('Relancez les tests');
  expect(html).toContain('42');
  expect(html).not.toContain('· état courant');
  expect(isCurrentTestReceipt(historical, run.fingerprint, 0)).toBe(false);
});
it.each(['null', '[]', '{', '{}'])(
  'refuse un rapport sans identité vérifiable : %s',
  (payload) => {
    expect(isCurrentTestReceipt({ ...run, payload }, run.fingerprint, 0)).toBe(
      false,
    );
  },
);
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
