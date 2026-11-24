import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import {
  referenceIssue,
  resolveChapter,
  type ChapterReference,
  type SkillReference,
} from './exercise-metadata';

/** Uses the caller's verified session/RLS, never a privileged key. SQL remains authoritative. */
export async function prepareExerciseReferences(
  client: SupabaseClient,
  definition: ExerciseDefinition,
) {
  const { chapter, skills = [] } = definition.catalogue ?? {};
  if (!chapter && !skills.length) return { issue: null, definition };
  const chapters = await client
    .from('chapters')
    .select('id,name,aliases')
    .limit(1000);
  if (
    chapters.error ||
    !Array.isArray(chapters.data) ||
    chapters.data.length >= 1000
  )
    throw new Error('Reference catalogue unavailable');
  let references: SkillReference[] = [];
  if (skills.length) {
    const result = await client
      .from('competences')
      .select('id,chapter_id')
      .in('id', skills)
      .limit(64);
    if (result.error || !Array.isArray(result.data))
      throw new Error('Reference catalogue unavailable');
    references = result.data as SkillReference[];
  }
  const chapterReferences = chapters.data as ChapterReference[];
  const issue = referenceIssue(chapter, skills, chapterReferences, references);
  const selected =
    !issue && chapter ? resolveChapter(chapter, chapterReferences) : null;
  return {
    issue,
    definition:
      selected && selected.id === chapter && selected.name !== chapter
        ? {
            ...definition,
            catalogue: { ...definition.catalogue, chapter: selected.name },
          }
        : definition,
  };
}
