import { expect, it } from 'vitest';
import { readLocalPedagogyConfiguration } from '@/lib/pedagogy-config';
import { localPedagogyEnvironment } from './fixtures/local-pedagogy-env';
it('requires a reviewed local source with its own physical login', () => {
  const env = localPedagogyEnvironment();
  expect(readLocalPedagogyConfiguration(env)?.environment).toBe('local-copy');
});
it.each([
  ['ADMIN_LOCAL_PEDAGOGY_ENABLED', 'false'],
  ['ADMIN_LOCAL_PEDAGOGY_REVIEW', 'anything'],
  ['ADMIN_PEDAGOGY_ENABLED', 'true'],
  ['ADMIN_STAGING_AUTH_ENABLED', 'true'],
  ['ADMIN_LOCAL_WORKSPACE_ENABLED', 'false'],
  ['APP_BASE_URL', 'https://admin.example.invalid'],
  ['ADMIN_LOCAL_PEDAGOGY_PG_CA', ''],
])('refuses missing or operational activation %s', (key, value) => {
  expect(
    readLocalPedagogyConfiguration({
      ...localPedagogyEnvironment(),
      [key]: value,
    }),
  ).toBeNull();
});
it.each([
  ['127.0.0.1', 'remote.invalid'],
  ['55436', '55435'],
  ['activity_copy', 'postgres'],
  ['novlearn_admin_pedagogy_service', 'novlearn_admin_activity_service'],
])('keeps source identity separate: %s', (a, b) => {
  const env = localPedagogyEnvironment();
  env.ADMIN_LOCAL_PEDAGOGY_PG_URL = env.ADMIN_LOCAL_PEDAGOGY_PG_URL.replace(
    a,
    b,
  );
  expect(readLocalPedagogyConfiguration(env)).toBeNull();
});
it.each(['?sslmode=disable', '?options=-c%20role%3Dpostgres', '#target'])(
  'rejects connection overrides %s',
  (suffix) => {
    const env = localPedagogyEnvironment();
    env.ADMIN_LOCAL_PEDAGOGY_PG_URL += suffix;
    expect(readLocalPedagogyConfiguration(env)).toBeNull();
  },
);
