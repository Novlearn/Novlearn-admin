// Metadata of the exact locally certified archive. These are compatibility
// identifiers, not an evaluator or a substitute for a native Engine execution.
export const certifiedEngineIdentity = Object.freeze({
  version: '0.1.8',
  pipelineVersion: '0.1.0',
  engineContract: 'schema-5;engine-0.1.0',
  generationVersion: 'mulberry32-rejection-v1',
  canonicalizationVersion: 'pg-jsonb-text-v1',
  engineArchiveSha256:
    '82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea',
});

/** Vercel can use only the explicitly configured HTTPS Engine transport. */
export function hasRemoteEngineConfiguration(
  env: Record<string, string | undefined>,
) {
  const endpoint = env.ADMIN_ENGINE_URL;
  const token = env.ADMIN_ENGINE_TOKEN;
  const archiveSha256 = env.ADMIN_ENGINE_ARCHIVE_SHA256;
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

export function isEngineEnabled(env: Record<string, string | undefined>) {
  return (
    env.ADMIN_ENGINE_ENABLED === 'true' &&
    (env.VERCEL !== '1' || hasRemoteEngineConfiguration(env))
  );
}

