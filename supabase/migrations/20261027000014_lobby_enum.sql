-- BingoBuzz — partie « en préparation » : les invités rejoignent et ajoutent
-- des phrases, l'hôte lance quand il veut. Valeur d'enum ajoutée seule
-- (Postgres interdit de l'utiliser dans la transaction qui la crée).

alter type public.game_status add value if not exists 'lobby' before 'playing';
