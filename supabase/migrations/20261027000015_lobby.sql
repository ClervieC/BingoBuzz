-- BingoBuzz — préparation collaborative d'un bingo
--
-- * Un bingo peut être enregistré en brouillon (moins de phrases que de cases).
-- * L'hôte ouvre une partie « lobby » : on la rejoint avec le code / lien
--   habituel, chaque membre ajoute des phrases au bingo (et retire les siennes).
-- * start_game distribue alors une grille à chacun et passe la partie en jeu.
--
-- Ré-exécutable sans erreur (colonnes, index, renommage et publication gardés).

-- ===========================================================================
-- 1. Colonnes
-- ===========================================================================

-- durée choisie à la création, appliquée au lancement (ends_at)
alter table public.games
  add column if not exists duration_days smallint check (duration_days between 1 and 30);

-- auteur d'une phrase proposée pendant la préparation (null : propriétaire / éditeur)
alter table public.board_phrases
  add column if not exists added_by uuid references auth.users (id) on delete set null;

create index if not exists board_phrases_added_by_idx on public.board_phrases (added_by);

-- ===========================================================================
-- 2. Statut : on n'entre pas en préparation après coup, et on n'en sort vers
--    « playing » que par start_game (qui distribue les grilles).
-- ===========================================================================

create or replace function public.bb_games_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('bingobuzz.system', true), '') <> 'on' then
    if new.status = 'lobby' then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    if old.status = 'lobby' and new.status = 'playing' then
      raise exception 'use_start_game' using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'finished' and old.status <> 'finished' then
    new.ended_at := now();
  elsif new.status <> 'finished' then
    new.ended_at := null;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 3. Brouillons : save_board accepte un bingo incomplet
--    (le nombre de phrases est vérifié au lancement d'une partie).
-- ===========================================================================

create or replace function public.save_board(
  p_id          uuid,
  p_title       text,
  p_theme       jsonb,
  p_grid_size   integer,
  p_free_center boolean,
  p_phrases     text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid;
  v_clean text[];
  v_count integer;
  v_free  boolean := coalesce(p_free_center, false) and p_grid_size % 2 = 1;
  v_i     integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_id is not null and public.board_locked(p_id) then
    raise exception 'board_locked' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(s.t order by s.ord), '{}')
  into v_clean
  from (
    select distinct on (lower(btrim(u.t))) btrim(u.t) as t, u.ord
    from unnest(p_phrases) with ordinality as u(t, ord)
    where btrim(coalesce(u.t, '')) <> ''
    order by lower(btrim(u.t)), u.ord
  ) s;

  v_count := coalesce(array_length(v_clean, 1), 0);

  if p_id is null then
    insert into public.boards (owner_id, title, theme, grid_size, free_center)
    values ((select auth.uid()), btrim(p_title), coalesce(p_theme, '{}'::jsonb), p_grid_size, v_free)
    returning id into v_id;
  else
    update public.boards
    set title = btrim(p_title),
        theme = coalesce(p_theme, theme),
        grid_size = p_grid_size,
        free_center = v_free
    where id = p_id and owner_id = (select auth.uid())
    returning id into v_id;

    if v_id is null then
      raise exception 'board_not_found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.board_phrases bp
  where bp.board_id = v_id and not (bp.text = any (v_clean));

  for v_i in 1..v_count loop
    update public.board_phrases
    set position = v_i - 1
    where board_id = v_id and text = v_clean[v_i];

    if not found then
      insert into public.board_phrases (board_id, text, position)
      values (v_id, v_clean[v_i], v_i - 1);
    end if;
  end loop;

  return v_id;
end;
$$;

-- ===========================================================================
-- 4. Distribution d'une grille (extrait de join_game, réutilisé par start_game)
-- ===========================================================================

create or replace function public.bb_deal_grid(p_game public.games)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board     public.boards;
  v_ids       uuid[];
  v_texts     text[];
  v_perm      integer[];
  v_validated uuid[];
  v_seed      bigint;
  v_size      integer;
  v_total     integer;
  v_center    integer;
  v_needed    integer;
  v_grid      jsonb := '[]'::jsonb;
  v_checked   jsonb := '[]'::jsonb;
  v_k         integer := 1;
  v_pos       integer;
begin
  select * into v_board from public.boards where id = p_game.board_id;

  select array_agg(bp.id order by bp.position, bp.id),
         array_agg(bp.text order by bp.position, bp.id)
  into v_ids, v_texts
  from public.board_phrases bp
  where bp.board_id = v_board.id;

  v_size   := v_board.grid_size;
  v_total  := v_size * v_size;
  v_center := case when v_board.free_center and v_size % 2 = 1 then (v_total - 1) / 2 else -1 end;
  v_needed := v_total - case when v_center >= 0 then 1 else 0 end;

  if coalesce(array_length(v_ids, 1), 0) < v_needed then
    raise exception 'not_enough_phrases' using errcode = '22023';
  end if;

  v_seed := floor(random() * 2147483646)::bigint + 1;
  v_perm := public.bb_shuffle(array(select generate_series(1, array_length(v_ids, 1))), v_seed);

  -- en mode validé, les phrases déjà confirmées sont cochées d'office
  select coalesce(array_agg(e.phrase_id), '{}')
  into v_validated
  from public.game_events e
  where e.game_id = p_game.id;

  for v_pos in 0..v_total - 1 loop
    if v_pos = v_center then
      v_grid := v_grid || jsonb_build_array(jsonb_build_object('id', null, 'text', '', 'free', true));
      v_checked := v_checked || jsonb_build_array(true);
    else
      v_grid := v_grid || jsonb_build_array(
        jsonb_build_object('id', v_ids[v_perm[v_k]], 'text', v_texts[v_perm[v_k]])
      );
      v_checked := v_checked || jsonb_build_array(v_ids[v_perm[v_k]] = any (v_validated));
      v_k := v_k + 1;
    end if;
  end loop;

  return jsonb_build_object('seed', v_seed, 'grid', v_grid, 'checked', v_checked);
end;
$$;

revoke execute on function public.bb_deal_grid(public.games) from public, anon, authenticated;

-- join_game v2 : en préparation, on rejoint sans grille (distribuée au lancement)
create or replace function public.join_game(p_code text, p_nickname text)
returns public.game_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_nick   text := btrim(coalesce(p_nickname, ''));
  v_game   public.games;
  v_player public.game_players;
  v_deal   jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_nick) not between 1 and 24 then
    raise exception 'invalid_nickname' using errcode = '22023';
  end if;

  select * into v_game from public.games where code = upper(btrim(p_code));
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  select * into v_player
  from public.game_players
  where game_id = v_game.id and user_id = v_uid;

  if found then
    update public.game_players set nickname = v_nick
    where id = v_player.id
    returning * into v_player;
    return v_player;
  end if;

  if v_game.status = 'finished' then
    raise exception 'game_finished' using errcode = 'P0001';
  end if;

  if v_game.status = 'lobby' then
    v_deal := jsonb_build_object('seed', 1, 'grid', '[]'::jsonb, 'checked', '[]'::jsonb);
  else
    v_deal := public.bb_deal_grid(v_game);
  end if;

  insert into public.game_players (game_id, user_id, nickname, seed, grid, checked)
  values (v_game.id, v_uid, v_nick, (v_deal ->> 'seed')::bigint, v_deal -> 'grid', v_deal -> 'checked')
  on conflict (game_id, user_id) do update set nickname = excluded.nickname
  returning * into v_player;

  return v_player;
end;
$$;

-- ===========================================================================
-- 5. create_game v4 : option « préparer avec le groupe »
-- ===========================================================================

drop function if exists public.create_game(uuid, public.game_mode, public.game_auto_end, integer);

create or replace function public.create_game(
  p_board_id      uuid,
  p_mode          public.game_mode default 'free',
  p_auto_end      public.game_auto_end default 'manual',
  p_duration_days integer default null,
  p_lobby         boolean default false
)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_board    public.boards;
  v_count    integer;
  v_required integer;
  v_game     public.games;
  v_lobby    boolean := coalesce(p_lobby, false);
  v_attempt  integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_duration_days is not null and p_duration_days not between 1 and 30 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  select * into v_board
  from public.boards b
  where b.id = p_board_id and (b.owner_id = v_uid or b.is_template);
  if not found then
    raise exception 'board_not_found' using errcode = 'P0002';
  end if;
  -- les invités écrivent dans le bingo : impossible sur un modèle partagé
  if v_lobby and v_board.owner_id is distinct from v_uid then
    raise exception 'lobby_template' using errcode = 'P0001';
  end if;

  -- un bingo ne se joue qu'une fois à la fois : partie ouverte → on y retourne
  select * into v_game
  from public.games g
  where g.board_id = v_board.id and g.host_id = v_uid and g.status in ('lobby', 'playing')
  order by g.created_at desc
  limit 1;
  if found then
    return v_game;
  end if;

  if not v_lobby then
    select count(*) into v_count from public.board_phrases where board_id = v_board.id;
    v_required := v_board.grid_size * v_board.grid_size
                  - case when v_board.free_center then 1 else 0 end;
    if v_count < v_required then
      raise exception 'not_enough_phrases' using errcode = '22023';
    end if;
  end if;

  -- (le trigger de statut ne s'applique qu'aux mises à jour : créer en « lobby » est permis)
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.games (board_id, host_id, code, mode, auto_end, status, duration_days, ends_at)
      values (
        v_board.id, v_uid, public.bb_random_code(), coalesce(p_mode, 'free'),
        coalesce(p_auto_end, 'manual'),
        case when v_lobby then 'lobby'::public.game_status else 'playing'::public.game_status end,
        p_duration_days,
        case when p_duration_days is null or v_lobby then null
             else now() + make_interval(days => p_duration_days) end
      )
      returning * into v_game;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception 'code_generation_failed' using errcode = 'P0001';
      end if;
    end;
  end loop;

  return v_game;
end;
$$;

revoke execute on function public.create_game(uuid, public.game_mode, public.game_auto_end, integer, boolean) from public, anon;
grant execute on function public.create_game(uuid, public.game_mode, public.game_auto_end, integer, boolean) to authenticated;

-- ===========================================================================
-- 6. Préparation : ajouter / retirer des phrases, lancer la partie
-- ===========================================================================

create or replace function public.add_lobby_phrase(p_game_id uuid, p_text text)
returns public.board_phrases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_text   text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  v_game   public.games;
  v_phrase public.board_phrases;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_game_member(p_game_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  -- verrou : deux ajouts simultanés ne se marchent pas dessus (position, limite)
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.status <> 'lobby' then
    raise exception 'not_lobby' using errcode = 'P0001';
  end if;
  if char_length(v_text) not between 1 and 120 then
    raise exception 'invalid_phrase' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.board_phrases
    where board_id = v_game.board_id and lower(text) = lower(v_text)
  ) then
    raise exception 'phrase_exists' using errcode = '23505';
  end if;
  if (select count(*) from public.board_phrases where board_id = v_game.board_id) >= 200 then
    raise exception 'too_many_phrases' using errcode = '22023';
  end if;

  insert into public.board_phrases (board_id, text, position, added_by)
  values (
    v_game.board_id, v_text,
    coalesce((select max(position) + 1 from public.board_phrases where board_id = v_game.board_id), 0),
    v_uid
  )
  returning * into v_phrase;
  return v_phrase;
end;
$$;

-- On retire ses propres phrases ; l'hôte peut retirer toutes celles du bingo.
create or replace function public.remove_lobby_phrase(p_game_id uuid, p_phrase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_game public.games;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_game_member(p_game_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into v_game from public.games where id = p_game_id;
  if v_game.status <> 'lobby' then
    raise exception 'not_lobby' using errcode = 'P0001';
  end if;

  delete from public.board_phrases bp
  where bp.id = p_phrase_id
    and bp.board_id = v_game.board_id
    and (bp.added_by = v_uid or v_game.host_id = v_uid);
  if not found then
    raise exception 'phrase_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.start_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_game   public.games;
  v_player public.game_players;
  v_deal   jsonb;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.host_id is distinct from v_uid then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.status <> 'lobby' then
    raise exception 'not_lobby' using errcode = 'P0001';
  end if;

  perform set_config('bingobuzz.system', 'on', true);

  update public.games
  set status = 'playing',
      created_at = now(),
      ends_at = case when duration_days is null then null
                     else now() + make_interval(days => duration_days::integer) end
  where id = v_game.id
  returning * into v_game;

  -- une grille par membre (not_enough_phrases annule tout le lancement)
  for v_player in select * from public.game_players where game_id = v_game.id loop
    v_deal := public.bb_deal_grid(v_game);
    update public.game_players
    set seed = (v_deal ->> 'seed')::bigint, grid = v_deal -> 'grid', checked = v_deal -> 'checked'
    where id = v_player.id;
  end loop;

  perform set_config('bingobuzz.system', '', true);
  return v_game;
end;
$$;

revoke execute on function public.add_lobby_phrase(uuid, text) from public, anon;
revoke execute on function public.remove_lobby_phrase(uuid, uuid) from public, anon;
revoke execute on function public.start_game(uuid) from public, anon;
grant execute on function public.add_lobby_phrase(uuid, text) to authenticated;
grant execute on function public.remove_lobby_phrase(uuid, uuid) to authenticated;
grant execute on function public.start_game(uuid) to authenticated;

-- les phrases arrivent en direct dans la salle de préparation
do $$
begin
  alter publication supabase_realtime add table public.board_phrases;
exception when duplicate_object then
  null; -- déjà publiée
end;
$$;

-- ===========================================================================
-- 7. Notification « la partie commence »
-- ===========================================================================

create or replace function public.bb_push_on_game_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finished' and old.status <> 'finished' then
    perform private.notify_push('game_finished', jsonb_build_object('game_id', new.id));
  elsif new.status = 'playing' and old.status = 'lobby' then
    perform private.notify_push('game_started', jsonb_build_object('game_id', new.id, 'actor_id', new.host_id));
  end if;
  return null;
end;
$$;

-- ===========================================================================
-- 8. Export RGPD : phrases proposées dans les bingos des autres
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_catalog.pg_proc where proname = 'bb_export_my_data_v13') then
    alter function public.export_my_data() rename to bb_export_my_data_v13;
  end if;
end;
$$;
revoke execute on function public.bb_export_my_data_v13() from public, anon, authenticated;

create or replace function public.export_my_data()
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

  return public.bb_export_my_data_v13() || jsonb_build_object(
    'contributed_phrases', coalesce((
      select jsonb_agg(jsonb_build_object('board_id', p.board_id, 'text', p.text, 'created_at', p.created_at)
                       order by p.created_at)
      from public.board_phrases p
      join public.boards b on b.id = p.board_id
      where p.added_by = v_uid and b.owner_id is distinct from v_uid
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ===========================================================================
-- 9. Réglages modifiables par l'hôte après la création
--    * en préparation : mode, règle de fin, durée (appliquée au lancement)
--    * en jeu : règle de fin et échéance (le mode ne change plus : les coches
--      et propositions déjà faites en dépendent)
-- ===========================================================================

create or replace function public.update_game_settings(
  p_game_id       uuid,
  p_mode          public.game_mode,
  p_auto_end      public.game_auto_end,
  p_duration_days integer default null,
  -- en jeu : garder l'échéance actuelle au lieu d'en recalculer une
  p_keep_deadline boolean default false
)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.host_id is distinct from v_uid then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.status = 'finished' then
    raise exception 'game_finished' using errcode = 'P0001';
  end if;
  if p_duration_days is not null and p_duration_days not between 1 and 30 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  if v_game.status = 'lobby' then
    update public.games
    set mode = coalesce(p_mode, mode),
        auto_end = coalesce(p_auto_end, 'manual'),
        duration_days = p_duration_days
    where id = p_game_id
    returning * into v_game;
    return v_game;
  end if;

  if p_mode is not null and p_mode <> v_game.mode then
    raise exception 'mode_locked' using errcode = 'P0001';
  end if;

  update public.games
  set auto_end = coalesce(p_auto_end, 'manual'),
      duration_days = case when coalesce(p_keep_deadline, false) then duration_days else p_duration_days end,
      ends_at = case
        when coalesce(p_keep_deadline, false) then ends_at
        when p_duration_days is null then null
        else now() + make_interval(days => p_duration_days)
      end
  where id = p_game_id
  returning * into v_game;

  -- la nouvelle règle est peut-être déjà remplie
  if (v_game.auto_end = 'first_bingo'
        and exists (select 1 from public.game_players where game_id = p_game_id and has_bingo))
     or (v_game.auto_end = 'full_card'
        and exists (
          select 1 from public.game_players p
          where p.game_id = p_game_id and jsonb_array_length(p.checked) > 0
            and not exists (select 1 from jsonb_array_elements(p.checked) e where e.value = 'false'::jsonb)
        )) then
    update public.games set status = 'finished' where id = p_game_id returning * into v_game;
  end if;

  return v_game;
end;
$$;

revoke execute on function public.update_game_settings(uuid, public.game_mode, public.game_auto_end, integer, boolean) from public, anon;
grant execute on function public.update_game_settings(uuid, public.game_mode, public.game_auto_end, integer, boolean) to authenticated;

-- ===========================================================================
-- 10. Remise à zéro par l'hôte : toutes les coches, validations, propositions
--     et réactions sont effacées ; option : nouvelles grilles pour tous.
--     Une partie terminée repart. Les photos des propositions effacées sont
--     retirées du stockage par l'application (et sinon par la tâche planifiée).
-- ===========================================================================

create or replace function public.reset_game(p_game_id uuid, p_new_grids boolean default false)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_game   public.games;
  v_player public.game_players;
  v_deal   jsonb;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.host_id is distinct from v_uid then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.status = 'lobby' then
    raise exception 'not_started' using errcode = 'P0001';
  end if;

  perform set_config('bingobuzz.system', 'on', true);

  delete from public.game_reactions where game_id = p_game_id;
  delete from public.game_claims where game_id = p_game_id;
  delete from public.game_events where game_id = p_game_id;

  update public.games
  set status = 'playing',
      created_at = now(),
      ends_at = case when duration_days is null then null
                     else now() + make_interval(days => duration_days::integer) end
  where id = p_game_id
  returning * into v_game;

  for v_player in select * from public.game_players where game_id = p_game_id loop
    if coalesce(p_new_grids, false) then
      v_deal := public.bb_deal_grid(v_game);
      update public.game_players
      set seed = (v_deal ->> 'seed')::bigint, grid = v_deal -> 'grid', checked = v_deal -> 'checked'
      where id = v_player.id;
    else
      -- seule la case libre reste cochée
      update public.game_players
      set checked = (
        select coalesce(jsonb_agg(coalesce((g.cell ->> 'free')::boolean, false) order by g.idx), '[]'::jsonb)
        from jsonb_array_elements(v_player.grid) with ordinality as g(cell, idx)
      )
      where id = v_player.id;
    end if;
  end loop;

  perform set_config('bingobuzz.system', '', true);
  return v_game;
end;
$$;

revoke execute on function public.reset_game(uuid, boolean) from public, anon;
grant execute on function public.reset_game(uuid, boolean) to authenticated;

-- ===========================================================================
-- 11. Retour en préparation : la partie (en cours ou terminée) redevient un
--     brouillon. Coches, validations, propositions et réactions sont effacées,
--     les grilles retirées ; les membres restent et peuvent ajouter des
--     phrases. Le bingo redevient modifiable ; start_game relance.
-- ===========================================================================

create or replace function public.reopen_lobby(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_game  public.games;
  v_board public.boards;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found or v_game.host_id is distinct from v_uid then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.status = 'lobby' then
    return v_game;
  end if;
  -- les membres écriront dans le bingo : il doit appartenir à l'hôte
  select * into v_board from public.boards where id = v_game.board_id;
  if v_board.owner_id is distinct from v_uid then
    raise exception 'lobby_template' using errcode = 'P0001';
  end if;
  -- une seule partie ouverte par bingo
  if exists (
    select 1 from public.games g
    where g.board_id = v_game.board_id and g.host_id = v_uid and g.id <> v_game.id
      and g.status in ('lobby', 'playing')
  ) then
    raise exception 'game_already_open' using errcode = 'P0001';
  end if;

  perform set_config('bingobuzz.system', 'on', true);

  delete from public.game_reactions where game_id = p_game_id;
  delete from public.game_claims where game_id = p_game_id;
  delete from public.game_events where game_id = p_game_id;

  update public.game_players
  set grid = '[]'::jsonb, checked = '[]'::jsonb
  where game_id = p_game_id;

  update public.games
  set status = 'lobby', ends_at = null
  where id = p_game_id
  returning * into v_game;

  perform set_config('bingobuzz.system', '', true);
  return v_game;
end;
$$;

revoke execute on function public.reopen_lobby(uuid) from public, anon;
grant execute on function public.reopen_lobby(uuid) to authenticated;
