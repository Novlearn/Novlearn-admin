export const STAGING_PROJECT_REF = 'tksvbkvfusrnxulpahky';
export const LOCAL_SCHEMA_MANIFEST_SHA256 =
  '8e661db1f648196c9e586e76fb68b3f4412203bade43179b0621445aeeac9301';
export const LOCAL_AUTH_COOKIE = 'novlearn-admin-local-auth';

export type AuthConfiguration = {
  supabaseUrl: string;
  publishableKey: string;
  appOrigin: string;
  secureCookies: boolean;
  review: string;
  local?: true;
};

type Environment = Record<string, string | undefined>;

/** Development fixture only. This never enables the operational Staging gate. */
function readLocalAuthConfiguration(
  env: Environment,
): AuthConfiguration | null {
  if (
    env.NODE_ENV !== 'development' ||
    env.ADMIN_STAGING_AUTH_ENABLED === 'true' ||
    env.ADMIN_PUBLICATION_ENABLED === 'true' ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.ADMIN_LOCAL_SCHEMA_MANIFEST_SHA256 !== LOCAL_SCHEMA_MANIFEST_SHA256
  )
    return null;
  try {
    const supabase = new URL(env.ADMIN_LOCAL_SUPABASE_URL ?? '');
    const app = new URL(env.APP_BASE_URL ?? '');
    const key = env.ADMIN_LOCAL_SUPABASE_ANON_KEY ?? '';
    if (
      supabase.href !== 'http://127.0.0.1:55431/' ||
      app.href !== 'http://127.0.0.1:3150/' ||
      key.length > 2048
    )
      return null;
    const parts = key.split('.');
    if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p)))
      return null;
    const decode = (part: string) =>
      JSON.parse(atob(part.replaceAll('-', '+').replaceAll('_', '/')));
    const header = decode(parts[0]),
      payload = decode(parts[1]);
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      payload.iss !== 'supabase' ||
      payload.ref !== 'novlearn-admin-local' ||
      payload.role !== 'anon' ||
      payload.sub !== undefined
    )
      return null;
    return {
      supabaseUrl: supabase.origin,
      publishableKey: key,
      appOrigin: app.origin,
      secureCookies: false,
      review: 'local-schema:' + LOCAL_SCHEMA_MANIFEST_SHA256,
      local: true,
    };
  } catch {
    return null;
  }
}

/** Activation is an operator decision after Lot 1A, never an inferred capability. */
export function readAuthConfiguration(
  env: Environment,
): AuthConfiguration | null {
  if (env.ADMIN_LOCAL_WORKSPACE_ENABLED === 'true')
    return readLocalAuthConfiguration(env);
  if (env.ADMIN_STAGING_AUTH_ENABLED !== 'true') return null;
  const review = env.ADMIN_STAGING_SECURITY_REVIEW?.trim();
  if (!review) return null;
  try {
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    const app = new URL(env.APP_BASE_URL ?? '');
    const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
    if (
      supabase.href !== `https://${STAGING_PROJECT_REF}.supabase.co/` ||
      !key.startsWith('sb_publishable_') ||
      key.includes('replace_me') ||
      key.length > 512 ||
      app.username ||
      app.password ||
      app.search ||
      app.hash ||
      app.pathname !== '/' ||
      (app.protocol !== 'https:' &&
        !(
          app.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(app.hostname)
        ))
    )
      return null;
    return {
      supabaseUrl: supabase.origin,
      publishableKey: key,
      appOrigin: app.origin,
      secureCookies: app.protocol === 'https:',
      review,
    };
  } catch {
    return null;
  }
}
