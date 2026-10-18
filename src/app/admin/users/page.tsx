import { requireAdminPage } from '@/lib/auth/require-admin';
import { readLocalUsersConfiguration } from '@/lib/users-config';
import { readUsersQuery, type UsersPage } from '@/lib/users';
import { loadLocalUsers } from '@/lib/users-server';
import { UsersListView } from '@/components/users-list';
import { readLocalUserDetailConfiguration } from '@/lib/user-detail-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  const filter = readUsersQuery(params);
  const fallback = readUsersQuery(new URLSearchParams());
  if (!fallback.ok) throw Error('Période indisponible');
  const query = filter.ok ? filter.value : fallback.value;
  let error = filter.ok ? undefined : filter.error;
  let data: UsersPage | null = null;
  if (filter.ok) {
    if (!readLocalUsersConfiguration(process.env))
      error = 'Consultation locale des utilisateurs non activée.';
    else
      try {
        data = await loadLocalUsers(query);
      } catch {
        error = 'La liste n’a pas pu être chargée. Réessayez dans un instant.';
      }
  }
  return (
    <UsersListView
      data={data}
      query={query}
      error={error}
      detailsEnabled={!!readLocalUserDetailConfiguration(process.env)}
    />
  );
}
