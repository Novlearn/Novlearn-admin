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

/** Vercel is not the certified bounded Linux host. Never start native jobs there. */
export function isEngineEnabled(env: Record<string, string | undefined>) {
  return env.ADMIN_ENGINE_ENABLED === 'true' && env.VERCEL !== '1';
}
