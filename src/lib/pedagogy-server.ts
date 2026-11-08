import 'server-only';
import { readPedagogyConfiguration } from './pedagogy-config';
import { createPedagogyReader, PedagogyPgError } from './pedagogy-pg';
import type { PedagogyQuery } from './pedagogy-statistics';
import type { PedagogyReferenceQuery } from './pedagogy-references';
import type { PedagogyPgConfiguration } from './pedagogy-config';
import {
  loadProductionPedagogy,
  loadProductionReferences,
} from './production-api';
let active:
  | {
      url: string;
      ca: string;
      environment: 'local-copy' | 'production';
      reader: ReturnType<typeof createPedagogyReader>;
    }
  | undefined;
function reader(config: PedagogyPgConfiguration) {
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
      reader: createPedagogyReader(config),
    };
    void previous?.reader.close().catch(() => {});
  }
  return active.reader;
}
/** Each caller must freshly authorize the Admin. Only the pool is reused. */
export async function loadPedagogyStatistics(query: PedagogyQuery) {
  const config = readPedagogyConfiguration(process.env);
  if (!config) throw new PedagogyPgError();
  return config.environment === 'production'
    ? loadProductionPedagogy(query)
    : reader(config).read(query);
}
export async function loadPedagogyReferences(query: PedagogyReferenceQuery) {
  const config = readPedagogyConfiguration(process.env);
  if (!config) throw new PedagogyPgError();
  return config.environment === 'production'
    ? loadProductionReferences(query)
    : reader(config).references(query);
}
