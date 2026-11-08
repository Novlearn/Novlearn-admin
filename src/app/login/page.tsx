import Link from 'next/link';
import { Brand } from '@/components/brand';
import { readAuthConfiguration } from '@/lib/auth/config';
import { LoginForm } from './login-form';
import { readProductionApiConfiguration } from '@/lib/production-api-config';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  session: 'Votre session a expiré. Connectez-vous à nouveau.',
  invalid: 'Vérifiez votre adresse e-mail et votre mot de passe.',
  credentials: 'Connexion refusée. Vérifiez vos identifiants.',
  forbidden: 'Ce compte ne dispose pas des droits administrateur.',
  unavailable:
    'Le service de connexion est indisponible. Réessayez dans quelques instants.',
  'production-credentials':
    'Connexion Production refusée. Utilisez les mêmes identifiants pour vos deux comptes administrateur.',
  'production-forbidden':
    'Ce compte ne dispose pas des droits administrateur en Production.',
  'production-unavailable':
    'La connexion à Production est indisponible. Réessayez dans quelques instants.',
  'production-invalid':
    'Vérifiez les identifiants de vos comptes administrateur.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const authConfig = readAuthConfiguration(process.env);
  const enabled = authConfig !== null;
  const local = authConfig?.local === true;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-blue-100 bg-[#F0F7FF] p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
        <Link
          href="/login"
          aria-label="NovLearn Admin — connexion"
          className="w-fit rounded-lg"
        >
          <span className="lg:hidden">
            <Brand />
          </span>
          <span className="hidden lg:block">
            <Brand signature />
          </span>
        </Link>
        <div className="my-12 hidden max-w-lg lg:block">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
            Espace pédagogique
          </p>
          <p className="font-brand text-4xl font-medium leading-tight text-slate-900 xl:text-5xl">
            Le contenu de demain commence ici.
          </p>
          <p className="mt-6 text-base leading-8 text-slate-600">
            Créez, testez et préparez les exercices NovLearn dans un espace
            réservé aux administrateurs.
          </p>
        </div>
        <p className="mt-4 text-xs text-slate-500 lg:mt-0 lg:text-sm">
          Environnement de travail{' '}
          <span className="font-semibold text-brand-700">
            {local ? 'Local · données d’essai' : 'Préproduction'}
          </span>
        </p>
      </section>
      <section
        aria-labelledby="login-title"
        className="flex items-center justify-center px-6 py-14 sm:px-12"
      >
        <div className="w-full max-w-md">
          <span className="badge">
            {local
              ? 'Supabase local · données d’essai'
              : 'Base de préproduction'}
          </span>
          <h1
            id="login-title"
            className="mt-6 text-3xl font-semibold tracking-tight"
          >
            Connexion à l’Admin
          </h1>
          <p className="mb-8 mt-3 text-slate-600">
            {readProductionApiConfiguration(process.env)
              ? 'Utilisez vos identifiants administrateur autorisés en Préproduction et en Production.'
              : 'Utilisez votre compte administrateur autorisé.'}
          </p>
          {!enabled ? (
            <div role="status" className="notice mb-6">
              <p className="font-semibold">
                Configuration de connexion incomplète
              </p>
              <p className="mt-2">
                La connexion n’est pas encore configurée sur ce serveur.
                Contactez l’administrateur du site.
              </p>
            </div>
          ) : error && error !== 'disabled' && messages[error] ? (
            <p role="alert" className="notice mb-6">
              {messages[error]}
            </p>
          ) : null}
          <LoginForm enabled={enabled} />
          {!enabled && process.env.NODE_ENV === 'development' && (
            <aside className="card mt-6" aria-labelledby="preview-title">
              <h2 id="preview-title" className="font-semibold">
                Tester les écrans dès maintenant
              </h2>
              <p className="mb-4 mt-2 text-sm leading-6 text-slate-600">
                L’aperçu local utilise des exemples fictifs, sans compte ni
                sauvegarde en base. Les calculs nécessitent le moteur local.
              </p>
              <a className="button inline-flex" href="http://127.0.0.1:3140/">
                Ouvrir l’aperçu local
              </a>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Si le lien ne répond pas, l’aperçu doit être démarré sur cet
                ordinateur. Il est distinct de l’application avec connexion.
              </p>
            </aside>
          )}
          {local && (
            <p className="notice mt-6">
              Espace d’essai local. Les modifications sont enregistrées
              uniquement dans la base de test de cet ordinateur.
            </p>
          )}
          <p className="mt-6 text-sm leading-6 text-slate-500">
            L’attribution d’un accès administrateur est assurée par l’opérateur
            NovLearn.
          </p>
        </div>
      </section>
    </main>
  );
}
