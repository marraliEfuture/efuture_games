-- ============================================================
-- EFUTURE GAMES — niente più cellulare + elimina giocatore
-- Da eseguire UNA volta nel SQL Editor di Supabase (si può rieseguire).
--  1. Toglie il cellulare dal database: dai giocatori e dai backup salvati.
--     L'operazione non si può annullare.
--  2. La registrazione chiede solo nome ed email (le app vecchie che mandano
--     ancora il cellulare continuano a funzionare: il numero viene ignorato).
--  3. Pannello admin: "Elimina" cancella un giocatore e i suoi punteggi
--     (sparisce dalla classifica); il registro eventi resta com'è.
-- ============================================================

-- 1. cellulare fuori dal database
alter table public.efg_players drop column if exists phone;
update public.efg_backups
   set data = jsonb_set(data, '{giocatori}',
         coalesce((select jsonb_agg(g - 'phone') from jsonb_array_elements(data->'giocatori') g), '[]'::jsonb))
 where jsonb_typeof(data->'giocatori') = 'array';

-- 2. registrazione senza cellulare
drop function if exists public.efg_register(text,text,text);
create function public.efg_register(p_email text, p_name text, p_phone text default null)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if char_length(trim(p_name)) not between 2 and 20 then raise exception 'invalid name'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  insert into efg_log(kind, email, detail) values ('registrazione', e, jsonb_build_object('nome', trim(p_name)));
  return query insert into efg_players(email, name) values (e, trim(p_name))
    returning efg_players.pid, efg_players.name;
end $$;
revoke all on function public.efg_register(text,text,text) from public;
grant execute on function public.efg_register(text,text,text) to anon, authenticated;

-- elenco giocatori del pannello admin, senza cellulare
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.email, p.created_at,
      (select count(*) from efg_scores s where s.email = p.email and s.levels > 0) as giochi,
      (select coalesce(sum(s.levels),0) from efg_scores s where s.email = p.email) as livelli,
      (select coalesce(sum(s.score),0) from efg_scores s where s.email = p.email) as punti,
      (select jsonb_object_agg(s.game, jsonb_build_object('livelli', s.levels, 'punti', s.score, 'quando', s.updated_at))
         from efg_scores s where s.email = p.email) as dettaglio
    from efg_players p) x), '[]'::jsonb);
end $$;

-- ripristino di un backup, senza cellulare
create or replace function public.efg_admin_restore(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; d jsonb; bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select data into d from efg_backups where id = p_id;
  if d is null then return jsonb_build_object('errore', 'backup non trovato'); end if;
  insert into efg_backups(note, data) values ('automatico prima del ripristino del backup ' || p_id, efg_snapshot()) returning id into bid;
  delete from efg_scores where true; delete from efg_players where true;
  insert into efg_players(email, pid, name, created_at)
    select x.email, x.pid, x.name, x.created_at from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;

-- 3. elimina un giocatore: via dai giocatori e dalla classifica, il registro resta
create or replace function public.efg_admin_delete_player(p_key text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text; ns int;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select name into n from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'giocatore non trovato'); end if;
  select count(*) into ns from efg_scores where email = e;
  delete from efg_players where email = e;   -- i punteggi se ne vanno insieme (on delete cascade)
  insert into efg_log(kind, email, detail) values ('admin: giocatore eliminato', e, jsonb_build_object('nome', n, 'punteggi_cancellati', ns));
  return jsonb_build_object('ok', true, 'nome', n, 'punteggi', ns);
end $$;
revoke all on function public.efg_admin_delete_player(text,text) from public;
grant execute on function public.efg_admin_delete_player(text,text) to anon, authenticated;
