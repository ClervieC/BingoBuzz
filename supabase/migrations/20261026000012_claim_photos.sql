-- BingoBuzz — preuve photo (optionnelle) jointe à une proposition (mode « peer »)
--
-- Fichiers dans le bucket privé `proofs`, chemin : <game_id>/<user_id>/<fichier>
--  * dépôt : un joueur de la partie, uniquement dans SON dossier ;
--  * lecture : les membres de la partie (liens signés côté client) ;
--  * suppression : l'auteur (annulation, suppression de compte) ou l'hôte.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "proofs: dépôt par un joueur dans son dossier"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.game_players p
      where p.game_id::text = (storage.foldername(name))[1]
        and p.user_id = (select auth.uid())
    )
  );

create policy "proofs: lecture par les membres de la partie"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'proofs'
    and exists (
      select 1 from public.games g
      where g.id::text = (storage.foldername(name))[1]
        and public.is_game_member(g.id)
    )
  );

create policy "proofs: suppression par l'auteur ou l'hôte"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'proofs'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1 from public.games g
        where g.id::text = (storage.foldername(name))[1]
          and g.host_id = (select auth.uid())
      )
    )
  );

alter table public.game_claims add column photo_path text
  check (photo_path is null or char_length(photo_path) <= 300);

-- ---------------------------------------------------------------------------
-- claim_phrase v2 : photo facultative (déjà déposée dans le dossier du joueur)
-- ---------------------------------------------------------------------------

drop function if exists public.claim_phrase(uuid, uuid);

create or replace function public.claim_phrase(
  p_game_id    uuid,
  p_phrase_id  uuid,
  p_photo_path text default null
)
returns public.game_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_game  public.games;
  v_claim public.game_claims;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.status <> 'playing' then
    raise exception 'game_finished' using errcode = 'P0001';
  end if;
  if v_game.mode <> 'peer' then
    raise exception 'wrong_mode' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.game_players p
    where p.game_id = p_game_id
      and p.user_id = v_uid
      and p.grid @> jsonb_build_array(jsonb_build_object('id', p_phrase_id))
  ) then
    raise exception 'not_in_grid' using errcode = 'P0001';
  end if;

  -- la photo doit être dans le dossier de ce joueur pour cette partie
  if p_photo_path is not null
     and p_photo_path not like (p_game_id::text || '/' || v_uid::text || '/%') then
    raise exception 'invalid_photo' using errcode = '22023';
  end if;

  if exists (select 1 from public.game_events e where e.game_id = p_game_id and e.phrase_id = p_phrase_id) then
    raise exception 'already_validated' using errcode = 'P0001';
  end if;

  begin
    insert into public.game_claims (game_id, phrase_id, claimed_by, photo_path)
    values (p_game_id, p_phrase_id, v_uid, p_photo_path)
    returning * into v_claim;
  exception when unique_violation then
    raise exception 'claim_exists' using errcode = 'P0001';
  end;

  return v_claim;
end;
$$;

revoke execute on function public.claim_phrase(uuid, uuid, text) from public, anon;
grant execute on function public.claim_phrase(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RGPD : l’export inclut le chemin des photos de preuve
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
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(
        -- toutes les colonnes, dont photo_path (chemin de la preuve dans le bucket proofs)
        to_jsonb(c)
        order by c.created_at
      )
      from public.game_claims c
      where c.claimed_by = v_uid
    ), '[]'::jsonb)
  );
end;
$$;
