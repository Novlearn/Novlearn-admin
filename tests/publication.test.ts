import { expect, it } from 'vitest';
import sqlFixture from './fixtures/publication-sql.json';
import { newDraft } from '@/lib/catalogue';
import {
  parsePublicationPayload,
  parsePublicationInspection,
  planPublication,
  PublicationConflict,
  type PublicationPayload,
  type PublicationInspection,
} from '@/lib/publication';
const id = 'b5500000-0000-4000-8000-000000000001';
const row = 'b5500000-0000-4000-8000-000000000002';
const hash = 'a'.repeat(64);
const runtime = {
  engineArchiveSha256: 'b'.repeat(64),
  engineContract: 'schema-5;engine-0.1.0',
  generationVersion: 'mulberry32-rejection-v1',
  canonicalizationVersion: 'pg-jsonb-text-v1',
};
const definition = (r = 1, title = 'Publication') => ({
  ...newDraft(title),
  id,
  revision: String(r),
});
const payload = (r = 1): PublicationPayload => ({
  schemaVersion: 1,
  catalogId: id,
  revision: r,
  definitionJson: JSON.stringify(definition(r)),
  businessDigest: hash,
  ...runtime,
});
const header = {
  title: 'Publication',
  chapter: 'Chapitre',
  difficulty: 'medium' as const,
  competences: ['target-skill'],
  app_title: 'Publication',
  Is_Flash: false,
  Need_Calculator: false,
};
const inspection = (r = 1): PublicationInspection => ({
  desiredHeader: { ...header },
  state: {
    catalogId: id,
    requestedRevision: r,
    latestRevision: 0,
    stateToken: 'c'.repeat(64),
    runtime: { ...runtime },
    parent: null,
    candidate: null,
    active: null,
  },
});
const existing = (r = 1): PublicationInspection => {
  const value = inspection(r);
  value.state.latestRevision = r;
  value.state.parent = {
    ...header,
    id: '9007199254740993',
    catalog_id: id,
    publication_epoch: 2,
    admin_archived_at: null,
    activeVersionId: row,
  };
  value.state.candidate = {
    id: row,
    revision: r,
    status: 'published',
    definitionJson: payload(r).definitionJson,
    businessDigest: hash,
  };
  value.state.active = { ...value.state.candidate };
  return value;
};
it('accepte le protocole réellement renvoyé par PostgreSQL après transfert local', () => {
  expect(parsePublicationPayload(sqlFixture.payload)).not.toBeNull();
  expect(parsePublicationInspection(sqlFixture.inspection)).not.toBeNull();
  expect(
    planPublication(sqlFixture.payload, sqlFixture.inspection, 'publish'),
  ).toMatchObject({
    action: 'unchanged',
    headerChanges: [],
    definitionChanges: [],
  });
});
it('conserve exactement le JSON transféré et refuse identité, champs éditoriaux ou schéma ajoutés', () => {
  const value = payload();
  value.definitionJson = JSON.stringify(definition(), null, 2);
  expect(parsePublicationPayload(value)?.definitionJson).toBe(
    value.definitionJson,
  );
  for (const change of [
    { actorId: id },
    { approved: true },
    { source: { receiptId: id } },
    { environment: 'production' },
    { definitionJson: '[]' },
    { catalogId: row },
    { revision: 0 },
    { businessDigest: 'wrong' },
    { definitionJson: 'x'.repeat(262145) },
  ])
    expect(parsePublicationPayload({ ...value, ...change })).toBeNull();
});
it('planifie une première publication et expose le changement de contenu', () => {
  const plan = planPublication(payload(), inspection(), 'publish');
  expect(plan.action).toBe('create_exercise');
  expect(plan.previousRevision).toBeNull();
  expect(plan.targetExerciseId).toBeNull();
  expect(plan.definitionChanges.length).toBeGreaterThan(0);
  expect(plan.headerChanges.length).toBeGreaterThan(0);
  expect(plan.stateToken).toBe('c'.repeat(64));
});
it('préserve les bigint en chaîne et distingue répétition, ajout et activation', () => {
  const target = existing();
  expect(planPublication(payload(), target, 'publish')).toMatchObject({
    action: 'unchanged',
    targetExerciseId: '9007199254740993',
    headerChanges: [],
    definitionChanges: [],
  });
  const next = existing();
  next.state.requestedRevision = 2;
  next.state.candidate = null;
  expect(planPublication(payload(2), next, 'publish').action).toBe(
    'append_revision',
  );
  const retained = existing(2);
  retained.state.active = {
    id: row.replace(/2$/, '3'),
    revision: 1,
    status: 'published',
    definitionJson: payload().definitionJson,
    businessDigest: 'd'.repeat(64),
  };
  retained.state.parent!.activeVersionId = retained.state.active.id;
  expect(planPublication(payload(2), retained, 'publish').action).toBe(
    'activate_revision',
  );
});
it('montre les métadonnées modifiées même quand la version active est identique', () => {
  const target = existing();
  target.state.parent!.title = 'Titre ancien';
  const plan = planPublication(payload(), target, 'publish');
  expect(plan.action).toBe('activate_revision');
  expect(plan.headerChanges).toEqual([
    { path: '/title', before: 'Titre ancien', after: 'Publication' },
  ]);
});
it('refuse de convertir un conflit immuable ou une version non publiée en activation', () => {
  for (const change of [
    { businessDigest: 'd'.repeat(64) },
    { status: 'draft' as const },
  ]) {
    const target = existing();
    Object.assign(target.state.candidate!, change);
    expect(() => planPublication(payload(), target, 'publish')).toThrow(
      'revision_conflict',
    );
  }
});
it('le retour à une version antérieure est explicite et conserve les différences', () => {
  const target = existing();
  target.state.active = {
    ...target.state.active!,
    id: row.replace(/2$/, '4'),
    revision: 2,
    definitionJson: JSON.stringify(definition(2, 'Plus récent')),
    businessDigest: 'd'.repeat(64),
  };
  target.state.parent!.activeVersionId = target.state.active.id;
  target.state.latestRevision = 2;
  expect(() => planPublication(payload(), target, 'publish')).toThrow(
    'rollback_required',
  );
  const plan = planPublication(payload(), target, 'rollback');
  expect(plan.action).toBe('rollback');
  expect(plan.previousRevision).toBe(2);
  expect(plan.definitionChanges).toContainEqual({
    path: '/title',
    before: 'Plus récent',
    after: 'Publication',
  });
  expect(() => planPublication(payload(), inspection(), 'rollback')).toThrow(
    'rollback_unavailable',
  );
});
it('refuse les contrats incompatibles et la cible archivée', () => {
  const mismatch = inspection();
  mismatch.state.runtime.engineArchiveSha256 = 'e'.repeat(64);
  expect(() => planPublication(payload(), mismatch, 'publish')).toThrow(
    'runtime',
  );
  const archived = existing();
  archived.state.parent!.admin_archived_at = '2026-10-15T00:00:00Z';
  expect(() => planPublication(payload(), archived, 'publish')).toThrow(
    'archived',
  );
});
it('refuse les snapshots incohérents, les données ajoutées et les epochs non représentables', () => {
  const values: unknown[] = [null, {}, { ...inspection(), actorId: id }];
  const badParent = existing();
  badParent.state.parent!.id = '9007199254740992.5';
  values.push(badParent);
  const wrongActive = existing();
  wrongActive.state.parent!.activeVersionId = id;
  values.push(wrongActive);
  const huge = existing();
  huge.state.parent!.publication_epoch = Number.MAX_SAFE_INTEGER + 1;
  values.push(huge);
  const wrongRevision = existing();
  wrongRevision.state.candidate!.revision = 2;
  values.push(wrongRevision);
  const foreign = existing();
  foreign.state.active!.definitionJson = JSON.stringify({
    ...definition(),
    id: row,
  });
  values.push(foreign);
  for (const value of values) {
    expect(parsePublicationInspection(value)).toBeNull();
    expect(() => planPublication(payload(), value, 'publish')).toThrow(
      PublicationConflict,
    );
  }
});
