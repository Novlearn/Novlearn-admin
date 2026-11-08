import Link from 'next/link';
import {
  decodeUsersPage,
  usersHref,
  type UsersPage,
  type UsersQuery,
} from '@/lib/users';
import { formatCount, overviewDate } from '@/lib/dashboard';
import { userDetailHref } from '@/lib/user-detail';
import type { ReadEnvironment } from '@/lib/production-read-config';

export function UsersListView({
  data,
  query,
  error,
  detailsEnabled = false,
  environment = 'local-copy',
}: {
  data: UsersPage | null;
  query: UsersQuery;
  error?: string;
  detailsEnabled?: boolean;
  environment?: ReadEnvironment;
}) {
  const current = decodeUsersPage(data, query, undefined, environment);
  const attempts = (count: string) =>
    `${formatCount(count)} tentative${count === '1' ? '' : 's'}`;
  return (
    <div className="space-y-7">
      <header>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Utilisateurs
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Nom, e-mail du compte et tentatives enregistrées sur la période
          choisie. 
        </p>
      </header>
      <form
        method="get"
        action="/admin/users"
        className="card flex flex-wrap items-end gap-4"
      >
        <label className="label min-w-56 flex-1">
          Nom ou e-mail
          <input
            className="field"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query.query}
            placeholder="Rechercher un compte"
          />
        </label>
        <label className="label">
          Début (UTC)
          <input
            className="field"
            name="from"
            type="date"
            required
            defaultValue={query.period.from}
          />
        </label>
        <label className="label">
          Fin incluse (UTC)
          <input
            className="field"
            name="to"
            type="date"
            required
            defaultValue={query.period.to}
          />
        </label>
        <button className="button" type="submit">
          Rechercher
        </button>
        <p className="w-full text-sm text-slate-500">
          90 jours au maximum. L’activité compte les tentatives d’exercice et de
          duel datées, sans déduire l’activité des seules connexions.
        </p>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!current ? (
        <section className="card" role="status">
          <h2 className="font-semibold">Utilisateurs indisponibles</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aucune liste vérifiée n’a pu être chargée.
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-3 text-sm text-slate-600">
            <p>
              {formatCount(current.total)} comptes correspondent à la recherche.
            </p>
            <p>Relevé du {overviewDate(current.asOf)}</p>
          </div>
          {current.items.length === 0 ? (
            <section className="card" role="status">
              <h2 className="font-semibold">
                {current.total === '0'
                  ? 'Aucun compte ne correspond à la recherche.'
                  : 'Cette page ne contient plus de résultat.'}
              </h2>
              <Link
                className="mt-3 inline-block font-semibold text-blue-700"
                href={usersHref({ ...query, after: null, before: null })}
                prefetch={false}
              >
                Revenir au début de la liste
              </Link>
            </section>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-4 text-left font-semibold">
                  Comptes et activité sur la période UTC
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th scope="col" className="px-3 py-3">
                      Nom
                    </th>
                    <th scope="col" className="px-3 py-3">
                      E-mail
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Activité
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <th
                        scope="row"
                        className="max-w-xs break-words px-3 py-4 font-semibold"
                      >
                        {detailsEnabled ? (
                          <Link
                            prefetch={false}
                            className="text-blue-700 hover:underline"
                            href={userDetailHref({
                              userId: user.id,
                              period: query.period,
                              view: 'history',
                              after: null,
                              before: null,
                            })}
                          >
                            {user.name}
                          </Link>
                        ) : (
                          user.name
                        )}
                        {user.nameTruncated && (
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            Nom abrégé
                          </span>
                        )}
                      </th>
                      <td className="max-w-xs break-all px-3 py-4 text-slate-600">
                        {user.email ?? '—'}
                      </td>
                      <td className="px-3 py-4">
                        <p>
                          {attempts(user.exerciseAttempts)} d’exercice ·{' '}
                          {attempts(user.duelAttempts)} de duel
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.lastActivity
                            ? 'Dernière tentative : ' +
                              overviewDate(user.lastActivity)
                            : 'Aucune tentative datée sur cette période.'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {current.items.some((user) => user.nameTruncated) && (
                <p className="mt-4 text-xs text-slate-500">
                  Les noms de plus de 200 caractères sont abrégés.
                </p>
              )}
            </div>
          )}
          <nav
            className="flex flex-wrap items-center gap-4"
            aria-label="Pagination des utilisateurs"
          >
            {current.previous ? (
              <Link
                className="font-semibold text-blue-700"
                href={usersHref(query, { before: current.previous })}
                prefetch={false}
              >
                Précédent
              </Link>
            ) : (
              <span className="text-sm text-slate-400" aria-disabled="true">
                Précédent
              </span>
            )}
            {current.next ? (
              <Link
                className="font-semibold text-blue-700"
                href={usersHref(query, { after: current.next })}
                prefetch={false}
              >
                Suivant
              </Link>
            ) : (
              <span className="text-sm text-slate-400" aria-disabled="true">
                Suivant
              </span>
            )}
            <span className="text-sm text-slate-500">
              25 comptes au maximum par page.
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
