"use client";

import { useT } from "./I18nProvider";

/**
 * Aperçu flouté d'une grille, pour qui ouvre un lien d'invitation sans être
 * connecté : donne envie, sans révéler les phrases (non lisibles sans compte).
 */
export function GridTeaser({ size, freeCenter = true }: { size: number; freeCenter?: boolean }) {
  const t = useT();
  const total = size * size;
  const center = freeCenter && size % 2 === 1 ? (total - 1) / 2 : -1;
  // quelques cases « cochées » pour l'effet, toujours les mêmes
  const checked = new Set([1, size + 2, 2 * size, total - 2].filter((i) => i < total && i !== center));

  return (
    <div className="relative">
      <div
        aria-hidden
        className="bingo-board mx-auto grid aspect-square w-full max-w-[340px] gap-1.5 blur-[3px] select-none"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            data-state={i === center ? "free" : checked.has(i) ? "checked" : "idle"}
            className={`bingo-cell flex flex-col items-center justify-center gap-1 rounded-xl border p-1.5 ${
              i === center ? "border-transparent bg-accent" : checked.has(i) ? "border-accent/50 bg-accent-soft" : "border-border bg-surface"
            }`}
          >
            {i !== center && (
              <>
                <span className="h-1.5 w-4/5 rounded-full bg-fg/25" />
                <span className="h-1.5 w-3/5 rounded-full bg-fg/20" />
              </>
            )}
          </span>
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <p className="animate-bounce-in rounded-full bg-surface/95 px-4 py-2 text-sm font-black shadow-lg">
          🔒 {t("teaser.locked")}
        </p>
      </div>
    </div>
  );
}
