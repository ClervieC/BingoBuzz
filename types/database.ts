/**
 * Types de la base Supabase, écrits à la main d'après supabase/migrations.
 * Peuvent être régénérés avec :
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 * (les colonnes jsonb redeviennent alors `Json` : garder les casts dans lib/db.ts).
 */

import type { BoardTheme, Cell, ClaimStatus, GameClaim, GameMode, GameStatus, GridSize } from "./bingo";

type BoardRow = {
  id: string;
  owner_id: string | null;
  title: string;
  theme: BoardTheme;
  grid_size: GridSize;
  free_center: boolean;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

type BoardPhraseRow = {
  id: string;
  board_id: string;
  text: string;
  position: number;
  created_at: string;
};

type GameRow = {
  id: string;
  board_id: string;
  host_id: string;
  code: string;
  mode: GameMode;
  status: GameStatus;
  created_at: string;
  ended_at: string | null;
};

type GamePlayerRow = {
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
};

type GameEventRow = {
  id: string;
  game_id: string;
  phrase_id: string;
  validated_by: string;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      boards: {
        Row: BoardRow;
        Insert: Partial<BoardRow> & Pick<BoardRow, "title">;
        Update: Partial<Pick<BoardRow, "title" | "theme" | "grid_size" | "free_center">>;
        Relationships: [];
      };
      board_phrases: {
        Row: BoardPhraseRow;
        Insert: Partial<BoardPhraseRow> & Pick<BoardPhraseRow, "board_id" | "text" | "position">;
        Update: Partial<Pick<BoardPhraseRow, "text" | "position">>;
        Relationships: [
          {
            foreignKeyName: "board_phrases_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: GameRow;
        Insert: never;
        Update: Partial<Pick<GameRow, "status">>;
        Relationships: [
          {
            foreignKeyName: "games_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      game_players: {
        Row: GamePlayerRow;
        Insert: never;
        Update: Partial<Pick<GamePlayerRow, "nickname" | "checked">>;
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_claims: {
        // type littéral (et non interface) : exigé par les types génériques de supabase-js
        Row: { [K in keyof GameClaim]: GameClaim[K] };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "game_claims_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_events: {
        Row: GameEventRow;
        Insert: Partial<GameEventRow> & Pick<GameEventRow, "game_id" | "phrase_id">;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_events_phrase_id_fkey";
            columns: ["phrase_id"];
            isOneToOne: false;
            referencedRelation: "board_phrases";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_board: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_theme: BoardTheme;
          p_grid_size: number;
          p_free_center: boolean;
          p_phrases: string[];
        };
        Returns: string;
      };
      duplicate_board: {
        Args: { p_id: string; p_title?: string | null };
        Returns: string;
      };
      create_game: {
        Args: { p_board_id: string; p_mode?: GameMode };
        Returns: GameRow;
      };
      join_game: {
        Args: { p_code: string; p_nickname: string };
        Returns: GamePlayerRow;
      };
      claim_phrase: {
        Args: { p_game_id: string; p_phrase_id: string; p_photo_path?: string | null };
        Returns: { [K in keyof GameClaim]: GameClaim[K] };
      };
      resolve_claim: {
        Args: { p_claim_id: string; p_accept: boolean };
        Returns: { [K in keyof GameClaim]: GameClaim[K] };
      };
      board_locked: {
        Args: { p_board_id: string };
        Returns: boolean;
      };
      export_my_data: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_game_public: {
        Args: { p_code: string };
        Returns: {
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
        }[];
      };
    };
    Enums: {
      game_mode: GameMode;
      game_status: GameStatus;
      claim_status: ClaimStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
