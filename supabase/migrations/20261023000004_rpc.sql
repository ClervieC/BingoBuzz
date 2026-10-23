-- BingoBuzz — fonctions appelées par l'application (supabase.rpc)

-- ---------------------------------------------------------------------------
-- save_board : crée ou met à jour un bingo et ses phrases de façon atomique.
-- security invoker : les policies RLS s'appliquent normalement.
-- Les phrases conservées gardent leur id (les parties en cours restent valides).
-- ---------------------------------------------------------------------------

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
  v_id       uuid;
  v_clean    text[];
  v_count    integer;
  v_required integer;
  v_free     boolean := coalesce(p_free_center, false) and p_grid_size % 2 = 1;
  v_i        integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- nettoyage : trim, lignes vides retirées, doublons (insensibles à la casse)
  -- retirés en gardant la première occurrence
  select coalesce(array_agg(s.t order by s.ord), '{}')
  into v_clean
  from (
    select distinct on (lower(btrim(u.t))) btrim(u.t) as t, u.ord
    from unnest(p_phrases) with ordinality as u(t, ord)
    where btrim(coalesce(u.t, '')) <> ''
    order by lower(btrim(u.t)), u.ord
  ) s;

  v_count := coalesce(array_length(v_clean, 1), 0);
  v_required := p_grid_size * p_grid_size - case when v_free then 1 else 0 end;

  if v_count < v_required then
    raise exception 'not_enough_phrases' using errcode = '22023',
      detail = format('%s phrases, %s requises', v_count, v_required);
  end if;

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

-- ---------------------------------------------------------------------------
-- duplicate_board : copie un bingo lisible (dont les modèles) dans mes bingos
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_board(p_id uuid, p_title text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_src public.boards;
  v_id  uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- RLS : on ne voit que les bingos qu'on a le droit de lire
  select * into v_src from public.boards where id = p_id;
  if not found then
    raise exception 'board_not_found' using errcode = 'P0002';
  end if;

  insert into public.boards (owner_id, title, theme, grid_size, free_center)
  values (
    (select auth.uid()),
    left(coalesce(nullif(btrim(p_title), ''), v_src.title), 80),
    v_src.theme,
    v_src.grid_size,
    v_src.free_center
  )
  returning id into v_id;

  insert into public.board_phrases (board_id, text, position)
  select v_id, bp.text, bp.position
  from public.board_phrases bp
  where bp.board_id = p_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_game : crée une partie avec un code unique à 6 caractères
-- ---------------------------------------------------------------------------

create or replace function public.bb_random_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(b.bytes, i) % 31) + 1, 1),
    '' order by i
  )
  from (select extensions.gen_random_bytes(6) as bytes) b,
       generate_series(0, 5) as i;
$$;

create or replace function public.create_game(
  p_board_id uuid,
  p_mode     public.game_mode default 'free'
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
  v_attempt  integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_board
  from public.boards b
  where b.id = p_board_id and (b.owner_id = v_uid or b.is_template);

  if not found then
    raise exception 'board_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.board_phrases where board_id = v_board.id;
  v_required := v_board.grid_size * v_board.grid_size
                - case when v_board.free_center then 1 else 0 end;
  if v_count < v_required then
    raise exception 'not_enough_phrases' using errcode = '22023';
  end if;

  -- 31^6 ≈ 887 millions de codes : les collisions sont rares, on réessaie
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.games (board_id, host_id, code, mode)
      values (v_board.id, v_uid, public.bb_random_code(), coalesce(p_mode, 'free'))
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

-- ---------------------------------------------------------------------------
-- join_game : rejoindre une partie avec un pseudo.
-- La grille est tirée côté serveur (le client ne peut pas choisir ses phrases).
-- Rejoindre à nouveau (même utilisateur) renvoie la même grille.
-- ---------------------------------------------------------------------------

create or replace function public.join_game(p_code text, p_nickname text)
returns public.game_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_nick      text := btrim(coalesce(p_nickname, ''));
  v_game      public.games;
  v_board     public.boards;
  v_player    public.game_players;
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

  select * into v_board from public.boards where id = v_game.board_id;

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
  v_perm := public.bb_shuffle(
    array(select generate_series(1, array_length(v_ids, 1))),
    v_seed
  );

  -- en mode validé, les phrases déjà confirmées sont cochées d'office
  select coalesce(array_agg(e.phrase_id), '{}')
  into v_validated
  from public.game_events e
  where e.game_id = v_game.id;

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

  insert into public.game_players (game_id, user_id, nickname, seed, grid, checked)
  values (v_game.id, v_uid, v_nick, v_seed, v_grid, v_checked)
  on conflict (game_id, user_id) do update set nickname = excluded.nickname
  returning * into v_player;

  return v_player;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_game_public : infos non sensibles d'une partie à partir de son code.
-- Utilisé avant de rejoindre et pour l'image Open Graph (sans session).
-- ---------------------------------------------------------------------------

create or replace function public.get_game_public(p_code text)
returns table (
  id           uuid,
  code         text,
  mode         public.game_mode,
  status       public.game_status,
  board_id     uuid,
  title        text,
  theme        jsonb,
  grid_size    smallint,
  player_count integer,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.code, g.mode, g.status, g.board_id, b.title, b.theme, b.grid_size,
         (select count(*)::integer from public.game_players p where p.game_id = g.id),
         g.created_at
  from public.games g
  join public.boards b on b.id = g.board_id
  where g.code = upper(btrim(p_code));
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on function public.save_board(uuid, text, jsonb, integer, boolean, text[]) from public, anon;
revoke execute on function public.duplicate_board(uuid, text) from public, anon;
revoke execute on function public.bb_random_code() from public, anon, authenticated;
revoke execute on function public.create_game(uuid, public.game_mode) from public, anon;
revoke execute on function public.join_game(text, text) from public, anon;
revoke execute on function public.get_game_public(text) from public;

grant execute on function public.save_board(uuid, text, jsonb, integer, boolean, text[]) to authenticated;
grant execute on function public.duplicate_board(uuid, text) to authenticated;
grant execute on function public.create_game(uuid, public.game_mode) to authenticated;
grant execute on function public.join_game(text, text) to authenticated;
grant execute on function public.get_game_public(text) to anon, authenticated;
grant execute on function public.bb_shuffle(integer[], bigint) to anon, authenticated;
grant execute on function public.bb_has_bingo(jsonb, integer) to anon, authenticated;
