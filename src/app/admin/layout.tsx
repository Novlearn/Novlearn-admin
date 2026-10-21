import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { AdminNavigation } from '@/components/admin-navigation';
import { readAuthConfiguration } from '@/lib/auth/config';
import { readLocalActivityConfiguration } from '@/lib/activity-config';
import { readLocalUsersConfiguration } from '@/lib/users-config';
import { LocalRecoveryNotice } from '@/components/local-recovery-notice';
import {
  EditorRecoveryScope,
  AdminLogout,
} from '@/components/editor-recovery-scope';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAdminPage();
  const authConfig = readAuthConfiguration(process.env);
  const local = authConfig?.local === true;
  const recoveryScope = `${authConfig?.supabaseUrl ?? 'disabled'}|${access.userId}`;
  return (
    <EditorRecoveryScope key={recoveryScope} scope={recoveryScope}>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Aller au contenu
        </a>
        <aside className="border-b border-slate-200 bg-white p-6 lg:border-b-0 lg:border-r">
          <Link
            href="/admin"
            className="inline-flex"
            aria-label="NovLearn Admin — vue d’ensemble"
          >
            <Brand />
          </Link>
          <AdminNavigation
            publicationEnabled={
              !!authConfig?.localPublicationFixture ||
              process.env.ADMIN_PUBLICATION_ENABLED === 'true'
            }
            statisticsEnabled={!!readLocalActivityConfiguration(process.env)}
            usersEnabled={!!readLocalUsersConfiguration(process.env)}
          />
          <p className="mt-10 text-xs leading-6 text-slate-500">
            {local
              ? 'Copie locale de Staging : vos modifications restent sur cet ordinateur.'
              : 'Créez, organisez et préparez vos contenus pédagogiques dans Staging.'}
          </p>
        </aside>
        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
            <span className="badge">
              {authConfig?.localPublicationFixture
                ? 'Banc de publication local · données synthétiques'
                : local
                  ? 'Local · données d’essai enregistrées'
                  : 'Staging · espace d’administration'}
            </span>
            <AdminLogout />
          </header>
          <main id="main-content" className="px-6 py-9 lg:px-10">
            <LocalRecoveryNotice
              local={local && !authConfig?.localPublicationFixture}
              date={process.env.ADMIN_LOCAL_RECOVERY_DATE}
            />
            {children}
          </main>
        </div>
      </div>
    </EditorRecoveryScope>
  );
}
