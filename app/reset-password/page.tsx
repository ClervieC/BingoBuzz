import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { getT } from "@/lib/i18n/server";
import { ResetPasswordClient } from "./ResetPasswordClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("reset.title"), robots: { index: false } };
}

/**
 * Arrivée depuis le lien « mot de passe oublié » : /auth/callback a déjà
 * ouvert une session, le proxy garantit donc qu'on est connecté ici.
 */
export default async function ResetPasswordPage() {
  const { t } = await getT();
  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} title={t("reset.title")} />
      <main className="page pb-safe pt-6">
        <ResetPasswordClient />
      </main>
    </>
  );
}
