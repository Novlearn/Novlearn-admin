import { requireAdminPage } from '@/lib/auth/require-admin';
import { readUsersConfiguration } from '@/lib/users-config';
import { readUsersQuery, type UsersPage } from '@/lib/users';
import { loadUsers } from '@/lib/users-server';
import { UsersListView } from '@/components/users-list';
import { readUserDetailConfiguration } from '@/lib/user-detail-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const config = readUsersConfiguration(process.env);
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
    if (!config) error = 'Consultation des utilisateurs non configurée.';
    else
      try {
        data = await loadUsers(query);
      } catch {
        error = 'La liste n’a pas pu être chargée. Réessayez dans un instant.';
      }
  }
  return (
    <UsersListView
      data={data}
      query={query}
      error={error}
      environment={config?.environment ?? 'production'}
      detailsEnabled={!!readUserDetailConfiguration(process.env)}
    />
  );
}
