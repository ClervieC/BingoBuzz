import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { getT } from "@/lib/i18n/server";
import { LoginClient } from "./LoginClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title"), robots: { index: false } };
}

type Props = { searchParams: Promise<{ error?: string; upgraded?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const [{ t }, params] = await Promise.all([getT(), searchParams]);
  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} title={t("nav.account")} />
      <main className="page pb-safe pt-6">
        <LoginClient
          callbackError={params.error === "1"}
          upgraded={params.upgraded === "1"}
          next={params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/library"}
        />
      </main>
    </>
  );
}
