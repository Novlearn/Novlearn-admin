import { requireAdminPage } from '@/lib/auth/require-admin';

export default async function AdminHome() {
  await requireAdminPage();
  return (
    <>
      <p className="text-sm font-medium text-slate-500">Administration</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Vue d’ensemble
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Votre espace de travail pédagogique NovLearn.
      </p>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="card" aria-labelledby="catalog-title">
          <span className="badge">Staging</span>
          <h2 id="catalog-title" className="mt-5 text-xl font-semibold">
            Catalogue pédagogique
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Le catalogue versionné attend son schéma validé. Les indicateurs
            seront disponibles après l’ouverture de la gestion des exercices.
          </p>
        </section>
        <section className="card" aria-labelledby="production-title">
          <span className="badge bg-slate-100 text-slate-600">Production</span>
          <h2 id="production-title" className="mt-5 text-xl font-semibold">
            Activité NovLearn
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            La consultation des statistiques attend un accès de lecture
            restreint approuvé. Aucune donnée de Production n’est chargée.
          </p>
        </section>
      </div>
    </>
  );
}
