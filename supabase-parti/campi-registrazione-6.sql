-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 6 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 6".

-- 5. classifiche: name = "Azienda - Nome", più azienda e nome separati
create or replace function public.efg_nome_classifica(p_name text, p_azienda text) returns text
language sql immutable as $$
  select case when coalesce(trim(p_azienda), '') = '' then p_name else trim(p_azienda) || ' - ' || p_name end;
$$;

revoke all on function public.efg_nome_classifica(text,text) from public, anon, authenticated;

drop function if exists public.efg_board(text);

create function public.efg_board(p_game text)
returns table (pid uuid, name text, levels integer, score integer, games integer, azienda text, nome text)
language sql stable security definer set search_path = public as $$
  select p.pid, efg_nome_classifica(p.name, p.azienda), sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games, nullif(trim(p.azienda), ''), p.name
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
  group by p.pid, p.name, p.azienda, p.recensione_ok
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;

drop function if exists public.efg_board_group(text, text);

create function public.efg_board_group(p_game text, p_group text default 'tutti')
returns table (pid uuid, name text, levels integer, score integer, games integer, azienda text, nome text)
language sql stable security definer set search_path = public as $$
  select p.pid, efg_nome_classifica(p.name, p.azienda), sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games, nullif(trim(p.azienda), ''), p.name
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
    and (coalesce(p_group, 'tutti') = 'tutti'
         or p.categoria = any (string_to_array(replace(replace(replace(coalesce(p_group, ''), ' ', ''), 'ospiti', 'ospite'), 'efuture', 'staff'), ',')))
  group by p.pid, p.name, p.azienda, p.recensione_ok
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;
-- fine parte 6
