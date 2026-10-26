-- BingoBuzz — un bingo ne se joue qu'une fois à la fois (par animateur) :
-- relancer une partie depuis un bingo qui en a déjà une en cours renvoie
-- simplement cette partie au lieu d'en créer une nouvelle.

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

  -- partie déjà en cours avec ce bingo : on y retourne
  select * into v_game
  from public.games g
  where g.board_id = v_board.id and g.host_id = v_uid and g.status = 'playing'
  order by g.created_at desc
  limit 1;

  if found then
    return v_game;
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
