"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useFitText } from "@/hooks/useFitText";
import { useLongPress } from "@/hooks/useLongPress";
import { frenchSpacing } from "@/lib/phrases";
import type { Cell } from "@/types/bingo";
import { useT } from "./I18nProvider";

interface BingoCellProps {
  cell: Cell;
  index: number;
  checked: boolean;
  winning: boolean;
  /** proposée, en attente de confirmation (mode « peer ») */
  pending?: boolean;
  readOnly: boolean;
  onToggle?: (index: number) => void;
  onLongPress?: (index: number) => void;
}

export const BingoCell = memo(function BingoCell({
  cell,
  index,
  checked,
  winning,
  pending = false,
  readOnly,
  onToggle,
  onLongPress,
}: BingoCellProps) {
  const t = useT();
  const label = cell.free ? t("grid.free") : frenchSpacing(cell.text);
  const { boxRef, textRef } = useFitText<HTMLDivElement, HTMLDivElement>(label, {
    min: 9,
    max: cell.free ? 18 : 22,
  });

  // n'animer que les changements, pas l'état initial
  const [justChanged, setJustChanged] = useState(false);
  const previous = useRef(checked);
  useEffect(() => {
    if (previous.current === checked) return;
    previous.current = checked;
    setJustChanged(true);
    const id = window.setTimeout(() => setJustChanged(false), 300);
    return () => window.clearTimeout(id);
  }, [checked]);

  const handlers = useLongPress({
    onTap: readOnly || cell.free ? undefined : () => onToggle?.(index),
    onLongPress: cell.free || !onLongPress ? undefined : () => onLongPress(index),
  });

  const state = checked ? t("grid.cell.checked") : t("grid.cell.unchecked");

  return (
    <button
      type="button"
      {...handlers}
      aria-pressed={cell.free ? undefined : checked}
      aria-label={`${label}, ${state}`}
      aria-disabled={readOnly || cell.free ? true : undefined}
      className={[
        "bingo-cell relative min-h-[44px] min-w-[44px] overflow-hidden rounded-xl border text-center font-semibold leading-[1.15]",
        "transition-colors duration-150",
        cell.free
          ? "border-transparent bg-accent text-accent-fg"
          : checked
            ? "border-accent/50 bg-accent-soft text-fg"
            : pending
              ? "border-2 border-dashed border-accent bg-surface text-fg"
              : "border-border bg-surface text-fg shadow-sm shadow-violet-900/5 active:bg-surface-2",
        winning ? "animate-win border-gold" : "",
        justChanged ? "animate-pop" : "",
        readOnly ? "cursor-default" : "",
      ].join(" ")}
    >
      {checked && !cell.free && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 m-auto aspect-square w-[78%] rounded-full border-[3px] border-accent/45 bg-accent/10 ${justChanged ? "animate-stamp" : "-rotate-6"}`}
        />
      )}
      {pending && !checked && (
        <span aria-hidden className="absolute top-0.5 right-0.5 animate-pulse text-[11px] leading-none">
          ⏳
        </span>
      )}
      <div ref={boxRef} className="absolute inset-[5px] flex items-center justify-center">
        <div ref={textRef} lang="fr" className="bingo-cell-text relative w-full">
          {cell.free ? `★ ${label}` : label}
        </div>
      </div>
    </button>
  );
});
