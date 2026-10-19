import { readAuthConfiguration } from './auth/config';

export type LocalPedagogyPgConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
};
export function validLocalPedagogyEndpoint(
  config: LocalPedagogyPgConfiguration,
) {
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
/** Explicit isolated fixture activation only; never an operational source selector. */
export function readLocalPedagogyConfiguration(
  env: Record<string, string | undefined>,
): LocalPedagogyPgConfiguration | null {
  const auth = readAuthConfiguration(env);
  if (
    !auth?.local ||
    auth.localPublicationFixture ||
    env.ADMIN_LOCAL_PEDAGOGY_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_PEDAGOGY_REVIEW !== 'isolated-sql69-pedagogy-http-v1' ||
    env.ADMIN_PEDAGOGY_ENABLED === 'true'
  )
    return null;
  const config: LocalPedagogyPgConfiguration = {
    url: env.ADMIN_LOCAL_PEDAGOGY_PG_URL ?? '',
    ca: env.ADMIN_LOCAL_PEDAGOGY_PG_CA ?? '',
    environment: 'local-copy',
  };
  return validLocalPedagogyEndpoint(config) ? config : null;
}
