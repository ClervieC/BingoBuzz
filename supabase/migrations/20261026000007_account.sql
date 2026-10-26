-- BingoBuzz — droits RGPD : accès / portabilité (art. 15 et 20) et effacement (art. 17)

-- ---------------------------------------------------------------------------
-- export_my_data : toutes les données liées au compte, en un document JSON
-- ---------------------------------------------------------------------------

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

  return jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'providers', u.raw_app_meta_data -> 'providers',
        'profile', u.raw_user_meta_data
      )
      from auth.users u
      where u.id = v_uid
    ),
    'boards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'title', b.title,
          'theme', b.theme,
          'grid_size', b.grid_size,
          'free_center', b.free_center,
          'created_at', b.created_at,
          'updated_at', b.updated_at,
          'phrases', coalesce((
            select jsonb_agg(p.text order by p.position)
            from public.board_phrases p
            where p.board_id = b.id
          ), '[]'::jsonb)
        )
        order by b.created_at
      )
      from public.boards b
      where b.owner_id = v_uid
    ), '[]'::jsonb),
    'hosted_games', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'code', g.code,
          'board_id', g.board_id,
          'mode', g.mode,
          'status', g.status,
          'created_at', g.created_at,
          'ended_at', g.ended_at
        )
        order by g.created_at
      )
      from public.games g
      where g.host_id = v_uid
    ), '[]'::jsonb),
    'participations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'game_id', gp.game_id,
          'game_code', g.code,
          'nickname', gp.nickname,
          'grid', gp.grid,
          'checked', gp.checked,
          'has_bingo', gp.has_bingo,
          'bingo_at', gp.bingo_at,
          'joined_at', gp.joined_at
        )
        order by gp.joined_at
      )
      from public.game_players gp
      join public.games g on g.id = gp.game_id
      where gp.user_id = v_uid
    ), '[]'::jsonb),
    'validations', coalesce((
      select jsonb_agg(
        jsonb_build_object('game_id', e.game_id, 'phrase_id', e.phrase_id, 'created_at', e.created_at)
        order by e.created_at
      )
      from public.game_events e
      where e.validated_by = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_account : supprime le compte. Les clés étrangères en cascade
-- effacent ses bingos (et leurs parties), les parties qu'il anime, ses
-- participations et ses validations.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
