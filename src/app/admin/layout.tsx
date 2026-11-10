import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { AdminNavigation } from '@/components/admin-navigation';
import { readAuthConfiguration } from '@/lib/auth/config';
import { readActivityConfiguration } from '@/lib/activity-config';
import { readUsersConfiguration } from '@/lib/users-config';
import { readProductionApiConfiguration } from '@/lib/production-api-config';
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
      <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Aller au contenu
        </a>
        <aside className="flex flex-col border-b border-sky-100 bg-sky-50 p-6 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
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
            statisticsEnabled={!!readActivityConfiguration(process.env)}
            usersEnabled={!!readUsersConfiguration(process.env)}
            feedbackEnabled={!!readProductionApiConfiguration(process.env)}
          />
          <div className="mt-6 border-t border-sky-200 pt-4 lg:mt-auto">
            <AdminLogout buttonClassName="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-white/80 hover:text-blue-700" />
          </div>
        </aside>
        <div className="min-w-0">
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
