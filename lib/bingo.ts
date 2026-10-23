/**
 * Détection de bingo pour une grille N×N.
 *
 * Fonctions pures : aucune dépendance au DOM ni à Supabase.
 * Les cases sont indexées ligne par ligne : index = ligne * N + colonne.
 *
 * Miroir SQL (autoritaire en partie de groupe) : public.bb_has_bingo
 * dans supabase/migrations/20261023000002_game_logic.sql.
 */

export type LineKind = "row" | "column" | "diagonal" | "antiDiagonal";

export interface Line {
  kind: LineKind;
  /** numéro de ligne/colonne ; 0 pour les diagonales */
  index: number;
  cells: number[];
}

export interface BingoResult {
  /** au moins une ligne complète */
  hasBingo: boolean;
  /** toutes les cases cochées */
  isFullCard: boolean;
  /** lignes complètes (lignes, colonnes, diagonales) */
  lines: Line[];
  /** index des cases appartenant à une ligne gagnante */
  winningCells: Set<number>;
}

const linesCache = new Map<number, Line[]>();

function assertSize(size: number): void {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`Taille de grille invalide : ${size}`);
  }
}

function assertGrid(checked: readonly boolean[], size: number): void {
  assertSize(size);
  if (checked.length !== size * size) {
    throw new RangeError(
      `La grille doit contenir ${size * size} cases (reçu ${checked.length})`,
    );
  }
}

/** Toutes les lignes gagnantes possibles d'une grille N×N : N lignes, N colonnes, 2 diagonales. */
export function getLines(size: number): Line[] {
  assertSize(size);
  const cached = linesCache.get(size);
  if (cached) return cached;

  const lines: Line[] = [];
  const range = Array.from({ length: size }, (_, i) => i);

  for (const r of range) {
    lines.push({ kind: "row", index: r, cells: range.map((c) => r * size + c) });
  }
  for (const c of range) {
    lines.push({ kind: "column", index: c, cells: range.map((r) => r * size + c) });
  }
  lines.push({ kind: "diagonal", index: 0, cells: range.map((i) => i * size + i) });
  lines.push({
    kind: "antiDiagonal",
    index: 0,
    cells: range.map((i) => i * size + (size - 1 - i)),
  });

  linesCache.set(size, lines);
  return lines;
}

export function detectBingo(checked: readonly boolean[], size: number): BingoResult {
  assertGrid(checked, size);

  const lines = getLines(size).filter((line) => line.cells.every((i) => checked[i]));
  const winningCells = new Set<number>();
  for (const line of lines) for (const i of line.cells) winningCells.add(i);

  return {
    hasBingo: lines.length > 0,
    isFullCard: checked.every(Boolean),
    lines,
    winningCells,
  };
}

export function hasBingo(checked: readonly boolean[], size: number): boolean {
  assertGrid(checked, size);
  return getLines(size).some((line) => line.cells.every((i) => checked[i]));
}

/**
 * Nombre minimal de cases à cocher pour compléter une ligne.
 * 0 = bingo, 1 = « plus qu'une case ! ».
 */
export function cellsToBingo(checked: readonly boolean[], size: number): number {
  assertGrid(checked, size);
  let best = size;
  for (const line of getLines(size)) {
    let missing = 0;
    for (const i of line.cells) if (!checked[i]) missing++;
    if (missing < best) best = missing;
    if (best === 0) break;
  }
  return best;
}

/** Nombre de cases cochées. */
export function countChecked(checked: readonly boolean[]): number {
  let n = 0;
  for (const c of checked) if (c) n++;
  return n;
}

/** Taille N d'une grille à partir de son nombre de cases (doit être un carré parfait). */
export function sizeFromLength(length: number): number {
  const size = Math.round(Math.sqrt(length));
  if (size < 1 || size * size !== length) {
    throw new RangeError(`${length} cases ne forment pas une grille carrée`);
  }
  return size;
}
