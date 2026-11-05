import 'server-only';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EngineOperation } from 'novlearn-exercise-engine/node-host';
import type { JsonObject, JsonValue } from 'novlearn-exercise-engine';
import { certifiedEngineIdentity } from './engine-identity';
import { EngineRuntimeError, runEngine } from './engine-runtime';
import { readRemoteEngineConfiguration } from './engine-remote-transport';

let active = false;
const fixture: JsonObject = {
  schemaVersion: 5,
  kind: 'composed',
  id: 'host-qualification',
  revision: '1',
  title: 'Qualification synthétique',
  generation: {
    schemaVersion: 5,
    definitions: [],
    constraints: [],
    maxAttempts: 4,
    maxDraws: 16,
  },
  variables: [],
  elements: [
    {
      id: 'q',
      type: 'question',
      text: 'Deux plus deux ?',
      points: 1,
      response: { format: 'latex', kind: 'rational' },
      expectedLatex: '4',
      policy: { domain: 'rational', form: 'value-only' },
    },
  ],
};
const object = (v: JsonValue): v is JsonObject =>
  !!v && typeof v === 'object' && !Array.isArray(v);

async function profile() {
  let pythonExecutable = false;
  try {
    await access('/usr/bin/python3', constants.X_OK);
    pythonExecutable = true;
  } catch {}
  let cgroup: Record<string, number | 'max' | null> | null = null;
  if (process.platform === 'linux') {
    try {
      const entry = (await readFile('/proc/self/cgroup', 'utf8'))
        .split('\n')
        .find((line) => line.startsWith('0::'))
        ?.slice(3);
      if (entry === undefined) throw Error('Missing cgroup');
      const root = resolve('/sys/fs/cgroup');
      const group = resolve(root, '.' + entry);
      if (group !== root && !group.startsWith(root + sep))
        throw Error('Invalid cgroup');
      cgroup = {};
      for (const name of [
        'memory.max',
        'memory.swap.max',
        'memory.peak',
        'pids.max',
      ]) {
        const text = (await readFile(resolve(group, name), 'utf8')).trim();
        cgroup[name] =
          text === 'max'
            ? 'max'
            : /^\d+$/.test(text) && Number.isSafeInteger(Number(text))
              ? Number(text)
              : null;
      }
    } catch {
      cgroup = null;
    }
  }
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    pythonExecutable,
    cgroup,
  };
}

/** Synthetic-only probe. Never removes the application guard or accepts an authoring payload. */
export async function qualifyEngine(signal: AbortSignal) {
  if (active) return { busy: true as const };
  active = true;
  const results: {
    operation: string;
    passed: boolean;
    error?: string;
    elapsedMs: number;
  }[] = [];
  try {
    const runtime = await profile();
    const remote = readRemoteEngineConfiguration(process.env);
    const transport =
      process.env.VERCEL === '1'
        ? 'remote-https'
        : process.platform === 'linux'
          ? 'local-node-host'
          : 'local-http-worker';
    const run = async (operation: EngineOperation, payload: JsonObject) => {
      signal.throwIfAborted();
      const started = performance.now();
      try {
        const value = await runEngine(operation, payload, signal);
        results.push({
          operation,
          passed: true,
          elapsedMs: performance.now() - started,
        });
        return value;
      } catch (error) {
        const reason =
          error instanceof EngineRuntimeError ? error.reason : 'unavailable';
        results.push({
          operation,
          passed: false,
          error: reason,
          elapsedMs: performance.now() - started,
        });
        return null;
      }
    };
    const validation = await run('validateDefinition', { definition: fixture });
    if (!validation || !object(validation) || validation.ok !== true)
      return {
        received: false,
        identity: {
          adminPackage: certifiedEngineIdentity.version,
          contract: certifiedEngineIdentity.engineContract,
          transport,
          expectedRemoteArchiveSha256: remote?.archiveSha256 ?? null,
        },
        runtime,
        results,
      };
    const instanceId = randomUUID();
    const first = await run('instantiateExercise', {
      definition: fixture,
      seed: 42,
      instanceId,
    });
    if (
      !first ||
      !object(first) ||
      first.ok !== true ||
      !first.value ||
      !object(first.value)
    )
      return {
        received: false,
        identity: {
          adminPackage: certifiedEngineIdentity.version,
          contract: certifiedEngineIdentity.engineContract,
          transport,
          expectedRemoteArchiveSha256: remote?.archiveSha256 ?? null,
        },
        runtime,
        results,
      };
    const official = first.value;
    const replay = await run('instantiateExercise', {
      definition: fixture,
      seed: 42,
      instanceId,
    });
    const projected = await run('projectPublicInstance', { official });
    const verdicts: string[] = [];
    const answers: JsonObject[] = [
      { format: 'latex', source: '4' },
      { format: 'latex', source: '5' },
      { format: 'invalid-fixture' },
    ];
    for (const answer of answers) {
      const result = await run('gradeAnswer', {
        official,
        submission: { schemaVersion: 5, instanceId, questionId: 'q', answer },
      });
      verdicts.push(
        result && object(result) && typeof result.state === 'string'
          ? result.state
          : 'error',
      );
    }
    const deterministic = JSON.stringify(first) === JSON.stringify(replay);
    const publicSafe =
      !!projected &&
      object(projected) &&
      Object.keys(projected).sort().join(',') ===
        'elements,instanceId,schemaVersion,title';
    return {
      received:
        deterministic &&
        publicSafe &&
        verdicts.join(',') === 'correct,incorrect,invalid' &&
        results.every((r) => r.passed),
      identity: {
        adminPackage: certifiedEngineIdentity.version,
        contract: certifiedEngineIdentity.engineContract,
        transport,
        expectedRemoteArchiveSha256: remote?.archiveSha256 ?? null,
      },
      runtime,
      results,
      deterministic,
      publicSafe,
      verdicts,
    };
  } finally {
    active = false;
  }
}
