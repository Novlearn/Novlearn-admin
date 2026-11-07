'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import { newDraft, readSavedDraft } from '@/lib/catalogue';
import { CreatorFields } from './creator-fields';
import { bindEditorNavigation } from '@/lib/editor-navigation';
import { ExercisePreview } from './exercise-preview';
import { useCreatorRecovery } from './creator-recovery';
import { recoveryResource } from '@/lib/creator-recovery';
import { ExerciseReferenceFields } from './exercise-reference-fields';
import { elementTemplate } from '@/lib/creator';

type Props = {
  exerciseId?: string;
  versionId?: string;
  fingerprint?: string;
  testEpoch?: number;
  definition?: ExerciseDefinition;
  newRevision?: boolean;
  canRecordTests?: boolean;
  engineEnabled?: boolean;
};
export function DraftMetadataForm(props: Props) {
  const router = useRouter();
  const [definition, setDefinition] = useState(() => {
    if (props.definition) return props.definition;
    const starter = newDraft('');
    return {
      ...starter,
      elements: [
        elementTemplate('text', 'statement-1'),
        elementTemplate('question', 'question-1'),
      ],
    };
  });
  const [skills, setSkills] = useState(
    (props.definition?.catalogue?.skills ?? []).join(', '),
  );
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveredAsNewRevision, setRecoveredAsNewRevision] = useState(false);
  const newRevision = props.newRevision || recoveredAsNewRevision;
  const recoveryBase = useMemo(
    () => ({
      fingerprint: props.fingerprint ?? null,
      epoch: props.testEpoch ?? null,
    }),
    [props.fingerprint, props.testEpoch],
  );
  const recovery = useCreatorRecovery({
    resource: recoveryResource(
      props.exerciseId,
      props.versionId,
      props.newRevision,
    ),
    base: recoveryBase,
    definition,
    skills,
    dirty,
    createRevision: !!newRevision,
    onRestore(copy, changedBase) {
      setDefinition(copy.definition);
      setSkills(copy.skills);
      setRecoveredAsNewRevision(changedBase && !!props.exerciseId);
      dirtyRef.current = true;
      setDirty(true);
    },
  });
  const clean = (
    value: ExerciseDefinition,
    skillList: string,
  ): ExerciseDefinition => {
    const result = {
      ...value,
      catalogue: {
        ...value.catalogue,
        appTitle: value.title,
        skills: skillList
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
      },
    };
    if (!result.catalogue.chapter) delete result.catalogue.chapter;
    return result;
  };
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
    if (busy || recovery.awaitingChoice) return;
    setBusy(true);
    setMessage('');
    try {
      const cleaned: ExerciseDefinition = {
        ...definition,
        catalogue: {
          ...definition.catalogue,
          appTitle: definition.title,
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
          versionId: newRevision ? null : (props.versionId ?? null),
          fingerprint: newRevision ? null : (props.fingerprint ?? null),
          definition: cleaned,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? 'Sauvegarde impossible.');
        return;
      }
      const confirmed = readSavedDraft(data, {
        exerciseId: props.exerciseId,
        versionId: props.versionId,
        newRevision: !!newRevision,
      });
      if (!confirmed) {
        setMessage(
          'L’enregistrement n’a pas pu être confirmé. Votre saisie et sa copie de récupération restent conservées ; vérifiez le catalogue avant de réessayer.',
        );
        return;
      }
      dirtyRef.current = false;
      if (!recovery.saved())
        window.alert(
          'Le brouillon est enregistré, mais sa copie de récupération n’a pas pu être effacée. Fermez cet onglet après vos vérifications.',
        );
      setDirty(false);
      router.push(
        `/admin/exercises/${confirmed.exerciseId}?version=${confirmed.versionId}&saved=1`,
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
    <form onSubmit={save} className="space-y-7">
      {recovery.panel}
      {recoveredAsNewRevision && (
        <p role="status" className="notice">
          Votre saisie sera enregistrée dans une nouvelle révision. La version
          actuelle reste conservée.
        </p>
      )}
      <section
        className="editor-section space-y-5"
        aria-labelledby="metadata-heading"
      >
        <div>
          <h2 id="metadata-heading" className="text-xl font-semibold">
            📋 Informations générales
          </h2>
        </div>
        <fieldset
          disabled={busy || recovery.awaitingChoice}
          className="space-y-5"
        >
          <label className="label rounded-xl border border-slate-200 bg-slate-50 p-4 md:max-w-2xl">
            NOM DE L’EXERCICE
            <input
              className="field"
              placeholder="Ex. : Logarithme_Bac"
              required
              maxLength={160}
              value={definition.title}
              onChange={(event) => {
                const title = event.target.value;
                setDefinition({
                  ...definition,
                  title,
                  catalogue: { ...catalogue, appTitle: title },
                });
                setDirty(true);
              }}
            />
            <span className="text-xs font-normal text-slate-500">
              Ce titre sert aussi de nom dans l’application.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 font-semibold transition-colors ${catalogue.exerciseType === 'flash' ? 'border-amber-400 bg-amber-100 text-amber-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-amber-50'}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={catalogue.exerciseType === 'flash'}
                onChange={(event) =>
                  patch({
                    exerciseType: event.target.checked ? 'flash' : 'classic',
                  })
                }
              />
              <span className="rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600">
                <span aria-hidden="true">⚡</span> Flash Exos
                {catalogue.exerciseType === 'flash' && (
                  <span className="ml-2" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
            </label>
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 font-semibold transition-colors ${catalogue.needsCalculator ? 'border-emerald-400 bg-emerald-100 text-emerald-950' : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={catalogue.needsCalculator ?? false}
                onChange={(event) =>
                  patch({ needsCalculator: event.target.checked })
                }
              />
              <span className="rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600">
                <span aria-hidden="true">▦</span> Calculatrice
                {catalogue.needsCalculator && (
                  <span className="ml-2" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
            </label>
          </div>
          <ExerciseReferenceFields
            disabled={busy || recovery.awaitingChoice}
            chapter={catalogue.chapter ?? ''}
            difficulty={catalogue.difficulty}
            skills={skills
              .split(',')
              .map((skill) => skill.trim())
              .filter(Boolean)}
            onChapter={(chapter) => patch({ chapter })}
            onDifficulty={(difficulty) => patch({ difficulty })}
            onSkills={(ids) => {
              setSkills(ids.join(', '));
              setDirty(true);
            }}
          />
        </fieldset>
      </section>
      <fieldset disabled={busy || recovery.awaitingChoice}>
        <CreatorFields
          definition={definition}
          disabled={busy || recovery.awaitingChoice}
          onChange={(next) => {
            setDefinition(next);
            setDirty(true);
          }}
        />
      </fieldset>
      <ExercisePreview
        engineEnabled={props.engineEnabled}
        canRecordTests={props.canRecordTests}
        definition={clean(definition, skills)}
        disabled={busy || recovery.awaitingChoice}
        saved={
          !dirty &&
          !newRevision &&
          props.versionId &&
          props.fingerprint &&
          typeof props.testEpoch === 'number'
            ? {
                id: props.versionId,
                fingerprint: props.fingerprint,
                epoch: props.testEpoch,
              }
            : undefined
        }
      />
      <div className="editor-save flex flex-wrap items-center gap-4">
        <button
          className="button"
          type="submit"
          disabled={busy || recovery.awaitingChoice}
        >
          {busy
            ? 'Enregistrement…'
            : newRevision
              ? 'Créer une nouvelle révision'
              : 'Enregistrer le brouillon'}
        </button>
        <span className="text-sm text-slate-500">
          {dirty ? 'Modifications non enregistrées' : 'Brouillon Préproduction'}
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
