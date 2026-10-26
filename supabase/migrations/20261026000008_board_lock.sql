-- BingoBuzz — un bingo n'est modifiable que tant qu'aucune partie en cours
-- n'a de joueur : les grilles distribuées doivent correspondre au bingo.

create or replace function public.board_locked(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    join public.game_players p on p.game_id = g.id
    where g.board_id = p_board_id
      and g.status = 'playing'
  );
$$;

revoke execute on function public.board_locked(uuid) from public;
grant execute on function public.board_locked(uuid) to authenticated;

-- save_board : même fonction qu'en 20261023000004, avec le verrou en plus.
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
