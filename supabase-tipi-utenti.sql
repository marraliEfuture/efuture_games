-- ============================================================
-- EFUTURE GAMES — tipo di utente e utenti disabilitati (admin, sezione Utenti)
-- Da eseguire nel SQL Editor di Supabase. Si può rieseguire: se l'avevi già
-- eseguito per il tipo, rieseguilo per avere anche "Disabilita".
--  1. Ogni utente ha un tipo: 'giocatore' (predefinito), 'admin_giocatore'
--     (admin e giocatore) oppure 'admin' (solo admin).
--  2. efg_admin_players restituisce anche il tipo.
--  3. efg_admin_set_tipo cambia il tipo di un utente e lo scrive nel log.
--  4. Il ripristino di un backup conserva tipo e disabilitazione (i backup
--     vecchi tornano 'giocatore', abilitato).
--  5. Un utente si può disabilitare (efg_admin_set_disabilitato): non può più
--     accedere, i suoi nuovi punteggi non vengono salvati e sparisce dalla
--     classifica. Riabilitandolo torna tutto com'era: i punteggi restano salvati.
-- ============================================================

-- 1. colonna tipo
alter table public.efg_players add column if not exists tipo text not null default 'giocatore';
alter table public.efg_players drop constraint if exists efg_players_tipo_check;
alter table public.efg_players add constraint efg_players_tipo_check check (tipo in ('giocatore','admin_giocatore','admin'));
alter table public.efg_players add column if not exists disabilitato boolean not null default false;

-- 2. elenco utenti per l'admin, con il tipo
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.email, p.created_at, p.tipo, p.disabilitato,
      (select count(*) from efg_scores s where s.email = p.email and s.levels > 0) as giochi,
      (select coalesce(sum(s.levels),0) from efg_scores s where s.email = p.email) as livelli,
      (select coalesce(sum(s.score),0) from efg_scores s where s.email = p.email) as punti,
      (select jsonb_object_agg(s.game, jsonb_build_object('livelli', s.levels, 'punti', s.score, 'quando', s.updated_at))
         from efg_scores s where s.email = p.email) as dettaglio
    from efg_players p) x), '[]'::jsonb);
end $$;

-- 3. cambia il tipo di un utente
create or replace function public.efg_admin_set_tipo(p_key text, p_email text, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text; prima text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_tipo not in ('giocatore','admin_giocatore','admin') then return jsonb_build_object('errore', 'tipo non valido'); end if;
  select name, tipo into n, prima from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  update efg_players set tipo = p_tipo where email = e;
  insert into efg_log(kind, email, detail) values ('admin: tipo utente', e, jsonb_build_object('nome', n, 'prima', prima, 'dopo', p_tipo));
  return jsonb_build_object('ok', true, 'nome', n, 'tipo', p_tipo);
end $$;
revoke all on function public.efg_admin_set_tipo(text,text,text) from public;
grant execute on function public.efg_admin_set_tipo(text,text,text) to anon, authenticated;

-- 4. ripristino di un backup, con il tipo
create or replace function public.efg_admin_restore(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; d jsonb; bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select data into d from efg_backups where id = p_id;
  if d is null then return jsonb_build_object('errore', 'backup non trovato'); end if;
  insert into efg_backups(note, data) values ('automatico prima del ripristino del backup ' || p_id, efg_snapshot()) returning id into bid;
  delete from efg_scores where true; delete from efg_players where true;
  insert into efg_players(email, pid, name, created_at, tipo, disabilitato)
    select x.email, x.pid, x.name, x.created_at, coalesce(x.tipo, 'giocatore'), coalesce(x.disabilitato, false) from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;

-- 5. disabilita o riabilita un utente
create or replace function public.efg_admin_set_disabilitato(p_key text, p_email text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select name into n from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  update efg_players set disabilitato = coalesce(p_on, false) where email = e;
  insert into efg_log(kind, email, detail) values (case when p_on then 'admin: utente disabilitato' else 'admin: utente riabilitato' end, e, jsonb_build_object('nome', n));
  return jsonb_build_object('ok', true, 'nome', n, 'disabilitato', coalesce(p_on, false));
end $$;
revoke all on function public.efg_admin_set_disabilitato(text,text,boolean) from public;
grant execute on function public.efg_admin_set_disabilitato(text,text,boolean) to anon, authenticated;

-- accesso: un utente disabilitato non entra
create or replace function public.efg_login(p_email text)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); dis boolean;
begin
  select efg_players.disabilitato into dis from efg_players where efg_players.email = e;
  insert into efg_log(kind, email, detail) values ('accesso', e,
    jsonb_build_object('esito', case when dis is null then 'email sconosciuta' when dis then 'disabilitato' else 'ok' end));
  if dis then raise exception 'account disabilitato'; end if;
  return query select efg_players.pid, efg_players.name from efg_players where efg_players.email = e;
end $$;

-- punteggi: niente salvataggio per un utente disabilitato (gara aperta come prima)
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
    where (efg_scores.levels, efg_scores.score) < (excluded.levels, excluded.score);
  get diagnostics n = row_count;
  insert into efg_log(kind, email, game, detail) values ('partita', e, p_game,
    jsonb_build_object('punti', p_score, 'livelli', p_levels, 'record', n > 0));
  return n > 0;
end $$;

-- classifiche: gli utenti disabilitati non compaiono
create or replace function public.efg_board(p_game text)
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels, sum(s.score)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
  group by p.pid, p.name
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;

create or replace function public.efg_board_group(p_game text, p_group text default 'tutti')
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels, sum(s.score)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where (p_game = 'all' or s.game = p_game) and not p.disabilitato
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
