import { readAuthConfiguration } from './auth/config';

export type LocalActiveVersionConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
  targetKey: 'local-http-fixture';
};
/** The same local target as publication, with a separate metadata-only login. */
export function validLocalActiveVersionEndpoint(
  config: LocalActiveVersionConfiguration,
) {
  try {
    const url = new URL(config.url),
      password = decodeURIComponent(url.password);
    return (
      config.environment === 'local-copy' &&
      config.targetKey === 'local-http-fixture' &&
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname === '127.0.0.1' &&
      url.port === '55434' &&
      url.pathname === '/admin_local' &&
      !url.search &&
      !url.hash &&
      decodeURIComponent(url.username) ===
        'novlearn_admin_active_version_service' &&
      password.length >= 16 &&
      password.length <= 512 &&
      config.ca.length <= 32768 &&
      config.ca.includes('-----BEGIN CERTIFICATE-----')
    );
  } catch {
    return false;
  }
}
/** Local qualification only. Operational access requires a separate decision. */
export function readLocalActiveVersionConfiguration(
  env: Record<string, string | undefined>,
): LocalActiveVersionConfiguration | null {
  if (
    !readAuthConfiguration(env)?.local ||
    env.ADMIN_LOCAL_ACTIVE_VERSION_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_ACTIVE_VERSION_REVIEW !==
      'isolated-sql70-active-version-http-v1' ||
    env.ADMIN_ACTIVE_VERSION_ENABLED === 'true'
  )
    return null;
  const config: LocalActiveVersionConfiguration = {
    url: env.ADMIN_LOCAL_ACTIVE_VERSION_PG_URL ?? '',
    ca: env.ADMIN_LOCAL_ACTIVE_VERSION_PG_CA ?? '',
    environment: 'local-copy',
    targetKey: 'local-http-fixture',
  };
  return validLocalActiveVersionEndpoint(config) ? config : null;
}
