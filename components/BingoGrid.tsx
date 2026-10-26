"use client";

import { useCallback, useMemo, useState } from "react";
import { detectBingo, sizeFromLength } from "@/lib/bingo";
import type { Cell } from "@/types/bingo";
import { BingoCell } from "./BingoCell";
import { BottomSheet } from "./BottomSheet";
import { useT } from "./I18nProvider";

/**
 * Grille carrée pleine largeur. Tap = cocher ; appui long = phrase entière.
 * `highlightWins` : les cases des lignes gagnantes pulsent.
 */
export function BingoGrid({
  grid,
  checked,
  onToggle,
  readOnly = false,
  highlightWins = true,
  compact = false,
  pending,
}: {
  grid: Cell[];
  checked: boolean[];
  onToggle?: (index: number) => void;
  readOnly?: boolean;
  highlightWins?: boolean;
  /** grille d'aperçu (pas de contrainte de hauteur d'écran) */
  compact?: boolean;
  /** index des cases proposées en attente de confirmation (mode « peer ») */
  pending?: ReadonlySet<number>;
}) {
  const t = useT();
  const size = sizeFromLength(grid.length);
  const [detail, setDetail] = useState<number | null>(null);

  const winning = useMemo(
    () => (highlightWins ? detectBingo(checked, size).winningCells : new Set<number>()),
    [checked, size, highlightWins],
  );

  const openDetail = useCallback((index: number) => setDetail(index), []);
  const detailCell = detail !== null ? grid[detail] : null;

  return (
    <>
      <div
        role="group"
        aria-label={t("grid.label", { size })}
        className="mx-auto grid aspect-square gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          // pleine largeur sur mobile, mais toujours visible en entier en hauteur
          width: compact ? "100%" : "min(100%, max(300px, calc(100dvh - 230px)))",
        }}
      >
        {grid.map((cell, i) => (
          <BingoCell
            key={cell.id ?? `free-${i}`}
            cell={cell}
            index={i}
            checked={Boolean(checked[i])}
            winning={winning.has(i)}
            pending={pending?.has(i)}
            readOnly={readOnly}
            onToggle={onToggle}
            onLongPress={openDetail}
          />
        ))}
      </div>

      <BottomSheet open={detailCell !== null} onClose={() => setDetail(null)} title={t("grid.fullText")}>
        {detailCell && detail !== null && (
          <div className="space-y-5">
            <p className="text-2xl leading-snug font-bold">
              {detailCell.text}
            </p>
            {!readOnly && onToggle && !detailCell.free && (
              <button
                type="button"
                className={`btn w-full ${checked[detail] ? "btn-ghost" : "btn-primary"}`}
                onClick={() => {
                  onToggle(detail);
                  setDetail(null);
                }}
              >
                {checked[detail] ? t("grid.toggle.uncheck") : t("grid.toggle.check")}
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
