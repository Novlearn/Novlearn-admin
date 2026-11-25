import 'server-only';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeAdmin } from './auth/authorization';
import { asAuthGateway, createPageClient } from './auth/supabase';
import {
  PAGE_SIZE,
  type CatalogueFilter,
  type CataloguePage,
} from './catalogue';

export async function requireCatalogueClient() {
  const client = await createPageClient();
  if (!client) redirect('/login?error=disabled');
  const access = await authorizeAdmin(asAuthGateway(client));
  if (!access.allowed) {
    if (access.reason === 'forbidden') redirect('/access-denied');
    redirect(
      `/login?error=${access.reason === 'unauthenticated' ? 'session' : 'unavailable'}`,
    );
  }
  return client;
}
export async function loadCatalogue(
  client: SupabaseClient,
  filter: CatalogueFilter,
): Promise<CataloguePage | null> {
  const offset = (filter.page - 1) * PAGE_SIZE;
  if (filter.status !== 'approved')
    return readCataloguePage(client, filter, offset, PAGE_SIZE);

  // The deployed RPC returns ready rows but its status filter only accepts
  // the older approved value. Keep the RPC's search and sort across batches.
  const batchSize = 50;
  const items: CataloguePage['items'] = [];
  let total = 0;
  let sourceTotal = 0;
  let batchOffset = 0;
  do {
    const batch = await readCataloguePage(
      client,
      { ...filter, status: 'all' },
      batchOffset,
      batchSize,
    );
    if (!batch) return null;
    if (batchOffset === 0) sourceTotal = batch.total;
    if (
      batch.total !== sourceTotal ||
      batch.items.length !==
        Math.max(0, Math.min(batchSize, sourceTotal - batchOffset))
    )
      return null;
    for (const item of batch.items) {
      if (
        item?.archived !== false ||
        (item.status !== 'ready' && item.status !== 'approved')
      )
        continue;
      if (total >= offset && items.length < PAGE_SIZE) items.push(item);
      total += 1;
    }
    batchOffset += batchSize;
  } while (batchOffset < sourceTotal);
  return { items, total };
}

async function readCataloguePage(
  client: SupabaseClient,
  filter: CatalogueFilter,
  offset: number,
  limit: number,
): Promise<CataloguePage | null> {
  const { data, error } = await client.rpc('admin_list_exercises', {
    p_query: filter.query,
    p_status: filter.status,
    p_sort: filter.sort,
    p_offset: offset,
    p_limit: limit,
  });
  if (
    error ||
    !data ||
    !Array.isArray(data.items) ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0
  )
    return null;
  return data as CataloguePage;
}
export const versionColumns =
  'id,exercise_id,revision,definition,definition_sha256,editorial_status,approval_fingerprint_sha256,engine_contract,generation_version,canonicalization_version,updated_at';
