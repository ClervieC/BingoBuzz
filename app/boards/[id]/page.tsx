import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HeaderNav } from "@/components/HeaderNav";
import { fetchBoard } from "@/lib/db";
import { requiredPhraseCount } from "@/lib/random";
import { getT } from "@/lib/i18n/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/user";
import { themeStyle } from "@/lib/themes";
import { BoardActions } from "./BoardActions";
import { BoardHero } from "./BoardHero";
import { PhraseCloud } from "./PhraseCloud";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const board = await fetchBoard(await getSupabaseServerClient(), id).catch(() => null);
  return { title: board ? `${board.theme.emoji} ${board.title}` : undefined, robots: { index: false } };
}

export default async function BoardPage({ params }: Props) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const [{ t }, user, board] = await Promise.all([getT(), getServerUser(), fetchBoard(supabase, id)]);
  if (!board) notFound();

  // Un bingo ne se joue qu'une fois à la fois : s'il a une partie en cours ou en
  // préparation dont je fais partie (RLS), ouvrir le bingo m'y ramène directement.
  const { data: ongoing } = await supabase
    .from("games")
    .select("code")
    .eq("board_id", board.id)
    .in("status", ["lobby", "playing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ongoing) redirect(`/play/${ongoing.code}`);

  const isOwner = Boolean(user && board.owner_id === user.id);
  const [locked, gamesCount] = await Promise.all([
    // verrouillé si une partie en cours a déjà des joueurs (même règle que save_board)
    isOwner
      ? supabase.rpc("board_locked", { p_board_id: board.id }).then(({ data }) => Boolean(data))
      : Promise.resolve(false),
    // parties visibles par l'utilisateur (RLS : celles qu'il anime ou où il joue)
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("board_id", board.id)
      .then(({ count }) => count ?? 0),
  ]);

  return (
    <div className="themed min-h-dvh" style={themeStyle(board.theme)}>
      <AppHeader back="/library" backLabel={t("common.back")} actions={<HeaderNav />} />
      <main className="page pb-safe stagger space-y-6 pt-4 pb-12">
        <BoardHero board={board} gamesCount={gamesCount} t={t} />

        <BoardActions
          boardId={board.id}
          title={board.title}
          isOwner={isOwner}
          locked={locked}
          isTemplate={board.is_template}
          missing={Math.max(0, requiredPhraseCount(board.grid_size, board.free_center) - board.phrases.length)}
        />

        <PhraseCloud phrases={board.phrases} />
      </main>
    </div>
  );
}
