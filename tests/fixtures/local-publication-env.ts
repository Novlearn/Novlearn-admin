import { LOCAL_SCHEMA_MANIFEST_SHA256 } from '@/lib/auth/config';
// Syntax-only configuration fixtures. These JWT bytes are never a verified session.
export function localPublicationEnvironment(): Record<
  string,
  string | undefined
> {
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        iss: 'supabase',
        ref: 'novlearn-admin-publication-local',
        role: 'anon',
      }),
    ).toString('base64url'),
    'a'.repeat(43),
  ].join('.');
  const ca =
    '-----BEGIN CERTIFICATE-----\nSYNTHETIC CONFIGURATION ONLY\n-----END CERTIFICATE-----';
  return {
    NODE_ENV: 'development',
    ADMIN_LOCAL_WORKSPACE_ENABLED: 'true',
    ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: LOCAL_SCHEMA_MANIFEST_SHA256,
    ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED: 'true',
    ADMIN_LOCAL_PUBLICATION_ENABLED: 'true',
    ADMIN_LOCAL_PUBLICATION_REVIEW: 'isolated-sql64-http-fixture-v1',
    ADMIN_LOCAL_SUPABASE_URL: 'http://127.0.0.1:55432',
    ADMIN_LOCAL_SUPABASE_ANON_KEY: token,
    APP_BASE_URL: 'http://127.0.0.1:3152',
    ADMIN_ENGINE_ENABLED: 'true',
    ADMIN_LOCAL_ENGINE_URL: 'http://127.0.0.1:3153/run',
    ADMIN_LOCAL_ENGINE_CAPABILITY: 'ab'.repeat(32),
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_URL:
      'postgresql://novlearn_admin_journal_service:synthetic-source-password@127.0.0.1:55433/admin_local',
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:synthetic-target-password@127.0.0.1:55434/admin_local',
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_CA: ca,
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_CA: ca,
    ADMIN_LOCAL_PUBLICATION_CONFIRMATION_KEY: 'cd'.repeat(32),
    ADMIN_PUBLICATION_ENABLED: 'false',
    ADMIN_STAGING_AUTH_ENABLED: 'false',
  };
}
