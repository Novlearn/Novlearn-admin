import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { draftEnvelope, isFingerprint } from './catalogue';

const prefix = 'novlearn-admin:creator-recovery:v1:';
export const recoveryEndEvent = 'novlearn:creator-recovery-end';
export const recoveryLifetimeMs = 30 * 60 * 1000;
export const recoveryMaxBytes = 256 * 1024;
export type RecoveryStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;
export type RecoveryBase = { fingerprint: string | null; epoch: number | null };
export type RecoveryCopy = {
  schema: 1;
  resource: string;
  base: RecoveryBase;
  createRevision: boolean;
  updatedAt: number;
  definition: ExerciseDefinition;
  skills: string;
};
export type RecoveryRead =
  | { state: 'missing' | 'expired' | 'invalid' | 'unavailable' }
  | { state: 'ready'; copy: RecoveryCopy };

export function recoveryResource(
  exerciseId?: string,
  versionId?: string,
  newRevision = false,
) {
  return JSON.stringify([exerciseId ?? null, versionId ?? null, newRevision]);
}
function ownerPrefix(scope: string) {
  return prefix + encodeURIComponent(scope) + ':';
}
function key(scope: string, resource: string) {
  return ownerPrefix(scope) + encodeURIComponent(resource);
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Storage is untrusted input, never a mathematical validation or an approval.
// Incomplete titles/catalogue fields must remain recoverable without repairing them.
function recoverableDefinition(value: unknown): value is ExerciseDefinition {
  if (
    !object(value) ||
    typeof value.title !== 'string' ||
    value.title.length > 160
  )
    return false;
  if (
    !draftEnvelope({
      ...value,
      title: 'Copie de récupération',
      catalogue: undefined,
    })
  )
    return false;
  if (value.catalogue !== undefined) {
    if (!object(value.catalogue)) return false;
    const c = value.catalogue;
    if (
      Object.keys(c).some(
        (k) =>
          ![
            'chapter',
            'appTitle',
            'difficulty',
            'skills',
            'exerciseType',
            'needsCalculator',
          ].includes(k),
      )
    )
      return false;
    for (const k of ['chapter', 'appTitle', 'exerciseType'])
      if (c[k] !== undefined && typeof c[k] !== 'string') return false;
    if (c.difficulty !== undefined && typeof c.difficulty !== 'number')
      return false;
    if (
      c.needsCalculator !== undefined &&
      typeof c.needsCalculator !== 'boolean'
    )
      return false;
    if (
      c.skills !== undefined &&
      (!Array.isArray(c.skills) || c.skills.some((s) => typeof s !== 'string'))
    )
      return false;
  }
  return true;
}
function parse(raw: string, resource: string, now: number): RecoveryRead {
  if (new TextEncoder().encode(raw).length > recoveryMaxBytes)
    return { state: 'invalid' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { state: 'invalid' };
  }
  if (
    !object(value) ||
    value.schema !== 1 ||
    value.resource !== resource ||
    typeof value.createRevision !== 'boolean' ||
    !object(value.base) ||
    !(
      value.base.fingerprint === null || isFingerprint(value.base.fingerprint)
    ) ||
    !(
      value.base.epoch === null ||
      (Number.isSafeInteger(value.base.epoch) && Number(value.base.epoch) >= 0)
    ) ||
    !Number.isSafeInteger(value.updatedAt) ||
    Number(value.updatedAt) > now ||
    typeof value.skills !== 'string' ||
    value.skills.length > 2000 ||
    !recoverableDefinition(value.definition) ||
    Object.keys(value).some(
      (k) =>
        ![
          'schema',
          'resource',
          'base',
          'createRevision',
          'updatedAt',
          'definition',
          'skills',
        ].includes(k),
    )
  )
    return { state: 'invalid' };
  if (now - Number(value.updatedAt) >= recoveryLifetimeMs)
    return { state: 'expired' };
  return { state: 'ready', copy: value as RecoveryCopy };
}
export function readRecovery(
  storage: RecoveryStorage,
  scope: string,
  resource: string,
  now = Date.now(),
): RecoveryRead {
  try {
    const raw = storage.getItem(key(scope, resource));
    return raw === null ? { state: 'missing' } : parse(raw, resource, now);
  } catch {
    return { state: 'unavailable' };
  }
}
/** Only called after explicit opt-in. A failure preserves any previous copy. */
export function writeRecovery(
  storage: RecoveryStorage,
  scope: string,
  copy: RecoveryCopy,
): boolean {
  try {
    const raw = JSON.stringify(copy);
    if (parse(raw, copy.resource, copy.updatedAt).state !== 'ready')
      return false;
    storage.setItem(key(scope, copy.resource), raw);
    return true;
  } catch {
    return false;
  }
}
export function removeRecovery(
  storage: RecoveryStorage,
  scope: string,
  resource: string,
): boolean {
  try {
    storage.removeItem(key(scope, resource));
    return true;
  } catch {
    return false;
  }
}
/** Never clear unrelated browser state. Used for explicit logout/account changes. */
export function clearRecoveries(
  storage: RecoveryStorage,
  keepScope?: string,
): boolean {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const entry = storage.key(i);
      if (
        entry?.startsWith(prefix) &&
        (!keepScope || !entry.startsWith(ownerPrefix(keepScope)))
      )
        keys.push(entry);
    }
    for (const entry of keys) storage.removeItem(entry);
    return true;
  } catch {
    return false;
  }
}
export function recoveryBaseChanged(copy: RecoveryCopy, base: RecoveryBase) {
  return (
    copy.base.fingerprint !== base.fingerprint || copy.base.epoch !== base.epoch
  );
}
