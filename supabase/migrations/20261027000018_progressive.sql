-- BingoBuzz — paliers de bingo : 1 ligne → BINGO, 2 lignes → DOUBLE BINGO,
-- grille complète → CARTON PLEIN. Avec la règle « progressive », le carton
-- plein termine la partie. Ré-exécutable sans erreur.

-- ===========================================================================
-- 1. Nombre de lignes complètes (lignes, colonnes, diagonales)
-- ===========================================================================

create or replace function public.bb_count_lines(p_checked jsonb, p_size integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_r     integer;
  v_c     integer;
  v_ok    boolean;
begin
  if p_checked is null or jsonb_typeof(p_checked) <> 'array' or p_size < 1
     or jsonb_array_length(p_checked) <> p_size * p_size then
    return 0;
  end if;

  for v_r in 0..p_size - 1 loop
    v_ok := true;
    for v_c in 0..p_size - 1 loop
      if not coalesce((p_checked ->> (v_r * p_size + v_c))::boolean, false) then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  for v_c in 0..p_size - 1 loop
    v_ok := true;
    for v_r in 0..p_size - 1 loop
      if not coalesce((p_checked ->> (v_r * p_size + v_c))::boolean, false) then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  v_ok := true;
  for v_r in 0..p_size - 1 loop
    if not coalesce((p_checked ->> (v_r * p_size + v_r))::boolean, false) then
      v_ok := false;
      exit;
    end if;
  end loop;
  if v_ok then v_count := v_count + 1; end if;

  v_ok := true;
  for v_r in 0..p_size - 1 loop
    if not coalesce((p_checked ->> (v_r * p_size + (p_size - 1 - v_r)))::boolean, false) then
      v_ok := false;
      exit;
    end if;
  end loop;
  if v_ok then v_count := v_count + 1; end if;

  return v_count;
end;
$$;

-- ===========================================================================
-- 2. Paliers par joueur (horodatés au moment où ils sont atteints)
-- ===========================================================================

alter table public.game_players
  add column if not exists lines     smallint not null default 0,
  add column if not exists double_at timestamptz,
  add column if not exists full_at   timestamptz;

-- après game_players_guard (ordre alphabétique des triggers BEFORE)
create or replace function public.bb_game_players_stages()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_len  integer := jsonb_array_length(new.checked);
  v_full boolean;
begin
  new.lines := public.bb_count_lines(new.checked, round(sqrt(v_len))::integer);
  v_full := v_len > 0 and not exists (
    select 1 from jsonb_array_elements(new.checked) e where e.value = 'false'::jsonb
  );

  if new.lines >= 2 then
    new.double_at := case when tg_op = 'UPDATE' and old.double_at is not null then old.double_at else now() end;
  else
    new.double_at := null;
  end if;

  if v_full then
    new.full_at := case when tg_op = 'UPDATE' and old.full_at is not null then old.full_at else now() end;
  else
    new.full_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists game_players_stages on public.game_players;
create trigger game_players_stages
  before insert or update of checked, grid on public.game_players
  for each row execute function public.bb_game_players_stages();

revoke execute on function public.bb_game_players_stages() from public, anon, authenticated;

-- lignes déjà cochées avant cette migration
update public.game_players set checked = checked where jsonb_array_length(checked) > 0;

-- ===========================================================================
-- 3. Fin automatique : la règle progressive se termine au carton plein
-- ===========================================================================

create or replace function public.bb_auto_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
begin
  if not new.has_bingo then
    return null;
  end if;

  select * into v_game from public.games where id = new.game_id;
  if v_game.status <> 'playing' then
    return null;
  end if;

  if v_game.auto_end = 'first_bingo'
     or (v_game.auto_end in ('full_card', 'progressive') and new.full_at is not null) then
    update public.games set status = 'finished' where id = v_game.id;
  end if;
  return null;
end;
$$;

-- update_game_settings : « déjà rempli » tient compte de la règle progressive
create or replace function public.update_game_settings(
  p_game_id       uuid,
  p_mode          public.game_mode,
  p_auto_end      public.game_auto_end,
  p_duration_days integer default null,
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

  if (v_game.auto_end = 'first_bingo'
        and exists (select 1 from public.game_players where game_id = p_game_id and has_bingo))
     or (v_game.auto_end in ('full_card', 'progressive')
        and exists (select 1 from public.game_players where game_id = p_game_id and full_at is not null)) then
    update public.games set status = 'finished' where id = p_game_id returning * into v_game;
  end if;

  return v_game;
end;
$$;

-- ===========================================================================
-- 4. Notifications : bingo (corrigé) et double bingo
-- ===========================================================================

-- has_bingo est calculé par la base (le client n'écrit que `checked`) :
-- le trigger doit donc suivre `checked`, pas `has_bingo`.
create or replace function public.bb_push_on_bingo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.has_bingo and (tg_op = 'INSERT' or not old.has_bingo) then
    perform private.notify_push('bingo', jsonb_build_object(
      'game_id', new.game_id, 'player_id', new.id, 'actor_id', new.user_id));
  end if;
  if new.double_at is not null and new.full_at is null
     and (tg_op = 'INSERT' or old.double_at is null) then
    perform private.notify_push('double_bingo', jsonb_build_object(
      'game_id', new.game_id, 'player_id', new.id, 'actor_id', new.user_id));
  end if;
  return null;
end;
$$;

drop trigger if exists game_players_push on public.game_players;
create trigger game_players_push
  after insert or update of checked on public.game_players
  for each row execute function public.bb_push_on_bingo();
