import Link from 'next/link';
import { AdminLogout } from '@/components/editor-recovery-scope';

export default function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <span className="badge w-fit">Accès réservé</span>
      <h1 className="mt-6 text-3xl font-semibold">
        Accès administrateur requis
      </h1>
      <p className="mt-4 leading-7 text-slate-600">
        Votre compte ne dispose pas des droits nécessaires. Contactez
        l’opérateur NovLearn pour demander un accès.
      </p>
      <div className="mt-8">
        <AdminLogout buttonClassName="button" />
      </div>
      <Link className="mt-5 text-sm text-blue-700 underline" href="/login">
        Retour à la connexion
      </Link>
    </main>
  );
}
