import { describe, expect, it } from "vitest";
import { cleanPhrase, frenchSpacing, isDuplicate, MAX_PHRASE_LENGTH, parsePhrases } from "./phrases";

describe("cleanPhrase", () => {
  it.each([
    ["- Il pleut", "Il pleut"],
    ["• Il pleut", "Il pleut"],
    ["* Il pleut", "Il pleut"],
    ["12. Il pleut", "Il pleut"],
    ["3) Il pleut", "Il pleut"],
    ["[ ] Il pleut", "Il pleut"],
    ["  Il   pleut  ", "Il pleut"],
    ["-5 degrés dehors", "-5 degrés dehors"],
  ])("%j → %j", (input, expected) => {
    expect(cleanPhrase(input)).toBe(expected);
  });

  it("tronque les phrases trop longues", () => {
    expect(cleanPhrase("a".repeat(500))).toHaveLength(MAX_PHRASE_LENGTH);
  });
});

describe("parsePhrases", () => {
  it("découpe un collage multiligne et ignore les lignes vides", () => {
    expect(parsePhrases("Un\n\n  Deux \r\n- Trois\n")).toEqual(["Un", "Deux", "Trois"]);
  });

  it("retire les doublons sans tenir compte de la casse", () => {
    expect(parsePhrases("Il pleut\nil PLEUT\nIl neige")).toEqual(["Il pleut", "Il neige"]);
  });

  it("ignore les phrases déjà présentes", () => {
    expect(parsePhrases("Un\nDeux", ["deux"])).toEqual(["Un"]);
  });
});

describe("isDuplicate", () => {
  it("compare sans casse ni espaces", () => {
    expect(isDuplicate("  On en reparle ", ["on en reparle"])).toBe(true);
    expect(isDuplicate("Autre", ["on en reparle"])).toBe(false);
  });
});

describe("frenchSpacing", () => {
  it("rend insécables les espaces de la ponctuation double", () => {
    expect(frenchSpacing("« Vive les mariés ! »")).toBe("«\u00a0Vive les mariés\u00a0!\u00a0»");
    expect(frenchSpacing("Tu m'entends ?")).toBe("Tu m'entends\u00a0?");
  });

  it("ne touche pas au reste", () => {
    expect(frenchSpacing("Il pleut")).toBe("Il pleut");
  });
});
