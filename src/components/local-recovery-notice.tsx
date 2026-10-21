/** Local operator notice only; no account, credential or backup path reaches the UI. */
export function LocalRecoveryNotice({
  local,
  date,
}: {
  local: boolean;
  date?: string;
}) {
  if (!local || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return null;
  const label = parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  return (
    <aside
      role="status"
      aria-label="État des données locales"
      className="mb-6 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950"
    >
      <p className="font-semibold">
        Copie locale restaurée depuis la sauvegarde du {label}.
      </p>
      <p className="text-sm leading-6">
        Certaines données d’essai plus récentes manquent. Les sauvegardes
        disponibles restent conservées.
      </p>
    </aside>
  );
}
