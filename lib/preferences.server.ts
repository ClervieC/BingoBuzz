import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_THEME_PREF, isTheme, THEME_COOKIE, type Theme } from "./preferences";

export async function getThemePreference(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME_PREF;
}
