-- BingoBuzz — Row Level Security
--
-- Règles :
--  * un bingo est lisible par son propriétaire, par tout le monde si c'est un
--    modèle, et par l'hôte / les joueurs d'une partie qui l'utilise ;
--  * seul le propriétaire modifie un bingo et ses phrases ;
--  * seul l'hôte modifie / supprime une partie et insère des game_events ;
--  * un joueur ne modifie que SA ligne game_players, et seulement `nickname`
--    et `checked` (la grille est générée côté serveur par join_game).
--
-- Les privilèges sont donnés explicitement : on ne dépend pas des « default
-- privileges » du projet Supabase.

alter table public.boards        enable row level security;
alter table public.board_phrases enable row level security;
alter table public.games         enable row level security;
alter table public.game_players  enable row level security;
alter table public.game_events   enable row level security;

-- ---------------------------------------------------------------------------
-- Fonctions d'aide (security definer pour éviter la récursion des policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game_id and g.host_id = (select auth.uid())
  ) or exists (
    select 1 from public.game_players p
    where p.game_id = p_game_id and p.user_id = (select auth.uid())
  );
$$;

-- Bingo utilisé par une partie dont je suis l'hôte ou un joueur.
create or replace function public.board_in_my_games(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.board_id = p_board_id
      and (
        g.host_id = (select auth.uid())
        or exists (
          select 1 from public.game_players p
          where p.game_id = g.id and p.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Pour les tables enfants (board_phrases) : le bingo parent existe déjà.
-- NB : la policy SELECT de `boards` teste ses propres colonnes directement,
-- car une fonction STABLE ne voit pas la ligne d'un INSERT … RETURNING.
create or replace function public.can_read_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id
      and (b.is_template or b.owner_id = (select auth.uid()))
  ) or public.board_in_my_games(p_board_id);
$$;

create or replace function public.owns_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = p_board_id and b.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_game_member(uuid) from public;
revoke execute on function public.board_in_my_games(uuid) from public;
revoke execute on function public.can_read_board(uuid) from public;
revoke execute on function public.owns_board(uuid) from public;
grant execute on function public.is_game_member(uuid) to anon, authenticated;
grant execute on function public.board_in_my_games(uuid) to anon, authenticated;
grant execute on function public.can_read_board(uuid) to anon, authenticated;
grant execute on function public.owns_board(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilèges de table
-- ---------------------------------------------------------------------------

revoke all on public.boards, public.board_phrases, public.games,
              public.game_players, public.game_events
  from anon, authenticated;

-- anon : uniquement la lecture des modèles (mode solo sans session)
grant select on public.boards, public.board_phrases to anon;

grant select, insert, delete on public.boards to authenticated;
grant update (title, theme, grid_size, free_center) on public.boards to authenticated;

grant select, insert, update, delete on public.board_phrases to authenticated;

-- création via create_game() ; l'hôte ne peut changer que le statut
grant select, delete on public.games to authenticated;
grant update (status) on public.games to authenticated;

-- insertion via join_game() ; un joueur ne change que son pseudo et ses coches
grant select, delete on public.game_players to authenticated;
grant update (nickname, checked) on public.game_players to authenticated;

grant select, insert, delete on public.game_events to authenticated;

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------

create policy "boards: lecture propriétaire, modèles, membres d'une partie"
  on public.boards for select
  to anon, authenticated
  using (
    is_template
    or owner_id = (select auth.uid())
    or public.board_in_my_games(id)
  );

create policy "boards: création par soi-même"
  on public.boards for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and not is_template);

create policy "boards: modification par le propriétaire"
  on public.boards for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and not is_template);

create policy "boards: suppression par le propriétaire"
  on public.boards for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- board_phrases
-- ---------------------------------------------------------------------------

create policy "board_phrases: lecture si le bingo est lisible"
  on public.board_phrases for select
  to anon, authenticated
  using (public.can_read_board(board_id));

create policy "board_phrases: ajout par le propriétaire"
  on public.board_phrases for insert
  to authenticated
  with check (public.owns_board(board_id));

create policy "board_phrases: modification par le propriétaire"
  on public.board_phrases for update
  to authenticated
  using (public.owns_board(board_id))
  with check (public.owns_board(board_id));

create policy "board_phrases: suppression par le propriétaire"
  on public.board_phrases for delete
  to authenticated
  using (public.owns_board(board_id));

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------

create policy "games: lecture par l'hôte et les joueurs"
  on public.games for select
  to authenticated
  using (host_id = (select auth.uid()) or public.is_game_member(id));

create policy "games: modification par l'hôte"
  on public.games for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "games: suppression par l'hôte"
  on public.games for delete
  to authenticated
  using (host_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------

create policy "game_players: lecture par les membres de la partie"
  on public.game_players for select
  to authenticated
  using (public.is_game_member(game_id));

create policy "game_players: un joueur ne modifie que sa ligne"
  on public.game_players for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "game_players: quitter la partie ou être exclu par l'hôte"
  on public.game_players for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.games g
      where g.id = game_id and g.host_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- game_events
-- ---------------------------------------------------------------------------

create policy "game_events: lecture par les membres de la partie"
  on public.game_events for select
  to authenticated
  using (public.is_game_member(game_id));

create policy "game_events: seul l'hôte valide, en mode validé"
  on public.game_events for insert
  to authenticated
  with check (
    validated_by = (select auth.uid())
    and exists (
      select 1
      from public.games g
      join public.board_phrases bp on bp.board_id = g.board_id
      where g.id = game_id
        and bp.id = phrase_id
        and g.host_id = (select auth.uid())
        and g.mode = 'validated'
        and g.status = 'playing'
    )
  );

create policy "game_events: seul l'hôte annule une validation"
  on public.game_events for delete
  to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and g.host_id = (select auth.uid())
    )
  );
