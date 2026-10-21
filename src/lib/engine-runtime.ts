import 'server-only';
import { isEngineEnabled } from './engine-identity';
import { randomUUID } from 'node:crypto';
import {
  createNodeHost,
  type EngineOperation,
  type NodeHost,
  type HostError,
} from 'novlearn-exercise-engine/node-host';
import type { JsonObject, JsonValue } from 'novlearn-exercise-engine';

export class EngineRuntimeError extends Error {
  readonly reason: HostError | 'runtime-profile';
  constructor(reason: HostError | 'runtime-profile') {
    super('Engine unavailable');
    this.reason = reason;
  }
}
let host: NodeHost | undefined;
/** The user-qualified profile is Linux with bounded cgroup v2, never a fallback evaluator. */
export async function runEngine(
  operation: EngineOperation,
  payload: JsonObject,
  signal?: AbortSignal,
): Promise<JsonValue> {
  if (process.env.VERCEL === '1' && !isEngineEnabled(process.env))
    throw new EngineRuntimeError('runtime-profile');
  if (process.platform !== 'linux') {
    const { readLocalEngineConfiguration, runLocalEngine } = await import(
      './engine-local-transport'
    );
    if (!readLocalEngineConfiguration(process.env))
      throw new EngineRuntimeError('runtime-profile');
    try {
      const result = await runLocalEngine(operation, payload, signal);
      if (!result.ok) throw new EngineRuntimeError(result.error);
      return result.value;
    } catch (error) {
      if (error instanceof EngineRuntimeError) throw error;
      throw new EngineRuntimeError(signal?.aborted ? 'aborted' : 'unavailable');
    }
  }
  host ??= createNodeHost({ maxConcurrent: 1, maxQueued: 4 });
  const result = await host.run(
    JSON.stringify({
      protocolVersion: 1,
      requestId: randomUUID(),
      operation,
      payload,
    }),
    { signal },
  );
  if (!result.ok) throw new EngineRuntimeError(result.error);
  return result.value;
}
export async function closeEngineRuntime() {
  await host?.close();
  host = undefined;
}
