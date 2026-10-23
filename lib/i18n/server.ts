import "server-only";

import { cookies } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from ".";

/**
 * Langue de l'interface : cookie `bb_locale` si présent, sinon français.
 * (Pour activer la détection automatique, lire ici l'en-tête Accept-Language.)
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: createTranslator(getDictionary(locale)) };
}
