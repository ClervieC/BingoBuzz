"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { setPreferenceCookie, THEME_COLOR, THEME_COOKIE, type Theme } from "@/lib/preferences";
import { useI18n } from "./I18nProvider";

interface PreferencesValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;

  // barre d'adresse / barre d'état mobile
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
    if (theme !== "system") meta.removeAttribute("media");
  }
}

export function PreferencesProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const router = useRouter();
  const { locale } = useI18n();
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    setPreferenceCookie(THEME_COOKIE, next);
    applyTheme(next);
    setThemeState(next);
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      setPreferenceCookie(LOCALE_COOKIE, next);
      // les textes sont choisis côté serveur : on re-rend la page
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ theme, setTheme, locale, setLocale }), [theme, setTheme, locale, setLocale]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences doit être utilisé dans <PreferencesProvider>");
  return value;
}
