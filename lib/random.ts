/**
 * Mélange déterministe (Fisher-Yates) à partir d'une graine.
 *
 * Générateur : Park–Miller « minimal standard » (x ← x·48271 mod 2³¹−1).
 * Il n'utilise que des entiers < 2⁴⁷ : le résultat est exact en JavaScript
 * comme en Postgres (bigint). La fonction SQL public.bb_shuffle produit donc
 * exactement la même permutation pour la même graine — ne pas modifier l'un
 * sans l'autre.
 */

import type { Cell } from "@/types/bingo";

export const SEED_MODULUS = 2147483647; // 2³¹ − 1
const MULTIPLIER = 48271;

export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError(`Graine invalide : ${seed}`);
  let state = Math.trunc(seed) % SEED_MODULUS;
  if (state <= 0) state += SEED_MODULUS - 1;
  return state;
}

/** Générateur d'entiers dans [1, 2³¹−2]. */
export function createRng(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state * MULTIPLIER) % SEED_MODULUS;
    return state;
  };
}

/** Graine aléatoire dans [1, 2³¹−2] (crypto si disponible). */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] % (SEED_MODULUS - 1)) + 1;
  }
  return Math.floor(Math.random() * (SEED_MODULUS - 1)) + 1;
}

/** Fisher-Yates à graine. Ne modifie pas le tableau d'entrée. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const next = createRng(seed);
  for (let i = result.length - 1; i >= 1; i--) {
    const j = next() % (i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

export function requiredPhraseCount(size: number, freeCenter: boolean): number {
  return size * size - (hasFreeCenter(size, freeCenter) ? 1 : 0);
}

export function hasFreeCenter(size: number, freeCenter: boolean): boolean {
  return freeCenter && size % 2 === 1;
}

export function centerIndex(size: number): number {
  return (size * size - 1) / 2;
}

export interface GridPhrase {
  id: string | null;
  text: string;
}

/**
 * Construit une grille N×N : les phrases (triées par position) sont mélangées
 * avec la graine, on garde les premières, et on insère la case libre au centre.
 */
export function buildGrid(
  phrases: readonly GridPhrase[],
  size: number,
  freeCenter: boolean,
  seed: number,
): Cell[] {
  const needed = requiredPhraseCount(size, freeCenter);
  if (phrases.length < needed) {
    throw new RangeError(`Il faut au moins ${needed} phrases (reçu ${phrases.length})`);
  }

  const picked = shuffle(phrases, seed).slice(0, needed);
  const cells: Cell[] = picked.map((p) => ({ id: p.id, text: p.text }));

  if (hasFreeCenter(size, freeCenter)) {
    cells.splice(centerIndex(size), 0, { id: null, text: "", free: true });
  }
  return cells;
}

/** État initial des coches : seule la case libre est cochée. */
export function initialChecked(grid: readonly Cell[]): boolean[] {
  return grid.map((cell) => Boolean(cell.free));
}
