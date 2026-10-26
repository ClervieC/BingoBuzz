import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { Icon } from "./Icon";

/** Liens de navigation de l'en-tête (Server Component, utilisateur connecté). */
export async function HeaderNav() {
  const { t } = await getT();
  return (
    <>
      <Link href="/library" className="icon-btn" aria-label={t("nav.library")} title={t("nav.library")}>
        <Icon name="library" />
      </Link>
      <Link href="/settings" className="icon-btn" aria-label={t("settings.title")} title={t("settings.title")}>
        <Icon name="settings" />
      </Link>
    </>
  );
}
