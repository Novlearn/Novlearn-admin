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
  const { data, error } = await client.rpc('admin_list_exercises', {
    p_query: filter.query,
    p_status: filter.status,
    p_sort: filter.sort,
    p_offset: (filter.page - 1) * PAGE_SIZE,
    p_limit: PAGE_SIZE,
  });
  if (
    error ||
    !data ||
    !Array.isArray(data.items) ||
    typeof data.total !== 'number'
  )
    return null;
  return data as CataloguePage;
}
export const versionColumns =
  'id,exercise_id,revision,definition,definition_sha256,editorial_status,approval_fingerprint_sha256,engine_contract,generation_version,canonicalization_version,test_epoch,updated_at';
