-- ============================================================================
-- EFUTURE GAMES — nell'app la classifica si apre sulla propria categoria (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-campi-registrazione.sql. Rieseguibile, non tocca i dati.
-- App › Classifica: in alto Generale · Ospiti · Sponsor · Staff. Si apre sulla categoria di chi gioca
-- (quella scelta in Admin › Utenti); in home la posizione è quella nella propria categoria.
--  1. efg_profilo: restituisce anche la categoria (staff, sponsor, ospite).
--  2. efg_board / efg_board_group: ogni riga ha anche la categoria (nella Generale si vede accanto al nome).
--     Per il resto uguali a prima (classifica.html continua a funzionare).
-- ============================================================================

-- 1. profilo: anche la categoria
create or replace function public.efg_profilo(p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', p.name, 'azienda', p.azienda, 'categoria', coalesce(p.categoria, 'ospite'),
           'manca_azienda', coalesce(trim(p.azienda), '') = '' and efg_campi()->>'azienda' = 'obbligatorio')
  from efg_players p where p.email = lower(trim(p_email));
$$;
revoke all on function public.efg_profilo(text) from public;
grant execute on function public.efg_profilo(text) to anon, authenticated;

-- 2. classifiche: anche la categoria di ogni giocatore
drop function if exists public.efg_board(text);
create function public.efg_board(p_game text)
returns table (pid uuid, name text, levels integer, score integer, games integer, azienda text, nome text, categoria text)
language sql stable security definer set search_path = public as $$
  select p.pid, efg_nome_classifica(p.name, p.azienda), sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games, nullif(trim(p.azienda), ''), p.name, coalesce(p.categoria, 'ospite')
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
  group by p.pid, p.name, p.azienda, p.recensione_ok, p.categoria
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;
drop function if exists public.efg_board_group(text, text);
create function public.efg_board_group(p_game text, p_group text default 'tutti')
returns table (pid uuid, name text, levels integer, score integer, games integer, azienda text, nome text, categoria text)
language sql stable security definer set search_path = public as $$
  select p.pid, efg_nome_classifica(p.name, p.azienda), sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games, nullif(trim(p.azienda), ''), p.name, coalesce(p.categoria, 'ospite')
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
    and (coalesce(p_group, 'tutti') = 'tutti'
         or p.categoria = any (string_to_array(replace(replace(replace(coalesce(p_group, ''), ' ', ''), 'ospiti', 'ospite'), 'efuture', 'staff'), ',')))
  group by p.pid, p.name, p.azienda, p.recensione_ok, p.categoria
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;
revoke all on function public.efg_board(text), public.efg_board_group(text, text) from public;
grant execute on function public.efg_board(text), public.efg_board_group(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- controllo: quanti giocatori per categoria
select coalesce(categoria, 'ospite') as categoria, count(*) as giocatori from efg_players group by 1 order by 1;
