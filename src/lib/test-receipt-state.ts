import { certifiedEngineIdentity } from './engine-identity';

export function isCurrentTestReceipt(
  run: { fingerprint: string; test_epoch: number; payload: string },
  fingerprint: string,
  epoch: number,
): boolean {
  if (run.fingerprint !== fingerprint || run.test_epoch !== epoch) return false;
  try {
    const body: unknown = JSON.parse(run.payload);
    return (
      typeof body === 'object' &&
      body !== null &&
      'engineArchiveSha256' in body &&
      body.engineArchiveSha256 === certifiedEngineIdentity.engineArchiveSha256
    );
  } catch {
    return false;
  }
}
