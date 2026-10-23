"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, getDictionary, type Locale, type Translator } from "@/lib/i18n";

interface I18nValue {
  locale: Locale;
  t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(getDictionary(locale)) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n doit être utilisé dans <I18nProvider>");
  return value;
}

export function useT(): Translator {
  return useI18n().t;
}
