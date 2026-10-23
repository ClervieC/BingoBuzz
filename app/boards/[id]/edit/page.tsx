import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BoardEditor } from "@/components/BoardEditor";
import { fetchBoard } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("editor.editTitle"), robots: { index: false } };
}

export default async function EditBoardPage({ params }: Props) {
  const { id } = await params;
  const [{ t }, user, board] = await Promise.all([
    getT(),
    getServerUser(),
    getSupabaseServerClient().then((s) => fetchBoard(s, id)),
  ]);

  if (!board) notFound();
  // seul le propriétaire modifie (la RLS le garantit aussi côté base)
  if (!user || board.owner_id !== user.id) redirect(`/boards/${id}`);

  return (
    <>
      <AppHeader back={`/boards/${id}`} backLabel={t("common.back")} title={t("editor.editTitle")} />
      <main>
        <BoardEditor initial={board} />
      </main>
    </>
  );
}
