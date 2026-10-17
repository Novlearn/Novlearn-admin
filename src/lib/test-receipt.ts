import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import type { PreviewCase, PreviewTestReport } from './preview';
import { certifiedEngineIdentity } from './engine-identity';
export function readTestSigningConfiguration(
  env: Readonly<Record<string, string | undefined>>,
) {
  const id = env.ADMIN_TEST_SIGNING_KEY_ID,
    key = env.ADMIN_TEST_SIGNING_KEY;
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id,
    ) ||
    !key ||
    !/^[0-9a-f]{64}$/.test(key)
  )
    return null;
  return { id, key: Buffer.from(key, 'hex') };
}
export function signTestReceipt(
  config: NonNullable<ReturnType<typeof readTestSigningConfiguration>>,
  input: {
    actorId: string;
    versionId: string;
    fingerprint: string;
    epoch: number;
    report: PreviewTestReport;
    cases: PreviewCase[];
  },
  now = Date.now(),
) {
  const payload = JSON.stringify({
    schemaVersion: 1,
    receiptId: randomUUID(),
    keyId: config.id,
    ...input,
    issuedAt: Math.floor(now / 1000),
    engineArchiveSha256: certifiedEngineIdentity.engineArchiveSha256,
  });
  if (Buffer.byteLength(payload) > 262144) throw Error('Receipt limit');
  return {
    payload,
    signature: createHmac('sha256', config.key)
      .update(payload, 'utf8')
      .digest('hex'),
  };
}
