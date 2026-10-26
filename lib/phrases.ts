export const MAX_PHRASE_LENGTH = 120;
export const MAX_PHRASES = 200;

const BULLET = /^\s*(?:[-*•·–—]|\d{1,3}[.)]|\[\s?[xX ]?\s?\])\s+/;

/** Nettoie une phrase : puces/numérotation retirées, espaces normalisés, longueur bornée. */
export function cleanPhrase(raw: string): string {
  return raw.replace(BULLET, "").replace(/\s+/g, " ").trim().slice(0, MAX_PHRASE_LENGTH);
}

/**
 * Découpe un texte collé (une phrase par ligne) en phrases propres.
 * Lignes vides et doublons (insensibles à la casse) retirés.
 */
export function parsePhrases(text: string, existing: readonly string[] = []): string[] {
  const seen = new Set(existing.map((p) => p.toLocaleLowerCase("fr")));
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const phrase = cleanPhrase(line);
    if (!phrase) continue;
    const key = phrase.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

export function isDuplicate(phrase: string, list: readonly string[]): boolean {
  const key = phrase.trim().toLocaleLowerCase("fr");
  return list.some((p) => p.toLocaleLowerCase("fr") === key);
}

/**
 * Typographie française à l'affichage : espace insécable après « et avant
 * » ! ? : ; pour qu'un signe ne se retrouve jamais seul en début de ligne.
 */
export function frenchSpacing(text: string): string {
  return text.replace(/«\s+/g, "«\u00a0").replace(/\s+([»!?:;])/g, "\u00a0$1");
}
