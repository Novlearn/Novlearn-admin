import { expect, it } from 'vitest';
import { readLocalActiveVersionConfiguration } from '@/lib/active-version-config';
import { localActiveVersionEnvironment } from './fixtures/local-active-version-env';
import { localPublicationEnvironment } from './fixtures/local-publication-env';
it('allows metadata reads in both local workspaces independently of writer activation', () => {
  const main = localActiveVersionEnvironment();
  expect(readLocalActiveVersionConfiguration(main)?.targetKey).toBe(
    'local-http-fixture',
  );
  expect(
    readLocalActiveVersionConfiguration({
      ...main,
      ...localPublicationEnvironment(),
      ADMIN_LOCAL_PUBLICATION_ENABLED: 'false',
    })?.environment,
  ).toBe('local-copy');
});
it.each([
  ['ADMIN_LOCAL_ACTIVE_VERSION_ENABLED', 'false'],
  ['ADMIN_LOCAL_ACTIVE_VERSION_REVIEW', 'anything'],
  ['ADMIN_ACTIVE_VERSION_ENABLED', 'true'],
  ['ADMIN_STAGING_AUTH_ENABLED', 'true'],
  ['ADMIN_LOCAL_WORKSPACE_ENABLED', 'false'],
  ['ADMIN_LOCAL_ACTIVE_VERSION_PG_CA', ''],
  ['APP_BASE_URL', 'https://admin.example.invalid'],
])('requires explicit isolated configuration %s', (key, value) => {
  expect(
    readLocalActiveVersionConfiguration({
      ...localActiveVersionEnvironment(),
      [key]: value,
    }),
  ).toBeNull();
});
it.each([
  ['127.0.0.1', 'remote.invalid'],
  ['55434', '55433'],
  ['admin_local', 'postgres'],
  [
    'novlearn_admin_active_version_service',
    'novlearn_admin_publication_service',
  ],
  ['synthetic-reader-password', 'short'],
])('rejects any other endpoint or identity %s', (a, b) => {
  const env = localActiveVersionEnvironment();
  env.ADMIN_LOCAL_ACTIVE_VERSION_PG_URL =
    env.ADMIN_LOCAL_ACTIVE_VERSION_PG_URL.replace(a, b);
  expect(readLocalActiveVersionConfiguration(env)).toBeNull();
});
it.each(['?sslmode=disable', '?options=-c%20role%3Dpostgres', '#target'])(
  'rejects URL overrides %s',
  (suffix) => {
    const env = localActiveVersionEnvironment();
    env.ADMIN_LOCAL_ACTIVE_VERSION_PG_URL += suffix;
    expect(readLocalActiveVersionConfiguration(env)).toBeNull();
  },
);
