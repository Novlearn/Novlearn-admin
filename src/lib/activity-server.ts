import 'server-only';
import { readLocalActivityConfiguration } from './activity-config';
import { createLocalActivityReader, ActivityPgError } from './activity-pg';
import type { StatisticsPeriod } from './activity-statistics';

let active:
  | {
      url: string;
      ca: string;
      reader: ReturnType<typeof createLocalActivityReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadLocalActivityStatistics(period: StatisticsPeriod) {
  const config = readLocalActivityConfiguration(process.env);
  if (!config) throw new ActivityPgError();
  if (!active || active.url !== config.url || active.ca !== config.ca) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      reader: createLocalActivityReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(period);
}
