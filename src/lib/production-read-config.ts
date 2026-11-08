export { PRODUCTION_PROJECT_REF } from './production-api-config';
export { readProductionApiConfiguration as readProductionReadConfiguration } from './production-api-config';
export type ReadEnvironment = 'local-copy' | 'production';
/** Invalid Production settings never fall back to a local data copy. */
export function productionReadRequested(
  env: Record<string, string | undefined>,
) {
  return Object.entries(env).some(
    ([key, value]) =>
      (key.startsWith('ADMIN_PRODUCTION_') ||
        key.startsWith('PRODUCTION_SUPABASE_')) &&
      !!value &&
      value !== 'false',
  );
}
