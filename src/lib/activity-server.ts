import { loadProductionActivity } from './production-api';
import 'server-only';
import { readActivityConfiguration } from './activity-config';
import { createActivityReader, ActivityPgError } from './activity-pg';
import type { StatisticsPeriod } from './activity-statistics';

let active:
  | {
      url: string;
      ca: string;
      environment: 'local-copy' | 'production';
      reader: ReturnType<typeof createActivityReader>;
    }
  | undefined;

/** Call only after a fresh server-side Admin authorization. No result caching. */
export async function loadActivityStatistics(period: StatisticsPeriod) {
  const config = readActivityConfiguration(process.env);
  if (!config) throw new ActivityPgError();
  if (config.environment === 'production')
    return loadProductionActivity(period);
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
      reader: createActivityReader(config),
    };
    // New requests use the new identity immediately; old leases finish/close.
    void previous?.reader.close().catch(() => {});
  }
  return active.reader.read(period);
}
