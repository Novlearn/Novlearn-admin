// Metadata of the exact locally certified archive. These are compatibility
// identifiers, not an evaluator or a substitute for a native Engine execution.
export const certifiedEngineIdentity = Object.freeze({
  version: '0.2.3',
  pipelineVersion: '0.1.0',
  engineContract: 'schema-5;engine-0.1.0',
  generationVersion: 'mulberry32-rejection-v1',
  canonicalizationVersion: 'pg-jsonb-text-v1',
  engineArchiveSha256:
    '3068549e521d1f643ced8564e94ad645dbccace22a9ec173c912530af3766028',
});

/** The HTTPS transport is pinned to the authenticated Staging host. */
export function hasRemoteEngineConfiguration(
  env: Record<string, string | undefined>,
) {
  const endpoint = env.ENGINE_URL;
  const token = env.ENGINE_TOKEN;
  const archiveSha256 = env.ENGINE_ARTIFACT_SHA256;
  if (!endpoint || !token || !archiveSha256) return false;
  try {
    const url = new URL(endpoint);
    return (
      url.href === 'https://staging.novlearn.fr/run' &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/run' &&
      new TextEncoder().encode(token).length >= 32 &&
      /^[a-f0-9]{64}$/.test(archiveSha256)
    );
  } catch {
    return false;
  }
}

export function usesRemoteEngine(env: Record<string, string | undefined>) {
  return (
    env.VERCEL === '1' || (env.NODE_ENV === 'development' && !!env.ENGINE_URL)
  );
}

export function isEngineEnabled(env: Record<string, string | undefined>) {
  return (
    env.ADMIN_ENGINE_ENABLED === 'true' &&
    (!usesRemoteEngine(env) || hasRemoteEngineConfiguration(env))
  );
}
