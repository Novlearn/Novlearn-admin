'use client';
import { useEffect, useState } from 'react';
import type {
  ChapterValue,
  CompetenceValue,
  TaxonomyData,
  TaxonomyItem,
} from '@/lib/taxonomy';
import { difficultyChoices } from '@/lib/exercise-metadata';

const PAGE_SIZE = 25;
const LEGACY_CHAPTER = '__legacy_chapter__';

type ExerciseReferences = {
  chapters: { id: string; name: string }[];
  competences: { id: string; name: string; chapterId: string }[];
};

function isTaxonomyData(value: unknown): value is TaxonomyData {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as TaxonomyData).items) &&
    Array.isArray((value as TaxonomyData).chapters) &&
    Number.isSafeInteger((value as TaxonomyData).total) &&
    (value as TaxonomyData).total >= 0
  );
}

async function fetchTaxonomyPage(
  kind: 'chapter' | 'competence',
  page: number,
  signal: AbortSignal,
): Promise<TaxonomyData> {
  const params = new URLSearchParams({ kind, q: '', page: String(page) });
  const response = await fetch(`/api/admin/taxonomy?${params}`, {
    signal,
    cache: 'no-store',
  });
  const packet = await response.json();
  if (
    !response.ok ||
    packet.environment !== 'staging' ||
    !isTaxonomyData(packet.result)
  )
    throw new Error('Taxonomy response');
  return packet.result;
}

async function fetchAllTaxonomyItems(
  kind: 'chapter' | 'competence',
  signal: AbortSignal,
): Promise<TaxonomyItem[]> {
  const first = await fetchTaxonomyPage(kind, 1, signal);
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  if (pageCount <= 1) return first.items;
  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchTaxonomyPage(kind, index + 2, signal),
    ),
  );
  const items = [first, ...remaining].flatMap((page) => page.items);
  if (items.length !== first.total) throw new Error('Incomplete taxonomy');
  return items;
}

function SkillCheckbox({
  item,
  checked,
  disabled,
  onChange,
}: {
  item: { id: string; name: string };
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm leading-5 hover:bg-slate-50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{item.name}</span>
    </label>
  );
}

export function ExerciseReferenceFields({
  chapter,
  skills,
  difficulty,
  onChapter,
  onSkills,
  onDifficulty,
  disabled = false,
}: {
  chapter: string;
  skills: string[];
  difficulty?: number;
  onChapter: (name: string) => void;
  onSkills: (ids: string[]) => void;
  onDifficulty: (difficulty: number | undefined) => void;
  disabled?: boolean;
}) {
  const [references, setReferences] = useState<ExerciseReferences | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [retry, setRetry] = useState(0);
  const [skillsOpen, setSkillsOpen] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    void Promise.all([
      fetchAllTaxonomyItems('chapter', controller.signal),
      fetchAllTaxonomyItems('competence', controller.signal),
    ])
      .then(([chapterItems, competenceItems]) => {
        if (controller.signal.aborted) return;
        setReferences({
          chapters: chapterItems.map((item) => ({
            id: item.id,
            name: (item.value as ChapterValue).name,
          })),
          competences: competenceItems.map((item) => {
            const value = item.value as CompetenceValue;
            return {
              id: item.id,
              name: value.name,
              chapterId: value.chapter_id,
            };
          }),
        });
        setLoadState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error');
      });
    return () => controller.abort();
  }, [retry]);

  const selectedChapters =
    references?.chapters.filter((item) => item.name === chapter) ?? [];
  const selectedChapterId =
    selectedChapters.length === 1 ? selectedChapters[0].id : null;
  const groups = (references?.chapters ?? []).map((item) => ({
    ...item,
    items: (references?.competences ?? []).filter(
      (competence) => competence.chapterId === item.id,
    ),
  }));
  const selectedGroup = groups.find((group) => group.id === selectedChapterId);
  const otherGroups = groups.filter((group) => group.id !== selectedChapterId);
  const ungrouped = (references?.competences ?? []).filter(
    (competence) =>
      !references?.chapters.some((item) => item.id === competence.chapterId),
  );
  const knownSkills = new Set(
    (references?.competences ?? []).map((item) => item.id),
  );
  const unresolvedSkills = skills.filter((id) => !knownSkills.has(id));

  function toggleSkill(id: string, checked: boolean) {
    onSkills(
      checked
        ? [...new Set([...skills, id])]
        : skills.filter((selected) => selected !== id),
    );
  }

  function skillList(items: { id: string; name: string }[]) {
    return items.map((item) => (
      <SkillCheckbox
        key={item.id}
        item={item}
        checked={skills.includes(item.id)}
        disabled={
          disabled || (skills.length >= 64 && !skills.includes(item.id))
        }
        onChange={(checked) => toggleSkill(item.id, checked)}
      />
    ));
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="label">
        Chapitre
        <select
          className="field"
          value={selectedChapterId ?? (chapter ? LEGACY_CHAPTER : '')}
          disabled={disabled || loadState !== 'ready'}
          onChange={(event) => {
            const selected = references?.chapters.find(
              (item) => item.id === event.target.value,
            );
            if (selected) onChapter(selected.name);
            else if (event.target.value === '') onChapter('');
          }}
        >
          <option value="">Choisir un chapitre</option>
          {chapter && !selectedChapterId && (
            <option value={LEGACY_CHAPTER} disabled>
              {chapter} · référence à rapprocher
            </option>
          )}
          {(references?.chapters ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {chapter && !selectedChapterId && (
          <span className="text-xs font-normal text-amber-800">
            Cette référence historique est conservée jusqu’à son rapprochement.
          </span>
        )}
      </label>

      <label className="label">
        Difficulté
        <select
          className="field"
          value={difficulty ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onDifficulty(
              event.target.value ? Number(event.target.value) : undefined,
            )
          }
        >
          <option value="">À choisir</option>
          {difficulty !== undefined &&
            !difficultyChoices.some(
              (choice) => choice.engine === difficulty,
            ) && (
              <option value={difficulty}>À rapprocher ({difficulty})</option>
            )}
          {difficultyChoices.map((choice) => (
            <option key={choice.engine} value={choice.engine}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset disabled={disabled} className="space-y-3 md:col-span-2">
        <legend className="sr-only">Compétences de l’exercice</legend>
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-slate-900">
            Compétences ({skills.length})
          </p>
          <button
            type="button"
            className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label={
              skillsOpen
                ? 'Replier les compétences'
                : 'Afficher les compétences'
            }
            aria-expanded={skillsOpen}
            onClick={() => setSkillsOpen((open) => !open)}
          >
            <span aria-hidden="true">{skillsOpen ? '⌃' : '⌄'}</span>
          </button>
        </div>

        {loadState === 'loading' && (
          <p role="status" className="text-sm text-slate-500">
            Chargement des chapitres et compétences…
          </p>
        )}
        {loadState === 'error' && (
          <p role="alert" className="text-sm text-amber-800">
            Référentiel indisponible.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              Réessayer
            </button>
          </p>
        )}

        {skillsOpen && references && (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {selectedGroup && (
              <div className="space-y-1">
                {selectedGroup.items.length ? (
                  skillList(selectedGroup.items)
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    Aucune compétence pour ce chapitre.
                  </p>
                )}
              </div>
            )}
            {otherGroups.map((group) => {
              const selectedCount = group.items.filter((item) =>
                skills.includes(item.id),
              ).length;
              return (
                <details
                  key={group.id}
                  className="overflow-hidden rounded-lg bg-slate-50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    <span>{group.name}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      {selectedCount
                        ? `${selectedCount} sélectionnée${selectedCount > 1 ? 's' : ''} · `
                        : ''}
                      ›
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 bg-white py-1">
                    {group.items.length ? (
                      skillList(group.items)
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-500">
                        Aucune compétence pour ce chapitre.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
            {!!ungrouped.length && (
              <details className="overflow-hidden rounded-lg bg-amber-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-950">
                  Chapitre absent · {ungrouped.length} compétence
                  {ungrouped.length > 1 ? 's' : ''}
                </summary>
                <div className="border-t border-amber-200 py-1">
                  {skillList(ungrouped)}
                </div>
              </details>
            )}
            {unresolvedSkills.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950"
              >
                <span className="break-all">
                  Compétence historique à rapprocher · {id}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-semibold underline"
                  onClick={() => toggleSkill(id, false)}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
