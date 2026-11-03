import { LOCAL_SCHEMA_MANIFEST_SHA256 } from '@/lib/auth/config';
export function localActivityEnvironment() {
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        iss: 'supabase',
        ref: 'novlearn-admin-local',
        role: 'anon',
      }),
    ).toString('base64url'),
    'a'.repeat(43),
  ].join('.');
  return {
    NODE_ENV: 'development',
    APP_BASE_URL: 'http://127.0.0.1:3150',
    ADMIN_LOCAL_WORKSPACE_ENABLED: 'true',
    ADMIN_PUBLICATION_ENABLED: 'false',
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: LOCAL_SCHEMA_MANIFEST_SHA256,
    ADMIN_LOCAL_SUPABASE_URL: 'http://127.0.0.1:55431',
    ADMIN_LOCAL_SUPABASE_ANON_KEY: token,
    ADMIN_LOCAL_ACTIVITY_ENABLED: 'true',
    ADMIN_LOCAL_ACTIVITY_REVIEW: 'isolated-sql65-activity-http-v1',
    ADMIN_LOCAL_ACTIVITY_PG_URL:
      'postgresql://novlearn_admin_activity_service:synthetic-activity-password@127.0.0.1:55435/activity_copy',
    ADMIN_LOCAL_ACTIVITY_PG_CA:
      '-----BEGIN CERTIFICATE-----\nSYNTHETIC CONFIGURATION\n-----END CERTIFICATE-----',
  };
}
