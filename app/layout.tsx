import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/Toast";
import { getT } from "@/lib/i18n/server";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#110f1c" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getT();
  return (
    <html lang={locale}>
      <body className="antialiased">
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
