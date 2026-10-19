import { requireAdminPage } from '@/lib/auth/require-admin';
import { readLocalPedagogyConfiguration } from '@/lib/pedagogy-config';
import {
  readPedagogyQuery,
  type PedagogyStatistics,
} from '@/lib/pedagogy-statistics';
import {
  readPedagogyPageQuery,
  type PedagogyReferences,
} from '@/lib/pedagogy-references';
import {
  loadLocalPedagogyStatistics,
  loadLocalPedagogyReferences,
} from '@/lib/pedagogy-server';
import { PedagogyStatisticsView } from '@/components/pedagogy-statistics';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function PedagogyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  const parsed = readPedagogyPageQuery(params),
    fallback = readPedagogyQuery(new URLSearchParams());
  if (!fallback.ok) throw Error('Période indisponible');
  const query = parsed.ok ? parsed.query : fallback.query;
  let error = parsed.ok ? undefined : parsed.error;
  let data: PedagogyStatistics | null = null;
  let chapters: PedagogyReferences | null = null,
    competences: PedagogyReferences | null = null;
  let selectedChapter: PedagogyReferences['items'][number] | null = null,
    selectedCompetence: PedagogyReferences['items'][number] | null = null;
  if (parsed.ok) {
    if (!readLocalPedagogyConfiguration(process.env))
      error = 'Lecture pédagogique locale non activée.';
    else
      try {
        data = await loadLocalPedagogyStatistics(query);
        const results = await Promise.all([
          parsed.chapterSearch
            ? loadLocalPedagogyReferences({
                kind: 'chapter',
                q: parsed.chapterSearch,
              })
            : null,
          parsed.competenceSearch
            ? loadLocalPedagogyReferences({
                kind: 'competence',
                q: parsed.competenceSearch,
              })
            : null,
        ]);
        [chapters, competences] = results;
        for (const kind of ['chapter', 'competence'] as const) {
          const id = query[kind];
          const items =
            kind === 'chapter'
              ? (chapters?.items ?? data.references.chapters)
              : (competences?.items ?? data.references.competences);
          if (id && !items.some((item) => item.id === id)) {
            const selected = await loadLocalPedagogyReferences({ kind, q: id });
            const found = selected.items.find((item) => item.id === id);
            if (found) {
              if (kind === 'chapter') selectedChapter = found;
              else selectedCompetence = found;
            }
          }
        }
      } catch {
        data = null;
        error =
          'Le relevé pédagogique n’a pas pu être chargé. Réessayez dans un instant.';
      }
  }
  return (
    <PedagogyStatisticsView
      data={data}
      query={query}
      error={error}
      chapters={chapters}
      competences={competences}
      selectedChapter={selectedChapter}
      selectedCompetence={selectedCompetence}
      chapterSearch={parsed.ok ? parsed.chapterSearch : ''}
      competenceSearch={parsed.ok ? parsed.competenceSearch : ''}
    />
  );
}
