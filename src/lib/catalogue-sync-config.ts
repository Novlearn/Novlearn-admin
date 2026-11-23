import 'server-only';
import { readPublicationPgConfiguration } from './publication-pg';

/** Explicit per-capability gate. Reading it never opens a database connection. */
export function readCatalogueSyncConfiguration(
  env: Record<string, string | undefined>,
) {
  if (env.ADMIN_CATALOGUE_SYNC_ENABLED !== 'true') return null;
  return readPublicationPgConfiguration(env);
}
