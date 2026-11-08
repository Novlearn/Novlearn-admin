import { PRODUCTION_PROJECT_REF } from '@/lib/production-api-config';
export function productionReadEnvironment(): Record<string, string> {
  return {
    APP_BASE_URL: 'https://admin.example.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://tksvbkvfusrnxulpahky.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      'sb_publishable_synthetic_staging_key',
    ADMIN_PRODUCTION_READ_ENABLED: 'true',
    PRODUCTION_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    PRODUCTION_SUPABASE_PUBLISHABLE_KEY:
      'sb_publishable_synthetic_production_key',
  };
}
