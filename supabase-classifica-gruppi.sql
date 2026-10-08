-- ============================================================
-- EFUTURE GAMES — classifica filtrabile: utenti Efuture / ospiti / tutti
-- Da eseguire nel SQL Editor di Supabase (si può rieseguire).
-- "Utente Efuture" = email che finisce con @efuture.it (anche @reparto.efuture.it,
-- maiuscole e spazi non contano); tutti gli altri sono ospiti.
-- Ordine come la classifica normale: prima i livelli superati, poi i punti.
-- Le email non escono mai dal database: la classifica riceve solo nome e punti.
-- ============================================================
create or replace function public.efg_board_group(p_game text, p_group text default 'tutti')
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels, sum(s.score)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game)
    and case coalesce(p_group, 'tutti')
          when 'efuture' then lower(trim(p.email)) ~ '@([a-z0-9-]+\.)*efuture\.it$'
          when 'ospiti'  then lower(trim(p.email)) !~ '@([a-z0-9-]+\.)*efuture\.it$'
          else true end
  group by p.pid, p.name
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;

revoke all on function public.efg_board_group(text, text) from public;
grant execute on function public.efg_board_group(text, text) to anon, authenticated;
