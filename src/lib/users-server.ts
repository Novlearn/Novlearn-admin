import { loadProductionUsers } from './production-api';
import 'server-only';
import { readUsersConfiguration } from './users-config';
import { createUsersReader, UsersPgError } from './users-pg';
import type { UsersQuery } from './users';

let active:
  | {
      url: string;
      ca: string;
      environment: 'local-copy' | 'production';
      reader: ReturnType<typeof createUsersReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadUsers(query: UsersQuery) {
  const config = readUsersConfiguration(process.env);
  if (!config) throw new UsersPgError();
  if (config.environment === 'production') return loadProductionUsers(query);
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
      reader: createUsersReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(query);
}
