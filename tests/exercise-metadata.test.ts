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
import { checkExerciseReferences } from '@/lib/exercise-references';
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
  it('résout un alias unique sans remplacer la valeur dans le brouillon', () => {
    expect(resolveChapter('Suites et limites', chapters)?.id).toBe('c1');
    expect(resolveChapter('c1', chapters)).toBeNull();
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
      await checkExerciseReferences(client, newDraft('Incomplet')),
    ).toBeNull();
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
    expect(await checkExerciseReferences(client, draft)).toBeNull();
    expect(calls).toEqual(['chapters', 'competences']);
    draft.catalogue.skills = ['derivee'];
    expect(await checkExerciseReferences(client, draft)).toBeNull();
    fail = true;
    await expect(checkExerciseReferences(client, draft)).rejects.toThrow(
      'unavailable',
    );
  });
});
