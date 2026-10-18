import { readAuthConfiguration } from './auth/config';

export type LocalUserDetailPgConfiguration = {
  url: string;
  ca: string;
  environment: 'local-copy';
};
export function validLocalUserDetailEndpoint(
  config: LocalUserDetailPgConfiguration,
) {
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
      decodeURIComponent(url.username) ===
        'novlearn_admin_user_detail_service' &&
      decodeURIComponent(url.password).length >= 16 &&
      decodeURIComponent(url.password).length <= 512 &&
      config.ca.length <= 32768 &&
      config.ca.includes('-----BEGIN CERTIFICATE-----')
    );
  } catch {
    return false;
  }
}
/** Local-only operator activation. A remote Auth or publication profile cannot
 * accidentally inherit this fixture's database or source label. */
export function readLocalUserDetailConfiguration(
  env: Record<string, string | undefined>,
): LocalUserDetailPgConfiguration | null {
  const auth = readAuthConfiguration(env);
  if (
    !auth?.local ||
    auth.localPublicationFixture ||
    env.ADMIN_LOCAL_USER_DETAIL_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_USER_DETAIL_REVIEW !==
      'isolated-sql67-user-detail-http-v1' ||
    env.ADMIN_USER_DETAIL_ENABLED === 'true'
  )
    return null;
  const config: LocalUserDetailPgConfiguration = {
    url: env.ADMIN_LOCAL_USER_DETAIL_PG_URL ?? '',
    ca: env.ADMIN_LOCAL_USER_DETAIL_PG_CA ?? '',
    environment: 'local-copy',
  };
  return validLocalUserDetailEndpoint(config) ? config : null;
}
