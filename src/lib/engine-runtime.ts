import 'server-only';
import { isEngineEnabled } from './engine-identity';
import { RemoteEngineError, runRemoteEngine } from './engine-remote-transport';
import { randomUUID } from 'node:crypto';
import {
  createNodeHost,
  type EngineOperation,
  type NodeHost,
  type HostError,
} from 'novlearn-exercise-engine/node-host';
import type { JsonObject, JsonValue } from 'novlearn-exercise-engine';

export class EngineRuntimeError extends Error {
  readonly reason:
    | HostError
    | 'runtime-profile'
    | 'authentication'
    | 'archive-mismatch'
    | 'contract-mismatch'
    | 'network';
  constructor(reason: EngineRuntimeError['reason']) {
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
  if (process.env.VERCEL === '1') {
    if (!isEngineEnabled(process.env))
      throw new EngineRuntimeError('runtime-profile');
    try {
      const result = await runRemoteEngine(operation, payload, signal);
      if (!result.ok) throw new EngineRuntimeError(result.error);
      return result.value;
    } catch (error) {
      if (error instanceof EngineRuntimeError) throw error;
      if (error instanceof RemoteEngineError)
        throw new EngineRuntimeError(error.reason);
      throw new EngineRuntimeError(signal?.aborted ? 'aborted' : 'unavailable');
    }
  }
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

export function engineFailure(error: unknown) {
  if (!(error instanceof EngineRuntimeError))
    return {
      status: 500,
      code: 'engine_internal',
      message: 'Erreur interne pendant le traitement Engine.',
    } as const;
  const reason = error.reason;
  const common = {
    authentication: {
      status: 502,
      code: 'engine_authentication',
      message: "L'authentification du host Engine a été refusée.",
    },
    'archive-mismatch': {
      status: 502,
      code: 'engine_archive_mismatch',
      message: "L'empreinte de l'archive Engine ne correspond pas.",
    },
    'contract-mismatch': {
      status: 502,
      code: 'engine_contract_mismatch',
      message:
        'La réponse du host Engine est incompatible avec le contrat attendu.',
    },
    network: {
      status: 503,
      code: 'engine_network',
      message: "Le host Engine est injoignable depuis l'hébergement Admin.",
    },
    timeout: {
      status: 504,
      code: 'engine_timeout',
      message: "Le host Engine n'a pas répondu dans le délai prévu.",
    },
  } as const;
  if (reason in common) return common[reason as keyof typeof common];
  if (reason === 'runtime-profile')
    return {
      status: 503,
      code: 'engine_not_configured',
      message: "Le transport Engine serveur n'est pas configuré.",
    };
  if (reason === 'busy')
    return {
      status: 429,
      code: 'engine_busy',
      message: 'Engine est occupé. Réessayez dans un instant.',
    };
  if (reason === 'invalid-request' || reason === 'protocol-error')
    return {
      status: 502,
      code: 'engine_contract_mismatch',
      message:
        'La réponse du host Engine est incompatible avec le contrat attendu.',
    };
  return {
    status: 503,
    code: 'engine_unavailable',
    message:
      'Engine est temporairement indisponible. Réessayez dans un instant.',
  };
}
