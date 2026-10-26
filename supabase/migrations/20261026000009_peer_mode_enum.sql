-- BingoBuzz — mode « validé par le groupe » : un joueur propose une case,
-- un autre la confirme. Valeur d'enum ajoutée seule (Postgres interdit de
-- l'utiliser dans la transaction qui la crée).

alter type public.game_mode add value if not exists 'peer';
