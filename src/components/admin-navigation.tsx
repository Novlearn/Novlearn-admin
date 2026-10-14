'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavigation() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="mt-8 space-y-1">
      {[
        ['/admin', 'Vue d’ensemble'],
        ['/admin/exercises', 'Exercices'],
        ['/admin/exercises/new', 'Créer un exercice'],
      ].map(([href, label]) => {
        const active =
          path === href ||
          (href === '/admin/exercises' &&
            path.startsWith(href + '/') &&
            path !== '/admin/exercises/new');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`block rounded-lg px-4 py-3 text-sm font-semibold ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
