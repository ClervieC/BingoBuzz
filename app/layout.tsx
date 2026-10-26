import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/I18nProvider";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ToastProvider } from "@/components/Toast";
import { getT } from "@/lib/i18n/server";
import { THEME_COLOR } from "@/lib/preferences";
import { getThemePreference } from "@/lib/preferences.server";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: `${t("app.name")} · ${t("app.tagline")}`, template: `%s · ${t("app.name")}` },
    description: t("app.description"),
    applicationName: t("app.name"),
    appleWebApp: { capable: true, title: t("app.name"), statusBarStyle: "default" },
    formatDetection: { telephone: false },
    openGraph: {
      type: "website",
      siteName: t("app.name"),
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemePreference();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
          ]
        : THEME_COLOR[theme],
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [{ locale }, theme] = await Promise.all([getT(), getThemePreference()]);
  return (
    // data-theme absent = suit le système (voir globals.css)
    <html lang={locale} data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <body className="antialiased">
        <I18nProvider locale={locale}>
          <PreferencesProvider initialTheme={theme}>
            <ToastProvider>{children}</ToastProvider>
            <ServiceWorker />
          </PreferencesProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
