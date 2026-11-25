import Link from 'next/link';
import { ExercisePromptForm } from '@/components/exercise-prompt-form';
import { ExerciseImportForm } from '@/components/exercise-import-form';
import { requireCatalogueClient } from '@/lib/catalogue-server';
import { type CatalogueItem, isUuid } from '@/lib/catalogue';
import { difficultyLabel } from '@/lib/exercise-metadata';
import type { TaxonomyData, TaxonomyItem } from '@/lib/taxonomy';
import { isEngineEnabled } from '@/lib/engine-identity';

type ChapterOption = { id: string; name: string; aliases: string[] };
type ChapterCoverage = {
  total: number;
  byDifficulty: Record<string, number>;
  examples: ExerciseContext[];
  skills: { id: string; count: number }[];
};
type MutableChapterCoverage = Omit<ChapterCoverage, 'skills'> & {
  skills: Map<string, number>;
};
type ExerciseContext = {
  title: string;
  difficulty: string;
  status: string;
  skills: string[];
};
const CATALOGUE_BATCH_SIZE = 25;

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

function readChapters(data: TaxonomyData): ChapterOption[] | null {
  const chapters = data.items.flatMap((item: TaxonomyItem) => {
    const value = item.value as { name?: unknown; aliases?: unknown };
    if (
      !isUuid(item.id) ||
      typeof value.name !== 'string' ||
      !Array.isArray(value.aliases) ||
      !value.aliases.every((alias) => typeof alias === 'string')
    )
      return [];
    return [{ id: item.id, name: value.name, aliases: value.aliases }];
  });
  return chapters.length === data.items.length ? chapters : null;
}

function normalizeChapter(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr');
}

export default async function GenerateExercisePage() {
  const client = await requireCatalogueClient();
  const importConfigured = isEngineEnabled(process.env);
  const [taxonomyResult, firstCataloguePage] = await Promise.all([
    client.rpc('admin_list_taxonomy', {
      p_kind: 'chapter',
      p_query: '',
      p_chapter: null,
      p_offset: 0,
    }),
    client.rpc('admin_list_exercises', {
      p_query: '',
      p_status: 'all',
      p_sort: 'title',
      p_offset: 0,
      p_limit: CATALOGUE_BATCH_SIZE,
    }),
  ]);

  let chapters: ChapterOption[] | null = null;
  if (!taxonomyResult.error && isTaxonomyData(taxonomyResult.data)) {
    chapters = readChapters(taxonomyResult.data);
  }

  const catalogue = firstCataloguePage.data as {
    total?: unknown;
    items?: unknown;
  } | null;
  let exercises: CatalogueItem[] | null = null;
  if (
    !firstCataloguePage.error &&
    catalogue &&
    Number.isSafeInteger(catalogue.total) &&
    (catalogue.total as number) >= 0 &&
    Array.isArray(catalogue.items) &&
    catalogue.items.length <= CATALOGUE_BATCH_SIZE &&
    catalogue.items.length ===
      Math.min(catalogue.total as number, CATALOGUE_BATCH_SIZE)
  ) {
    const total = catalogue.total as number;
    const offsets = Array.from(
      { length: Math.ceil(total / CATALOGUE_BATCH_SIZE) - 1 },
      (_, index) => (index + 1) * CATALOGUE_BATCH_SIZE,
    );
    const laterPages = [];
    for (let start = 0; start < offsets.length; start += 5) {
      const pageOffsets = offsets.slice(start, start + 5);
      const results = await Promise.all(
        pageOffsets.map((offset) =>
          client.rpc('admin_list_exercises', {
            p_query: '',
            p_status: 'all',
            p_sort: 'title',
            p_offset: offset,
            p_limit: CATALOGUE_BATCH_SIZE,
          }),
        ),
      );
      if (
        results.some((result, index) => {
          const page = result.data as { items?: unknown } | null;
          return (
            result.error ||
            !page ||
            !Array.isArray(page.items) ||
            page.items.length !==
              Math.min(total - pageOffsets[index], CATALOGUE_BATCH_SIZE)
          );
        })
      ) {
        laterPages.length = 0;
        break;
      }
      laterPages.push(
        ...results.flatMap(
          (result) => (result.data as { items: CatalogueItem[] }).items,
        ),
      );
    }
    if (
      offsets.length === 0 ||
      laterPages.length === total - CATALOGUE_BATCH_SIZE
    ) {
      exercises = [...catalogue.items, ...laterPages] as CatalogueItem[];
    }
  }

  const chapterNames = new Map(
    (chapters ?? []).flatMap((chapter) => [
      [normalizeChapter(chapter.name), chapter.name] as const,
      ...chapter.aliases.map(
        (alias) => [normalizeChapter(alias), chapter.name] as const,
      ),
      [normalizeChapter(chapter.id), chapter.name] as const,
    ]),
  );
  const contextByChapter = new Map<string, MutableChapterCoverage>();

  if (exercises) {
    for (const item of exercises) {
      if (item.archived) continue;
      const chapter = chapterNames.get(normalizeChapter(item.chapter));
      if (!chapter) continue;
      let entry = contextByChapter.get(chapter);
      if (!entry) {
        entry = {
          total: 0,
          byDifficulty: {
            Facile: 0,
            Moyen: 0,
            Difficile: 0,
            Inconnue: 0,
          },
          examples: [],
          skills: new Map<string, number>(),
        };
      }
      entry.total += 1;
      const difficulty =
        (
          { '1': 'Facile', '2': 'Moyen', '3': 'Difficile' } as Record<
            string,
            string
          >
        )[item.difficulty] ?? difficultyLabel(item.difficulty);
      const difficultyKey = ['Facile', 'Moyen', 'Difficile'].includes(
        difficulty,
      )
        ? difficulty
        : 'Inconnue';
      entry.byDifficulty[difficultyKey] += 1;
      for (const skill of item.skills)
        entry.skills.set(skill, (entry.skills.get(skill) ?? 0) + 1);
      if (entry.examples.length < 20) {
        entry.examples.push({
          title: item.appTitle || item.title,
          difficulty: difficultyKey,
          status: item.status === 'draft' ? 'Brouillon' : 'Autre statut',
          skills: item.skills,
        });
      }
      contextByChapter.set(chapter, entry);
    }
  }

  const options = (chapters ?? []).map((chapter) => {
    const coverage = contextByChapter.get(chapter.name);
    return {
      ...chapter,
      coverage: coverage
        ? {
            ...coverage,
            skills: [...coverage.skills.entries()].map(([id, count]) => ({
              id,
              count,
            })),
          }
        : {
            total: 0,
            byDifficulty: {
              Facile: 0,
              Moyen: 0,
              Difficile: 0,
              Inconnue: 0,
            },
            examples: [],
            skills: [],
          },
    };
  });

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/exercises"
        className="text-sm font-medium text-blue-700"
      >
        ← Catalogue des exercices
      </Link>
      <h1 className="mb-3 mt-2 text-3xl font-semibold tracking-tight">
        Générer des exercices avec un agent IA
      </h1>
      {!chapters || !exercises ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"
        >
          Le catalogue Staging n’a pas pu être chargé complètement. Réessaie
          plus tard afin d’éviter de générer un prompt avec des références ou
          des compteurs incomplets.
        </div>
      ) : options.length === 0 ? (
        <div role="status" className="rounded-xl border bg-white p-5 text-sm">
          Aucun chapitre n’est disponible dans le référentiel Staging.
        </div>
      ) : (
        <ExercisePromptForm chapters={options} />
      )}
      {chapters && exercises && options.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="font-semibold text-slate-900">
            Importer et relire les brouillons
          </h2>
          <p className="mt-2">
            Après avoir généré le lot avec le prompt, colle son JSON ou
            sélectionne le fichier reçu. Ta session Admin sert à créer les
            brouillons dans Staging.
          </p>
          {!importConfigured && (
            <p className="mt-2 text-amber-800">
              Configure Engine sur cette instance pour importer des brouillons.
            </p>
          )}
          {importConfigured && <ExerciseImportForm />}
          <p className="mt-3">
            Bon rapport qualité-prix pour ce flux&nbsp;: Claude Sonnet 5.5 dans
            Claude Code ou GPT-6.2 Sol (effort moyen) dans Codex.
          </p>
        </section>
      )}
    </div>
  );
}
