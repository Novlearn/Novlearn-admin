export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section
        aria-labelledby="welcome-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12"
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">
          NovLearn
        </p>
        <h1
          id="welcome-title"
          className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
        >
          NovLearn Admin est initialisé
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          Le socle technique et la documentation sont en place. Aucune
          fonctionnalité métier n’est encore implémentée.
        </p>
        <p className="mt-8 border-t border-slate-100 pt-5 text-sm text-slate-500">
          Le cahier des charges de référence est à la racine du dépôt ; la
          documentation est dans <code>docs/</code>.
        </p>
      </section>
    </main>
  );
}
