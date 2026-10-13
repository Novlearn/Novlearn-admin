export const STAGING_PROJECT_REF = 'tksvbkvfusrnxulpahky';

export type AuthConfiguration = {
  supabaseUrl: string;
  publishableKey: string;
  appOrigin: string;
  secureCookies: boolean;
  review: string;
};

type Environment = Record<string, string | undefined>;

/** Activation is an operator decision after Lot 1A, never an inferred capability. */
export function readAuthConfiguration(
  env: Environment,
): AuthConfiguration | null {
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
