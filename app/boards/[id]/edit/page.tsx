import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BoardEditor } from "@/components/BoardEditor";
import { fetchBoard } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ next?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("editor.editTitle"), robots: { index: false } };
}

export default async function EditBoardPage({ params, searchParams }: Props) {
  const [{ id }, { next: rawNext }] = await Promise.all([params, searchParams]);
  // retour après enregistrement (ex. la partie depuis laquelle on modifie)
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const supabase = await getSupabaseServerClient();
  const [{ t }, user, board] = await Promise.all([getT(), getServerUser(), fetchBoard(supabase, id)]);

  if (!board) notFound();
  // seul le propriétaire modifie (la RLS le garantit aussi côté base)
  if (!user || board.owner_id !== user.id) redirect(`/boards/${id}`);
  // des joueurs ont rejoint une partie en cours : la page du bingo explique pourquoi
  const { data: locked } = await supabase.rpc("board_locked", { p_board_id: board.id });
  if (locked) redirect(next ?? `/boards/${id}`);

  return (
    <>
      <AppHeader back={next ?? `/boards/${id}`} backLabel={t("common.back")} title={t("editor.editTitle")} />
      <main>
        <BoardEditor initial={board} returnTo={next ?? undefined} />
      </main>
    </>
  );
}
