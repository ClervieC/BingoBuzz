"use client";

import { LOCALES, type Locale } from "@/lib/i18n";
import { THEMES, type Theme } from "@/lib/preferences";
import { useT } from "./I18nProvider";
import { Icon, type IconName } from "./Icon";
import { usePreferences } from "./PreferencesProvider";

const THEME_ICON: Record<Theme, IconName> = { system: "monitor", light: "sun", dark: "moon" };
const THEME_LABEL = { system: "prefs.theme.system", light: "prefs.theme.light", dark: "prefs.theme.dark" } as const;
const LOCALE_LABEL = { fr: "prefs.language.fr", en: "prefs.language.en" } as const;

/** Sélecteur de thème complet (réglages). */
export function ThemeSelector() {
  const t = useT();
  const { theme, setTheme } = usePreferences();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label={t("prefs.theme")}>
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-bold transition ${
            theme === value ? "bg-surface text-fg shadow-sm" : "text-muted"
          }`}
        >
          <Icon name={THEME_ICON[value]} size={20} />
          {t(THEME_LABEL[value])}
        </button>
      ))}
    </div>
  );
}

/** Sélecteur de langue complet (réglages). */
export function LanguageSelector() {
  const t = useT();
  const { locale, setLocale } = usePreferences();
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label={t("prefs.language")}>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={locale === value}
          lang={value}
          onClick={() => setLocale(value)}
          className={`min-h-[48px] rounded-xl font-bold transition ${
            locale === value ? "bg-surface text-fg shadow-sm" : "text-muted"
          }`}
        >
          {t(LOCALE_LABEL[value])}
        </button>
      ))}
    </div>
  );
}

/** Version compacte pour l'en-tête de l'écran de connexion : langue + bouton de thème cyclique. */
export function CompactPreferences() {
  const t = useT();
  const { theme, setTheme, locale, setLocale } = usePreferences();
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <div className="flex items-center gap-1">
      <div className="flex rounded-full bg-surface-2 p-0.5" role="radiogroup" aria-label={t("prefs.language")}>
        {LOCALES.map((value: Locale) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={locale === value}
            aria-label={t(LOCALE_LABEL[value])}
            lang={value}
            onClick={() => setLocale(value)}
            className={`min-h-[40px] min-w-[40px] rounded-full px-2 text-xs font-black uppercase transition ${
              locale === value ? "bg-surface text-fg shadow-sm" : "text-muted"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setTheme(nextTheme)}
        aria-label={`${t("prefs.theme")} : ${t(THEME_LABEL[theme])}`}
        title={`${t("prefs.theme")} : ${t(THEME_LABEL[theme])}`}
      >
        <Icon name={THEME_ICON[theme]} />
      </button>
    </div>
  );
}
