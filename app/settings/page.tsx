import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getT } from "@/lib/i18n/server";
import { getServerUser } from "@/lib/supabase/user";
import { SettingsClient } from "./SettingsClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("settings.title"), robots: { index: false } };
}

export default async function SettingsPage() {
  const [{ t }, user] = await Promise.all([getT(), getServerUser()]);
  if (!user || user.isAnonymous) redirect("/");

  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} title={t("settings.title")} />
      <main className="page pb-safe pt-4 pb-12">
        <SettingsClient email={user.email} name={user.name} />
      </main>
    </>
  );
}
