'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { newDraft } from '@/lib/catalogue';

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const leave = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      )
        return;
      if (
        !window.confirm(
          'Quitter cette page et perdre les modifications non enregistrées ?',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', leave, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', leave, true);
    };
  }, [dirty]);
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
        <h2 className="text-xl font-semibold">Informations générales</h2>
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
