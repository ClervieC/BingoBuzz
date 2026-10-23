import { describe, expect, it } from "vitest";
import {
  buildGrid,
  createRng,
  initialChecked,
  normalizeSeed,
  randomSeed,
  requiredPhraseCount,
  SEED_MODULUS,
  shuffle,
} from "./random";

const phrases = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, text: `Phrase ${i}` }));

describe("createRng", () => {
  it("est déterministe pour une même graine", () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it("reproduit la séquence Park–Miller de référence", () => {
    // valeurs de référence de MINSTD (48271) pour la graine 1
    const next = createRng(1);
    expect(next()).toBe(48271);
    expect(next()).toBe(182605794);
    expect(next()).toBe(1291394886);
  });

  it("reste dans [1, 2³¹−2]", () => {
    const next = createRng(SEED_MODULUS - 1);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThan(SEED_MODULUS);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("normalise les graines hors bornes", () => {
    expect(normalizeSeed(0)).toBe(SEED_MODULUS - 1);
    expect(normalizeSeed(SEED_MODULUS)).toBe(SEED_MODULUS - 1);
    expect(normalizeSeed(-5)).toBe(SEED_MODULUS - 6);
    expect(() => normalizeSeed(Number.NaN)).toThrow(RangeError);
  });
});

describe("randomSeed", () => {
  it("produit une graine valide", () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed();
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThan(SEED_MODULUS);
    }
  });
});

describe("shuffle", () => {
  it("renvoie une permutation sans modifier l'entrée", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const copy = input.slice();
    const out = shuffle(input, 99);
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("donne le même ordre pour la même graine", () => {
    const input = phrases(30);
    expect(shuffle(input, 2024)).toEqual(shuffle(input, 2024));
  });

  it("donne des ordres différents pour des graines différentes", () => {
    const input = phrases(30);
    const orders = new Set(
      [1, 2, 3, 4, 5].map((s) => shuffle(input, s).map((p) => p.id).join(",")),
    );
    expect(orders.size).toBe(5);
  });

  it("produit une permutation de référence stable (contrat avec bb_shuffle SQL)", () => {
    // Si ce test casse, public.bb_shuffle doit être mis à jour en même temps.
    // SQL : select public.bb_shuffle(array[1,2,3,4,5,6,7,8,9], 42);
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], 42)).toEqual([9, 5, 1, 2, 3, 6, 4, 8, 7]);
  });

  it("gère les tableaux vides ou d'un élément", () => {
    expect(shuffle([], 1)).toEqual([]);
    expect(shuffle(["a"], 1)).toEqual(["a"]);
  });

  it("répartit les éléments de façon raisonnablement uniforme", () => {
    const counts = Array(5).fill(0);
    for (let seed = 1; seed <= 5000; seed++) counts[shuffle([0, 1, 2, 3, 4], seed)[0]]++;
    for (const c of counts) {
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });
});

describe("buildGrid", () => {
  it("construit une grille 5×5 avec case libre au centre", () => {
    const grid = buildGrid(phrases(30), 5, true, 7);
    expect(grid).toHaveLength(25);
    expect(grid[12]).toEqual({ id: null, text: "", free: true });
    expect(grid.filter((c) => c.free)).toHaveLength(1);
    expect(new Set(grid.map((c) => c.id)).size).toBe(25);
  });

  it("ignore la case libre pour une grille paire", () => {
    const grid = buildGrid(phrases(16), 4, true, 7);
    expect(grid).toHaveLength(16);
    expect(grid.some((c) => c.free)).toBe(false);
  });

  it("est reproductible à partir de la graine", () => {
    expect(buildGrid(phrases(40), 4, false, 555)).toEqual(buildGrid(phrases(40), 4, false, 555));
  });

  it("donne des grilles différentes à des joueurs différents", () => {
    const a = buildGrid(phrases(40), 3, false, 1).map((c) => c.id);
    const b = buildGrid(phrases(40), 3, false, 2).map((c) => c.id);
    expect(a).not.toEqual(b);
  });

  it("refuse s'il n'y a pas assez de phrases", () => {
    expect(() => buildGrid(phrases(8), 3, false, 1)).toThrow(RangeError);
    expect(() => buildGrid(phrases(8), 3, true, 1)).not.toThrow();
  });

  it("requiredPhraseCount", () => {
    expect(requiredPhraseCount(3, false)).toBe(9);
    expect(requiredPhraseCount(3, true)).toBe(8);
    expect(requiredPhraseCount(4, true)).toBe(16);
    expect(requiredPhraseCount(5, true)).toBe(24);
  });

  it("initialChecked coche uniquement la case libre", () => {
    const grid = buildGrid(phrases(10), 3, true, 3);
    expect(initialChecked(grid)).toEqual([false, false, false, false, true, false, false, false, false]);
  });
});
