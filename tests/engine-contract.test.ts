import { describe, expect, it } from 'vitest';
import { validateDefinition } from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';

describe('brouillons et validation officielle Engine', () => {
  it('conserve explicitement un brouillon incomplet sans fabriquer un résultat validé', () => {
    const result = validateDefinition(newDraft('Brouillon incomplet'));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Incomplete draft must not be accepted');
    expect(result.diagnostics).toEqual([
      {
        path: '/elements',
        code: 'value',
        message: 'At least one element is required.',
      },
    ]);
  });
  it('transmet un bloc canonique au validateur officiel sans adaptation mathématique', () => {
    const draft = newDraft('Définition de test');
    draft.elements = [
      { id: 'statement', type: 'text', text: 'Énoncé de test' },
    ];
    expect(validateDefinition(draft).ok).toBe(true);
    expect(validateDefinition({ ...draft, schemaVersion: 4 }).ok).toBe(false);
  });
});
