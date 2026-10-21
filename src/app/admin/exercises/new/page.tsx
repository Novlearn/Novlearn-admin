import Link from 'next/link';
import { DraftMetadataForm } from '@/components/draft-metadata-form';
import { requireAdminPage } from '@/lib/auth/require-admin';
import { readTestSigningConfiguration } from '@/lib/test-receipt';
import { isEngineEnabled } from '@/lib/engine-identity';

export default async function NewExercisePage() {
  await requireAdminPage();
  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/exercises"
        className="text-sm font-medium text-blue-700"
      >
        ← Catalogue
      </Link>
      <p className="mt-7 text-sm text-slate-500">Staging · nouveau brouillon</p>
      <h1 className="mb-8 mt-2 text-3xl font-semibold tracking-tight">
        Créer un exercice
      </h1>
      <DraftMetadataForm
        engineEnabled={isEngineEnabled(process.env)}
        canRecordTests={!!readTestSigningConfiguration(process.env)}
      />
    </div>
  );
}
