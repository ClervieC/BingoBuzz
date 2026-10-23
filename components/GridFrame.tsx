import { forwardRef, type ReactNode } from "react";
import { themeStyle } from "@/lib/themes";
import type { BoardTheme } from "@/types/bingo";

/**
 * Cadre autour d'une grille : titre + emoji en haut, marque en bas.
 * C'est ce nœud qui est capturé pour l'export en image.
 */
export const GridFrame = forwardRef<
  HTMLDivElement,
  { title: string; theme: BoardTheme; subtitle?: ReactNode; children: ReactNode }
>(function GridFrame({ title, theme, subtitle, children }, ref) {
  return (
    <div ref={ref} className="themed rounded-3xl bg-bg py-3" style={themeStyle(theme)}>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl"
        >
          {theme.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl leading-tight font-extrabold">{title}</h1>
          {subtitle && <div className="text-sm font-semibold text-muted">{subtitle}</div>}
        </div>
      </div>
      {children}
      <p className="mt-3 text-center text-xs font-bold tracking-wide text-muted">BingoBuzz</p>
    </div>
  );
});
