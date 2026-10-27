-- BingoBuzz — règle « progressive » : 1 ligne (bingo), 2 lignes (double
-- bingo), carton plein (fin de partie). Valeur d'enum ajoutée seule
-- (Postgres interdit de l'utiliser dans la transaction qui la crée).

alter type public.game_auto_end add value if not exists 'progressive';
