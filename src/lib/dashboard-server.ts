import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { contentOverview } from './dashboard';

export async function loadContentOverview(client: SupabaseClient) {
  try {
    const { data, error } = await client.rpc('admin_content_overview');
    return error ? null : contentOverview(data);
  } catch {
    return null;
  }
}
