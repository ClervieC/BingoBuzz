-- BingoBuzz — schéma de base
-- Tables : boards, board_phrases, games, game_players, game_events

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.game_mode as enum ('free', 'validated');
create type public.game_status as enum ('playing', 'finished');

-- ---------------------------------------------------------------------------
-- boards : un bingo (modèle de grille + liste de phrases)
-- ---------------------------------------------------------------------------

create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  -- null uniquement pour les modèles fournis par l'application
  owner_id    uuid references auth.users (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  -- { "emoji": "🎉", "color": "violet" }
  theme       jsonb not null default '{"emoji":"🎉","color":"violet"}'::jsonb
              check (jsonb_typeof(theme) = 'object'),
  grid_size   smallint not null default 5 check (grid_size in (3, 4, 5)),
  free_center boolean not null default false,
  is_template boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- la case libre n'a de sens que pour une grille impaire
  constraint boards_free_center_odd check (not free_center or grid_size % 2 = 1),
  -- un bingo utilisateur a toujours un propriétaire ; un modèle n'en a pas besoin
  constraint boards_owner_or_template check (owner_id is not null or is_template)
);

create index boards_owner_id_idx on public.boards (owner_id, updated_at desc);
create index boards_template_idx on public.boards (is_template) where is_template;

-- ---------------------------------------------------------------------------
-- board_phrases : les phrases / événements d'un bingo
-- ---------------------------------------------------------------------------

create table public.board_phrases (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 120),
  position   integer not null check (position >= 0),
  created_at timestamptz not null default now(),

  constraint board_phrases_unique_text unique (board_id, text)
);

create index board_phrases_board_position_idx on public.board_phrases (board_id, position);

-- ---------------------------------------------------------------------------
-- games : une partie de groupe
-- ---------------------------------------------------------------------------

create table public.games (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  host_id    uuid not null references auth.users (id) on delete cascade,
  -- alphabet sans caractères ambigus (pas de 0/O, 1/I/L)
  code       text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  mode       public.game_mode not null default 'free',
  status     public.game_status not null default 'playing',
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);

create index games_board_id_idx on public.games (board_id);
create index games_host_id_idx on public.games (host_id, created_at desc);

-- ---------------------------------------------------------------------------
-- game_players : un joueur dans une partie, avec SA grille
-- ---------------------------------------------------------------------------

create table public.game_players (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references public.games (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  nickname  text not null check (char_length(btrim(nickname)) between 1 and 24),
  -- graine du mélange Fisher-Yates : permet de régénérer exactement la même grille
  seed      bigint not null check (seed between 1 and 2147483646),
  -- [{ "id": uuid, "text": "..." } | { "id": null, "text": "", "free": true }]
  grid      jsonb not null check (jsonb_typeof(grid) = 'array'),
  -- [true, false, ...] même longueur que grid
  checked   jsonb not null check (jsonb_typeof(checked) = 'array'),
  has_bingo boolean not null default false,
  bingo_at  timestamptz,
  joined_at timestamptz not null default now(),

  constraint game_players_one_per_user unique (game_id, user_id)
);

create index game_players_user_id_idx on public.game_players (user_id);
-- (game_id, user_id) est déjà indexé par la contrainte d'unicité

-- ---------------------------------------------------------------------------
-- game_events : phrases confirmées par l'hôte (mode « validé »)
-- ---------------------------------------------------------------------------

create table public.game_events (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  phrase_id    uuid not null references public.board_phrases (id) on delete cascade,
  validated_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint game_events_once_per_phrase unique (game_id, phrase_id)
);

create index game_events_phrase_id_idx on public.game_events (phrase_id);
create index game_events_validated_by_idx on public.game_events (validated_by);

-- ---------------------------------------------------------------------------
-- updated_at automatique sur boards
-- ---------------------------------------------------------------------------

create or replace function public.bb_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger boards_touch_updated_at
  before update on public.boards
  for each row execute function public.bb_touch_updated_at();
