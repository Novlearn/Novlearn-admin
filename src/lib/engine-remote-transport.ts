import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  EngineOperation,
  HostError,
  HostResult,
} from 'novlearn-exercise-engine/node-host';
import type { JsonObject } from 'novlearn-exercise-engine';
import { hasRemoteEngineConfiguration } from './engine-identity';

export type RemoteEngineFailure =
  | 'authentication'
  | 'archive-mismatch'
  | 'contract-mismatch'
  | 'network'
  | 'timeout'
  | 'unavailable';

export class RemoteEngineError extends Error {
  constructor(readonly reason: RemoteEngineFailure | HostError) {
    super('Engine request failed');
    this.name = 'RemoteEngineError';
  }
}

export function readRemoteEngineConfiguration(
  env: Record<string, string | undefined>,
) {
  const endpoint = env.ENGINE_URL;
  const token = env.ENGINE_TOKEN;
  const archiveSha256 = env.ENGINE_ARTIFACT_SHA256;
  if (
    !endpoint ||
    !token ||
    !archiveSha256 ||
    !hasRemoteEngineConfiguration(env)
  )
    return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.href !== 'https://staging.novlearn.fr/run') return null;
  return { url: url.href, token, archiveSha256 };
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const hostErrors: HostError[] = [
  'invalid-request',
  'input-limit',
  'output-limit',
  'stderr-limit',
  'busy',
  'timeout',
  'aborted',
  'closed',
  'unavailable',
  'crash',
  'protocol-error',
  'worker-error',
];

/** Server-to-server transport only. It relays Engine operations and never evaluates them. */
export async function runRemoteEngine(
  operation: EngineOperation,
  payload: JsonObject,
  signal?: AbortSignal,
): Promise<HostResult> {
  const config = readRemoteEngineConfiguration(process.env);
  if (!config) throw new RemoteEngineError('unavailable');
  const requestId = randomUUID();
  const body = JSON.stringify({
    protocolVersion: 1,
    requestId,
    operation,
    payload,
  });
  if (Buffer.byteLength(body, 'utf8') > 1048576)
    throw new RemoteEngineError('input-limit');

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'x-engine-archive-sha256': config.archiveSha256,
      },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(10000),
      ]),
    });
  } catch (error) {
    throw new RemoteEngineError(
      signal?.aborted ||
      (error instanceof Error && error.name === 'TimeoutError')
        ? 'timeout'
        : 'network',
    );
  }

  const returnedArchive = response.headers.get('x-engine-archive-sha256');
  if (response.status === 401 || response.status === 403)
    throw new RemoteEngineError('authentication');
  if (response.status === 409 || returnedArchive !== config.archiveSha256)
    throw new RemoteEngineError('archive-mismatch');
  if (response.status === 429) throw new RemoteEngineError('busy');
  if (response.status === 504) throw new RemoteEngineError('timeout');
  if (response.status === 503) throw new RemoteEngineError('unavailable');
  if (response.status === 400 || response.status === 415)
    throw new RemoteEngineError('contract-mismatch');
  if (!response.ok || !response.body)
    throw new RemoteEngineError('unavailable');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 2099200) throw new RemoteEngineError('output-limit');
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof RemoteEngineError) throw error;
    throw new RemoteEngineError('network');
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  let result: unknown;
  try {
    result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RemoteEngineError('contract-mismatch');
  }
  if (
    !object(result) ||
    result.requestId !== requestId ||
    !object(result.metrics) ||
    !Number.isFinite(result.metrics.elapsedMs) ||
    !Number.isFinite(result.metrics.queuedMs)
  )
    throw new RemoteEngineError('contract-mismatch');
  if (result.ok === true && Object.hasOwn(result, 'value'))
    return result as unknown as HostResult;
  if (result.ok === false && hostErrors.includes(result.error as HostError))
    throw new RemoteEngineError(result.error as HostError);
  throw new RemoteEngineError('contract-mismatch');
}
