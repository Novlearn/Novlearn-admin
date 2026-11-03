import { describe, expect, it, vi } from 'vitest';
import {
  readAuthConfiguration,
  LOCAL_SCHEMA_MANIFEST_SHA256,
} from '@/lib/auth/config';
import { readPublicationPgConfiguration } from '@/lib/publication-pg';
vi.mock('server-only', () => ({}));
const token = (
  payload: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) =>
  [
    Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT', ...header }),
    ).toString('base64url'),
    Buffer.from(
      JSON.stringify({
        iss: 'supabase',
        ref: 'novlearn-admin-local',
        role: 'anon',
        ...payload,
      }),
    ).toString('base64url'),
    'a'.repeat(43),
  ].join('.');
const environment = () => ({
  NODE_ENV: 'development',
  ADMIN_LOCAL_WORKSPACE_ENABLED: 'true',
  ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: LOCAL_SCHEMA_MANIFEST_SHA256,
  ADMIN_LOCAL_SUPABASE_URL: 'http://127.0.0.1:55431',
  ADMIN_LOCAL_SUPABASE_ANON_KEY: token(),
  APP_BASE_URL: 'http://127.0.0.1:3150',
});
describe('Isolated local Auth configuration', () => {
  it('accepts only the explicit development fixture and keeps its identity distinct', () => {
    expect(readAuthConfiguration(environment())).toMatchObject({
      local: true,
      supabaseUrl: 'http://127.0.0.1:55431',
      appOrigin: 'http://127.0.0.1:3150',
      secureCookies: false,
    });
    expect(
      readAuthConfiguration({
        ...environment(),
        ADMIN_LOCAL_WORKSPACE_ENABLED: 'false',
      }),
    ).toBeNull();
  });
  it.each(['production', 'test', undefined])(
    'stays disabled in %s even with all fixture flags',
    (mode) => {
      expect(
        readAuthConfiguration({ ...environment(), NODE_ENV: mode }),
      ).toBeNull();
    },
  );
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: 'https://mixed-project.supabase.co' },
    { ADMIN_PUBLICATION_ENABLED: 'true' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://tksvbkvfusrnxulpahky.supabase.co' },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' },
    { ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: 'a'.repeat(64) },
    { ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256: undefined },
  ])(
    'refuses mixed environments and unqualified schema markers %#',
    (change) => {
      expect(readAuthConfiguration({ ...environment(), ...change })).toBeNull();
    },
  );
  it.each([
    'https://tksvbkvfusrnxulpahky.supabase.co',
    'http://127.0.0.1:54321',
    'http://localhost:55431',
    'http://127.0.0.1:55431.evil.test',
    'http://127.0.0.1:55431/?forward=remote',
    'http://user:password@127.0.0.1:55431',
  ])('refuses every other API destination: %s', (url) => {
    expect(
      readAuthConfiguration({
        ...environment(),
        ADMIN_LOCAL_SUPABASE_URL: url,
      }),
    ).toBeNull();
  });
  it.each([
    'https://example.test',
    'http://localhost:3150',
    'http://127.0.0.1:3150/path',
    'http://127.0.0.1:3150/?redirect=remote',
  ])('refuses another application origin: %s', (url) => {
    expect(
      readAuthConfiguration({ ...environment(), APP_BASE_URL: url }),
    ).toBeNull();
  });
  it.each([
    token({ role: 'service_role' }),
    token({ role: 'authenticated' }),
    token({ ref: 'remote-project' }),
    token({ sub: 'fake-admin' }),
    token({}, { alg: 'none' }),
    'sb_secret_fixture',
    'not.a.jwt',
    'x'.repeat(2049),
  ])('refuses privileged, foreign or malformed API keys %#', (key) => {
    expect(
      readAuthConfiguration({
        ...environment(),
        ADMIN_LOCAL_SUPABASE_ANON_KEY: key,
      }),
    ).toBeNull();
  });
  it('never grants a publication connection to a local workspace', () => {
    expect(
      readPublicationPgConfiguration({
        ...environment(),
        ADMIN_PUBLICATION_ENABLED: 'true',
        ADMIN_PUBLICATION_SECURITY_REVIEW: 'fixture',
      }),
    ).toBeNull();
  });
});
