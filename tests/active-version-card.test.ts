import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { expect, it } from 'vitest';
import {
  ActiveVersionCard,
  type ActiveVersionObservation,
} from '@/components/active-version-card';
import type {
  ActiveVersionSnapshot,
  ComparableVersion,
} from '@/lib/active-version';
const snapshot = (): ActiveVersionSnapshot => ({
  schemaVersion: 1,
  environment: 'local-copy',
  targetKey: 'local-http-fixture',
  catalogId: 'ad100000-0000-4000-8000-000000000001',
  asOf: '2026-10-19T18:00:00Z',
  parent: {
    exerciseId: '9007199254740993',
    catalogId: 'ad100000-0000-4000-8000-000000000001',
    activeVersionId: 'ad200000-0000-4000-8000-000000000001',
    publicationEpoch: '3',
    archivedAt: null,
  },
  active: {
    versionId: 'ad200000-0000-4000-8000-000000000001',
    exerciseId: '9007199254740993',
    revision: 1,
    status: 'published',
    publishedAt: '2026-10-18T10:00:00Z',
    definitionSha256: 'a'.repeat(64),
    engineContract: 'schema-5;engine-0.1.0',
    generationVersion: 'mulberry32-rejection-v1',
    canonicalizationVersion: 'pg-jsonb-text-v1',
  },
});
const selected = (): ComparableVersion => {
  const v = snapshot().active!;
  return {
    revision: v.revision,
    definitionSha256: v.definitionSha256,
    engineContract: v.engineContract,
    generationVersion: v.generationVersion,
    canonicalizationVersion: v.canonicalizationVersion,
  };
};
const render = (
  observation: ActiveVersionObservation,
  version: ComparableVersion | null = selected(),
) =>
  renderToStaticMarkup(
    createElement(ActiveVersionCard, {
      observation,
      selected: version,
      exerciseId: '123',
      refreshQuery: {
        version: 'version-id',
        compare: 'comparison-id',
        history: '3',
      },
    }),
  );
it('shows actual current revision, source and observation time without substituting source selection', () => {
  const html = render(
    { kind: 'observed', snapshot: snapshot() },
    { ...selected(), revision: 2 },
  );
  expect(html).toContain('Version 1 active');
  expect(html).toContain('révision active diffère');
  expect(html).toContain('copie locale');
  expect(html).toContain('Vérifié le');
  expect(html).not.toContain('Version 2 active');
  expect(html).not.toContain('9007199254740993');
});
it('keeps selected version, comparison and history when refreshing with GET', () => {
  const html = render({ kind: 'observed', snapshot: snapshot() });
  expect(html).toContain('method="get"');
  for (const [name, value] of Object.entries({
    version: 'version-id',
    compare: 'comparison-id',
    history: '3',
  }))
    expect(html).toContain(`name="${name}" value="${value}"`);
});
it.each(['disabled', 'identity-unavailable', 'unavailable'] as const)(
  'does not show absence or success for %s',
  (kind) => {
    const html = render({ kind });
    expect(html).not.toContain('absent de la cible');
    expect(html).not.toContain('Version 1 active');
  },
);
it('separates absence, no pointer, inconsistency and archival', () => {
  const v = snapshot();
  expect(
    render({
      kind: 'observed',
      snapshot: { ...v, parent: null, active: null },
    }),
  ).toContain('absent de la cible locale');
  expect(
    render({
      kind: 'observed',
      snapshot: {
        ...v,
        parent: { ...v.parent!, activeVersionId: null },
        active: null,
      },
    }),
  ).toContain('sans version active');
  expect(
    render({ kind: 'observed', snapshot: { ...v, active: null } }),
  ).toContain('incohérentes');
  const html = render({
    kind: 'observed',
    snapshot: {
      ...v,
      parent: { ...v.parent!, archivedAt: '2026-10-19T17:00:00Z' },
    },
  });
  expect(html).toContain('Version 1 active');
  expect(html).toContain('archivé sur la cible');
});
it('compares content and contracts separately from revision number', () => {
  expect(render({ kind: 'observed', snapshot: snapshot() })).toContain(
    'correspondent à la version consultée',
  );
  expect(
    render(
      { kind: 'observed', snapshot: snapshot() },
      { ...selected(), definitionSha256: 'b'.repeat(64) },
    ),
  ).toContain('le contenu ou le contrat Engine diffère');
});
