/**
 * Codes de partie : 6 caractères dans un alphabet sans caractères ambigus
 * (pas de 0/O, 1/I/L). La génération se fait côté serveur
 * (public.bb_random_code, appelée par create_game) ; ici on ne fait que
 * normaliser la saisie de l'utilisateur.
 */

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Majuscules, espaces et tirets retirés, longueur bornée. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** Extrait un code depuis une saisie libre : code brut ou lien …/play/ABC234. */
export function extractCode(input: string): string | null {
  const fromUrl = input.match(/\/play\/([A-Za-z0-9]{6})/);
  const code = normalizeCode(fromUrl ? fromUrl[1] : input);
  return isValidCode(code) ? code : null;
}
