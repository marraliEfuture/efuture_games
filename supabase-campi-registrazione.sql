-- ============================================================================
-- EFUTURE GAMES — registrazione con nome e azienda, categorie degli utenti (15/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Rieseguibile senza problemi.
-- Serve supabase-tipi-utenti.sql e supabase-recensioni.sql (già eseguiti).
--  1. Nuove colonne in efg_players: azienda, cellulare (lo vedono solo gli admin)
--     e categoria ('staff', 'sponsor', 'ospite'; di base 'ospite').
--     Sono Staff, in automatico, gli utenti con email @efuture.it o azienda "efuture";
--     a chi ha l'email @efuture.it senza azienda viene messa l'azienda "Efuture".
--  2. Campi della registrazione scelti in admin (efg_settings 'campi_registrazione'):
--     nome, azienda e cellulare possono essere non visibili, facoltativi o obbligatori.
--     L'email resta sempre obbligatoria (serve per accedere).
--  3. efg_register e efg_signup_check con l'azienda (le app vecchie continuano a funzionare).
--     Nome e azienda insieme non possono ripetersi.
--  4. efg_profilo / efg_set_azienda: l'app chiede l'azienda a chi non l'ha ancora.
--  5. Classifiche: in più azienda e nome separati, e "name" diventa "Azienda - Nome".
--     Il filtro dei gruppi usa le categorie: ospiti, sponsor, staff (anche più insieme,
--     separati da virgola) o tutti; i vecchi valori ('ospiti', 'efuture') valgono ancora.
--  6. Admin: elenco utenti con azienda, cellulare e categoria; efg_admin_set_categoria;
--     il ripristino dei backup conserva i nuovi campi.
-- ============================================================================

-- 1. colonne nuove
alter table public.efg_players add column if not exists azienda text;
alter table public.efg_players add column if not exists cellulare text;
alter table public.efg_players add column if not exists categoria text not null default 'ospite';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'efg_players_categoria_check') then
    alter table public.efg_players add constraint efg_players_categoria_check check (categoria in ('staff', 'sponsor', 'ospite'));
  end if;
end $$;

-- utente di Efuture: email @efuture.it (anche @reparto.efuture.it) oppure azienda "efuture"
create or replace function public.efg_is_efuture(p_email text, p_azienda text) returns boolean
language sql immutable set search_path = public as $$
  select lower(trim(coalesce(p_email, ''))) ~ '@([a-z0-9-]+\.)*efuture\.it$' or lower(trim(coalesce(p_azienda, ''))) = 'efuture';
$$;

-- in automatico: azienda "Efuture" per le email @efuture.it, e categoria Staff (solo se era Ospite)
create or replace function public.efg_players_efuture() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(trim(new.azienda), '') = '' and lower(trim(new.email)) ~ '@([a-z0-9-]+\.)*efuture\.it$' then new.azienda := 'Efuture'; end if;
  if lower(trim(coalesce(new.azienda, ''))) = 'efuture' then new.azienda := 'Efuture'; end if;   -- sempre scritto uguale
  if new.categoria = 'ospite' and efg_is_efuture(new.email, new.azienda)
     and (tg_op = 'INSERT' or coalesce(old.azienda, '') is distinct from coalesce(new.azienda, '')) then
    new.categoria := 'staff';
  end if;
  return new;
end $$;
drop trigger if exists efg_players_efuture on public.efg_players;
create trigger efg_players_efuture before insert or update of azienda on public.efg_players
  for each row execute function public.efg_players_efuture();
-- funzioni d'aiuto: le usano solo le altre funzioni del database, non l'app
revoke all on function public.efg_is_efuture(text,text), public.efg_players_efuture() from public, anon, authenticated;

-- utenti già registrati (una volta sola: tocca solo chi è ancora Ospite o senza azienda)
update public.efg_players set azienda = 'Efuture'
 where coalesce(trim(azienda), '') = '' and lower(trim(email)) ~ '@([a-z0-9-]+\.)*efuture\.it$';
update public.efg_players set categoria = 'staff' where categoria = 'ospite' and efg_is_efuture(email, azienda);

-- nome e azienda insieme unici (al posto del solo nome)
drop index if exists public.efg_players_name_unique;
do $$ begin
  if exists (select 1 from efg_players group by lower(trim(name)), lower(trim(coalesce(azienda, ''))) having count(*) > 1) then
    raise notice 'Ci sono già utenti con lo stesso nome e la stessa azienda: indice unico non creato (la registrazione controlla comunque i nuovi).';
  else
    create unique index if not exists efg_players_nome_azienda_unique on public.efg_players (lower(trim(name)), lower(trim(coalesce(azienda, ''))));
  end if;
end $$;

-- 2. campi della registrazione
create or replace function public.efg_campi() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', 'obbligatorio', 'azienda', 'obbligatorio', 'cellulare', 'facoltativo')
         || coalesce((select value::jsonb from efg_settings where key = 'campi_registrazione'), '{}'::jsonb)
         || jsonb_build_object('email', 'obbligatorio');
$$;

create or replace function public.efg_impostazioni() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vista_default', coalesce((select value from efg_settings where key = 'vista_default'), 'game'),
    'recensione_punti', efg_bonus_recensione(),
    'recensione_link', (select value from efg_settings where key = 'recensione_link'),
    'campi', efg_campi());
$$;

create or replace function public.efg_admin_set_impostazione(p_key text, p_nome text, p_valore text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; v text := trim(coalesce(p_valore, '')); j jsonb; k text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_nome = 'vista_default' then
    if v not in ('game', 'light', 'dark') then return jsonb_build_object('errore', 'visualizzazione non valida'); end if;
  elsif p_nome = 'recensione_punti' then
    if v !~ '^[0-9]+$' or v::int > 5000 then return jsonb_build_object('errore', 'i punti devono essere un numero da 0 a 5000'); end if;
    v := (v::int)::text;
  elsif p_nome = 'campi_registrazione' then
    begin j := v::jsonb; exception when others then return jsonb_build_object('errore', 'campi non validi'); end;
    if jsonb_typeof(j) <> 'object' then return jsonb_build_object('errore', 'campi non validi'); end if;
    for k in select jsonb_object_keys(j) loop
      if k not in ('nome', 'azienda', 'cellulare') or j->>k not in ('nascosto', 'facoltativo', 'obbligatorio') then
        return jsonb_build_object('errore', 'campi non validi');
      end if;
    end loop;
    v := j::text;
  else
    return jsonb_build_object('errore', 'impostazione sconosciuta');
  end if;
  insert into efg_settings(key, value, updated_at) values (p_nome, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into efg_log(kind, detail) values ('admin: impostazione', jsonb_build_object('nome', p_nome, 'valore', v));
  return efg_impostazioni();
end $$;
revoke all on function public.efg_campi(), public.efg_impostazioni(), public.efg_admin_set_impostazione(text,text,text) from public;
grant execute on function public.efg_campi(), public.efg_impostazioni(), public.efg_admin_set_impostazione(text,text,text) to anon, authenticated;

-- 3. registrazione
drop function if exists public.efg_register(text,text,text);
drop function if exists public.efg_register(text,text,text,text);
create function public.efg_register(p_email text, p_name text, p_phone text default null, p_azienda text default null)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); c jsonb := efg_campi();
        n text := trim(coalesce(p_name, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if c->>'azienda' = 'nascosto' then a := null; end if;
  if a is null and e ~ '@([a-z0-9-]+\.)*efuture\.it$' then a := 'Efuture'; end if;   -- email di Efuture: l'azienda c'è già
  if c->>'cellulare' = 'nascosto' then tel := null; end if;
  if c->>'nome' = 'nascosto' and n = '' then n := coalesce(a, split_part(e, '@', 1)); end if;
  if char_length(n) not between 2 and 40 then raise exception 'invalid name'; end if;
  if c->>'azienda' = 'obbligatorio' and a is null and p_azienda is not null then raise exception 'invalid company'; end if;
  if a is not null and char_length(a) > 40 then raise exception 'invalid company'; end if;
  if c->>'cellulare' = 'obbligatorio' and tel is null and p_azienda is not null then raise exception 'invalid phone'; end if;
  if tel is not null and char_length(tel) not between 6 and 16 then raise exception 'invalid phone'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  if exists (select 1 from efg_players p where lower(trim(p.name)) = lower(n) and lower(trim(coalesce(p.azienda, ''))) = lower(coalesce(a, ''))) then
    raise exception 'name taken';
  end if;
  insert into efg_log(kind, email, detail) values ('registrazione', e, jsonb_build_object('nome', n, 'azienda', a));
  return query insert into efg_players(email, name, azienda, cellulare) values (e, n, a, tel)
    returning efg_players.pid, efg_players.name;
end $$;
revoke all on function public.efg_register(text,text,text,text) from public;
grant execute on function public.efg_register(text,text,text,text) to anon, authenticated;

drop function if exists public.efg_signup_check(text,text);
drop function if exists public.efg_signup_check(text,text,text);
create function public.efg_signup_check(p_email text, p_name text, p_azienda text default null)
returns table (nome_usato boolean, email_usata boolean)
language sql stable security definer set search_path = public as $$
  select
    coalesce(trim(p_name), '') <> '' and exists (select 1 from efg_players p where lower(trim(p.name)) = lower(trim(p_name))
      and lower(trim(coalesce(p.azienda, ''))) = lower(trim(coalesce(p_azienda, '')))),
    coalesce(trim(p_email), '') <> '' and exists (select 1 from efg_players p where p.email = lower(trim(p_email)));
$$;
revoke all on function public.efg_signup_check(text,text,text) from public;
grant execute on function public.efg_signup_check(text,text,text) to anon, authenticated;

-- 4. l'app chiede l'azienda a chi non l'ha (solo se è vuota: non si cambia quella di un altro)
create or replace function public.efg_profilo(p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', p.name, 'azienda', p.azienda,
           'manca_azienda', coalesce(trim(p.azienda), '') = '' and efg_campi()->>'azienda' = 'obbligatorio')
  from efg_players p where p.email = lower(trim(p_email));
$$;
create or replace function public.efg_set_azienda(p_email text, p_azienda text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); a text := trim(coalesce(p_azienda, '')); n text;
begin
  if char_length(a) not between 1 and 40 then raise exception 'invalid company'; end if;
  select name into n from efg_players where email = e and coalesce(trim(azienda), '') = '';
  if n is null then raise exception 'not found'; end if;
  if exists (select 1 from efg_players p where p.email <> e and lower(trim(p.name)) = lower(trim(n)) and lower(trim(coalesce(p.azienda, ''))) = lower(a)) then
    raise exception 'name taken';
  end if;
  update efg_players set azienda = a where email = e;
  insert into efg_log(kind, email, detail) values ('azienda aggiunta', e, jsonb_build_object('azienda', a));
  return efg_profilo(e);
end $$;
revoke all on function public.efg_profilo(text), public.efg_set_azienda(text,text) from public;
grant execute on function public.efg_profilo(text), public.efg_set_azienda(text,text) to anon, authenticated;

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
revoke all on function public.efg_board(text), public.efg_board_group(text, text) from public;
grant execute on function public.efg_board(text), public.efg_board_group(text, text) to anon, authenticated;

-- 6. admin: elenco utenti, categoria, ripristino
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.azienda, p.cellulare, p.categoria, p.email, p.created_at, p.tipo, p.disabilitato, (p.admin_key_hash is not null) as chiave,
      p.recensione_clic, p.recensione_ok,
      (select count(*) from efg_scores s where s.email = p.email and s.levels > 0) as giochi,
      (select coalesce(sum(s.levels),0) from efg_scores s where s.email = p.email) as livelli,
      (select coalesce(sum(s.score),0) from efg_scores s where s.email = p.email) as punti,
      (select jsonb_object_agg(s.game, jsonb_build_object('livelli', s.levels, 'punti', s.score, 'quando', s.updated_at))
         from efg_scores s where s.email = p.email) as dettaglio
    from efg_players p) x), '[]'::jsonb);
end $$;

create or replace function public.efg_admin_set_categoria(p_key text, p_email text, p_categoria text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_categoria not in ('staff', 'sponsor', 'ospite') then return jsonb_build_object('errore', 'categoria non valida'); end if;
  update efg_players set categoria = p_categoria where email = e returning name into n;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  insert into efg_log(kind, email, detail) values ('admin: categoria', e, jsonb_build_object('nome', n, 'categoria', p_categoria));
  return jsonb_build_object('ok', true, 'nome', n, 'categoria', p_categoria);
end $$;
revoke all on function public.efg_admin_set_categoria(text,text,text) from public;
grant execute on function public.efg_admin_set_categoria(text,text,text) to anon, authenticated;

create or replace function public.efg_admin_restore(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; d jsonb; bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select data into d from efg_backups where id = p_id;
  if d is null then return jsonb_build_object('errore', 'backup non trovato'); end if;
  insert into efg_backups(note, data) values ('automatico prima del ripristino del backup ' || p_id, efg_snapshot()) returning id into bid;
  delete from efg_scores where true; delete from efg_players where true;
  insert into efg_players(email, pid, name, created_at, tipo, disabilitato, admin_key_hash, recensione_clic, recensione_ok, azienda, cellulare, categoria)
    select x.email, x.pid, x.name, x.created_at, coalesce(x.tipo, 'giocatore'), coalesce(x.disabilitato, false), x.admin_key_hash,
           x.recensione_clic, x.recensione_ok, x.azienda, x.cellulare, coalesce(x.categoria, 'ospite')
    from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;

-- fa vedere subito le nuove funzioni all'app (senza aspettare)
notify pgrst, 'reload schema';
