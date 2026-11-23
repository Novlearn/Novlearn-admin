import 'server-only';
import { readAuthConfiguration } from './auth/config';
import { PRODUCTION_PROJECT_REF } from './production-api-config';
import {
  readCatalogueSyncSessionConnections,
  readPublicationPgConfiguration,
  type PublicationPgConfiguration,
} from './publication-pg';

export type CatalogueSyncConfiguration = Omit<
  PublicationPgConfiguration,
  'review'
>;

export function readCatalogueSyncConfiguration(
  env: Record<string, string | undefined>,
): CatalogueSyncConfiguration | null {
  if (env.VERCEL !== '1') return readPublicationPgConfiguration(env);
  const auth = readAuthConfiguration(env);
  if (
    env.VERCEL_ENV !== 'production' ||
    !auth?.secureCookies ||
    auth.local ||
    Object.entries(env).some(
      ([key, value]) =>
        key.startsWith('ADMIN_LOCAL_') && value && value !== 'false',
    )
  )
    return null;

  const connections = readCatalogueSyncSessionConnections(
    env,
    PRODUCTION_PROJECT_REF,
  );
  return (
    connections && {
      ...connections,
      targetKey: `production-${PRODUCTION_PROJECT_REF}`,
    }
  );
}
