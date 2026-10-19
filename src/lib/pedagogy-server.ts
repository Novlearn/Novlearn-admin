import 'server-only';
import { readLocalPedagogyConfiguration } from './pedagogy-config';
import { createLocalPedagogyReader, PedagogyPgError } from './pedagogy-pg';
import type { PedagogyQuery } from './pedagogy-statistics';
import type { PedagogyReferenceQuery } from './pedagogy-references';
let active:
  | {
      url: string;
      ca: string;
      reader: ReturnType<typeof createLocalPedagogyReader>;
    }
  | undefined;
function reader() {
  const config = readLocalPedagogyConfiguration(process.env);
  if (!config) throw new PedagogyPgError();
  if (!active || active.url !== config.url || active.ca !== config.ca) {
    const previous = active;
    active = {
      url: config.url,
      ca: config.ca,
      reader: createLocalPedagogyReader(config),
    };
    void previous?.reader.close().catch(() => {});
  }
  return active.reader;
}
/** Each caller must freshly authorize the Admin. Only the pool is reused. */
export const loadLocalPedagogyStatistics = (query: PedagogyQuery) =>
  reader().read(query);
export const loadLocalPedagogyReferences = (query: PedagogyReferenceQuery) =>
  reader().references(query);
