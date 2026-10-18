'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExerciseDefinition } from 'novlearn-exercise-engine';
import {
  readRecovery,
  writeRecovery,
  removeRecovery,
  recoveryBaseChanged,
  recoveryEndEvent,
  type RecoveryBase,
  type RecoveryCopy,
} from '@/lib/creator-recovery';
import { useEditorRecoveryScope } from './editor-recovery-scope';

export function useCreatorRecovery({
  resource,
  base,
  definition,
  skills,
  dirty,
  createRevision,
  onRestore,
}: {
  resource: string;
  base: RecoveryBase;
  definition: ExerciseDefinition;
  skills: string;
  dirty: boolean;
  createRevision: boolean;
  onRestore(copy: RecoveryCopy, changedBase: boolean): void;
}) {
  const scope = useEditorRecoveryScope();
  const identity = JSON.stringify([scope, resource]);
  const [loadedFor, setLoadedFor] = useState('');
  const [pending, setPending] = useState<RecoveryCopy | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState('');
  const [unreadableCopy, setUnreadableCopy] = useState(false);
  const saved = useRef(false);
  useEffect(() => {
    setEnabled(false);
    setPending(null);
    setUnreadableCopy(false);
    saved.current = false;
    if (!scope) return;
    try {
      const result = readRecovery(window.sessionStorage, scope, resource);
      if (result.state === 'ready') setPending(result.copy);
      setUnreadableCopy(
        result.state === 'expired' || result.state === 'invalid',
      );
      setNotice(
        result.state === 'expired'
          ? 'L’ancienne copie a dépassé les 30 minutes de récupération. Elle n’est pas restaurée.'
          : result.state === 'invalid' || result.state === 'unavailable'
            ? 'La copie de récupération est illisible ou le stockage de cet onglet est indisponible.'
            : '',
      );
    } catch {
      setNotice('Le navigateur ne permet pas la récupération dans cet onglet.');
    }
    setLoadedFor(identity);
  }, [scope, resource, identity]);
  useEffect(() => {
    const end = () => {
      saved.current = true;
      setEnabled(false);
      setPending(null);
      setUnreadableCopy(false);
      setNotice('La récupération est désactivée pour la déconnexion.');
    };
    window.addEventListener(recoveryEndEvent, end);
    return () => window.removeEventListener(recoveryEndEvent, end);
  }, []);
  useEffect(() => {
    if (!scope || !enabled || !dirty || pending || loadedFor !== identity)
      return;
    const persist = () => {
      if (saved.current) return;
      let ok = false;
      try {
        ok = writeRecovery(window.sessionStorage, scope, {
          schema: 1,
          resource,
          base,
          createRevision,
          updatedAt: Date.now(),
          definition,
          skills,
        });
      } catch {
        /* SecurityError is an ordinary unavailable-storage state. */
      }
      setNotice(
        ok
          ? 'Copie de récupération à jour dans cet onglet.'
          : 'Copie non actualisée : stockage indisponible, saturé ou contenu trop volumineux. Votre saisie reste dans le formulaire.',
      );
    };
    persist();
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, [
    scope,
    enabled,
    dirty,
    pending,
    loadedFor,
    identity,
    resource,
    base,
    createRevision,
    definition,
    skills,
  ]);
  const remove = () => {
    if (!scope) return true;
    try {
      return removeRecovery(window.sessionStorage, scope, resource);
    } catch {
      return false;
    }
  };
  const discard = () => {
    setEnabled(false);
    if (!remove()) {
      setNotice(
        'L’ancienne copie n’a pas pu être effacée. Fermez cet onglet si vous souhaitez abandonner sa récupération.',
      );
      return;
    }
    setPending(null);
    setUnreadableCopy(false);
    setNotice(
      'Copie de récupération effacée ; le contenu du formulaire est conservé.',
    );
  };
  const changedBase = pending ? recoveryBaseChanged(pending, base) : false;
  const createsRevision = changedBase || !!pending?.createRevision;
  return {
    awaitingChoice:
      scope !== null && (loadedFor !== identity || pending !== null),
    saved: () => {
      saved.current = true;
      setEnabled(false);
      remove();
    },
    panel: scope ? (
      <section
        className="rounded-xl border border-blue-100 bg-blue-50 p-5"
        aria-label="Récupération de la saisie"
      >
        <h3 className="font-semibold">Récupération de la saisie</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sur votre choix, une copie contenant aussi les réponses attendues
          reste dans le stockage de cet onglet. Elle est récupérable pendant 30
          minutes après sa dernière actualisation et peut survivre à une
          restauration de l’onglet par le navigateur. Elle ne remplace pas
          l’enregistrement du brouillon. La déconnexion efface les copies de cet
          onglet.
        </p>
        {pending ? (
          <div className="mt-4 space-y-3">
            <p role="status" className="text-sm font-medium">
              Une saisie non enregistrée peut être récupérée pour cet exercice.
              {changedBase &&
                ' La version de référence a changé : la récupération préparera une nouvelle révision, sans écraser la version actuelle.'}
              {!changedBase &&
                pending.createRevision &&
                ' Cette copie prépare une nouvelle révision ; la version actuelle reste conservée.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="button"
                onClick={() => {
                  // Recheck expiry when the person chooses, rather than trusting mount time.
                  try {
                    const fresh = readRecovery(
                      window.sessionStorage,
                      scope,
                      resource,
                    );
                    if (fresh.state !== 'ready') {
                      setPending(null);
                      setNotice(
                        'Cette copie n’est plus récupérable. Le formulaire actuel est conservé.',
                      );
                      return;
                    }
                    onRestore(
                      fresh.copy,
                      recoveryBaseChanged(fresh.copy, base) ||
                        fresh.copy.createRevision,
                    );
                    saved.current = false;
                    setPending(null);
                    setEnabled(true);
                  } catch {
                    setNotice(
                      'La copie n’est pas accessible ; aucune saisie n’a été remplacée.',
                    );
                  }
                }}
              >
                {createsRevision
                  ? 'Récupérer dans une nouvelle révision'
                  : 'Récupérer ma saisie'}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-slate-600 underline"
                onClick={discard}
              >
                Abandonner cette copie
              </button>
            </div>
          </div>
        ) : (
          <label className="mt-4 flex items-start gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-blue-600"
              checked={enabled}
              disabled={loadedFor !== identity}
              onChange={(event) => {
                if (event.target.checked) {
                  saved.current = false;
                  setEnabled(true);
                  setNotice(
                    'Récupération activée pour les modifications de ce formulaire.',
                  );
                } else discard();
              }}
            />
            Conserver une copie de récupération dans cet onglet
          </label>
        )}
        {unreadableCopy && (
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-slate-600 underline"
            onClick={discard}
          >
            Effacer l’ancienne copie de cet exercice
          </button>
        )}
        {notice && (
          <p className="mt-3 text-sm leading-6 text-slate-600" role="status">
            {notice}
          </p>
        )}
      </section>
    ) : null,
  };
}
