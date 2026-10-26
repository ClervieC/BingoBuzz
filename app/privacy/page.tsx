import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { getT } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("legal.privacy") };
}

export default async function PrivacyPage() {
  const { t, locale } = await getT();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(LEGAL.updatedAt));
  return (
    <LegalLayout
      title={t("legal.privacy")}
      updated={t("legal.updated", { date })}
      backLabel={t("common.back")}
      other={{ href: "/terms", label: t("legal.terms") }}
    >
      <PrivacyContent locale={locale} />
    </LegalLayout>
  );
}
