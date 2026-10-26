/** Préférences d'affichage stockées en cookie (lisibles par le serveur : pas de flash au chargement). */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "bb_theme";
export const DEFAULT_THEME_PREF: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Couleur de la barre du navigateur selon le mode affiché. */
export const THEME_COLOR = { light: "#f6f4fb", dark: "#110f1c" } as const;

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Écrit un cookie de préférence côté navigateur. */
export function setPreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
