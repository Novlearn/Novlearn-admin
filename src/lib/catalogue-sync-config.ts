import 'server-only';
import { readPublicationPgConfiguration } from './publication-pg';

/** Reuses the server-only publication connections; reading it opens no connection. */
export function readCatalogueSyncConfiguration(
  env: Record<string, string | undefined>,
) {
  return readPublicationPgConfiguration(env);
}
