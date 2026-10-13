import { describe, expect, it, vi } from 'vitest';
import {
  bindMathInput,
  syncMathInput,
  type MathfieldPort,
} from '@/lib/math-input';

class Field extends EventTarget implements MathfieldPort {
  readOnly = false;
  disabled = false;
  value = '';
  getValue = vi.fn(() => this.value);
  setValue = vi.fn((value: string) => {
    this.value = value;
  });
}

describe('liaison LaTeX du champ', () => {
  it.each([
    '\\frac{1}{2}',
    '1{,}25',
    '\\rbrack0;1\\lbrack',
    '2^{\\placeholder{}}',
  ])('conserve la sortie %s sans décider de sa validité', (source) => {
    const field = new Field();
    const change = vi.fn();
    const detach = bindMathInput(field, change);
    field.value = source;
    field.dispatchEvent(new Event('input'));
    expect(change).toHaveBeenCalledWith(source);
    expect(field.getValue).toHaveBeenCalledWith('latex');
    detach();
    field.dispatchEvent(new Event('input'));
    expect(change).toHaveBeenCalledTimes(1);
  });
  it.each(['readOnly', 'disabled'] as const)(
    'ignore input quand %s est actif',
    (property) => {
      const field = new Field();
      field[property] = true;
      const change = vi.fn();
      bindMathInput(field, change);
      field.dispatchEvent(new Event('input'));
      expect(change).not.toHaveBeenCalled();
    },
  );
  it('ne déplace pas le curseur lorsque la valeur contrôlée est déjà présente', () => {
    const field = new Field();
    field.value = 'x';
    syncMathInput(field, 'x');
    expect(field.setValue).not.toHaveBeenCalled();
    syncMathInput(field, 'x^{2}');
    expect(field.setValue).toHaveBeenCalledWith('x^{2}', {
      format: 'latex',
      silenceNotifications: true,
    });
  });
});
