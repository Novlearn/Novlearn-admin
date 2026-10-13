'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';
import {
  bindMathInput,
  scientificKeyboards,
  syncMathInput,
} from '@/lib/math-input';

type MathInputProps = {
  label: string;
  value: string;
  onChange: (latex: string) => void;
  id?: string;
  description?: string;
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
};

let library: Promise<typeof import('mathlive')> | undefined;
let keyboardOwner: MathfieldElement | null = null;

function loadMathLive() {
  library ??= import('mathlive').then((module) => {
    module.MathfieldElement.fontsDirectory = new URL(
      '/mathlive/fonts/',
      window.location.href,
    ).href;
    module.MathfieldElement.soundsDirectory = null;
    module.MathfieldElement.locale = 'fr';
    module.MathfieldElement.decimalSeparator = ',';
    return module;
  });
  return library;
}

export function MathInput(props: MathInputProps) {
  const generatedId = useId();
  const id = props.id ?? `${generatedId}-math`;
  const messageId = `${id}-message`;
  const latest = useRef(props);
  latest.current = props;
  const container = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let disposed = false;
    let detach = () => {};
    let element: MathfieldElement | undefined;
    void loadMathLive()
      .then(({ MathfieldElement }) => {
        if (disposed || !container.current) return;
        element = new MathfieldElement();
        element.id = id;
        element.setAttribute('aria-label', latest.current.label);
        element.mathVirtualKeyboardPolicy = 'manual';
        element.smartFence = false;
        const mounted = () => {
          if (disposed || !element) return;
          element.menuItems = [];
          setState('ready');
        };
        element.addEventListener('mount', mounted, { once: true });
        element.readOnly = !!latest.current.readOnly;
        element.disabled = !!latest.current.disabled;
        element.setValue(latest.current.value, {
          format: 'latex',
          silenceNotifications: true,
        });
        const detachInput = bindMathInput(element, (value) =>
          latest.current.onChange(value),
        );
        const focused = () => {
          keyboardOwner = element ?? null;
          if (!element?.disabled && !element?.readOnly) {
            window.mathVirtualKeyboard.layouts = [
              ...scientificKeyboards(),
              'alphabetic',
              'greek',
            ];
          }
        };
        element.addEventListener('focusin', focused);
        detach = () => {
          detachInput();
          element?.removeEventListener('focusin', focused);
          element?.removeEventListener('mount', mounted);
        };
        container.current.appendChild(element);
        field.current = element;
      })
      .catch(() => {
        if (!disposed) setState('failed');
      });
    return () => {
      disposed = true;
      detach();
      if (element && keyboardOwner === element) {
        window.mathVirtualKeyboard.hide();
        keyboardOwner = null;
      }
      element?.remove();
      field.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (!field.current || state !== 'ready') return;
    field.current.readOnly = !!props.readOnly;
    field.current.disabled = !!props.disabled;
    field.current.setAttribute('aria-label', props.label);
    field.current.setAttribute('aria-invalid', props.error ? 'true' : 'false');
    if (props.error || props.description)
      field.current.setAttribute('aria-describedby', messageId);
    else field.current.removeAttribute('aria-describedby');
    syncMathInput(field.current, props.value);
    if ((props.disabled || props.readOnly) && keyboardOwner === field.current) {
      window.mathVirtualKeyboard.hide();
    }
  }, [
    state,
    props.value,
    props.disabled,
    props.readOnly,
    props.label,
    props.error,
    props.description,
    messageId,
  ]);

  function openKeyboard() {
    if (!field.current || props.disabled || props.readOnly) return;
    field.current.focus();
    window.mathVirtualKeyboard.layouts = [
      ...scientificKeyboards(),
      'alphabetic',
      'greek',
    ];
    window.mathVirtualKeyboard.show();
  }

  return (
    <div className="math-input space-y-2">
      <label className="label" htmlFor={id}>
        {props.label}
      </label>
      <div ref={container} />
      {state !== 'ready' && (
        <textarea
          id={id}
          className="field"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          disabled={props.disabled}
          readOnly={props.readOnly}
          aria-invalid={!!props.error}
          aria-describedby={
            props.error || props.description ? messageId : undefined
          }
        />
      )}
      {state === 'loading' && (
        <p role="status" className="text-xs text-slate-500">
          Chargement du champ mathématique…
        </p>
      )}
      {state === 'failed' && (
        <p role="alert" className="text-sm text-amber-900">
          Le champ visuel est indisponible. Vous pouvez saisir le LaTeX dans la
          zone de texte.
        </p>
      )}
      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 disabled:text-slate-500"
        onClick={openKeyboard}
        disabled={state !== 'ready' || props.disabled || props.readOnly}
      >
        Afficher le clavier scientifique
      </button>
      {(props.error || props.description) && (
        <p
          id={messageId}
          role={props.error ? 'alert' : undefined}
          className={
            props.error ? 'text-sm text-red-700' : 'text-sm text-slate-500'
          }
        >
          {props.error ?? props.description}
        </p>
      )}
    </div>
  );
}
