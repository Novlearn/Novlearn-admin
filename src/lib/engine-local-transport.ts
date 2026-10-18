import 'server-only';
import { readAuthConfiguration } from './auth/config';
import type {
  EngineOperation,
  HostResult,
} from 'novlearn-exercise-engine/node-host';
import type { JsonObject } from 'novlearn-exercise-engine';
import { randomUUID } from 'node:crypto';

/** Private development transport. The worker still executes the official Linux host. */
export function readLocalEngineConfiguration(
  env: Record<string, string | undefined>,
) {
  const auth = readAuthConfiguration(env);
  if (
    !auth?.local ||
    env.ADMIN_ENGINE_ENABLED !== 'true' ||
    env.ADMIN_LOCAL_ENGINE_URL !==
      (auth.localPublicationFixture
        ? 'http://127.0.0.1:3153/run'
        : 'http://127.0.0.1:3151/run') ||
    !/^[0-9a-f]{64}$/.test(env.ADMIN_LOCAL_ENGINE_CAPABILITY ?? '')
  )
    return null;
  return {
    url: env.ADMIN_LOCAL_ENGINE_URL,
    capability: env.ADMIN_LOCAL_ENGINE_CAPABILITY!,
  };
}

export async function runLocalEngine(
  operation: EngineOperation,
  payload: JsonObject,
  signal?: AbortSignal,
): Promise<HostResult> {
  const config = readLocalEngineConfiguration(process.env);
  if (!config) throw new Error('Local Engine transport is not configured');
  const requestId = randomUUID();
  const body = JSON.stringify({
    protocolVersion: 1,
    requestId,
    operation,
    payload,
  });
  if (Buffer.byteLength(body) > 1048576) throw new Error('Engine input limit');
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + config.capability,
      'content-type': 'application/json',
    },
    body,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(10000),
    ]),
  });
  if (!response.ok || !response.body)
    throw new Error('Engine transport unavailable');
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 2099200) throw new Error('Engine output limit');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
  }
  const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (
    !result ||
    typeof result !== 'object' ||
    result.requestId !== requestId ||
    typeof result.ok !== 'boolean' ||
    (result.ok
      ? !Object.hasOwn(result, 'value')
      : ![
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
        ].includes(result.error))
  )
    throw new Error('Engine transport protocol');
  return result as HostResult;
}
