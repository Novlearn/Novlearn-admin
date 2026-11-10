import { readAuthConfiguration, type AuthConfiguration } from './auth/config';

export const PRODUCTION_PROJECT_REF = 'abwipnppcrghdhwriyjp';
/** Production currently exposes its public anon JWT. Inspect only the trusted
 * server configuration here; Supabase verifies the API key and user session.
 * This never accepts a privileged key or shares a JWT signing secret. */
function validPublicApiKey(key: string) {
  if (key.includes('replace_me')) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return key.length <= 512;
  if (key.length > 2048) return false;
  const parts = key.split('.');
  if (
    parts.length !== 3 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    return false;
  try {
    const decode = (part: string) =>
      JSON.parse(atob(part.replaceAll('-', '+').replaceAll('_', '/')));
    const header = decode(parts[0]),
      payload = decode(parts[1]);
    return (
      header.alg === 'HS256' &&
      header.typ === 'JWT' &&
      payload.iss === 'supabase' &&
      payload.role === 'anon' &&
      payload.ref === PRODUCTION_PROJECT_REF &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp > Date.now() / 1000
    );
  } catch {
    return false;
  }
}
export type ProductionApiConfiguration = {
  environment: 'production';
  url: string;
  publishableKey: string;
};
export function readProductionApiConfiguration(
  env: Record<string, string | undefined>,
): ProductionApiConfiguration | null {
  const auth = readAuthConfiguration(env);
  if (
    !auth ||
    auth.local ||
    env.ADMIN_PRODUCTION_READ_ENABLED === 'false' ||
    Object.entries(env).some(
      ([k, v]) => k.startsWith('ADMIN_LOCAL_') && !!v && v !== 'false',
    )
  )
    return null;
  try {
    const url = new URL(env.PRODUCTION_SUPABASE_URL ?? '');
    const key = env.PRODUCTION_SUPABASE_PUBLISHABLE_KEY ?? '';
    if (
      url.href !== `https://${PRODUCTION_PROJECT_REF}.supabase.co/` ||
      !validPublicApiKey(key)
    )
      return null;
    return { environment: 'production', url: url.origin, publishableKey: key };
  } catch {
    return null;
  }
}
export function productionAuthConfiguration(
  env: Record<string, string | undefined>,
): AuthConfiguration | null {
  const primary = readAuthConfiguration(env),
    production = readProductionApiConfiguration(env);
  if (!primary || !production) return null;
  return {
    supabaseUrl: production.url,
    publishableKey: production.publishableKey,
    appOrigin: primary.appOrigin,
    secureCookies: primary.secureCookies,
  };
}
