import { localActivityEnvironment } from './local-activity-env';
export function localPedagogyEnvironment() {
  return {
    ...localActivityEnvironment(),
    ADMIN_LOCAL_PEDAGOGY_ENABLED: 'true',
    ADMIN_LOCAL_PEDAGOGY_REVIEW: 'isolated-sql69-pedagogy-http-v1',
    ADMIN_LOCAL_PEDAGOGY_PG_URL:
      'postgresql://novlearn_admin_pedagogy_service:synthetic-pedagogy-password@127.0.0.1:55436/activity_copy',
    ADMIN_LOCAL_PEDAGOGY_PG_CA:
      '-----BEGIN CERTIFICATE-----\nSYNTHETIC CONFIGURATION\n-----END CERTIFICATE-----',
  };
}
