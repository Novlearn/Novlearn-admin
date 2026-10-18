import 'server-only';
import { readLocalUsersConfiguration } from './users-config';
import { createLocalUsersReader, UsersPgError } from './users-pg';
import type { UsersQuery } from './users';

let active:
  | {
      url: string;
      ca: string;
      reader: ReturnType<typeof createLocalUsersReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadLocalUsers(query: UsersQuery) {
  const config = readLocalUsersConfiguration(process.env);
  if (!config) throw new UsersPgError();
  if (!active || active.url !== config.url || active.ca !== config.ca) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      reader: createLocalUsersReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(query);
}
