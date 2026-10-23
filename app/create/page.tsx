import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { BoardEditor } from "@/components/BoardEditor";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("editor.newTitle") };
}

export default async function CreatePage() {
  const { t } = await getT();
  return (
    <>
      <AppHeader back="/" backLabel={t("common.back")} title={t("editor.newTitle")} />
      <main>
        <BoardEditor />
      </main>
    </>
  );
}
