import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  difficultyChoices,
  difficultyLabel,
  referenceIssue,
  resolveChapter,
} from '@/lib/exercise-metadata';
import { newDraft } from '@/lib/catalogue';
vi.mock('server-only', () => ({}));
import { prepareExerciseReferences } from '@/lib/exercise-references';
const chapters = [
  { id: 'c1', name: 'Suites', aliases: ['Suites et limites'] },
  { id: 'c2', name: 'Dérivation', aliases: [] },
];
const skills = [
  { id: 'termes', chapter_id: 'c1' },
  { id: 'derivee', chapter_id: 'c2' },
];

describe('métadonnées éditoriales et références', () => {
  it('rend explicite le décalage des indices sans confondre les valeurs inconnues', () => {
    expect(
      difficultyChoices.map((c) => [c.engine, c.novlearn, c.label]),
    ).toEqual([
      [1, 0, 'Facile'],
      [2, 1, 'Moyen'],
      [3, 2, 'Difficile'],
    ]);
    expect(difficultyLabel(1)).toBe('Facile');
    expect(difficultyLabel('Moyen')).toBe('Moyen');
    expect(difficultyLabel(0)).toContain('À rapprocher');
    expect(difficultyLabel('easy')).toContain('À rapprocher');
  });
  it('résout un identifiant ou un alias unique et refuse les ambiguïtés', () => {
    expect(resolveChapter('Suites et limites', chapters)?.id).toBe('c1');
    expect(resolveChapter('c1', chapters)?.name).toBe('Suites');
    expect(resolveChapter('absent', chapters)).toBeNull();
    expect(
      resolveChapter('Suites', [
        ...chapters,
        { id: 'c3', name: 'Autre', aliases: ['Suites'] },
      ]),
    ).toBeNull();
  });
  it('permet l’absence explicite de références dans un brouillon incomplet', () => {
    expect(referenceIssue(undefined, [], chapters, skills)).toBeNull();
  });
  it.each([
    ['Inconnu', []],
    ['', ['termes']],
    ['Suites', ['absente']],
  ])('refuse chapitre/compétences incohérents : %s %j', (chapter, selected) => {
    expect(referenceIssue(chapter, selected, chapters, skills)).toBeTypeOf(
      'string',
    );
  });
  it('accepts a skill from another chapter when its reference exists', () => {
    expect(
      referenceIssue('Suites et limites', ['derivee'], chapters, skills),
    ).toBeNull();
  });
  it('n’utilise que la session du client et ne consulte pas le référentiel pour un brouillon vide', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    expect(
      await prepareExerciseReferences(client, newDraft('Incomplet')),
    ).toMatchObject({ issue: null });
    expect(from).not.toHaveBeenCalled();
  });
  it('vérifie les références réelles et ferme sur une erreur de lecture', async () => {
    let fail = false;
    const calls: string[] = [];
    const client = {
      from: (table: string) => {
        calls.push(table);
        return {
          select: () => ({
            in: () => ({ limit: async () => ({ data: skills, error: null }) }),
            limit: async () => ({ data: chapters, error: fail ? {} : null }),
          }),
        };
      },
    } as unknown as SupabaseClient;
    const draft = {
      ...newDraft('Références'),
      catalogue: { chapter: 'Suites', skills: ['termes'] },
    };
    expect(await prepareExerciseReferences(client, draft)).toEqual({
      issue: null,
      definition: draft,
    });
    expect(calls).toEqual(['chapters', 'competences']);
    draft.catalogue.skills = ['derivee'];
    draft.catalogue.chapter = 'c1';
    expect(await prepareExerciseReferences(client, draft)).toMatchObject({
      issue: null,
      definition: { catalogue: { chapter: 'Suites', skills: ['derivee'] } },
    });
    expect(draft.catalogue.chapter).toBe('c1');
    fail = true;
    await expect(prepareExerciseReferences(client, draft)).rejects.toThrow(
      'unavailable',
    );
  });
});
