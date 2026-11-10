import { loadProductionUserDetail } from './production-api';
import 'server-only';
import { readUserDetailConfiguration } from './user-detail-config';
import { createUserDetailReader, UserDetailPgError } from './user-detail-pg';
import type { UserDetailQuery } from './user-detail';

let active:
  | {
      url: string;
      ca: string;
      environment: 'local-copy' | 'production';
      reader: ReturnType<typeof createUserDetailReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadUserDetail(query: UserDetailQuery) {
  const config = readUserDetailConfiguration(process.env);
  if (!config) throw new UserDetailPgError();
  if (config.environment === 'production')
    return loadProductionUserDetail(query);
  if (
    !active ||
    active.url !== config.url ||
    active.ca !== config.ca ||
    active.environment !== config.environment
  ) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      environment: config.environment,
      reader: createUserDetailReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(query);
}
