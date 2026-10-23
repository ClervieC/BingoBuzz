import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getServerUser } from "@/lib/supabase/user";
import { Icon } from "./Icon";

/** Liens de navigation de l'en-tête (Server Component). */
export async function HeaderNav() {
  const [{ t }, user] = await Promise.all([getT(), getServerUser()]);
  const signedIn = user && !user.isAnonymous;
  return (
    <>
      <Link href="/library" className="icon-btn" aria-label={t("nav.library")} title={t("nav.library")}>
        <Icon name="library" />
      </Link>
      <Link
        href="/login"
        className="icon-btn"
        aria-label={signedIn ? t("nav.account") : t("nav.login")}
        title={signedIn ? t("nav.account") : t("nav.login")}
      >
        <Icon name="user" className={signedIn ? "text-accent" : undefined} />
      </Link>
    </>
  );
}
