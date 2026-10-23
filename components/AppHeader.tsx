import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Barre supérieure collante, compatible encoche (safe-area-inset-top).
 * `back` : lien de retour ; `actions` : boutons à droite.
 */
export function AppHeader({
  title,
  back,
  backLabel,
  actions,
}: {
  title?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur-md">
      <div className="page flex h-14 items-center gap-1">
        {back ? (
          <Link href={back} className="icon-btn -ml-2" aria-label={backLabel}>
            <Icon name="back" />
          </Link>
        ) : (
          <Link href="/" className="-ml-1 flex items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-lg text-accent-fg">
              B
            </span>
            <span className="text-lg">BingoBuzz</span>
          </Link>
        )}
        {title && <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h1>}
        {!title && <div className="flex-1" />}
        {actions && <div className="-mr-2 flex items-center">{actions}</div>}
      </div>
    </header>
  );
}
