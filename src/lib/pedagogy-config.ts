import {
  productionReadRequested,
  readProductionReadConfiguration,
} from './production-read-config';
import type { ProductionApiConfiguration } from './production-api-config';
import { readAuthConfiguration } from './auth/config';

export type PedagogyPgConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
};
export type PedagogyReadConfiguration =
  | PedagogyPgConfiguration
  | ProductionApiConfiguration;
export function validPedagogyEndpoint(config: PedagogyPgConfiguration) {
  try {
    const url = new URL(config.url);
    return (
      config.environment === 'local-copy' &&
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname === '127.0.0.1' &&
      url.port === '55436' &&
      url.pathname === '/activity_copy' &&
      !url.search &&
      !url.hash &&
      decodeURIComponent(url.username) === 'novlearn_admin_pedagogy_service' &&
      decodeURIComponent(url.password).length >= 16 &&
      decodeURIComponent(url.password).length <= 512 &&
      config.ca.length <= 32768 &&
      config.ca.includes('-----BEGIN CERTIFICATE-----')
    );
  } catch {
    return false;
  }
}
/** Explicit production capability or isolated development copy. */
export function readPedagogyConfiguration(
  env: Record<string, string | undefined>,
): PedagogyReadConfiguration | null {
  if (productionReadRequested(env)) return readProductionReadConfiguration(env);
  const auth = readAuthConfiguration(env);
  if (
    !auth?.local ||
    auth.localPublicationFixture ||
    env.ADMIN_LOCAL_PEDAGOGY_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_PEDAGOGY_REVIEW !== 'isolated-sql69-pedagogy-http-v1' ||
    env.ADMIN_PEDAGOGY_ENABLED === 'true'
  )
    return null;
  const config: PedagogyPgConfiguration = {
    url: env.ADMIN_LOCAL_PEDAGOGY_PG_URL ?? '',
    ca: env.ADMIN_LOCAL_PEDAGOGY_PG_CA ?? '',
    environment: 'local-copy',
  };
  return validPedagogyEndpoint(config) ? config : null;
}
