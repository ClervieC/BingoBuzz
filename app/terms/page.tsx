import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { TermsContent } from "@/components/legal/TermsContent";
import { getT } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("legal.terms") };
}

export default async function TermsPage() {
  const { t, locale } = await getT();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(LEGAL.updatedAt));
  return (
    <LegalLayout
      title={t("legal.terms")}
      updated={t("legal.updated", { date })}
      backLabel={t("common.back")}
      other={{ href: "/privacy", label: t("legal.privacy") }}
    >
      <TermsContent locale={locale} />
    </LegalLayout>
  );
}
