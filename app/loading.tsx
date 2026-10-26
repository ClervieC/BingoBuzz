/** Retour visuel immédiat pendant le rendu serveur d'une page (navigation). */
export default function Loading() {
  return (
    <div className="page pt-safe space-y-4 py-6" aria-busy="true">
      <div className="h-8 w-1/2 animate-pulse rounded-xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
