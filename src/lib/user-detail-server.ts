import 'server-only';
import { readLocalUserDetailConfiguration } from './user-detail-config';
import {
  createLocalUserDetailReader,
  UserDetailPgError,
} from './user-detail-pg';
import type { UserDetailQuery } from './user-detail';

let active:
  | {
      url: string;
      ca: string;
      reader: ReturnType<typeof createLocalUserDetailReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadLocalUserDetail(query: UserDetailQuery) {
  const config = readLocalUserDetailConfiguration(process.env);
  if (!config) throw new UserDetailPgError();
  if (!active || active.url !== config.url || active.ca !== config.ca) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      reader: createLocalUserDetailReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(query);
}
