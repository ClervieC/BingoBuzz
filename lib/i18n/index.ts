import { en } from "./dictionaries/en";
import { fr, type Dictionary, type MessageKey } from "./dictionaries/fr";

export type { Dictionary, MessageKey };

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "bb_locale";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type Vars = Record<string, string | number>;

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translator = (key: MessageKey, vars?: Vars) => string;

export function createTranslator(dict: Dictionary): Translator {
  return (key, vars) => format(dict[key] ?? key, vars);
}
