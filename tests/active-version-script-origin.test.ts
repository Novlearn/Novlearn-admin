import { expect, it } from 'vitest';
import { readAuthConfiguration, STAGING_PROJECT_REF } from '@/lib/auth/config';

const validConfiguration = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-key',
  APP_BASE_URL: 'http://localhost:3000',
};

it.each([
  'https://remote.invalid',
  'https://abwipnppcrghdhwriyjp.supabase.co',
  'http://127.0.0.1:55432',
])('rejects non-Staging Supabase URLs: %s', (supabaseUrl) => {
  expect(
    readAuthConfiguration({
      ...validConfiguration,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    }),
  ).toBeNull();
});

it('accepts the configured Staging project for the local admin origin', () => {
  expect(readAuthConfiguration(validConfiguration)).toMatchObject({
    supabaseUrl: `https://${STAGING_PROJECT_REF}.supabase.co`,
    appOrigin: 'http://localhost:3000',
    secureCookies: false,
  });
});
