'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavigation({
  statisticsEnabled = false,
  usersEnabled = false,
  publicationEnabled = true,
}: {
  statisticsEnabled?: boolean;
  usersEnabled?: boolean;
  publicationEnabled?: boolean;
}) {
  const path = usePathname();
  const groups = [
    {
      label: 'Espace de travail',
      links: [
        ['/admin', 'Vue d’ensemble'],
        ['/admin/exercises', 'Exercices'],
        ['/admin/flashcards', 'Flashcards'],
      ],
    },
    {
      label: 'Contenus',
      links: [
        ['/admin/chapters', 'Chapitres'],
        ['/admin/competences', 'Compétences'],
      ],
    },
    {
      label: 'Suivi',
      links: [
        ...(publicationEnabled ? [['/admin/publication', 'Publications']] : []),
        ...(statisticsEnabled ? [['/admin/statistics', 'Statistiques']] : []),
        ...(usersEnabled ? [['/admin/users', 'Utilisateurs']] : []),
      ],
    },
  ];
  return (
    <nav
      aria-label="Navigation principale"
      className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:mt-8 lg:block lg:space-y-6 lg:overflow-visible lg:pb-0"
    >
      {groups
        .filter((group) => group.links.length > 0)
        .map((group) => (
          <div
            key={group.label}
            className="flex shrink-0 gap-1 lg:block lg:space-y-1"
          >
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:block">
              {group.label}
            </p>
            {group.links.map(([href, label]) => {
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
                  className={`block whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors lg:px-4 ${active ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
    </nav>
  );
}
