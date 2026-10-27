export type GridSize = 3 | 4 | 5;
/** free : chacun coche ; validated : l’hôte valide ; peer : un autre joueur confirme */
export type GameMode = "free" | "validated" | "peer";
export type ClaimStatus = "pending" | "confirmed" | "rejected";
/** lobby : en préparation (les invités ajoutent des phrases, pas encore de grille) */
export type GameStatus = "lobby" | "playing" | "finished";
/** fin automatique choisie par l'hôte */
/** progressive : 1 ligne (bingo), 2 lignes (double), carton plein qui termine la partie */
export type GameAutoEnd = "manual" | "first_bingo" | "full_card" | "progressive";
export const REACTION_EMOJIS = ["😂", "🔥", "👏", "😮", "❤️"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface BoardTheme {
  emoji: string;
  color: ThemeColor;
  /** style de carte (absent : classique) */
  style?: CardStyle;
}

export const CARD_STYLES = ["classic", "paper", "neon", "minimal"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const TEMPLATE_CATEGORIES = ["work", "party", "family", "sport", "tv", "travel"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

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
  /** modèles : catégorie de la galerie */
  category?: TemplateCategory | null;
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
  /** emoji choisi en rejoignant */
  avatar?: string | null;
  /** lignes complètes et paliers (calculés par la base) */
  lines?: number;
  double_at?: string | null;
  full_at?: string | null;
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
  /** joueur (classement, arrivée, paliers), proposition ou validation de l'hôte */
  target_type: "player" | "join" | "bingo" | "double" | "full" | "claim" | "event";
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

/** Statistiques du joueur (get_my_stats) */
export interface PlayerStats {
  games_played: number;
  bingos: number;
  wins: number;
  full_cards: number;
  cells_checked: number;
  hosted: number;
  boards: number;
  claims_confirmed: number;
  photos: number;
  confirmations_given: number;
  phrases_contributed: number;
  reactions_received: number;
  friends: number;
  since: string | null;
}
