"use client";

import { useEffect, type ReactNode } from "react";
import { fireConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import type { LineKind } from "@/lib/bingo";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "./I18nProvider";

export type VictoryKind = "row" | "column" | "diagonal" | "full";

export function victoryKindFromLine(kind: LineKind): VictoryKind {
  return kind === "antiDiagonal" ? "diagonal" : kind;
}

const TITLES: Record<VictoryKind, MessageKey> = {
  row: "victory.row",
  column: "victory.column",
  diagonal: "victory.diagonal",
  full: "victory.full",
};

/** Écran de victoire plein écran avec confettis et vibration. */
export function VictoryOverlay({
  kind,
  onClose,
  children,
}: {
  kind: VictoryKind | null;
  onClose: () => void;
  /** actions supplémentaires (partage, export…) */
  children?: ReactNode;
}) {
  const t = useT();

  useEffect(() => {
    if (!kind) return;
    haptics.bingo();
    void fireConfetti(kind === "full" ? "full" : "bingo");
  }, [kind]);

  if (!kind) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="victory-title"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-6xl" aria-hidden>
          {kind === "full" ? "🏆" : "🎉"}
        </p>
        <h2 id="victory-title" className="mt-3 text-4xl font-black tracking-tight text-accent">
          {kind === "full" ? t("victory.full") : t("victory.bingo")}
        </h2>
        {kind !== "full" && <p className="mt-1 text-lg font-semibold text-muted">{t(TITLES[kind])}</p>}
        <div className="mt-6 flex flex-col gap-3">
          {children}
          <button type="button" className="btn btn-primary w-full" onClick={onClose} autoFocus>
            {t("victory.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
