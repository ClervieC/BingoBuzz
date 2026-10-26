import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("offline.title"), robots: { index: false } };
}

/**
 * Servie par le service worker quand une page ne peut pas être chargée.
 * Sans réseau, le JavaScript de l'appli n'est pas disponible : la page doit
 * fonctionner en HTML seul (icône précachée, lien qui recharge l'adresse).
 */
export default async function OfflinePage() {
  const { t } = await getT();
  return (
    <main className="page grid min-h-dvh place-items-center py-10 text-center">
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
        <h1 className="text-2xl font-black">📡 {t("offline.title")}</h1>
        <p className="text-muted">{t("offline.body")}</p>
        <a href="" className="btn btn-primary">
          {t("offline.retry")}
        </a>
      </div>
    </main>
  );
}
