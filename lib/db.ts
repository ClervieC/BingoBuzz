import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTheme } from "@/lib/themes";
import type { Board, BoardWithPhrases, PublicGame } from "@/types/bingo";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

const BOARD_COLUMNS =
  "id, owner_id, title, theme, grid_size, free_center, is_template, created_at, updated_at";

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
      .select("id, text, position")
      .eq("board_id", id)
      .order("position")
      .order("id"),
  ]);

  if (error) throw error;
  if (phrasesError) throw phrasesError;
  if (!board) return null;
  return { ...toBoard(board), phrases: phrases ?? [] };
}

export async function fetchTemplates(supabase: Client): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select(BOARD_COLUMNS)
    .eq("is_template", true)
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
