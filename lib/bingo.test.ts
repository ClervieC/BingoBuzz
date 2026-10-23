import { describe, expect, it } from "vitest";
import {
  cellsToBingo,
  countChecked,
  detectBingo,
  getLines,
  hasBingo,
  sizeFromLength,
} from "./bingo";

/** Construit une grille à partir d'un dessin : "x" = cochée, "." = vide. */
function grid(...rows: string[]): { checked: boolean[]; size: number } {
  const size = rows.length;
  const checked = rows.flatMap((row) => {
    const cells = row.replace(/\s+/g, "").split("");
    if (cells.length !== size) throw new Error(`ligne invalide : ${row}`);
    return cells.map((c) => c === "x");
  });
  return { checked, size };
}

function empty(size: number): boolean[] {
  return Array(size * size).fill(false);
}

describe("getLines", () => {
  it.each([3, 4, 5])("génère 2N + 2 lignes pour N=%i", (size) => {
    const lines = getLines(size);
    expect(lines).toHaveLength(2 * size + 2);
    for (const line of lines) expect(line.cells).toHaveLength(size);
  });

  it("couvre chaque case exactement une fois par les lignes et par les colonnes", () => {
    const lines = getLines(4);
    const rows = lines.filter((l) => l.kind === "row").flatMap((l) => l.cells);
    const cols = lines.filter((l) => l.kind === "column").flatMap((l) => l.cells);
    expect([...rows].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    expect([...cols].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });

  it("calcule les diagonales d'une 3×3", () => {
    const lines = getLines(3);
    expect(lines.find((l) => l.kind === "diagonal")?.cells).toEqual([0, 4, 8]);
    expect(lines.find((l) => l.kind === "antiDiagonal")?.cells).toEqual([2, 4, 6]);
  });

  it("rejette une taille invalide", () => {
    expect(() => getLines(0)).toThrow(RangeError);
    expect(() => getLines(2.5)).toThrow(RangeError);
  });
});

describe("detectBingo", () => {
  it.each([3, 4, 5])("grille vide N=%i : pas de bingo", (size) => {
    const result = detectBingo(empty(size), size);
    expect(result.hasBingo).toBe(false);
    expect(result.isFullCard).toBe(false);
    expect(result.lines).toEqual([]);
    expect(result.winningCells.size).toBe(0);
  });

  it.each([3, 4, 5])("détecte chaque ligne pour N=%i", (size) => {
    for (let r = 0; r < size; r++) {
      const checked = empty(size);
      for (let c = 0; c < size; c++) checked[r * size + c] = true;
      const result = detectBingo(checked, size);
      expect(result.hasBingo).toBe(true);
      expect(result.lines).toEqual([expect.objectContaining({ kind: "row", index: r })]);
    }
  });

  it.each([3, 4, 5])("détecte chaque colonne pour N=%i", (size) => {
    for (let c = 0; c < size; c++) {
      const checked = empty(size);
      for (let r = 0; r < size; r++) checked[r * size + c] = true;
      const result = detectBingo(checked, size);
      expect(result.hasBingo).toBe(true);
      expect(result.lines).toEqual([expect.objectContaining({ kind: "column", index: c })]);
    }
  });

  it.each([3, 4, 5])("détecte la diagonale principale pour N=%i", (size) => {
    const checked = empty(size);
    for (let i = 0; i < size; i++) checked[i * size + i] = true;
    expect(detectBingo(checked, size).lines.map((l) => l.kind)).toEqual(["diagonal"]);
  });

  it.each([3, 4, 5])("détecte l'anti-diagonale pour N=%i", (size) => {
    const checked = empty(size);
    for (let i = 0; i < size; i++) checked[i * size + (size - 1 - i)] = true;
    expect(detectBingo(checked, size).lines.map((l) => l.kind)).toEqual(["antiDiagonal"]);
  });

  it("une ligne incomplète n'est pas un bingo", () => {
    const { checked, size } = grid(
      "x x x x .",
      ". . . . .",
      "x . . . .",
      "x . . . .",
      "x . . . .",
    );
    expect(detectBingo(checked, size).hasBingo).toBe(false);
  });

  it("des cases dispersées sans ligne ne font pas bingo", () => {
    const { checked, size } = grid(
      "x . x .",
      ". x . x",
      "x . x .",
      ". x . .",
    );
    expect(hasBingo(checked, size)).toBe(false);
  });

  it("détecte plusieurs lignes simultanées et leurs cases gagnantes", () => {
    const { checked, size } = grid(
      "x x x",
      "x . .",
      "x . .",
    );
    const result = detectBingo(checked, size);
    expect(result.lines.map((l) => `${l.kind}:${l.index}`).sort()).toEqual(["column:0", "row:0"]);
    expect([...result.winningCells].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 6]);
  });

  it("le croisement des deux diagonales (case centrale partagée)", () => {
    const { checked, size } = grid(
      "x . . . x",
      ". x . x .",
      ". . x . .",
      ". x . x .",
      "x . . . x",
    );
    const result = detectBingo(checked, size);
    expect(result.lines.map((l) => l.kind).sort()).toEqual(["antiDiagonal", "diagonal"]);
    expect(result.winningCells.size).toBe(9);
  });

  it.each([3, 4, 5])("carton plein N=%i : toutes les lignes", (size) => {
    const result = detectBingo(Array(size * size).fill(true), size);
    expect(result.isFullCard).toBe(true);
    expect(result.lines).toHaveLength(2 * size + 2);
    expect(result.winningCells.size).toBe(size * size);
  });

  it("rejette une grille de mauvaise longueur", () => {
    expect(() => detectBingo(Array(8).fill(false), 3)).toThrow(RangeError);
    expect(() => hasBingo(Array(26).fill(false), 5)).toThrow(RangeError);
  });

  it("hasBingo est cohérent avec detectBingo", () => {
    // tirage pseudo-aléatoire déterministe de 200 grilles
    let state = 42;
    const next = () => (state = (state * 48271) % 2147483647);
    for (let n = 0; n < 200; n++) {
      const size = 3 + (n % 3);
      const checked = Array.from({ length: size * size }, () => next() % 3 !== 0);
      expect(hasBingo(checked, size)).toBe(detectBingo(checked, size).hasBingo);
    }
  });
});

describe("cellsToBingo", () => {
  it("vaut N sur une grille vide", () => {
    expect(cellsToBingo(empty(4), 4)).toBe(4);
  });

  it("vaut 1 quand il ne manque qu'une case", () => {
    const { checked, size } = grid(
      "x x . x",
      ". . . .",
      ". . . .",
      ". . . .",
    );
    expect(cellsToBingo(checked, size)).toBe(1);
  });

  it("vaut 1 pour une diagonale presque complète", () => {
    const { checked, size } = grid(
      "x . . . .",
      ". x . . .",
      ". . x . .",
      ". . . x .",
      ". . . . .",
    );
    expect(cellsToBingo(checked, size)).toBe(1);
  });

  it("vaut 0 en cas de bingo", () => {
    const { checked, size } = grid(
      ". . x",
      ". . x",
      ". . x",
    );
    expect(cellsToBingo(checked, size)).toBe(0);
  });
});

describe("utilitaires", () => {
  it("countChecked", () => {
    expect(countChecked([true, false, true, true])).toBe(3);
  });

  it("sizeFromLength", () => {
    expect(sizeFromLength(9)).toBe(3);
    expect(sizeFromLength(16)).toBe(4);
    expect(sizeFromLength(25)).toBe(5);
    expect(() => sizeFromLength(10)).toThrow(RangeError);
    expect(() => sizeFromLength(0)).toThrow(RangeError);
  });
});
