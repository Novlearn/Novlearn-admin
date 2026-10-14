import type {
  AnswerSubmission,
  CorrectionResult,
  PublicInstance,
  GeneratedValue,
} from 'novlearn-exercise-engine';

export type PreviewCase = {
  questionId: string;
  answer: AnswerSubmission['answer'];
  expectedState: 'correct' | 'incorrect' | 'invalid';
};
export type PreviewResult = {
  previewId: string;
  expiresAt: number;
  definitionDigest: string;
  seed: number;
  instance: PublicInstance;
  engineVersion: string;
};
export type PreviewDetails = {
  values: Record<string, GeneratedValue>;
  draws: number;
  attempts: number;
  expected: {
    questionId: string;
    answer: AnswerSubmission['answer'];
    variants?: string[];
  }[];
};
export type PreviewDiagnostic = {
  path: string;
  code: string;
  message: string;
  stage?: string;
  questionId?: string;
  elementId?: string;
};
export type SeedTestReport = {
  seed: number;
  passed: boolean;
  reproducible: boolean;
  publicProjectionSafe: boolean;
  diagnostics: PreviewDiagnostic[];
  checks: {
    questionId: string;
    label: string;
    expectedState: string;
    result: CorrectionResult;
    passed: boolean;
  }[];
};
export type PreviewTestReport = {
  definitionDigest: string;
  engineVersion: string;
  passed: boolean;
  complete: boolean;
  seeds: SeedTestReport[];
};
export const correctionLabels: Record<CorrectionResult['state'], string> = {
  correct: 'Correcte',
  incorrect: 'Incorrecte',
  invalid: 'Format invalide',
  indeterminate: 'Indéterminée',
  error: 'Erreur du moteur',
};
