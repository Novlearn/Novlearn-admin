import { requireAdminPage } from '@/lib/auth/require-admin';
import { loadProductionFeedbacks } from '@/lib/feedbacks-server';
import { readFeedbackQuery } from '@/lib/feedbacks';
import { FeedbacksManager } from '@/components/feedbacks-manager';
import { productionAuthConfiguration } from '@/lib/production-api-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function FeedbackPage({
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
  const query = readFeedbackQuery(params) ?? {
    categories: [],
    status: 'all' as const,
    sort: 'newest' as const,
    exerciseId: null,
    page: 1,
  };
  let data = null;
  let error: string | undefined;
  if (!productionAuthConfiguration(process.env)) {
    error = 'La lecture Production des feedbacks n’est pas configurée.';
  } else {
    try {
      data = await loadProductionFeedbacks(query);
    } catch {
      error =
        'Impossible de charger les feedbacks Production. Vérifiez votre accès Production.';
    }
  }
  return (
    <FeedbacksManager
      data={data}
      query={query}
      error={error}
      reviewEnabled={process.env.ADMIN_FEEDBACK_REVIEW_ENABLED === 'true'}
    />
  );
}
