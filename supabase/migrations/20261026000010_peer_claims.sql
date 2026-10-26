-- BingoBuzz — mode « validé par le groupe » (peer)
--
-- Un joueur propose une phrase de sa grille (game_claims, statut pending).
-- Un AUTRE membre de la partie la confirme : la phrase est alors validée comme
-- en mode « validé » (insertion dans game_events → cochée chez tous ceux qui
-- l'ont). Une contestation rejette la proposition, qui pourra être refaite.

create type public.claim_status as enum ('pending', 'confirmed', 'rejected');

create table public.game_claims (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  phrase_id   uuid not null references public.board_phrases (id) on delete cascade,
  claimed_by  uuid not null references auth.users (id) on delete cascade,
  status      public.claim_status not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- une seule proposition en attente par phrase et par partie
create unique index game_claims_one_pending
  on public.game_claims (game_id, phrase_id)
  where status = 'pending';
create index game_claims_game_id_idx on public.game_claims (game_id, created_at desc);
create index game_claims_claimed_by_idx on public.game_claims (claimed_by);
create index game_claims_resolved_by_idx on public.game_claims (resolved_by);

alter table public.game_claims enable row level security;

revoke all on public.game_claims from anon, authenticated;
-- lecture seule : création et résolution passent par les fonctions ci-dessous
grant select on public.game_claims to authenticated;

create policy "game_claims: lecture par les membres de la partie"
  on public.game_claims for select
  to authenticated
  using (public.is_game_member(game_id));

alter publication supabase_realtime add table public.game_claims;

-- ---------------------------------------------------------------------------
-- Les joueurs ne cochent pas eux-mêmes en mode « peer » (comme en « validated »)
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
    -- les coches posées par le système (validations) passent toujours
    if coalesce(current_setting('bingobuzz.system', true), '') <> 'on' then
      select g.mode, g.status into v_mode, v_status
      from public.games g
      where g.id = new.game_id;

      if v_status = 'finished' then
        raise exception 'game_finished' using errcode = 'P0001';
      end if;
      if v_mode <> 'free' then
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

-- ---------------------------------------------------------------------------
-- claim_phrase : « j'ai vu ça ! » (phrase de SA grille)
-- ---------------------------------------------------------------------------

create or replace function public.claim_phrase(p_game_id uuid, p_phrase_id uuid)
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

  if exists (select 1 from public.game_events e where e.game_id = p_game_id and e.phrase_id = p_phrase_id) then
    raise exception 'already_validated' using errcode = 'P0001';
  end if;

  begin
    insert into public.game_claims (game_id, phrase_id, claimed_by)
    values (p_game_id, p_phrase_id, v_uid)
    returning * into v_claim;
  exception when unique_violation then
    raise exception 'claim_exists' using errcode = 'P0001';
  end;

  return v_claim;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_claim : confirmer (un autre membre) ou contester / annuler
-- ---------------------------------------------------------------------------

create or replace function public.resolve_claim(p_claim_id uuid, p_accept boolean)
returns public.game_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_claim public.game_claims;
  v_game  public.games;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_claim from public.game_claims where id = p_claim_id for update;
  if not found or v_claim.status <> 'pending' then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;

  select * into v_game from public.games where id = v_claim.game_id;
  if v_game.status <> 'playing' then
    raise exception 'game_finished' using errcode = 'P0001';
  end if;

  -- membre de la partie (joueur ou hôte)
  if not (
    v_game.host_id = v_uid
    or exists (select 1 from public.game_players p where p.game_id = v_game.id and p.user_id = v_uid)
  ) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if p_accept then
    -- on ne confirme pas sa propre proposition
    if v_claim.claimed_by = v_uid then
      raise exception 'own_claim' using errcode = 'P0001';
    end if;

    update public.game_claims
    set status = 'confirmed', resolved_by = v_uid, resolved_at = now()
    where id = v_claim.id
    returning * into v_claim;

    -- même effet qu'une validation de l'hôte : cochée chez tous ceux qui l'ont
    insert into public.game_events (game_id, phrase_id, validated_by)
    values (v_claim.game_id, v_claim.phrase_id, v_uid)
    on conflict (game_id, phrase_id) do nothing;
  else
    -- contestation par un autre membre, ou annulation par l'auteur
    update public.game_claims
    set status = 'rejected', resolved_by = v_uid, resolved_at = now()
    where id = v_claim.id
    returning * into v_claim;
  end if;

  return v_claim;
end;
$$;

revoke execute on function public.claim_phrase(uuid, uuid) from public, anon;
revoke execute on function public.resolve_claim(uuid, boolean) from public, anon;
grant execute on function public.claim_phrase(uuid, uuid) to authenticated;
grant execute on function public.resolve_claim(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RGPD : les propositions font partie des données exportées
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
        jsonb_build_object(
          'game_id', c.game_id,
          'phrase_id', c.phrase_id,
          'status', c.status,
          'created_at', c.created_at,
          'resolved_at', c.resolved_at
        )
        order by c.created_at
      )
      from public.game_claims c
      where c.claimed_by = v_uid
    ), '[]'::jsonb)
  );
end;
$$;
