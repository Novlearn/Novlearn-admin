import { expect, it, vi } from 'vitest';
import { readAuthConfiguration } from '@/lib/auth/config';
import { readPublicationPgConfiguration } from '@/lib/publication-pg';
import { readLocalEngineConfiguration } from '@/lib/engine-local-transport';
import { readPublicationConfirmationKey } from '@/lib/publication-service';
import { localPublicationEnvironment } from './fixtures/local-publication-env';
vi.mock('server-only', () => ({}));
it('refuse les transports et la publication locale sur Vercel même avec une configuration complète', () => {
  const env = { ...localPublicationEnvironment(), VERCEL: '1' };
  expect(readPublicationPgConfiguration(env)).toBeNull();
  expect(readLocalEngineConfiguration(env)).toBeNull();
});
it('binds the explicit fixture to its separate Auth, SQL, Engine and confirmation namespaces', () => {
  const env = localPublicationEnvironment();
  expect(readAuthConfiguration(env)).toMatchObject({
    local: true,
    localPublicationFixture: true,
    appOrigin: 'http://127.0.0.1:3152',
  });
  expect(readPublicationPgConfiguration(env)).toMatchObject({
    localFixture: true,
    targetKey: 'local-http-fixture',
  });
  expect(readLocalEngineConfiguration(env)?.url).toBe(
    'http://127.0.0.1:3153/run',
  );
  expect(readPublicationConfirmationKey(env)).toBeNull();
  expect(readPublicationConfirmationKey(env, true)?.toString('hex')).toBe(
    env.ADMIN_LOCAL_PUBLICATION_CONFIRMATION_KEY,
  );
});
it.each([
  { NODE_ENV: 'production' },
  { NODE_ENV: 'test' },
  { ADMIN_LOCAL_WORKSPACE_ENABLED: 'false' },
  { ADMIN_LOCAL_PUBLICATION_FIXTURE_ENABLED: 'false' },
  { ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: 'a'.repeat(64) },
  { ADMIN_PUBLICATION_ENABLED: 'true' },
  { ADMIN_PUBLICATION_CONFIRMATION_KEY: 'ab'.repeat(32) },
  { ADMIN_PUBLICATION_SOURCE_PG_URL: 'postgresql://remote.example/postgres' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://mixed-project.supabase.co' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://tksvbkvfusrnxulpahky.supabase.co' },
  { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' },
  { APP_BASE_URL: 'http://127.0.0.1:3150' },
  { APP_BASE_URL: 'http://localhost:3152' },
  { ADMIN_LOCAL_SUPABASE_URL: 'http://127.0.0.1:55431' },
  { ADMIN_LOCAL_SUPABASE_URL: 'https://tksvbkvfusrnxulpahky.supabase.co' },
])('rejects mixed or unqualified fixture identity %#', (change) => {
  const env = { ...localPublicationEnvironment(), ...change };
  expect(readAuthConfiguration(env)).toBeNull();
  expect(readPublicationPgConfiguration(env)).toBeNull();
  expect(readLocalEngineConfiguration(env)).toBeNull();
});
it.each([
  { ADMIN_LOCAL_PUBLICATION_ENABLED: 'false' },
  { ADMIN_LOCAL_PUBLICATION_REVIEW: 'unreviewed' },
  { ADMIN_ENGINE_ENABLED: 'false' },
  { ADMIN_LOCAL_PUBLICATION_SOURCE_PG_CA: undefined },
  { ADMIN_LOCAL_PUBLICATION_TARGET_PG_CA: '' },
  {
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_URL:
      'postgresql://novlearn_admin_journal_service:synthetic-source-password@localhost:55433/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_URL:
      'postgresql://novlearn_admin_journal_service:synthetic-source-password@db.example.com:55433/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_SOURCE_PG_URL:
      'postgresql://novlearn_admin_journal_service:synthetic-source-password@127.0.0.1:55434/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:synthetic-target-password@127.0.0.1:55433/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://postgres:synthetic-target-password@127.0.0.1:55434/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:synthetic-source-password@127.0.0.1:55434/admin_local',
  },
  {
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:synthetic-target-password@127.0.0.1:55434/postgres',
  },
  {
    ADMIN_LOCAL_PUBLICATION_TARGET_PG_URL:
      'postgresql://novlearn_admin_publication_service:synthetic-target-password@127.0.0.1:55434/admin_local?sslmode=disable',
  },
])(
  'keeps the local publication backend closed for incomplete or unsafe configuration %#',
  (change) => {
    expect(
      readPublicationPgConfiguration({
        ...localPublicationEnvironment(),
        ...change,
      }),
    ).toBeNull();
  },
);
it('does not accept the main supervisor or privileged API key in the publication fixture', () => {
  const env = localPublicationEnvironment();
  expect(
    readLocalEngineConfiguration({
      ...env,
      ADMIN_LOCAL_ENGINE_URL: 'http://127.0.0.1:3151/run',
    }),
  ).toBeNull();
  const parts = env.ADMIN_LOCAL_SUPABASE_ANON_KEY!.split('.');
  parts[1] = Buffer.from(
    JSON.stringify({
      iss: 'supabase',
      ref: 'novlearn-admin-publication-local',
      role: 'service_role',
    }),
  ).toString('base64url');
  expect(
    readAuthConfiguration({
      ...env,
      ADMIN_LOCAL_SUPABASE_ANON_KEY: parts.join('.'),
    }),
  ).toBeNull();
});
