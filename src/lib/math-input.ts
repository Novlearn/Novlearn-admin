import type { VirtualKeyboardLayout } from 'mathlive';

/** UI insertions only. No parsing, calculation, grading or validity verdict. */
export function scientificKeyboards(): VirtualKeyboardLayout[] {
  return [
    {
      id: 'novlearn-scientific',
      label: 'Scientifique',
      tooltip: 'Clavier scientifique',
      rows: [
        ['[7]', '[8]', '[9]', '[+]', '\\frac{#@}{#?}', '[backspace]'],
        ['[4]', '[5]', '[6]', '[-]', '\\sqrt{#?}', '#@^{#?}'],
        ['[1]', '[2]', '[3]', '\\times', '\\pi', '\\infty'],
        ['[0]', '[.]', 'x', '=', '[left]', '[right]'],
      ],
    },
    {
      id: 'novlearn-functions',
      label: 'Fonctions',
      tooltip: 'Fonctions, intervalles et ensembles',
      rows: [
        [
          '\\ln(#?)',
          '\\log(#?)',
          'e^{#?}',
          '\\sin(#?)',
          '\\cos(#?)',
          '\\tan(#?)',
        ],
        [
          {
            latex: '\\lbrack#?;#?\\rbrack',
            tooltip: 'Intervalles ; appui long pour changer les bornes',
            variants: [
              '\\rbrack#?;#?\\lbrack',
              '\\lbrack#?;#?\\lbrack',
              '\\rbrack#?;#?\\rbrack',
            ],
          },
          '\\lbrace#?;#?\\rbrace',
          '\\cup',
          '[(]',
          '[)]',
          '[hide-keyboard]',
        ],
      ],
    },
  ];
}

export interface MathfieldPort extends EventTarget {
  readOnly: boolean;
  disabled: boolean;
  getValue(format: 'latex'): string;
  setValue(
    value: string,
    options: { format: 'latex'; silenceNotifications: true },
  ): void;
}

/** Preserve the library's LaTeX, including placeholders and French decimals. */
export function bindMathInput(
  field: MathfieldPort,
  onChange: (latex: string) => void,
) {
  const input = () => {
    if (!field.disabled && !field.readOnly) onChange(field.getValue('latex'));
  };
  field.addEventListener('input', input);
  return () => field.removeEventListener('input', input);
}

/** Avoid moving the cursor or creating a callback loop after a controlled update. */
export function syncMathInput(field: MathfieldPort, value: string) {
  if (field.getValue('latex') !== value) {
    field.setValue(value, { format: 'latex', silenceNotifications: true });
  }
}
