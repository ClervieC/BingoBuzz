"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "./I18nProvider";
import { Icon } from "./Icon";

/**
 * Panneau qui monte du bas de l'écran (mobile) ; centré en modale sur grand écran.
 * Fermeture : bouton, fond, touche Échap, ou glisser vers le bas.
 * Le focus reste dans le panneau (Tab / Maj+Tab bouclent) puis revient à
 * l'élément d'origine à la fermeture.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // le portail n'existe que côté client : rien avant le montage (pas d'écart d'hydratation)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="animate-slide-up pb-safe relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
        onTouchStart={(e) => {
          dragStart.current = panelRef.current?.scrollTop === 0 ? e.touches[0].clientY : null;
        }}
        onTouchMove={(e) => {
          if (dragStart.current === null || !panelRef.current) return;
          const delta = e.touches[0].clientY - dragStart.current;
          panelRef.current.style.transform = delta > 0 ? `translateY(${delta}px)` : "";
        }}
        onTouchEnd={(e) => {
          if (dragStart.current === null || !panelRef.current) return;
          const delta = e.changedTouches[0].clientY - dragStart.current;
          panelRef.current.style.transform = "";
          dragStart.current = null;
          if (delta > 90) onClose();
        }}
      >
        <div className="sticky top-0 z-10 bg-surface px-5 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
          <div className="flex items-center gap-2 pb-2">
            {title && (
              <h2 id={titleId} className="min-w-0 flex-1 text-lg font-extrabold">
                {title}
              </h2>
            )}
            <button type="button" className="icon-btn -mr-2 ml-auto" onClick={onClose} aria-label={t("common.close")}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="px-5 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
