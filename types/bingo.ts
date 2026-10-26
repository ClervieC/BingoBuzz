export type GridSize = 3 | 4 | 5;
/** free : chacun coche ; validated : l’hôte valide ; peer : un autre joueur confirme */
export type GameMode = "free" | "validated" | "peer";
export type ClaimStatus = "pending" | "confirmed" | "rejected";
/** lobby : en préparation (les invités ajoutent des phrases, pas encore de grille) */
export type GameStatus = "lobby" | "playing" | "finished";
/** fin automatique choisie par l'hôte */
export type GameAutoEnd = "manual" | "first_bingo" | "full_card";
export const REACTION_EMOJIS = ["😂", "🔥", "👏", "😮", "❤️"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

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
  /** auteur d'une phrase proposée pendant la préparation */
  added_by?: string | null;
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
  auto_end: GameAutoEnd;
  ends_at: string | null;
  /** durée choisie, appliquée au lancement d'une partie préparée */
  duration_days: number | null;
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

/** Proposition d’un joueur (mode « peer »), confirmée ou contestée par un autre. */
export interface GameClaim {
  id: string;
  game_id: string;
  phrase_id: string;
  claimed_by: string;
  status: ClaimStatus;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
  /** preuve photo facultative : chemin dans le bucket privé « proofs » */
  photo_path: string | null;
}

export interface GameReaction {
  id: string;
  game_id: string;
  target_type: "bingo" | "claim";
  target_id: string;
  user_id: string;
  emoji: ReactionEmoji;
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
