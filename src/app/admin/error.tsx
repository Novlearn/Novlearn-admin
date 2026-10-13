'use client';

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="card">
      <h1 className="text-2xl font-semibold">L’espace est indisponible</h1>
      <p className="my-4 text-slate-600">Réessayez dans quelques instants.</p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}
