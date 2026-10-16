import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  batchCandidate,
  MAX_PUBLICATION_BATCH,
  type BatchCandidate,
  type BatchLocator,
} from './publication-batch';
import { isUuid } from './catalogue';

/** Read only selected metadata; never fetch definitions or round bigint IDs. */
export async function loadBatchCandidates(
  client: SupabaseClient,
  items: BatchLocator[],
): Promise<(BatchCandidate | null)[] | null> {
  if (
    !items.length ||
    items.length > MAX_PUBLICATION_BATCH ||
    items.some((i) => !isUuid(i.versionId)) ||
    new Set(items.map((i) => i.versionId)).size !== items.length
  )
    return null;
  const versions = await client
    .from('exercise_versions')
    .select(
      'id,exercise_id::text,revision,editorial_status,approval_fingerprint_sha256,test_epoch::text,title:definition->>title',
    )
    .in(
      'id',
      items.map((i) => i.versionId),
    );
  if (versions.error || !Array.isArray(versions.data)) return null;
  const parentIds = versions.data.map((v) => v.exercise_id);
  if (!parentIds.every((id) => typeof id === 'string')) return null;
  const parents = parentIds.length
    ? await client
        .from('exercises')
        .select('id::text,catalog_id,admin_archived_at')
        .in('id', parentIds)
    : { data: [], error: null };
  if (parents.error || !Array.isArray(parents.data)) return null;
  const result: (BatchCandidate | null)[] = [];
  for (const item of items) {
    const v = versions.data.find((v) => v.id === item.versionId);
    if (!v) {
      result.push(null);
      continue;
    }
    const p = parents.data.find((p) => p.id === v.exercise_id);
    if (
      !p ||
      (p.admin_archived_at !== null && typeof p.admin_archived_at !== 'string')
    )
      return null;
    const candidate = {
      versionId: v.id,
      exerciseId: v.exercise_id,
      catalogId: p.catalog_id,
      title: v.title,
      revision: v.revision,
      fingerprint: v.approval_fingerprint_sha256,
      epoch: v.test_epoch,
      status: v.editorial_status,
      archived: p.admin_archived_at !== null,
    };
    if (!batchCandidate(candidate)) return null;
    result.push(candidate);
  }
  return result;
}
