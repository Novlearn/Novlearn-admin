import { expect, it } from 'vitest';
import {
  readProductionApiConfiguration,
  productionAuthConfiguration,
} from '@/lib/production-api-config';
import { readActivityConfiguration } from '@/lib/activity-config';
import { readUsersConfiguration } from '@/lib/users-config';
import { readUserDetailConfiguration } from '@/lib/user-detail-config';
import { readPedagogyConfiguration } from '@/lib/pedagogy-config';
import { productionReadEnvironment } from './fixtures/production-read-env';
import { localActivityEnvironment } from './fixtures/local-activity-env';

function anonKey(
  change: Record<string, unknown> = {},
  headerChange: Record<string, unknown> = {},
) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'HS256', typ: 'JWT', ...headerChange }),
    encode({
      iss: 'supabase',
      role: 'anon',
      ref: 'abwipnppcrghdhwriyjp',
      exp: 4102444800,
      ...change,
    }),
    'synthetic_signature',
  ].join('.');
}
it('accepts the existing Production public anon API key without accepting elevated credentials', () => {
  const env = productionReadEnvironment();
  expect(
    readProductionApiConfiguration({
      ...env,
      PRODUCTION_SUPABASE_PUBLISHABLE_KEY: anonKey(),
    })?.publishableKey,
  ).toBe(anonKey());
});
it.each([
  anonKey({ role: 'service_role' }),
  anonKey({ role: 'authenticated' }),
  anonKey({ ref: 'tksvbkvfusrnxulpahky' }),
  anonKey({ exp: 1 }),
  anonKey({ exp: '4102444800' }),
  anonKey({ iss: 'attacker' }),
  anonKey({}, { alg: 'none' }),
  'not.an.api-key',
])(
  'rejects privileged, wrong-project, expired and malformed JWT API keys %#',
  (key) => {
    expect(
      readProductionApiConfiguration({
        ...productionReadEnvironment(),
        PRODUCTION_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBeNull();
  },
);
it('uses a publishable API client for all Production reads while retaining Staging Auth', () => {
  const env = productionReadEnvironment();
  for (const read of [
    readActivityConfiguration,
    readUsersConfiguration,
    readUserDetailConfiguration,
    readPedagogyConfiguration,
  ])
    expect(read(env)).toEqual({
      url: env.PRODUCTION_SUPABASE_URL,
      publishableKey: env.PRODUCTION_SUPABASE_PUBLISHABLE_KEY,
      environment: 'production',
    });
  expect(productionAuthConfiguration(env)?.supabaseUrl).not.toBe(
    env.NEXT_PUBLIC_SUPABASE_URL,
  );
});
it('keeps Production reads configured even when the removed toggle is present as false', () => {
  expect(
    readProductionApiConfiguration({
      ...productionReadEnvironment(),
      ADMIN_PRODUCTION_READ_ENABLED: 'false',
    })?.environment,
  ).toBe('production');
});
it.each([
  { PRODUCTION_SUPABASE_URL: '' },
  { PRODUCTION_SUPABASE_URL: 'https://tksvbkvfusrnxulpahky.supabase.co' },
  { PRODUCTION_SUPABASE_URL: 'https://abwipnppcrghdhwriyjp.supabase.co/evil' },
  {
    PRODUCTION_SUPABASE_URL:
      'https://abwipnppcrghdhwriyjp.supabase.co?override=1',
  },
  { PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' },
  { PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_replace_me' },
  { PRODUCTION_SUPABASE_PUBLISHABLE_KEY: '' },
  { ADMIN_LOCAL_WORKSPACE_ENABLED: 'true' },
  { ADMIN_LOCAL_USERS_ENABLED: 'true' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://abwipnppcrghdhwriyjp.supabase.co' },
])(
  'rejects incomplete, privileged, mixed or cross-project settings %#',
  (change) => {
    expect(
      readProductionApiConfiguration({
        ...productionReadEnvironment(),
        ...change,
      }),
    ).toBeNull();
  },
);
it('never falls back to a data copy if Production API configuration is incomplete', () => {
  expect(
    readActivityConfiguration({
      ...localActivityEnvironment(),
      PRODUCTION_SUPABASE_URL: 'https://abwipnppcrghdhwriyjp.supabase.co',
    }),
  ).toBeNull();
});
it('does not treat an old SQL connection as an API credential', () => {
  expect(
    readProductionApiConfiguration({
      ...productionReadEnvironment(),
      PRODUCTION_SUPABASE_PUBLISHABLE_KEY: '',
      ADMIN_PRODUCTION_ACTIVITY_PG_URL: 'postgresql://private-credential',
    }),
  ).toBeNull();
});
