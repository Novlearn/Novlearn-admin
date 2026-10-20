import { localActivityEnvironment } from './local-activity-env';
export const localActiveVersionEnvironment = () => ({
  ...localActivityEnvironment(),
  ADMIN_LOCAL_ACTIVE_VERSION_ENABLED: 'true',
  ADMIN_LOCAL_ACTIVE_VERSION_REVIEW: 'isolated-sql70-active-version-http-v1',
  ADMIN_LOCAL_ACTIVE_VERSION_PG_URL:
    'postgresql://novlearn_admin_active_version_service:synthetic-reader-password@127.0.0.1:55434/admin_local',
  ADMIN_LOCAL_ACTIVE_VERSION_PG_CA:
    '-----BEGIN CERTIFICATE-----\nSYNTHETIC\n-----END CERTIFICATE-----',
});
