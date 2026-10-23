-- BingoBuzz — Supabase Realtime (postgres_changes)
-- Les événements respectent les policies RLS de lecture : chaque abonné ne
-- reçoit que les lignes des parties dont il est membre.

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.game_events;
