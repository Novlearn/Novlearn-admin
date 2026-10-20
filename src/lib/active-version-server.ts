import 'server-only';
import { readLocalActiveVersionConfiguration } from './active-version-config';
import {
  createLocalActiveVersionReader,
  ActiveVersionPgError,
} from './active-version-pg';
let active:
  | {
      url: string;
      ca: string;
      reader: ReturnType<typeof createLocalActiveVersionReader>;
    }
  | undefined;
/** Each caller freshly authorizes the Admin and resolves the source catalogue ID. */
export function loadLocalActiveVersion(catalogId: string) {
  const config = readLocalActiveVersionConfiguration(process.env);
  if (!config) throw new ActiveVersionPgError();
  if (!active || active.url !== config.url || active.ca !== config.ca) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      reader: createLocalActiveVersionReader(config),
    };
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(catalogId);
}
