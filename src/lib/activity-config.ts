import {
  productionReadRequested,
  readProductionReadConfiguration,
} from './production-read-config';
import type { ProductionApiConfiguration } from './production-api-config';
import { readAuthConfiguration } from './auth/config';

export type ActivityPgConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
};
export type ActivityReadConfiguration =
  | ActivityPgConfiguration
  | ProductionApiConfiguration;
export function validActivityEndpoint(config: ActivityPgConfiguration) {
  try {
    const url = new URL(config.url);
    return (
      config.environment === 'local-copy' &&
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname === '127.0.0.1' &&
      url.port === '55435' &&
      url.pathname === '/activity_copy' &&
      !url.search &&
      !url.hash &&
      decodeURIComponent(url.username) === 'novlearn_admin_activity_service' &&
      decodeURIComponent(url.password).length >= 16 &&
      decodeURIComponent(url.password).length <= 512 &&
      config.ca.length <= 32768 &&
      config.ca.includes('-----BEGIN CERTIFICATE-----')
    );
  } catch {
    return false;
  }
}
/** Explicit production capability or isolated development copy. No fallback on invalid production settings. */
export function readActivityConfiguration(
  env: Record<string, string | undefined>,
): ActivityReadConfiguration | null {
  if (productionReadRequested(env)) return readProductionReadConfiguration(env);
  const auth = readAuthConfiguration(env);
  if (
    !auth?.local ||
    auth.localPublicationFixture ||
    env.ADMIN_LOCAL_ACTIVITY_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_ACTIVITY_REVIEW !== 'isolated-sql65-activity-http-v1' ||
    env.ADMIN_ACTIVITY_ENABLED === 'true'
  )
    return null;
  const config: ActivityPgConfiguration = {
    url: env.ADMIN_LOCAL_ACTIVITY_PG_URL ?? '',
    ca: env.ADMIN_LOCAL_ACTIVITY_PG_CA ?? '',
    environment: 'local-copy',
  };
  return validActivityEndpoint(config) ? config : null;
}
