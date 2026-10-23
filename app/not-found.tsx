import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <>
      <AppHeader />
      <main className="page pb-safe flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-6xl" aria-hidden>
          🙈
        </p>
        <h1 className="text-2xl font-black">{t("notFound.title")}</h1>
        <p className="text-muted">{t("notFound.body")}</p>
        <Link href="/" className="btn btn-primary">
          {t("common.home")}
        </Link>
      </main>
    </>
  );
}
