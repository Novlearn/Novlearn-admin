import {
  validateDefinition,
  validateSubmission,
  parseMathInput,
  generateVariables,
  instantiateExercise,
  projectPublicInstance,
  gradeAnswer,
  type ExerciseDefinition,
  type ExerciseInstance,
  type PublicInstance,
  type AnswerSubmission,
  type CorrectionResult,
} from 'novlearn-exercise-engine';
import {
  createNodeHost,
  type EngineOperation,
  type HostResult,
  type NodeHost,
} from 'novlearn-exercise-engine/node-host';
import { adaptLegacyExercise } from 'novlearn-exercise-engine/legacy';

// Exhaustive host operation union: additions/removals require a coordinated contract update.
export const operations: Record<EngineOperation, true> = {
  validateDefinition: true,
  validateSubmission: true,
  parseMathInput: true,
  generateVariables: true,
  instantiateExercise: true,
  projectPublicInstance: true,
  gradeAnswer: true,
  adaptLegacyExercise: true,
};

export function contracts(
  definition: ExerciseDefinition,
  official: ExerciseInstance,
  submission: AnswerSubmission,
) {
  const instance: PublicInstance = projectPublicInstance(official);
  const correction: CorrectionResult = gradeAnswer(official, submission);
  const operation: EngineOperation = 'instantiateExercise';
  const host: NodeHost = createNodeHost({ maxConcurrent: 1, maxQueued: 4 });
  const result: Promise<HostResult> = host.run(
    JSON.stringify({
      protocolVersion: 1,
      requestId: 'type-test',
      operation,
      payload: {},
    }),
  );
  // Internal implementation files are not part of the supported API.
  // @ts-expect-error Package exports intentionally reject deep imports.
  void import('novlearn-exercise-engine/dist/math/algebra.js');
  return {
    instance,
    correction,
    result,
    validateDefinition,
    validateSubmission,
    parseMathInput,
    generateVariables,
    instantiateExercise,
    adaptLegacyExercise,
  };
}
