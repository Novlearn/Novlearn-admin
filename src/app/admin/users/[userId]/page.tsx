import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { readLocalUserDetailConfiguration } from '@/lib/user-detail-config';
import {
  detailUserId,
  readUserDetailQuery,
  type UserDetailPage,
} from '@/lib/user-detail';
import { loadLocalUserDetail } from '@/lib/user-detail-server';
import { UserDetailView } from '@/components/user-detail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const { userId } = await params;
  if (!detailUserId(userId)) notFound();
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      values.append(key, item);
  const filter = readUserDetailQuery(userId, values),
    fallback = readUserDetailQuery(userId, new URLSearchParams());
  if (!fallback.ok) throw Error('Période indisponible');
  const query = filter.ok ? filter.value : fallback.value;
  let data: UserDetailPage | null = null,
    error = filter.ok ? undefined : filter.error,
    missing = false;
  if (filter.ok) {
    if (!readLocalUserDetailConfiguration(process.env))
      error = 'Consultation détaillée locale non activée.';
    else
      try {
        data = await loadLocalUserDetail(query);
        missing = data === null;
      } catch {
        error = 'La fiche n’a pas pu être chargée. Réessayez dans un instant.';
      }
  }
  if (missing) notFound();
  return <UserDetailView data={data} query={query} error={error} />;
}
