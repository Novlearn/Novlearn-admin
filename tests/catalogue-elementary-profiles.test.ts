import { expect, it } from 'vitest';
import { validateDefinition } from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';
import {
  responseKinds,
  policyDomains,
  changeQuestionKind,
} from '@/lib/creator';
it.each(['geometric-expression', 'elementary-positive'] as const)(
  'edits the shared Engine profile %s in existing canonical fields',
  (kind) => {
    expect(responseKinds).toContain(kind);
    expect(policyDomains).toContain(kind);
    const definition = newDraft('Profil commun');
    definition.variables = [{ name: 'x', domain: 'real' }];
    const question = changeQuestionKind(
      {
        id: 'q',
        type: 'question',
        text: 'Calculer',
        points: 1,
        response: { format: 'latex', kind: 'rational' },
        policy: { domain: 'rational', form: 'value-only' },
        expectedLatex: '1',
      },
      kind,
    );
    if (question.response.format !== 'latex')
      throw Error('Expected mathematical input');
    question.response.variable = 'x';
    if (!('expectedLatex' in question))
      throw Error('Expected native mathematical source');
    question.expectedLatex =
      kind === 'geometric-expression' ? '3\\cdot2^x' : '1/\\sqrt{x}';
    definition.elements = [question];
    expect(validateDefinition(definition).ok).toBe(true);
  },
);
