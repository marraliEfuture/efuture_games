-- ============================================================
-- EFUTURE GAMES — utenti: tipo, disabilitazione, chiavi admin personali
-- Da eseguire nel SQL Editor di Supabase. Si può rieseguire: se l'avevi già
-- eseguito, rieseguilo per avere le ultime novità (disabilitazione, chiavi).
--  1. Ogni utente ha un tipo: 'giocatore' (predefinito), 'admin_giocatore'
--     (admin e giocatore) oppure 'admin' (solo admin).
--  2. efg_admin_players restituisce anche il tipo.
--  3. efg_admin_set_tipo cambia il tipo di un utente e lo scrive nel log.
--  4. Il ripristino di un backup conserva tipo e disabilitazione (i backup
--     vecchi tornano 'giocatore', abilitato).
--  5. Un utente si può disabilitare (efg_admin_set_disabilitato): non può più
--     accedere, i suoi nuovi punteggi non vengono salvati e sparisce dalla
--     classifica. Riabilitandolo torna tutto com'era: i punteggi restano salvati.
--  6. Chiavi admin personali: ogni utente di tipo admin ('admin_giocatore' o
--     'admin') può avere la sua chiave, salvata SOLO cifrata (bcrypt) in
--     efg_players.admin_key_hash. Si entra nel pannello con email + chiave.
--     La chiave principale (efg_admin, impostata con efg_admin_init) resta
--     valida per il primo accesso e per le emergenze.
--     Chi torna 'giocatore' perde la chiave.
-- ============================================================

-- 1. colonna tipo
alter table public.efg_players add column if not exists tipo text not null default 'giocatore';
alter table public.efg_players drop constraint if exists efg_players_tipo_check;
alter table public.efg_players add constraint efg_players_tipo_check check (tipo in ('giocatore','admin_giocatore','admin'));
alter table public.efg_players add column if not exists disabilitato boolean not null default false;
alter table public.efg_players add column if not exists admin_key_hash text;   -- solo l'impronta bcrypt, mai la chiave

-- 2. elenco utenti per l'admin, con il tipo
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.email, p.created_at, p.tipo, p.disabilitato, (p.admin_key_hash is not null) as chiave,
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
  update efg_players set tipo = p_tipo,
    admin_key_hash = case when p_tipo = 'giocatore' then null else admin_key_hash end   -- un giocatore non entra nel pannello
    where email = e;
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
  insert into efg_players(email, pid, name, created_at, tipo, disabilitato, admin_key_hash)
    select x.email, x.pid, x.name, x.created_at, coalesce(x.tipo, 'giocatore'), coalesce(x.disabilitato, false), x.admin_key_hash from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
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

-- 6. chiavi admin personali ------------------------------------------------
-- La credenziale che arriva dal pannello in p_key è:
--   "email" + a capo + "chiave"  -> chiave personale di un utente admin
--   "chiave"                      -> chiave principale
-- Blocco dopo 8 tentativi sbagliati in 10 minuti, come prima.
drop function if exists public.efg_admin_auth(text);
create or replace function public.efg_admin_auth(p_key text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text; fails int; e text; k text; pl efg_players%rowtype;
begin
  select count(*) into fails from efg_log where kind = 'admin: chiave errata' and at > now() - interval '10 minutes';
  if fails >= 8 then return 'troppi tentativi sbagliati: riprova tra 10 minuti'; end if;
  perform set_config('efg.admin_email', '', true);
  if position(E'\n' in coalesce(p_key, '')) > 0 then
    e := lower(trim(split_part(p_key, E'\n', 1)));
    k := substr(p_key, position(E'\n' in p_key) + 1);
    select * into pl from efg_players where email = e;
    if pl.email is null or pl.admin_key_hash is null or pl.tipo = 'giocatore' or pl.disabilitato
       or crypt(coalesce(k, ''), pl.admin_key_hash) <> pl.admin_key_hash then
      insert into efg_log(kind, email) values ('admin: chiave errata', e);
      return 'email o chiave admin errata';
    end if;
    perform set_config('efg.admin_email', e, true);
    return null;
  end if;
  select key_hash into h from efg_admin where id = 1;
  if h is null then return 'chiave admin non ancora impostata'; end if;
  if crypt(coalesce(p_key, ''), h) <> h then
    insert into efg_log(kind) values ('admin: chiave errata');
    return 'chiave admin errata';
  end if;
  return null;
end $$;
revoke all on function public.efg_admin_auth(text) from public, anon, authenticated;

-- chi è collegato al pannello: {principale:true} oppure nome, email e tipo
create or replace function public.efg_admin_me(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  e := current_setting('efg.admin_email', true);
  if coalesce(e, '') = '' then return jsonb_build_object('principale', true); end if;
  return (select jsonb_build_object('principale', false, 'email', email, 'nome', name, 'tipo', tipo) from efg_players where email = e);
end $$;
revoke all on function public.efg_admin_me(text) from public;
grant execute on function public.efg_admin_me(text) to anon, authenticated;

-- cambio della propria chiave: personale se si è entrati con email, altrimenti la principale
create or replace function public.efg_admin_set_key(p_key text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare err text; e text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if char_length(coalesce(p_new, '')) < 10 then return jsonb_build_object('errore', 'la nuova chiave deve avere almeno 10 caratteri'); end if;
  e := current_setting('efg.admin_email', true);
  if coalesce(e, '') = '' then
    update efg_admin set key_hash = crypt(p_new, gen_salt('bf')) where id = 1;
    insert into efg_log(kind) values ('admin: chiave cambiata');
    return jsonb_build_object('ok', true, 'principale', true);
  end if;
  update efg_players set admin_key_hash = crypt(p_new, gen_salt('bf')) where email = e;
  insert into efg_log(kind, email) values ('admin: chiave personale cambiata', e);
  return jsonb_build_object('ok', true, 'principale', false);
end $$;
revoke all on function public.efg_admin_set_key(text,text) from public;
grant execute on function public.efg_admin_set_key(text,text) to anon, authenticated;

-- imposta, cambia o toglie (p_new vuoto) la chiave personale di un utente admin
create or replace function public.efg_admin_set_user_key(p_key text, p_email text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare err text; e text := lower(trim(p_email)); n text; t text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select name, tipo into n, t from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  if coalesce(p_new, '') = '' then
    update efg_players set admin_key_hash = null where email = e;
    insert into efg_log(kind, email, detail) values ('admin: chiave utente tolta', e, jsonb_build_object('nome', n));
    return jsonb_build_object('ok', true, 'nome', n, 'chiave', false);
  end if;
  if t = 'giocatore' then return jsonb_build_object('errore', 'prima rendi l''utente admin: un giocatore non ha la chiave'); end if;
  if char_length(p_new) < 10 then return jsonb_build_object('errore', 'la chiave deve avere almeno 10 caratteri'); end if;
  update efg_players set admin_key_hash = crypt(p_new, gen_salt('bf')) where email = e;
  insert into efg_log(kind, email, detail) values ('admin: chiave utente impostata', e, jsonb_build_object('nome', n));
  return jsonb_build_object('ok', true, 'nome', n, 'chiave', true);
end $$;
revoke all on function public.efg_admin_set_user_key(text,text,text) from public;
grant execute on function public.efg_admin_set_user_key(text,text,text) to anon, authenticated;
