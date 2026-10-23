-- BingoBuzz — modèles prêts à l'emploi (is_template = true, sans propriétaire)
-- Idempotent : relancer la migration remplace les phrases des modèles.

create or replace function pg_temp.seed_template(
  p_id uuid, p_title text, p_emoji text, p_color text,
  p_grid_size smallint, p_free_center boolean, p_phrases text[]
) returns void
language plpgsql
as $$
begin
  insert into public.boards (id, owner_id, title, theme, grid_size, free_center, is_template)
  values (p_id, null, p_title, jsonb_build_object('emoji', p_emoji, 'color', p_color),
          p_grid_size, p_free_center, true)
  on conflict (id) do update
    set title = excluded.title, theme = excluded.theme,
        grid_size = excluded.grid_size, free_center = excluded.free_center;

  delete from public.board_phrases where board_id = p_id and not (text = any (p_phrases));

  insert into public.board_phrases (board_id, text, position)
  select p_id, t, ord - 1
  from unnest(p_phrases) with ordinality as u(t, ord)
  on conflict (board_id, text) do update set position = excluded.position;
end;
$$;

select pg_temp.seed_template(
  '00000000-0000-4000-8000-000000000001', 'Réunion d''équipe', '💼', 'blue', 5::smallint, true,
  array[
    'Quelqu''un dit « on en reparle »',
    '« Tu m''entends ? »',
    'Quelqu''un parle en étant en sourdine',
    '« Je partage mon écran »',
    'Mauvais écran partagé',
    'Un chien aboie en fond',
    '« On a perdu Julien »',
    'La réunion déborde',
    '« Synergie »',
    '« On fait un point rapide »',
    'Quelqu''un mange à la caméra',
    'Un enfant passe dans le champ',
    '« Je dois filer à une autre réunion »',
    '« Est-ce que tout le monde voit ? »',
    'Silence gênant de 10 secondes',
    '« Ça aurait pu être un mail »',
    'Quelqu''un arrive en retard et demande un résumé',
    '« Je reviens vers toi »',
    'Problème de micro',
    '« On prend ça en offline »',
    'Le chef pose une question piège',
    '« ASAP »',
    'Quelqu''un oublie de couper son micro',
    'Une notification Teams retentit',
    '« Next steps »',
    '« Quick win »',
    'Personne ne répond à une question',
    '« Je vais être bref » (il ne l''est pas)'
  ]
);

select pg_temp.seed_template(
  '00000000-0000-4000-8000-000000000002', 'Mariage', '💍', 'pink', 5::smallint, true,
  array[
    'Il pleut pendant le mariage',
    'Quelqu''un pleure pendant les vœux',
    'Le marié oublie une phrase',
    'Un enfant fait une crise',
    'Quelqu''un danse sur « Dancing Queen »',
    'Un oncle raconte une anecdote gênante',
    'La photo de groupe prend 20 minutes',
    'Quelqu''un renverse du vin',
    'Le DJ passe « La Danse des canards »',
    'Discours trop long',
    'Quelqu''un attrape le bouquet',
    'Un invité porte du blanc',
    'Le gâteau penche',
    'Quelqu''un s''endort à table',
    'Retard de plus de 30 minutes',
    'Un téléphone sonne pendant la cérémonie',
    'Chenille sur la piste de danse',
    'Quelqu''un enlève ses chaussures',
    'Larmes de la mère de la mariée',
    'Lâcher de ballons ou de colombes',
    'Selfie avec les mariés',
    'Un invité se trompe de prénom',
    '« Vive les mariés ! »',
    'Quelqu''un chante faux au micro',
    'Feu d''artifice ou cierges magiques',
    'Un drone filme la cérémonie'
  ]
);

select pg_temp.seed_template(
  '00000000-0000-4000-8000-000000000003', 'Noël en famille', '🎄', 'green', 5::smallint, true,
  array[
    'Débat politique à table',
    'Quelqu''un s''endort après le repas',
    'Papi raconte la même histoire',
    '« Tu as grandi ! »',
    '« Et les amours, ça va ? »',
    'Un cadeau en double',
    'Une guirlande ne marche plus',
    'Le chat attaque le sapin',
    'Quelqu''un arrive en retard',
    'On reparle d''une vieille dispute',
    'Le plat est trop cuit',
    'Pull de Noël moche',
    '« Il ne fallait pas ! »',
    'Quelqu''un ouvre un cadeau trop tôt',
    'Chants de Noël',
    'Bûche glacée',
    'Quelqu''un fait la vaisselle en cachette',
    'Panne de piles pour un jouet',
    'Photo de famille ratée',
    'Quelqu''un mange trop de chocolats',
    'Appel vidéo avec un cousin loin',
    'Le film de Noël habituel à la télé',
    'Quelqu''un dit « c''était mieux avant »',
    'Un enfant croit encore au Père Noël',
    'Il reste des restes pour trois jours'
  ]
);

select pg_temp.seed_template(
  '00000000-0000-4000-8000-000000000004', 'Eurovision', '🎤', 'violet', 5::smallint, true,
  array[
    'Changement de tonalité final',
    'Machine à vent',
    'Effets pyrotechniques',
    'Costume qui se transforme',
    'Chanson dans une langue inventée',
    'Douze points pour le pays voisin',
    'Un pays obtient « nul point »',
    'Danseurs en patins à roulettes',
    'Un violon sur scène',
    'Chanteur pieds nus',
    'Plus de paillettes que de musique',
    'Un présentateur fait une blague qui tombe à plat',
    'Problème technique pendant le vote',
    'Ballade très sérieuse',
    'Pays qui chante en français',
    'Quelqu''un pleure en recevant ses points',
    'Grosse ovation du public',
    'Le favori déçoit',
    'Hamster géant ou mascotte',
    'Un fan agite un drapeau énorme',
    'Chorégraphie synchronisée parfaite',
    'Note très haute tenue longtemps',
    'Instrument traditionnel',
    'Le porte-parole parle trop longtemps',
    'Le public hue un vote'
  ]
);

select pg_temp.seed_template(
  '00000000-0000-4000-8000-000000000005', 'Voyage', '✈️', 'orange', 4::smallint, false,
  array[
    'Retard du vol ou du train',
    'Quelqu''un oublie son chargeur',
    'On se perd malgré le GPS',
    'Valise qui déborde',
    'Photo de coucher de soleil',
    'Plat local improbable',
    '« On est bientôt arrivés ? »',
    'Sieste dans les transports',
    'Quelqu''un parle la langue locale (mal)',
    'Coup de soleil',
    'On rate le bon arrêt',
    'Souvenir inutile acheté',
    'Pas de réseau',
    'Musée fermé le jour J',
    'Rencontre avec d''autres Français',
    'Dispute sur l''itinéraire',
    'Prise électrique incompatible',
    'Pique-nique improvisé',
    'Animal mignon croisé',
    'Plus de batterie au pire moment'
  ]
);
