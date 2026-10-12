-- ============================================================
-- EFUTURE GAMES — Bonus Recensione
-- Da eseguire nel SQL Editor di Supabase (si può rieseguire). Funziona anche
-- se supabase-tipi-utenti.sql non è ancora stato eseguito. Se esegui o
-- riesegui supabase-tipi-utenti.sql, riesegui poi anche questo: entrambi
-- ridefiniscono la classifica e l'elenco utenti.
--  1. Il pulsante "Bonus Recensione" dell'app apre la pagina delle recensioni
--     Google di efuture e registra il clic sul giocatore (recensione_clic,
--     la prima volta) e nel log (ogni volta).
--  2. In admin › Utenti chi ha cliccato ha la stellina gialla; l'admin, dopo
--     aver visto la recensione su Google, la conferma: stellina verde
--     (recensione_ok).
--  3. La recensione confermata vale +200 punti nella classifica generale.
--  4. Il link alle recensioni Google si imposta da admin › Utenti.
-- ============================================================

-- 0. colonne di supabase-tipi-utenti.sql, se non è ancora stato eseguito (stesse definizioni)
alter table public.efg_players add column if not exists tipo text not null default 'giocatore';
alter table public.efg_players add column if not exists disabilitato boolean not null default false;
alter table public.efg_players add column if not exists admin_key_hash text;

-- 1. dati sul giocatore e impostazioni
alter table public.efg_players add column if not exists recensione_clic timestamptz;   -- primo clic sul pulsante
alter table public.efg_players add column if not exists recensione_ok   timestamptz;   -- confermata dall'admin

create table if not exists public.efg_settings (
  key   text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.efg_settings enable row level security;   -- nessun accesso diretto: solo dalle funzioni

-- punti del bonus (uguali in classifica e nell'app)
create or replace function public.efg_bonus_recensione() returns integer
language sql immutable as $$ select 200 $$;
revoke all on function public.efg_bonus_recensione() from public;
grant execute on function public.efg_bonus_recensione() to anon, authenticated;

-- 2. app: stato del bonus per il giocatore e link
create or replace function public.efg_recensione_info(p_email text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'link',  (select value from efg_settings where key = 'recensione_link'),
    'clic',  (select recensione_clic is not null from efg_players where email = lower(trim(p_email))),
    'ok',    (select recensione_ok   is not null from efg_players where email = lower(trim(p_email))),
    'punti', efg_bonus_recensione());
$$;

-- app: clic sul pulsante (il primo resta in recensione_clic, tutti nel log)
create or replace function public.efg_recensione_click(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n text; dis boolean;
begin
  select name, disabilitato into n, dis from efg_players where email = e;
  if n is null then raise exception 'not found'; end if;
  if dis then raise exception 'account disabilitato'; end if;
  update efg_players set recensione_clic = coalesce(recensione_clic, now()) where email = e;
  insert into efg_log(kind, email, detail) values ('recensione: clic', e, jsonb_build_object('nome', n));
  return efg_recensione_info(e);
end $$;

revoke all on function public.efg_recensione_info(text), public.efg_recensione_click(text) from public;
grant execute on function public.efg_recensione_info(text), public.efg_recensione_click(text) to anon, authenticated;

-- 3. admin: conferma o toglie la recensione (stellina verde / gialla)
create or replace function public.efg_admin_set_recensione(p_key text, p_email text, p_ok boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select name into n from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  update efg_players set recensione_ok = case when p_ok then coalesce(recensione_ok, now()) else null end,
                         recensione_clic = case when p_ok then coalesce(recensione_clic, now()) else recensione_clic end
    where email = e;
  insert into efg_log(kind, email, detail) values (case when p_ok then 'admin: recensione confermata' else 'admin: recensione tolta' end, e, jsonb_build_object('nome', n));
  return jsonb_build_object('ok', true, 'nome', n, 'recensione', coalesce(p_ok, false));
end $$;

-- admin: link alle recensioni Google (vuoto = ricerca di efuture su Google Maps)
create or replace function public.efg_admin_set_recensione_link(p_key text, p_link text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; l text := nullif(trim(coalesce(p_link, '')), '');
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if l is not null and l !~* '^https://' then return jsonb_build_object('errore', 'il link deve iniziare con https://'); end if;
  insert into efg_settings(key, value, updated_at) values ('recensione_link', l, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into efg_log(kind, detail) values ('admin: link recensioni', jsonb_build_object('link', l));
  return jsonb_build_object('ok', true, 'link', l);
end $$;

revoke all on function public.efg_admin_set_recensione(text,text,boolean), public.efg_admin_set_recensione_link(text,text) from public;
grant execute on function public.efg_admin_set_recensione(text,text,boolean), public.efg_admin_set_recensione_link(text,text) to anon, authenticated;

-- 4. elenco utenti per l'admin: come in supabase-tipi-utenti.sql, più la recensione
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.email, p.created_at, p.tipo, p.disabilitato, (p.admin_key_hash is not null) as chiave,
      p.recensione_clic, p.recensione_ok,
      (select count(*) from efg_scores s where s.email = p.email and s.levels > 0) as giochi,
      (select coalesce(sum(s.levels),0) from efg_scores s where s.email = p.email) as livelli,
      (select coalesce(sum(s.score),0) from efg_scores s where s.email = p.email) as punti,
      (select jsonb_object_agg(s.game, jsonb_build_object('livelli', s.levels, 'punti', s.score, 'quando', s.updated_at))
         from efg_scores s where s.email = p.email) as dettaglio
    from efg_players p) x), '[]'::jsonb);
end $$;

-- 5. ripristino di un backup: conserva anche la recensione (i backup vecchi tornano senza)
create or replace function public.efg_admin_restore(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; d jsonb; bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select data into d from efg_backups where id = p_id;
  if d is null then return jsonb_build_object('errore', 'backup non trovato'); end if;
  insert into efg_backups(note, data) values ('automatico prima del ripristino del backup ' || p_id, efg_snapshot()) returning id into bid;
  delete from efg_scores where true; delete from efg_players where true;
  insert into efg_players(email, pid, name, created_at, tipo, disabilitato, admin_key_hash, recensione_clic, recensione_ok)
    select x.email, x.pid, x.name, x.created_at, coalesce(x.tipo, 'giocatore'), coalesce(x.disabilitato, false), x.admin_key_hash,
           x.recensione_clic, x.recensione_ok
    from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;

-- 6. classifiche: nella generale ('all') la recensione confermata vale +200 punti
create or replace function public.efg_board(p_game text)
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
  group by p.pid, p.name, p.recensione_ok
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;

create or replace function public.efg_board_group(p_game text, p_group text default 'tutti')
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels,
         (sum(s.score) + case when p_game = 'all' and p.recensione_ok is not null then efg_bonus_recensione() else 0 end)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
    and case coalesce(p_group, 'tutti')
          when 'efuture' then lower(trim(p.email)) ~ '@([a-z0-9-]+\.)*efuture\.it$'
          when 'ospiti'  then lower(trim(p.email)) !~ '@([a-z0-9-]+\.)*efuture\.it$'
          else true end
  group by p.pid, p.name, p.recensione_ok
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;
revoke all on function public.efg_board(text), public.efg_board_group(text, text) from public;
grant execute on function public.efg_board(text), public.efg_board_group(text, text) to anon, authenticated;

-- fa vedere subito le nuove funzioni all'app (senza aspettare)
notify pgrst, 'reload schema';
