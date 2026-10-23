-- BingoBuzz — logique de jeu côté base
--
-- Le mélange et la détection de bingo existent aussi en TypeScript
-- (lib/random.ts et lib/bingo.ts). Les deux implémentations DOIVENT rester
-- identiques : même générateur (Park–Miller, multiplicateur 48271), même
-- Fisher-Yates, même ordre des phrases (position, id).

-- ---------------------------------------------------------------------------
-- Mélange Fisher-Yates à graine
-- ---------------------------------------------------------------------------

-- Retourne une permutation de p_items (tableau 1-indexé) déterminée par p_seed.
-- Équivalent exact de shuffle() dans lib/random.ts.
create or replace function public.bb_shuffle(p_items integer[], p_seed bigint)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_items integer[] := p_items;
  v_n     integer := coalesce(array_length(p_items, 1), 0);
  v_state bigint := mod(p_seed, 2147483647);
  v_i     integer;
  v_j     integer;
  v_tmp   integer;
begin
  if v_state <= 0 then
    v_state := v_state + 2147483646;
  end if;

  -- i va de n à 2 (1-indexé) ⇔ de n-1 à 1 (0-indexé) en TypeScript
  for v_i in reverse v_n..2 loop
    v_state := mod(v_state * 48271, 2147483647);
    v_j := mod(v_state, v_i) + 1;
    v_tmp := v_items[v_i];
    v_items[v_i] := v_items[v_j];
    v_items[v_j] := v_tmp;
  end loop;

  return v_items;
end;
$$;

-- ---------------------------------------------------------------------------
-- Détection de bingo (lignes, colonnes, 2 diagonales) pour une grille N×N
-- ---------------------------------------------------------------------------

create or replace function public.bb_has_bingo(p_checked jsonb, p_size integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_r  integer;
  v_c  integer;
  v_ok boolean;
begin
  if p_checked is null
     or jsonb_typeof(p_checked) <> 'array'
     or p_size < 1
     or jsonb_array_length(p_checked) <> p_size * p_size then
    return false;
  end if;

  -- lignes
  for v_r in 0..p_size - 1 loop
    v_ok := true;
    for v_c in 0..p_size - 1 loop
      if not coalesce((p_checked ->> (v_r * p_size + v_c))::boolean, false) then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then return true; end if;
  end loop;

  -- colonnes
  for v_c in 0..p_size - 1 loop
    v_ok := true;
    for v_r in 0..p_size - 1 loop
      if not coalesce((p_checked ->> (v_r * p_size + v_c))::boolean, false) then
        v_ok := false;
        exit;
      end if;
    end loop;
    if v_ok then return true; end if;
  end loop;

  -- diagonale principale
  v_ok := true;
  for v_r in 0..p_size - 1 loop
    if not coalesce((p_checked ->> (v_r * p_size + v_r))::boolean, false) then
      v_ok := false;
      exit;
    end if;
  end loop;
  if v_ok then return true; end if;

  -- anti-diagonale
  v_ok := true;
  for v_r in 0..p_size - 1 loop
    if not coalesce((p_checked ->> (v_r * p_size + (p_size - 1 - v_r)))::boolean, false) then
      v_ok := false;
      exit;
    end if;
  end loop;

  return v_ok;
end;
$$;

-- ---------------------------------------------------------------------------
-- Garde-fou sur game_players : forme de `checked`, mode validé, has_bingo
-- ---------------------------------------------------------------------------

create or replace function public.bb_game_players_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mode   public.game_mode;
  v_status public.game_status;
  v_len    integer;
begin
  if tg_op = 'UPDATE' and new.checked is distinct from old.checked then
    -- les coches posées par le système (validation de l'hôte) passent toujours
    if coalesce(current_setting('bingobuzz.system', true), '') <> 'on' then
      select g.mode, g.status into v_mode, v_status
      from public.games g
      where g.id = new.game_id;

      if v_status = 'finished' then
        raise exception 'game_finished' using errcode = 'P0001';
      end if;
      if v_mode = 'validated' then
        raise exception 'validated_mode' using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_len := jsonb_array_length(new.grid);

  if jsonb_typeof(new.checked) <> 'array' or jsonb_array_length(new.checked) <> v_len then
    raise exception 'invalid_checked' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.checked) as e(value)
    where jsonb_typeof(e.value) <> 'boolean'
  ) then
    raise exception 'invalid_checked' using errcode = '22023';
  end if;

  -- la case libre reste toujours cochée
  if exists (
    select 1
    from jsonb_array_elements(new.grid) with ordinality as g(cell, idx)
    where coalesce((g.cell ->> 'free')::boolean, false)
      and not (new.checked ->> (g.idx::integer - 1))::boolean
  ) then
    raise exception 'invalid_checked' using errcode = '22023';
  end if;

  new.has_bingo := public.bb_has_bingo(new.checked, round(sqrt(v_len))::integer);

  if new.has_bingo then
    if tg_op = 'INSERT' or not old.has_bingo then
      new.bingo_at := now();
    end if;
  else
    new.bingo_at := null;
  end if;

  return new;
end;
$$;

create trigger game_players_guard
  before insert or update on public.game_players
  for each row execute function public.bb_game_players_guard();

-- ---------------------------------------------------------------------------
-- Mode validé : propager une validation (ou son annulation) à toutes les grilles
-- ---------------------------------------------------------------------------

create or replace function public.bb_apply_game_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event   public.game_events;
  v_checked boolean;
begin
  if tg_op = 'INSERT' then
    v_event := new;
    v_checked := true;
  else
    v_event := old;
    v_checked := false;
  end if;

  perform set_config('bingobuzz.system', 'on', true);

  update public.game_players p
  set checked = (
    select jsonb_agg(
      case
        when g.cell ->> 'id' = v_event.phrase_id::text then to_jsonb(v_checked)
        else p.checked -> (g.idx::integer - 1)
      end
      order by g.idx
    )
    from jsonb_array_elements(p.grid) with ordinality as g(cell, idx)
  )
  where p.game_id = v_event.game_id
    and p.grid @> jsonb_build_array(jsonb_build_object('id', v_event.phrase_id));

  perform set_config('bingobuzz.system', 'off', true);

  return null;
end;
$$;

create trigger game_events_apply
  after insert or delete on public.game_events
  for each row execute function public.bb_apply_game_event();

-- ended_at automatique
create or replace function public.bb_games_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'finished' and old.status <> 'finished' then
    new.ended_at := now();
  elsif new.status <> 'finished' then
    new.ended_at := null;
  end if;
  return new;
end;
$$;

create trigger games_status
  before update of status on public.games
  for each row execute function public.bb_games_status();

-- les fonctions de trigger ne sont pas des API
revoke execute on function public.bb_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.bb_game_players_guard() from public, anon, authenticated;
revoke execute on function public.bb_apply_game_event() from public, anon, authenticated;
revoke execute on function public.bb_games_status() from public, anon, authenticated;
