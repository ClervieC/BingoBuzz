-- BingoBuzz — réactions sur tout ce qui apparaît dans le classement :
-- chaque joueur, et chaque moment du fil (arrivée, bingo, double bingo,
-- carton plein, phrase vue ou validée). Ré-exécutable sans erreur.

-- ===========================================================================
-- 1. Nouvelles cibles
--    joueur : player (ligne du classement), join, bingo, double, full
--    proposition : claim · validation de l'hôte : event
-- ===========================================================================

alter table public.game_reactions drop constraint if exists game_reactions_target_type_check;
alter table public.game_reactions
  add constraint game_reactions_target_type_check
  check (target_type in ('player', 'join', 'bingo', 'double', 'full', 'claim', 'event'));

drop policy if exists "game_reactions: un membre réagit en son nom, sur une cible de la partie" on public.game_reactions;

create policy "game_reactions: un membre réagit en son nom, sur une cible de la partie"
  on public.game_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_game_member(game_id)
    and (
      (target_type in ('player', 'join', 'bingo', 'double', 'full') and exists (
        select 1 from public.game_players p where p.id = target_id and p.game_id = game_reactions.game_id
      ))
      or (target_type = 'claim' and exists (
        select 1 from public.game_claims c where c.id = target_id and c.game_id = game_reactions.game_id
      ))
      or (target_type = 'event' and exists (
        select 1 from public.game_events e where e.id = target_id and e.game_id = game_reactions.game_id
      ))
    )
  );

-- ===========================================================================
-- 2. Statistiques : toutes les réactions reçues comptent pour le badge « Star »
-- ===========================================================================

create or replace function public.get_my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'games_played', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and jsonb_array_length(p.grid) > 0
    ),
    'bingos', (select count(*) from public.game_players p where p.user_id = v_uid and p.has_bingo),
    -- premier bingo de la partie
    'wins', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and p.has_bingo
        and p.bingo_at = (select min(o.bingo_at) from public.game_players o where o.game_id = p.game_id)
    ),
    'full_cards', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and jsonb_array_length(p.checked) > 0
        and not exists (select 1 from jsonb_array_elements(p.checked) e where e.value = 'false'::jsonb)
    ),
    'cells_checked', (
      select coalesce(sum((select count(*) from jsonb_array_elements(p.checked) e where e.value = 'true'::jsonb)), 0)
      from public.game_players p where p.user_id = v_uid
    ),
    'hosted', (select count(*) from public.games g where g.host_id = v_uid),
    'boards', (select count(*) from public.boards b where b.owner_id = v_uid),
    'claims_confirmed', (
      select count(*) from public.game_claims c where c.claimed_by = v_uid and c.status = 'confirmed'
    ),
    'photos', (
      select count(*) from public.game_claims c
      where c.claimed_by = v_uid and c.status = 'confirmed' and c.photo_path is not null
    ),
    'confirmations_given', (
      select count(*) from public.game_claims c
      where c.resolved_by = v_uid and c.claimed_by <> v_uid and c.status = 'confirmed'
    ),
    'phrases_contributed', (
      select count(*) from public.board_phrases bp
      join public.boards b on b.id = bp.board_id
      where bp.added_by = v_uid and b.owner_id is distinct from v_uid
    ),
    'reactions_received', (
      select count(*) from public.game_reactions r
      where r.user_id <> v_uid and (
        (r.target_type in ('bingo', 'double', 'full', 'join', 'player') and exists (select 1 from public.game_players p where p.id = r.target_id and p.user_id = v_uid))
        or (r.target_type = 'claim' and exists (select 1 from public.game_claims c where c.id = r.target_id and c.claimed_by = v_uid))
      )
    ),
    'friends', (
      select count(distinct o.user_id) from public.game_players p
      join public.game_players o on o.game_id = p.game_id and o.user_id <> v_uid
      where p.user_id = v_uid
    ),
    'since', (select u.created_at from auth.users u where u.id = v_uid)
  );
end;
$$;

revoke execute on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;
