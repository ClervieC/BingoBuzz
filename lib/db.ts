import type { SupabaseClient } from "@supabase/supabase-js";
import { cellsToBingo, countChecked, sizeFromLength } from "@/lib/bingo";
import { normalizeTheme } from "@/lib/themes";
import type { Board, BoardWithPhrases, PublicGame } from "@/types/bingo";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const BOARD_COLUMNS =
  "id, owner_id, title, theme, grid_size, free_center, is_template, created_at, updated_at, category";

function toBoard(row: Database["public"]["Tables"]["boards"]["Row"]): Board {
  return { ...row, theme: normalizeTheme(row.theme) };
}

/** Un bingo et ses phrases (ordre : position, id — le même que join_game). */
export async function fetchBoard(supabase: Client, id: string): Promise<BoardWithPhrases | null> {
  if (!isUuid(id)) return null;

  const [{ data: board, error }, { data: phrases, error: phrasesError }] = await Promise.all([
    supabase.from("boards").select(BOARD_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("board_phrases")
      .select("id, text, position, added_by")
      .eq("board_id", id)
      .order("position")
      .order("id"),
  ]);

  if (error) throw error;
  if (phrasesError) throw phrasesError;
  if (!board) return null;
  return { ...toBoard(board), phrases: phrases ?? [] };
}

/** Modèles fournis, dans la langue de l'interface. */
export async function fetchTemplates(supabase: Client, locale: "fr" | "en" = "fr"): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select(BOARD_COLUMNS)
    .eq("is_template", true)
    .eq("locale", locale)
    .order("title");
  if (error) throw error;
  return (data ?? []).map(toBoard);
}

export async function fetchOwnBoards(supabase: Client, userId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select(BOARD_COLUMNS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toBoard);
}

export async function fetchPublicGame(supabase: Client, code: string): Promise<PublicGame | null> {
  const { data, error } = await supabase.rpc("get_game_public", { p_code: code }).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, theme: normalizeTheme(data.theme) };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export interface ActiveGame {
  code: string;
  isHost: boolean;
  title: string;
  theme: Board["theme"];
  createdAt: string;
  /** en préparation : pas encore de grille */
  lobby: boolean;
  /** progression du joueur courant (null s'il n'a pas de grille, ex. hôte qui ne joue pas) */
  me: { count: number; total: number; missing: number; hasBingo: boolean } | null;
}

/**
 * Parties en cours de l'utilisateur (hôte ou joueur), les plus récentes d'abord.
 * La RLS ne renvoie que les parties dont il est membre.
 */
export async function fetchActiveGames(supabase: Client, userId: string): Promise<ActiveGame[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("id, code, host_id, board_id, created_at, status")
    .in("status", ["lobby", "playing"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  if (!games?.length) return [];

  const [{ data: boards }, { data: players }] = await Promise.all([
    supabase.from("boards").select(BOARD_COLUMNS).in("id", [...new Set(games.map((g) => g.board_id))]),
    supabase
      .from("game_players")
      .select("game_id, grid, checked, has_bingo")
      .eq("user_id", userId)
      .in("game_id", games.map((g) => g.id)),
  ]);
  const boardById = new Map((boards ?? []).map((b) => [b.id, toBoard(b)]));
  const playerByGame = new Map((players ?? []).map((p) => [p.game_id, p]));

  return games.flatMap((g) => {
    const board = boardById.get(g.board_id);
    if (!board) return [];
    const player = playerByGame.get(g.id);
    // en préparation, le joueur n'a pas encore de grille
    const me =
      player && player.grid.length > 0
      ? {
          count: countChecked(player.checked),
          total: player.grid.length,
          missing: cellsToBingo(player.checked, sizeFromLength(player.grid.length)),
          hasBingo: player.has_bingo,
        }
      : null;
    return [
      {
        code: g.code,
        isHost: g.host_id === userId,
        title: board.title,
        theme: board.theme,
        createdAt: g.created_at,
        lobby: g.status === "lobby",
        me,
      },
    ];
  });
}

export interface FinishedGame {
  code: string;
  title: string;
  theme: Board["theme"];
  endedAt: string;
  playerCount: number;
  /** gagnants dans l'ordre d'arrivée du bingo */
  winners: string[];
  me: { count: number; total: number } | null;
}

/** Historique : parties terminées dont l'utilisateur est membre (RLS), les plus récentes d'abord. */
export async function fetchFinishedGames(supabase: Client, userId: string, limit = 20): Promise<FinishedGame[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("id, code, board_id, created_at, ended_at")
    .eq("status", "finished")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  if (!games?.length) return [];

  const [{ data: boards }, { data: players }] = await Promise.all([
    supabase.from("boards").select(BOARD_COLUMNS).in("id", [...new Set(games.map((g) => g.board_id))]),
    supabase
      .from("game_players")
      .select("game_id, user_id, nickname, checked, has_bingo, bingo_at")
      .in("game_id", games.map((g) => g.id)),
  ]);
  const boardById = new Map((boards ?? []).map((b) => [b.id, toBoard(b)]));

  return games.flatMap((g) => {
    const board = boardById.get(g.board_id);
    if (!board) return [];
    const inGame = (players ?? []).filter((p) => p.game_id === g.id);
    const mine = inGame.find((p) => p.user_id === userId);
    return [
      {
        code: g.code,
        title: board.title,
        theme: board.theme,
        endedAt: g.ended_at ?? g.created_at,
        playerCount: inGame.length,
        winners: inGame
          .filter((p) => p.has_bingo)
          .sort((a, b) => (a.bingo_at ?? "~").localeCompare(b.bingo_at ?? "~"))
          .map((p) => p.nickname),
        me: mine ? { count: countChecked(mine.checked), total: mine.checked.length } : null,
      },
    ];
  });
}
