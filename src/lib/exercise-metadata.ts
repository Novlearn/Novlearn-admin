/** Editorial mapping only; mathematical meaning remains in Engine. */
export const difficultyChoices = [
  { engine: 1, novlearn: 0, label: 'Facile' },
  { engine: 2, novlearn: 1, label: 'Moyen' },
  { engine: 3, novlearn: 2, label: 'Difficile' },
] as const;

export function difficultyLabel(value: unknown) {
  const choice = difficultyChoices.find(
    (c) => c.engine === value || c.label === value,
  );
  return choice?.label ?? `À rapprocher (${String(value ?? 'absente')})`;
}

export type ChapterReference = { id: string; name: string; aliases: string[] };
export type SkillReference = { id: string; chapter_id: string };

export function resolveChapter(value: string, chapters: ChapterReference[]) {
  const matches = chapters.filter(
    (c) => c.name === value || c.aliases.includes(value),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function referenceIssue(
  chapter: string | undefined,
  skills: string[],
  chapters: ChapterReference[],
  references: SkillReference[],
) {
  if (!chapter && !skills.length) return null; // Explicit incomplete draft.
  const selected = chapter ? resolveChapter(chapter, chapters) : null;
  if (!selected) return 'Choisissez un chapitre existant et non ambigu.';
  if (skills.some((id) => !references.some((s) => s.id === id)))
    return 'Une compétence est inconnue. Rapprochez sa référence avant de sauvegarder.';
  return null;
}
