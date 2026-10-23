"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cellsToBingo, countChecked, detectBingo } from "@/lib/bingo";
import { haptics } from "@/lib/haptics";
import { buildGrid, initialChecked, randomSeed } from "@/lib/random";
import { readJson, storageKeys, writeJson } from "@/lib/storage";
import type { BoardWithPhrases, Cell } from "@/types/bingo";
import { victoryKindFromLine, type VictoryKind } from "@/components/Victory";

interface SavedSolo {
  v: 1;
  seed: number;
  checked: boolean[];
  /** empreinte du bingo : si elle change (phrases modifiées), on retire une grille */
  fingerprint: string;
  /** nombre de lignes déjà fêtées, pour ne pas relancer les confettis au rafraîchissement */
  celebratedLines: number;
  celebratedFull: boolean;
}

function fingerprint(board: BoardWithPhrases): string {
  const source = `${board.grid_size}|${board.free_center}|${board.phrases.map((p) => `${p.id}:${p.text}`).join("|")}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function fresh(board: BoardWithPhrases, fp: string): SavedSolo {
  const seed = randomSeed();
  const grid = buildGrid(board.phrases, board.grid_size, board.free_center, seed);
  return { v: 1, seed, checked: initialChecked(grid), fingerprint: fp, celebratedLines: 0, celebratedFull: false };
}

export function useSoloGame(board: BoardWithPhrases) {
  const key = storageKeys.solo(board.id);
  const fp = useMemo(() => fingerprint(board), [board]);
  const [state, setState] = useState<SavedSolo | null>(null);
  const [victory, setVictory] = useState<VictoryKind | null>(null);
  const [gridChanged, setGridChanged] = useState(false);

  // Chargement côté client uniquement (pas de localStorage au rendu serveur)
  useEffect(() => {
    const saved = readJson<SavedSolo>(key);
    const valid =
      saved?.v === 1 &&
      saved.fingerprint === fp &&
      Array.isArray(saved.checked) &&
      saved.checked.length === board.grid_size * board.grid_size;
    if (valid) {
      setState(saved);
    } else {
      if (saved) setGridChanged(true);
      setState(fresh(board, fp));
    }
  }, [key, fp, board]);

  useEffect(() => {
    if (state) writeJson(key, state);
  }, [key, state]);

  const seed = state?.seed;
  const grid: Cell[] = useMemo(
    () => (seed ? buildGrid(board.phrases, board.grid_size, board.free_center, seed) : []),
    [board, seed],
  );

  const result = useMemo(
    () => (state ? detectBingo(state.checked, board.grid_size) : null),
    [state, board.grid_size],
  );

  const toggle = useCallback(
    (index: number) => {
      if (!state || grid[index]?.free) return;
      const checked = state.checked.slice();
      checked[index] = !checked[index];
      if (checked[index]) haptics.tap();
      else haptics.untap();

      const next = detectBingo(checked, board.grid_size);
      let { celebratedLines, celebratedFull } = state;

      if (next.isFullCard && !celebratedFull) {
        celebratedFull = true;
        celebratedLines = next.lines.length;
        setVictory("full");
      } else if (next.lines.length > celebratedLines) {
        // la ligne nouvellement complétée contient forcément la case touchée
        const line = next.lines.find((l) => l.cells.includes(index)) ?? next.lines[0];
        celebratedLines = next.lines.length;
        setVictory(victoryKindFromLine(line.kind));
      } else {
        celebratedLines = Math.min(celebratedLines, next.lines.length);
        if (!next.isFullCard) celebratedFull = false;
      }

      setState({ ...state, checked, celebratedLines, celebratedFull });
    },
    [state, grid, board.grid_size],
  );

  const reset = useCallback(() => {
    setState((prev) => (prev ? { ...prev, checked: initialChecked(grid), celebratedLines: 0, celebratedFull: false } : prev));
  }, [grid]);

  const newGrid = useCallback(() => {
    setState(fresh(board, fp));
  }, [board, fp]);

  return {
    ready: state !== null,
    grid,
    checked: state?.checked ?? [],
    result,
    count: state ? countChecked(state.checked) : 0,
    missing: state ? cellsToBingo(state.checked, board.grid_size) : board.grid_size,
    toggle,
    reset,
    newGrid,
    victory,
    closeVictory: () => setVictory(null),
    gridChanged,
    dismissGridChanged: () => setGridChanged(false),
  };
}
