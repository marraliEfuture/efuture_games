-- ============================================================================
-- EFUTURE GAMES — classifiche in ordine di punti (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-campi-registrazione.sql. Rieseguibile, non tocca i dati.
-- Comprende anche supabase-classifica-categoria.sql (non serve eseguirlo a parte).
-- Prima in classifica veniva prima chi aveva più livelli, poi i punti. Ora:
--   1. punti (decrescenti: primo chi ne ha di più);
--   2. a parità di punti, i livelli superati;
--   3. poi i giochi in cui ha superato almeno un livello;
--   4. poi chi ci è arrivato prima.
--  1. efg_submit: anche il record di ogni gioco è la partita con più punti (a parità, più livelli).
--     I record già salvati restano; cambia solo il confronto con le partite nuove.
--  2. efg_profilo con la categoria.  3. efg_board / efg_board_group nel nuovo ordine.
-- Attenzione: rieseguire file vecchi (supabase-tipi-utenti.sql, supabase-recensioni.sql,
-- supabase-campi-registrazione.sql…) rimette l'ordine vecchio: dopo, riesegui questo.
-- ============================================================================

-- 1. record: prima i punti, poi i livelli (resto uguale a supabase-tipi-utenti.sql)
create or replace function public.efg_submit(p_email text, p_game text, p_score integer, p_levels integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n int; dis boolean;
begin
  select disabilitato into dis from efg_players where email = e;
  if dis is null then raise exception 'not found'; end if;
  if dis then raise exception 'account disabilitato'; end if;
  if not efg_gate_open(interval '10 seconds') then raise exception 'gara chiusa'; end if;
  insert into efg_scores(email, game, score, levels) values (e, p_game, p_score, p_levels)
  on conflict (email, game) do update set score = excluded.score, levels = excluded.levels, updated_at = now()
    where (efg_scores.score, efg_scores.levels) < (excluded.score, excluded.levels);
  get diagnostics n = row_count;
  insert into efg_log(kind, email, game, detail) values ('partita', e, p_game,
    jsonb_build_object('punti', p_score, 'livelli', p_levels, 'record', n > 0));
  return n > 0;
end $$;
revoke all on function public.efg_submit(text,text,integer,integer) from public;
grant execute on function public.efg_submit(text,text,integer,integer) to anon, authenticated;

-- 2. profilo con la categoria (come supabase-classifica-categoria.sql)
create or replace function public.efg_profilo(p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', p.name, 'azienda', p.azienda, 'categoria', coalesce(p.categoria, 'ospite'),
           'manca_azienda', coalesce(trim(p.azienda), '') = '' and efg_campi()->>'azienda' = 'obbligatorio')
  from efg_players p where p.email = lower(trim(p_email));
$$;
revoke all on function public.efg_profilo(text) from public;
grant execute on function public.efg_profilo(text) to anon, authenticated;

-- 3. classifiche: prima i punti, poi i livelli, poi i giochi (e la categoria di ogni giocatore)
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
  order by score desc, levels desc, games desc, max(s.updated_at) asc
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
  order by score desc, levels desc, games desc, max(s.updated_at) asc
  limit 50;
$$;
revoke all on function public.efg_board(text), public.efg_board_group(text, text) from public;
grant execute on function public.efg_board(text), public.efg_board_group(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- controllo: i primi 5 della classifica generale (punti, livelli, giochi)
select score as punti, levels as livelli, games as giochi, categoria from efg_board('all') limit 5;
