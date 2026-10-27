-- BingoBuzz — avatars, statistiques et badges, modèles par catégorie
-- Ré-exécutable sans erreur. Les phrases des modèles sont entre $p$ … $p$
-- (une par ligne) : aucune apostrophe à échapper.

-- ===========================================================================
-- 1. Avatar emoji d'un joueur (choisi en rejoignant)
-- ===========================================================================

alter table public.game_players
  add column if not exists avatar text check (avatar is null or char_length(avatar) between 1 and 16);

drop function if exists public.join_game(text, text);

create or replace function public.join_game(p_code text, p_nickname text, p_avatar text default null)
returns public.game_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_nick   text := btrim(coalesce(p_nickname, ''));
  v_avatar text := nullif(btrim(coalesce(p_avatar, '')), '');
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
  if v_avatar is not null and char_length(v_avatar) > 16 then
    v_avatar := null;
  end if;

  select * into v_game from public.games where code = upper(btrim(p_code));
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  select * into v_player
  from public.game_players
  where game_id = v_game.id and user_id = v_uid;

  if found then
    update public.game_players
    set nickname = v_nick, avatar = coalesce(v_avatar, avatar)
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

  insert into public.game_players (game_id, user_id, nickname, avatar, seed, grid, checked)
  values (v_game.id, v_uid, v_nick, v_avatar, (v_deal ->> 'seed')::bigint, v_deal -> 'grid', v_deal -> 'checked')
  on conflict (game_id, user_id) do update set nickname = excluded.nickname
  returning * into v_player;

  return v_player;
end;
$$;

revoke execute on function public.join_game(text, text, text) from public, anon;
grant execute on function public.join_game(text, text, text) to authenticated;

-- ===========================================================================
-- 2. Statistiques du joueur (profil et badges)
-- ===========================================================================

create or replace function public.get_my_stats()
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
    'games_played', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and jsonb_array_length(p.grid) > 0
    ),
    'bingos', (select count(*) from public.game_players p where p.user_id = v_uid and p.has_bingo),
    -- premier bingo de la partie
    'wins', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and p.has_bingo
        and p.bingo_at = (select min(o.bingo_at) from public.game_players o where o.game_id = p.game_id)
    ),
    'full_cards', (
      select count(*) from public.game_players p
      where p.user_id = v_uid and jsonb_array_length(p.checked) > 0
        and not exists (select 1 from jsonb_array_elements(p.checked) e where e.value = 'false'::jsonb)
    ),
    'cells_checked', (
      select coalesce(sum((select count(*) from jsonb_array_elements(p.checked) e where e.value = 'true'::jsonb)), 0)
      from public.game_players p where p.user_id = v_uid
    ),
    'hosted', (select count(*) from public.games g where g.host_id = v_uid),
    'boards', (select count(*) from public.boards b where b.owner_id = v_uid),
    'claims_confirmed', (
      select count(*) from public.game_claims c where c.claimed_by = v_uid and c.status = 'confirmed'
    ),
    'photos', (
      select count(*) from public.game_claims c
      where c.claimed_by = v_uid and c.status = 'confirmed' and c.photo_path is not null
    ),
    'confirmations_given', (
      select count(*) from public.game_claims c
      where c.resolved_by = v_uid and c.claimed_by <> v_uid and c.status = 'confirmed'
    ),
    'phrases_contributed', (
      select count(*) from public.board_phrases bp
      join public.boards b on b.id = bp.board_id
      where bp.added_by = v_uid and b.owner_id is distinct from v_uid
    ),
    'reactions_received', (
      select count(*) from public.game_reactions r
      where r.user_id <> v_uid and (
        (r.target_type = 'bingo' and exists (select 1 from public.game_players p where p.id = r.target_id and p.user_id = v_uid))
        or (r.target_type = 'claim' and exists (select 1 from public.game_claims c where c.id = r.target_id and c.claimed_by = v_uid))
      )
    ),
    'friends', (
      select count(distinct o.user_id) from public.game_players p
      join public.game_players o on o.game_id = p.game_id and o.user_id <> v_uid
      where p.user_id = v_uid
    ),
    'since', (select u.created_at from auth.users u where u.id = v_uid)
  );
end;
$$;

revoke execute on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;

-- ===========================================================================
-- 3. Modèles : catégorie + nouveaux modèles (FR et EN)
-- ===========================================================================

alter table public.boards
  add column if not exists category text
    check (category is null or category in ('work', 'party', 'family', 'sport', 'tv', 'travel'));

update public.boards set category = c.category
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'work'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'party'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'family'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'tv'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'travel'),
  ('00000000-0000-4000-8000-000000000101'::uuid, 'work'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'party'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'family'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'tv'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'travel')
) as c(id, category)
where public.boards.id = c.id;

create or replace function pg_temp.seed(
  p_id uuid, p_locale text, p_category text, p_title text, p_emoji text, p_color text, p_phrases text[]
) returns void
language plpgsql
as $$
begin
  -- une phrase par ligne : on retire lignes vides et retours chariot (fichiers Windows)
  p_phrases := array(
    select btrim(replace(x, chr(13), ''))
    from unnest(p_phrases) with ordinality as u(x, ord)
    where btrim(replace(x, chr(13), '')) <> ''
    order by ord
  );

  insert into public.boards (id, owner_id, title, theme, grid_size, free_center, is_template, locale, category)
  values (p_id, null, p_title, jsonb_build_object('emoji', p_emoji, 'color', p_color), 5, true, true, p_locale, p_category)
  on conflict (id) do update
    set title = excluded.title, theme = excluded.theme, locale = excluded.locale, category = excluded.category;

  delete from public.board_phrases where board_id = p_id and not (text = any (p_phrases));

  insert into public.board_phrases (board_id, text, position)
  select p_id, t, ord - 1
  from unnest(p_phrases) with ordinality as u(t, ord)
  on conflict (board_id, text) do update set position = excluded.position;
end;
$$;

select pg_temp.seed('00000000-0000-4000-8000-000000000006', 'fr', 'sport', 'Match de foot', '⚽', 'green', string_to_array($p$
Carton jaune dans les 10 premières minutes
But contre son camp
Penalty sifflé
Le VAR est consulté
Un joueur se roule par terre
Coup franc dans le mur
Le gardien arrête un penalty
But dans les arrêts de jeu
Changement à la mi-temps
Le commentateur s'emballe
Quelqu'un crie « Arbitre ! »
Une ola dans le stade
Hors-jeu signalé
Poteau ou barre transversale
Le coach s'énerve sur le banc
Un fumigène dans les tribunes
Carton rouge
Tir au-dessus de la cage
Quelqu'un renverse sa bière
« Il y avait main ! »
Un joueur change de crampons
Remontée au score
Égalisation
Quelqu'un s'endort sur le canapé
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000007', 'fr', 'family', 'Dîner de famille', '🍽️', 'orange', string_to_array($p$
« Et le travail, ça va ? »
« Alors, toujours célibataire ? »
Débat politique
Quelqu'un ressort une vieille histoire
Le plat est trop salé
« De mon temps… »
Un enfant renverse son verre
On parle de la météo
Quelqu'un est au téléphone à table
« Ressers-toi ! »
Une photo de famille
Quelqu'un arrive en retard
Débat sur la cuisson de la viande
On parle d'un cousin absent
Le dessert est raté
Quelqu'un fait la vaisselle en douce
« Tu as maigri, non ? »
Une blague de tonton
On sort les vieux albums photo
« On mange à quelle heure ? »
Quelqu'un fait une sieste
Le chien quémande sous la table
On parle d'héritage
Quelqu'un part avec des restes
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000008', 'fr', 'tv', 'Soirée électorale', '🗳️', 'blue', string_to_array($p$
Estimations à 20 h pile
« Le peuple a parlé »
Un candidat remercie sa famille
Ambiance de QG en direct
Quelqu'un pleure au QG
Un plateau de dix commentateurs
« Taux de participation historique »
Carte de France en couleurs
Un candidat refuse de commenter
« C'est un séisme politique »
Un duplex qui coupe
Des militants qui chantent
« Il faut attendre les résultats définitifs »
Un ancien ministre sur le plateau
Le mot « abstention »
Un candidat arrive en voiture
Des drapeaux partout
Discours trop long
Quelqu'un se félicite d'une défaite
« Rien n'est joué »
Un sondeur se justifie
Des confettis
Quelqu'un parle de « dynamique »
Le journaliste coupe la parole
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000009', 'fr', 'tv', 'Télé-réalité', '📺', 'pink', string_to_array($p$
Quelqu'un pleure dans le confessionnal
« Je suis pas là pour me faire des amis »
Clash à la piscine
Musique dramatique
Quelqu'un fait sa valise
Un ralenti sur un regard
Bisou surprise
« C'est du fake »
Quelqu'un chuchote un complot
Une épreuve de cuisine
Le présentateur fait durer le suspense
Coupure pub au pire moment
Un candidat parle de lui à la 3ᵉ personne
Quelqu'un dit « en vrai »
Une alliance secrète
Un retournement de situation
Quelqu'un se maquille en parlant
Une élimination surprise
Un message de la famille
Quelqu'un claque une porte
Un câlin de réconciliation
Tenue improbable
Musique triste au ralenti
« On en reparle demain »
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000010', 'fr', 'party', 'Soirée d’anniversaire', '🎂', 'violet', string_to_array($p$
On chante faux « Joyeux anniversaire »
Les bougies ne s'éteignent pas du premier coup
Un cadeau en double
Quelqu'un arrive sans cadeau
Photo de groupe ratée
Un discours improvisé
Quelqu'un danse sur la table
La playlist bugue
Un gâteau qui penche
Quelqu'un raconte une anecdote gênante
Un ballon éclate
On ouvre le champagne
Quelqu'un pleure d'émotion
Les voisins se plaignent
Un ex est invité
Quelqu'un s'endort
Un jeu à boire
Un cadeau collectif
« Tu fais pas ton âge ! »
Une carte qui fait rire tout le monde
Quelqu'un renverse son verre
Karaoké
Un selfie avec la star de la soirée
Il reste trop de gâteau
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000106', 'en', 'sport', 'Football match', '⚽', 'green', string_to_array($p$
Yellow card in the first 10 minutes
Own goal
Penalty given
VAR check
Player rolls on the ground
Free kick into the wall
Keeper saves a penalty
Stoppage-time goal
Half-time substitution
Commentator loses it
Someone yells “Ref!”
Mexican wave
Offside flag
Hits the post or the bar
Coach rages on the touchline
Flare in the stands
Red card
Shot way over the bar
Someone spills their drink
“That was a handball!”
Player changes boots
Comeback
Equaliser
Someone falls asleep on the couch
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000107', 'en', 'family', 'Thanksgiving dinner', '🦃', 'orange', string_to_array($p$
“So, how’s work?”
“Still single?”
Political debate
An old story comes back
The turkey is dry
“Back in my day…”
A kid spills a drink
Talk about the weather
Someone on their phone at the table
“Have some more!”
Family photo
Someone shows up late
Football on TV
Talk about an absent cousin
Pie disaster
Someone secretly does the dishes
“You look thinner!”
Uncle’s terrible joke
Old photo albums come out
“When are we eating?”
Post-dinner nap
Dog begs under the table
Someone says what they’re thankful for
Leftovers to go
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000108', 'en', 'tv', 'Election night', '🗳️', 'blue', string_to_array($p$
Too close to call
“The people have spoken”
Candidate thanks their family
Live from campaign HQ
Someone cries at HQ
Panel of ten pundits
“Record turnout”
The big electoral map
Candidate declines to comment
“Political earthquake”
Live feed cuts out
Supporters chanting
“We have to wait for final results”
Former minister on the panel
The word “turnout”
Motorcade arrival
Flags everywhere
Speech goes on too long
Someone celebrates a defeat
“It’s not over yet”
Pollster defends the polls
Confetti drop
Someone says “momentum”
Anchor interrupts a guest
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000109', 'en', 'tv', 'Reality TV', '📺', 'pink', string_to_array($p$
Crying in the confessional
“I’m not here to make friends”
Pool fight
Dramatic music
Someone packs their bags
Slow-motion stare
Surprise kiss
“It’s so fake”
Whispered conspiracy
Cooking challenge
Host drags out the suspense
Ad break at the worst moment
Contestant talks in third person
Someone says “literally”
Secret alliance
Plot twist
Doing makeup while talking
Shock elimination
Message from home
Door slam
Make-up hug
Questionable outfit
Sad music in slow motion
“We’ll talk tomorrow”
$p$, chr(10)));

select pg_temp.seed('00000000-0000-4000-8000-000000000110', 'en', 'party', 'Birthday party', '🎂', 'violet', string_to_array($p$
Off-key “Happy Birthday”
Candles won’t blow out
Duplicate present
Someone arrives empty-handed
Failed group photo
Improvised speech
Someone dances on the table
Playlist glitches
Leaning cake
Embarrassing story
A balloon pops
Champagne pop
Someone gets emotional
Neighbours complain
An ex is invited
Someone falls asleep
Drinking game
Group present
“You don’t look your age!”
Card that makes everyone laugh
Someone spills a drink
Karaoke
Selfie with the birthday star
Way too much cake left
$p$, chr(10)));

-- ===========================================================================
-- 4. Préparation : modifier une phrase (l'hôte toutes, chacun les siennes)
-- ===========================================================================

create or replace function public.edit_lobby_phrase(p_game_id uuid, p_phrase_id uuid, p_text text)
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
  select * into v_game from public.games where id = p_game_id for update;
  if v_game.status <> 'lobby' then
    raise exception 'not_lobby' using errcode = 'P0001';
  end if;
  if char_length(v_text) not between 1 and 120 then
    raise exception 'invalid_phrase' using errcode = '22023';
  end if;

  select * into v_phrase from public.board_phrases
  where id = p_phrase_id and board_id = v_game.board_id
    and (added_by = v_uid or v_game.host_id = v_uid);
  if not found then
    raise exception 'phrase_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.board_phrases
    where board_id = v_game.board_id and id <> p_phrase_id and lower(text) = lower(v_text)
  ) then
    raise exception 'phrase_exists' using errcode = '23505';
  end if;

  update public.board_phrases set text = v_text where id = p_phrase_id returning * into v_phrase;
  return v_phrase;
end;
$$;

revoke execute on function public.edit_lobby_phrase(uuid, uuid, text) from public, anon;
grant execute on function public.edit_lobby_phrase(uuid, uuid, text) to authenticated;
