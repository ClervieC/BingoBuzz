-- BingoBuzz — fin automatique, réactions, notifications push, modèles anglais

-- ===========================================================================
-- 1. Fin de partie automatique
-- ===========================================================================

create type public.game_auto_end as enum ('manual', 'first_bingo', 'full_card');

alter table public.games
  add column auto_end public.game_auto_end not null default 'manual',
  add column ends_at  timestamptz;

-- Un bingo / carton plein termine la partie si l'hôte l'a choisi.
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
     or (v_game.auto_end = 'full_card'
         and not exists (select 1 from jsonb_array_elements(new.checked) e where e.value = 'false'::jsonb)) then
    update public.games set status = 'finished' where id = v_game.id;
  end if;
  return null;
end;
$$;

create trigger game_players_auto_end
  after insert or update of checked on public.game_players
  for each row execute function public.bb_auto_end();

-- Parties dont la durée est écoulée : on ne coche plus, et on les termine
-- (par la tâche planifiée quotidienne, ou à l'ouverture de la partie).
create or replace function public.bb_game_expired(p_game public.games)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_game.ends_at is not null and p_game.ends_at <= now();
$$;

create or replace function public.check_game_expiry(p_game_id uuid)
returns public.game_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games;
begin
  if not public.is_game_member(p_game_id) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into v_game from public.games where id = p_game_id;
  if v_game.status = 'playing' and v_game.ends_at is not null and v_game.ends_at <= now() then
    update public.games set status = 'finished' where id = p_game_id returning * into v_game;
  end if;
  return v_game.status;
end;
$$;

create or replace function public.finish_expired_games()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.games
  set status = 'finished'
  where status = 'playing' and ends_at is not null and ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.bb_auto_end() from public, anon, authenticated;
revoke execute on function public.check_game_expiry(uuid) from public, anon;
grant execute on function public.check_game_expiry(uuid) to authenticated;
-- réservée à la tâche planifiée (clé service_role côté serveur)
revoke execute on function public.finish_expired_games() from public, anon, authenticated;

-- create_game v3 : règle de fin choisie par l'hôte
drop function if exists public.create_game(uuid, public.game_mode);

create or replace function public.create_game(
  p_board_id      uuid,
  p_mode          public.game_mode default 'free',
  p_auto_end      public.game_auto_end default 'manual',
  p_duration_days integer default null
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
  if p_duration_days is not null and p_duration_days not between 1 and 30 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  select * into v_board
  from public.boards b
  where b.id = p_board_id and (b.owner_id = v_uid or b.is_template);
  if not found then
    raise exception 'board_not_found' using errcode = 'P0002';
  end if;

  -- un bingo ne se joue qu'une fois à la fois : partie en cours → on y retourne
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

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.games (board_id, host_id, code, mode, auto_end, ends_at)
      values (
        v_board.id, v_uid, public.bb_random_code(), coalesce(p_mode, 'free'),
        coalesce(p_auto_end, 'manual'),
        case when p_duration_days is null then null else now() + make_interval(days => p_duration_days) end
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

revoke execute on function public.create_game(uuid, public.game_mode, public.game_auto_end, integer) from public, anon;
grant execute on function public.create_game(uuid, public.game_mode, public.game_auto_end, integer) to authenticated;

-- Plus de coches après l'échéance (même si le statut n'est pas encore à jour)
create or replace function public.bb_game_players_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
  v_len  integer;
begin
  if tg_op = 'UPDATE' and new.checked is distinct from old.checked then
    if coalesce(current_setting('bingobuzz.system', true), '') <> 'on' then
      select * into v_game from public.games g where g.id = new.game_id;

      if v_game.status = 'finished' or public.bb_game_expired(v_game) then
        raise exception 'game_finished' using errcode = 'P0001';
      end if;
      if v_game.mode <> 'free' then
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

-- ===========================================================================
-- 2. Réactions emoji (sur un bingo ou une proposition)
-- ===========================================================================

create table public.game_reactions (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  target_type text not null check (target_type in ('bingo', 'claim')),
  target_id   uuid not null,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji       text not null check (emoji in ('😂', '🔥', '👏', '😮', '❤️')),
  created_at  timestamptz not null default now(),

  constraint game_reactions_once unique (target_type, target_id, user_id, emoji)
);

create index game_reactions_game_idx on public.game_reactions (game_id);
create index game_reactions_user_idx on public.game_reactions (user_id);

alter table public.game_reactions enable row level security;
revoke all on public.game_reactions from anon, authenticated;
grant select, insert, delete on public.game_reactions to authenticated;

create policy "game_reactions: lecture par les membres"
  on public.game_reactions for select
  to authenticated
  using (public.is_game_member(game_id));

create policy "game_reactions: un membre réagit en son nom, sur une cible de la partie"
  on public.game_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_game_member(game_id)
    and (
      (target_type = 'bingo' and exists (
        select 1 from public.game_players p where p.id = target_id and p.game_id = game_reactions.game_id
      ))
      or (target_type = 'claim' and exists (
        select 1 from public.game_claims c where c.id = target_id and c.game_id = game_reactions.game_id
      ))
    )
  );

create policy "game_reactions: on retire les siennes"
  on public.game_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.game_reactions;

-- ===========================================================================
-- 3. Notifications push
-- ===========================================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) <= 1000),
  p256dh     text not null,
  auth       text not null,
  locale     text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create policy "push_subscriptions: chacun voit les siens"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions: chacun supprime les siens"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Enregistre l'appareil courant (un même navigateur peut changer de compte).
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_locale   text default 'fr'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth,
          case when p_locale in ('fr', 'en') then p_locale else 'fr' end);
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Configuration de l'envoi (renseignée à la main, voir README) : URL de
-- /api/push/dispatch et secret partagé. Schéma privé, invisible de l'API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.app_config (
  key   text primary key,
  value text not null
);

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net indisponible : notifications push désactivées (%)', sqlerrm;
end;
$$;

-- Prévient le serveur d'envoi ; ne fait rien tant que la config est absente.
create or replace function private.notify_push(p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url from private.app_config where key = 'push_webhook_url';
  select value into v_secret from private.app_config where key = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_net') then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kind', p_kind) || p_payload,
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret)
  );
exception when others then
  -- une notification ratée ne doit jamais bloquer le jeu
  raise warning 'notify_push: %', sqlerrm;
end;
$$;

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
  return null;
end;
$$;

create trigger game_players_push
  after insert or update of has_bingo on public.game_players
  for each row execute function public.bb_push_on_bingo();

create or replace function public.bb_push_on_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_push('claim', jsonb_build_object(
      'game_id', new.game_id, 'claim_id', new.id, 'actor_id', new.claimed_by));
  elsif old.status = 'pending' and new.status <> 'pending' and new.resolved_by is distinct from new.claimed_by then
    perform private.notify_push('claim_resolved', jsonb_build_object(
      'game_id', new.game_id, 'claim_id', new.id, 'actor_id', new.resolved_by));
  end if;
  return null;
end;
$$;

create trigger game_claims_push
  after insert or update of status on public.game_claims
  for each row execute function public.bb_push_on_claim();

create or replace function public.bb_push_on_game_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finished' and old.status <> 'finished' then
    perform private.notify_push('game_finished', jsonb_build_object('game_id', new.id));
  end if;
  return null;
end;
$$;

create trigger games_push
  after update of status on public.games
  for each row execute function public.bb_push_on_game_end();

revoke execute on function public.bb_push_on_bingo() from public, anon, authenticated;
revoke execute on function public.bb_push_on_claim() from public, anon, authenticated;
revoke execute on function public.bb_push_on_game_end() from public, anon, authenticated;

-- ===========================================================================
-- 4. Modèles par langue (+ 5 modèles anglais)
-- ===========================================================================

alter table public.boards add column locale text not null default 'fr' check (locale in ('fr', 'en'));

create or replace function pg_temp.seed_template_en(
  p_id uuid, p_title text, p_emoji text, p_color text,
  p_grid_size smallint, p_free_center boolean, p_phrases text[]
) returns void
language plpgsql
as $$
begin
  insert into public.boards (id, owner_id, title, theme, grid_size, free_center, is_template, locale)
  values (p_id, null, p_title, jsonb_build_object('emoji', p_emoji, 'color', p_color),
          p_grid_size, p_free_center, true, 'en')
  on conflict (id) do update
    set title = excluded.title, theme = excluded.theme, grid_size = excluded.grid_size,
        free_center = excluded.free_center, locale = 'en';

  delete from public.board_phrases where board_id = p_id and not (text = any (p_phrases));

  insert into public.board_phrases (board_id, text, position)
  select p_id, t, ord - 1
  from unnest(p_phrases) with ordinality as u(t, ord)
  on conflict (board_id, text) do update set position = excluded.position;
end;
$$;

select pg_temp.seed_template_en(
  '00000000-0000-4000-8000-000000000101', 'Team meeting', '💼', 'blue', 5::smallint, true,
  array[
    'Someone says “let’s circle back”', '“Can you hear me?”', 'Someone talks while muted', '“Let me share my screen”',
    'Wrong screen shared', 'A dog barks in the background', '“We lost Sam”', 'The meeting runs over', '“Synergy”',
    '“Quick sync”', 'Someone eats on camera', 'A kid walks into frame', '“I have a hard stop”', '“Can everyone see this?”',
    'Awkward 10-second silence', '“This could have been an email”', 'Late joiner asks for a recap', '“I’ll get back to you”',
    'Mic problem', '“Let’s take this offline”', '“ASAP”', 'Someone forgets to unmute', 'A notification sound goes off',
    '“Next steps”', '“Low-hanging fruit”', 'Nobody answers a question'
  ]
);

select pg_temp.seed_template_en(
  '00000000-0000-4000-8000-000000000102', 'Wedding', '💍', 'pink', 5::smallint, true,
  array[
    'It rains during the wedding', 'Someone cries during the vows', 'The groom forgets a line', 'A kid has a meltdown',
    'Someone dances to “Dancing Queen”', 'An uncle tells an awkward story', 'Group photo takes 20 minutes',
    'Someone spills wine', 'The DJ plays the Macarena', 'Speech too long', 'Someone catches the bouquet',
    'A guest wears white', 'The cake leans', 'Someone falls asleep at the table', 'More than 30 min late',
    'A phone rings during the ceremony', 'Conga line', 'Someone takes their shoes off', 'Mother of the bride cries',
    'Balloon or dove release', 'Selfie with the newlyweds', 'A guest gets a name wrong', '“To the newlyweds!”',
    'Someone sings off-key', 'Sparklers or fireworks'
  ]
);

select pg_temp.seed_template_en(
  '00000000-0000-4000-8000-000000000103', 'Family Christmas', '🎄', 'green', 5::smallint, true,
  array[
    'Political debate at dinner', 'Someone naps after lunch', 'Grandpa tells the same story', '“You’ve grown so much!”',
    '“So, are you seeing anyone?”', 'Duplicate present', 'A string of lights stops working', 'The cat attacks the tree',
    'Someone arrives late', 'An old argument resurfaces', 'The roast is overcooked', 'Ugly Christmas sweater',
    '“You shouldn’t have!”', 'Someone opens a present early', 'Christmas carols', 'Someone secretly does the dishes',
    'A toy needs batteries', 'Failed family photo', 'Too many chocolates', 'Video call with a cousin',
    'The usual Christmas movie on TV', '“It was better before”', 'A kid still believes in Santa', 'Leftovers for three days',
    'Board game argument'
  ]
);

select pg_temp.seed_template_en(
  '00000000-0000-4000-8000-000000000104', 'Eurovision', '🎤', 'violet', 5::smallint, true,
  array[
    'Final key change', 'Wind machine', 'Pyrotechnics', 'Costume reveal', 'Song in a made-up language',
    'Twelve points to the neighbour', 'A country gets nul points', 'Dancers on roller skates', 'Violin on stage',
    'Barefoot singer', 'More glitter than music', 'Host joke falls flat', 'Technical problem during the vote',
    'Very serious ballad', 'Song in French', 'Someone cries receiving points', 'Huge crowd ovation',
    'The favourite disappoints', 'Giant hamster or mascot', 'Massive flag in the crowd', 'Perfectly synced choreography',
    'Very long high note', 'Traditional instrument', 'Spokesperson talks too long', 'Crowd boos a vote'
  ]
);

select pg_temp.seed_template_en(
  '00000000-0000-4000-8000-000000000105', 'Road trip', '✈️', 'orange', 4::smallint, false,
  array[
    'Flight or train delayed', 'Someone forgot their charger', 'Lost despite the GPS', 'Overflowing suitcase',
    'Sunset photo', 'Weird local dish', '“Are we there yet?”', 'Nap on the transport',
    'Someone speaks the local language (badly)', 'Sunburn', 'Missed the right stop', 'Useless souvenir bought',
    'No signal', 'Museum closed that day', 'Argument about the route', 'Incompatible power plug',
    'Improvised picnic', 'Cute animal spotted', 'Battery dies at the worst time', 'Bumped into compatriots'
  ]
);

-- ===========================================================================
-- 5. Export RGPD : réactions et appareils abonnés aux notifications
-- ===========================================================================

-- La version précédente reste la base du document ; on y ajoute les
-- nouvelles données. Elle n'est plus appelable directement.
alter function public.export_my_data() rename to bb_export_my_data_v12;
revoke execute on function public.bb_export_my_data_v12() from public, anon, authenticated;

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

  return public.bb_export_my_data_v12() || jsonb_build_object(
    'reactions', coalesce((
      select jsonb_agg(
        jsonb_build_object('game_id', r.game_id, 'target_type', r.target_type, 'target_id', r.target_id,
                           'emoji', r.emoji, 'created_at', r.created_at)
        order by r.created_at)
      from public.game_reactions r
      where r.user_id = v_uid
    ), '[]'::jsonb),
    -- les clés de chiffrement des abonnements ne sont pas des données personnelles utiles
    'push_devices', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'locale', s.locale, 'created_at', s.created_at)
                       order by s.created_at)
      from public.push_subscriptions s
      where s.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
