'use client';
import { createContext, useContext, useEffect } from 'react';
import { clearRecoveries, recoveryEndEvent } from '@/lib/creator-recovery';
import { requestEditorLeave } from '@/lib/editor-navigation';

const RecoveryScope = createContext<string | null>(null);
export const useEditorRecoveryScope = () => useContext(RecoveryScope);
export function EditorRecoveryScope({
  scope,
  children,
}: {
  scope: string;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    try {
      clearRecoveries(window.sessionStorage, scope);
    } catch {
      /* Storage may be blocked by the browser. */
    }
  }, [scope]);
  return (
    <RecoveryScope.Provider value={scope}>{children}</RecoveryScope.Provider>
  );
}
export function AdminLogout({
  buttonClassName = 'text-sm font-medium text-slate-600 hover:text-blue-700',
}: { buttonClassName?: string } = {}) {
  return (
    <form
      action="/auth/logout"
      method="post"
      onSubmit={(event) => {
        if (!requestEditorLeave()) {
          event.preventDefault();
          return;
        }
        // Stop pagehide writers before clearing, so logout cannot recreate a copy.
        window.dispatchEvent(new Event(recoveryEndEvent));
        let cleared = false;
        try {
          cleared = clearRecoveries(window.sessionStorage);
        } catch {
          /* A disabled store must not prevent logout. */
        }
        if (!cleared)
          window.alert(
            'Les copies de récupération n’ont pas pu être effacées. Fermez cet onglet après la déconnexion.',
          );
      }}
    >
      <button className={buttonClassName} type="submit">
        Se déconnecter
      </button>
    </form>
  );
}
