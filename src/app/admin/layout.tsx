import Link from 'next/link';
import { Brand } from '@/components/brand';
import { requireAdminPage } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();
  return (
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
        <nav aria-label="Navigation principale" className="mt-8">
          <Link
            className="block rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
            href="/admin"
          >
            Vue d’ensemble
          </Link>
        </nav>
        <p className="mt-10 text-xs leading-6 text-slate-500">
          Les rubriques du catalogue seront ouvertes après validation de leurs
          prérequis.
        </p>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 lg:px-10">
          <span className="badge">Staging · espace d’administration</span>
          <form action="/auth/logout" method="post">
            <button
              className="text-sm font-medium text-slate-600 hover:text-blue-700"
              type="submit"
            >
              Se déconnecter
            </button>
          </form>
        </header>
        <main id="main-content" className="px-6 py-9 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
