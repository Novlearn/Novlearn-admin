import Link from 'next/link';
export default function UserNotFound() {
  return (
    <section className="card">
      <h1 className="text-2xl font-semibold">Utilisateur introuvable</h1>
      <p className="mt-3 text-sm text-slate-600">
        Ce compte n’est pas disponible dans la source consultée.
      </p>
      <Link
        href="/admin/users"
        prefetch={false}
        className="mt-5 inline-block font-semibold text-blue-700"
      >
        Retour aux utilisateurs
      </Link>
    </section>
  );
}
