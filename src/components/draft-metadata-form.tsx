'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';
import { CreatorFields } from './creator-fields';
import { bindEditorNavigation } from '@/lib/editor-navigation';

type Props = {
  exerciseId?: string;
  versionId?: string;
  fingerprint?: string;
  definition?: ExerciseDefinition;
  newRevision?: boolean;
};
export function DraftMetadataForm(props: Props) {
  const router = useRouter();
  const [definition, setDefinition] = useState(
    props.definition ?? newDraft(''),
  );
  const [skills, setSkills] = useState(
    (props.definition?.catalogue?.skills ?? []).join(', '),
  );
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    diagnostics: { path: string; code: string; message: string }[];
  } | null>(null);
  const latest = useRef({ definition, skills });
  latest.current = { definition, skills };
  useEffect(() => {
    setValidation(null);
  }, [definition, skills]);
  const clean = (
    value: ExerciseDefinition,
    skillList: string,
  ): ExerciseDefinition => {
    const result = {
      ...value,
      catalogue: {
        ...value.catalogue,
        skills: skillList
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      },
    };
    if (!result.catalogue.chapter) delete result.catalogue.chapter;
    return result;
  };
  async function validate() {
    setValidating(true);
    setMessage('');
    const source = JSON.stringify(clean(definition, skills));
    try {
      const response = await fetch('/api/admin/engine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ definition: JSON.parse(source) }),
      });
      const result = await response.json();
      if (
        source !==
        JSON.stringify(clean(latest.current.definition, latest.current.skills))
      )
        return;
      if (!response.ok) {
        setMessage(result.error ?? 'Validation indisponible.');
        return;
      }
      setValidation({
        valid: result.valid,
        diagnostics: result.diagnostics ?? [],
      });
    } catch {
      setMessage('Validation indisponible. Votre saisie reste conservée.');
    } finally {
      setValidating(false);
    }
  }
  useEffect(() => bindEditorNavigation(() => dirtyRef.current), []);
  const catalogue = definition.catalogue ?? {};
  const patch = (
    fields: Partial<NonNullable<ExerciseDefinition['catalogue']>>,
  ) => {
    setDefinition({ ...definition, catalogue: { ...catalogue, ...fields } });
    setDirty(true);
  };
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const cleaned: ExerciseDefinition = {
        ...definition,
        catalogue: {
          ...definition.catalogue,
          skills: skills
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean),
        },
      };
      if (!cleaned.catalogue?.chapter) delete cleaned.catalogue?.chapter;
      const response = await fetch('/api/admin/exercises', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          exerciseId: props.exerciseId ?? null,
          versionId: props.newRevision ? null : (props.versionId ?? null),
          fingerprint: props.newRevision ? null : (props.fingerprint ?? null),
          definition: cleaned,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? 'Sauvegarde impossible.');
        return;
      }
      dirtyRef.current = false;
      setDirty(false);
      router.push(
        `/admin/exercises/${data.result.exerciseId}?version=${data.result.versionId}&saved=1`,
      );
      router.refresh();
    } catch {
      setMessage(
        'Connexion interrompue. Votre brouillon reste dans ce formulaire.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="card space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          Creator · informations générales
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enregistrez un brouillon pour préparer votre exercice. Les versions
          publiées sont conservées.
        </p>
      </div>
      <fieldset disabled={busy} className="grid gap-5 md:grid-cols-2">
        <label className="label md:col-span-2">
          Titre administratif
          <input
            className="field"
            required
            maxLength={160}
            value={definition.title}
            onChange={(event) => {
              setDefinition({ ...definition, title: event.target.value });
              setDirty(true);
            }}
          />
        </label>
        <label className="label">
          Titre dans l’application
          <input
            className="field"
            maxLength={160}
            value={catalogue.appTitle ?? ''}
            onChange={(event) => patch({ appTitle: event.target.value })}
          />
        </label>
        <label className="label">
          Chapitre
          <input
            className="field"
            maxLength={160}
            value={catalogue.chapter ?? ''}
            onChange={(event) => patch({ chapter: event.target.value })}
          />
        </label>
        <label className="label">
          Difficulté
          <input
            type="number"
            min={1}
            step={1}
            className="field"
            value={catalogue.difficulty ?? ''}
            onChange={(event) =>
              patch({
                difficulty: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              })
            }
            placeholder="Niveau"
          />
        </label>
        <label className="label">
          Format
          <select
            className="field"
            value={catalogue.exerciseType ?? 'classic'}
            onChange={(event) =>
              patch({ exerciseType: event.target.value as 'classic' | 'flash' })
            }
          >
            <option value="classic">Classique</option>
            <option value="flash">Flash</option>
          </select>
        </label>
        <label className="label md:col-span-2">
          Compétences{' '}
          <span className="font-normal text-slate-500">
            (séparées par une virgule)
          </span>
          <input
            className="field"
            maxLength={2000}
            value={skills}
            onChange={(event) => {
              setSkills(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={catalogue.needsCalculator ?? false}
            onChange={(event) =>
              patch({ needsCalculator: event.target.checked })
            }
          />{' '}
          Calculatrice nécessaire
        </label>
      </fieldset>
      <fieldset disabled={busy}>
        <CreatorFields
          definition={definition}
          disabled={busy}
          onChange={(next) => {
            setDefinition(next);
            setDirty(true);
          }}
        />
      </fieldset>
      <section
        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
        aria-labelledby="validation-heading"
      >
        <h2 id="validation-heading" className="text-lg font-semibold">
          Validation officielle Engine
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Vérifiez la structure canonique avant les tests et la relecture. Cette
          vérification n’approuve ni ne publie votre brouillon.
        </p>
        <button
          type="button"
          className="button mt-4"
          disabled={busy || validating}
          onClick={validate}
        >
          {validating ? 'Validation…' : 'Vérifier la définition'}
        </button>
        {validation && (
          <div className="mt-4" role="status">
            {validation.valid ? (
              <p className="text-sm font-medium text-green-700">
                Structure canonique correcte. L’exercice reste à tester et à
                relire.
              </p>
            ) : (
              <ul className="space-y-3 text-sm text-red-800">
                {validation.diagnostics.map((diagnostic, index) => (
                  <li key={index}>
                    <p className="font-mono text-xs text-slate-500">
                      {diagnostic.path || 'Définition'} · {diagnostic.code}
                    </p>
                    <p className="mt-1">{diagnostic.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <div className="flex flex-wrap items-center gap-4">
        <button className="button" type="submit" disabled={busy}>
          {busy
            ? 'Enregistrement…'
            : props.newRevision
              ? 'Créer une nouvelle révision'
              : 'Enregistrer le brouillon'}
        </button>
        <span className="text-sm text-slate-500">
          {dirty ? 'Modifications non enregistrées' : 'Brouillon Staging'}
        </span>
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {message}
        </p>
      )}
    </form>
  );
}
