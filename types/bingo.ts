export type GridSize = 3 | 4 | 5;
export type GameMode = "free" | "validated";
export type GameStatus = "playing" | "finished";

export interface BoardTheme {
  emoji: string;
  color: ThemeColor;
}

export type ThemeColor =
  | "violet"
  | "blue"
  | "teal"
  | "green"
  | "orange"
  | "red"
  | "pink"
  | "slate";

/** Une case de grille. `id` null + `free` = case centrale libre. */
export interface Cell {
  id: string | null;
  text: string;
  free?: boolean;
}

export interface Phrase {
  id: string;
  text: string;
  position: number;
}

export interface Board {
  id: string;
  owner_id: string | null;
  title: string;
  theme: BoardTheme;
  grid_size: GridSize;
  free_center: boolean;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardWithPhrases extends Board {
  phrases: Phrase[];
}

export interface Game {
  id: string;
  board_id: string;
  host_id: string;
  code: string;
  mode: GameMode;
  status: GameStatus;
  created_at: string;
  ended_at: string | null;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  nickname: string;
  seed: number;
  grid: Cell[];
  checked: boolean[];
  has_bingo: boolean;
  bingo_at: string | null;
  joined_at: string;
}

export interface GameEvent {
  id: string;
  game_id: string;
  phrase_id: string;
  validated_by: string;
  created_at: string;
}

export interface PublicGame {
  id: string;
  code: string;
  mode: GameMode;
  status: GameStatus;
  board_id: string;
  title: string;
  theme: BoardTheme;
  grid_size: GridSize;
  player_count: number;
  created_at: string;
}
