import { describe, expect, it } from "vitest";
import { extractCode, isValidCode, normalizeCode } from "./code";

describe("codes de partie", () => {
  it("normalise la saisie", () => {
    expect(normalizeCode(" abc-234 ")).toBe("ABC234");
    expect(normalizeCode("abc 234 xyz")).toBe("ABC234");
  });

  it("valide l'alphabet sans caractères ambigus", () => {
    expect(isValidCode("ABC234")).toBe(true);
    expect(isValidCode("ABC23")).toBe(false);
    expect(isValidCode("ABCO23")).toBe(false); // O exclu
    expect(isValidCode("ABC123")).toBe(false); // 1 exclu
    expect(isValidCode("abc234")).toBe(false);
  });

  it("extrait un code d'un lien de partage", () => {
    expect(extractCode("https://bingobuzz.app/play/xyz789")).toBe("XYZ789");
    expect(extractCode("hk7 m9p")).toBe("HK7M9P");
    expect(extractCode("bonjour")).toBeNull();
  });
});
