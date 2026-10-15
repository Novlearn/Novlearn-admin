import { describe, it, expect } from 'vitest';
import {
  taxonomyMutation,
  taxonomyFilter,
  canDeleteTaxonomy,
} from '@/lib/taxonomy';
const chapter = {
  name: 'Analyse',
  aliases: ['analysis'],
  emoji: '📐',
  order_index: 2,
};
const skill = {
  id: 'derivees.1',
  name: 'Dérivées',
  chapter_id: 'a5700000-0000-4000-8000-000000000001',
  max_points: 10,
};
const save = {
  kind: 'chapter',
  action: 'save',
  id: null,
  fingerprint: null,
  value: chapter,
};
describe('Référentiel : contrats de mutation', () => {
  it('accepts chapter creation and stable competence creation', () => {
    expect(taxonomyMutation(save)).not.toBeNull();
    expect(
      taxonomyMutation({ ...save, kind: 'competence', value: skill }),
    ).not.toBeNull();
  });
  it.each([
    { ...save, environment: 'production' },
    { ...save, actor_id: 'forged' },
    { ...save, action: 'publish' },
    { ...save, id: skill.chapter_id },
    { ...save, value: { ...chapter, name: ' ' } },
    { ...save, value: { ...chapter, aliases: [''] } },
    { ...save, value: { ...chapter, order_index: 1.5 } },
    { ...save, value: { ...chapter, emoji: 'x'.repeat(17) } },
  ])('refuses invalid or privileged payload %#', (body) => {
    expect(taxonomyMutation(body)).toBeNull();
  });
  it('requires exact fingerprint and explicit deletion envelope', () => {
    expect(taxonomyMutation({ ...save, action: 'delete' })).toBeNull();
    expect(
      taxonomyMutation({
        ...save,
        id: skill.chapter_id,
        fingerprint: 'a'.repeat(64),
        action: 'delete',
        value: null,
      }),
    ).not.toBeNull();
  });
  it.each([0, 1.5, 1000001, NaN])(
    'refuses invalid max points %s',
    (max_points) => {
      expect(
        taxonomyMutation({
          ...save,
          kind: 'competence',
          value: { ...skill, max_points },
        }),
      ).toBeNull();
    },
  );
  it('prevents competence ID replacement while editing', () => {
    expect(
      taxonomyMutation({
        ...save,
        kind: 'competence',
        id: 'old-id',
        fingerprint: 'a'.repeat(64),
        value: skill,
      }),
    ).toBeNull();
  });
  it('bounds filters without interpreting search text as a pattern', () => {
    expect(
      taxonomyFilter(new URLSearchParams('q=%25_&page=-1&chapter=bad')),
    ).toEqual({ query: '%_', page: 1, chapter: null });
    expect(taxonomyFilter(new URLSearchParams('page=99999')).page).toBe(4001);
  });
  it('only enables deletion when every dependency counter is zero', () => {
    const usage = {
      exercises: 0,
      revisions: 0,
      competences: 0,
      flashcards: 0,
      scores: 0,
      exerciseIds: [],
    };
    expect(canDeleteTaxonomy(usage)).toBe(true);
    for (const key of [
      'exercises',
      'revisions',
      'competences',
      'flashcards',
      'scores',
    ])
      expect(canDeleteTaxonomy({ ...usage, [key]: 1 })).toBe(false);
  });
});
