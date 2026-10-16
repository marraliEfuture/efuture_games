-- ============================================================================
-- EFUTURE GAMES — Contatti: feedback, richieste e segnalazioni (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Rieseguibile, non tocca gli altri dati.
-- Admin › Contatti: l'admin registra a mano i contatti raccolti all'evento.
--   efg_contatti                tabella (nessun accesso diretto: solo dalle funzioni admin)
--   efg_admin_contatti(p_key)   elenco, dal più recente, + elenco dei servizi già usati
--   efg_admin_contatto_salva(p_key, p_id, p_nome, p_azienda, p_telefono, p_email, p_servizio, p_descrizione, p_interesse, p_tipo)
--                               p_id null = nuovo contatto, altrimenti modifica; tipo: feedback, richiesta, segnalazione
--   efg_admin_contatto_elimina(p_key, p_id)
-- Il servizio è testo libero: ogni servizio scritto compare tra le scelte dei contatti successivi.
-- Backup: i backup dell'admin (efg_snapshot) contengono anche i contatti; il ripristino li rimette
-- solo se il backup li contiene (i backup fatti prima di questo file non toccano i contatti).
-- Serve supabase-campi-registrazione.sql (ripristino con azienda, cellulare e categoria).
-- ============================================================================

create table if not exists public.efg_contatti (
  id          bigint generated always as identity primary key,
  creato      timestamptz not null default now(),
  modificato  timestamptz,
  nome        text not null,
  azienda     text,
  telefono    text,
  email       text,
  servizio    text,
  descrizione text,
  interesse   text not null default 'base' check (interesse in ('base', 'medio', 'alto')),
  inserito_da text
);
alter table public.efg_contatti add column if not exists tipo text not null default 'richiesta';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'efg_contatti_tipo_check') then
    alter table public.efg_contatti add constraint efg_contatti_tipo_check check (tipo in ('feedback', 'richiesta', 'segnalazione'));
  end if;
end $$;
alter table public.efg_contatti enable row level security;   -- nessuna regola: si legge e scrive solo dalle funzioni
revoke all on table public.efg_contatti from anon, authenticated;

-- chi ha inserito: l'email dell'admin (chiave personale) o "chiave principale"
create or replace function public.efg_chi_inserisce(p_key text) returns text
language sql immutable set search_path = public as $$
  select case when position(E'\n' in coalesce(p_key, '')) > 0 then lower(trim(split_part(p_key, E'\n', 1))) else 'chiave principale' end
$$;

create or replace function public.efg_admin_contatti(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return jsonb_build_object(
    'contatti', coalesce((select jsonb_agg(to_jsonb(c) order by c.creato desc, c.id desc) from efg_contatti c), '[]'::jsonb),
    'servizi',  coalesce((select jsonb_agg(s order by lower(s)) from (select distinct on (lower(servizio)) servizio as s
                          from efg_contatti where coalesce(trim(servizio), '') <> '' order by lower(servizio), creato desc) x), '[]'::jsonb));
end $$;

drop function if exists public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text);
drop function if exists public.efg_admin_chi(text);   -- nome vecchio della funzione qui sotto
create or replace function public.efg_admin_contatto_salva(p_key text, p_id bigint, p_nome text, p_azienda text, p_telefono text,
  p_email text, p_servizio text, p_descrizione text, p_interesse text, p_tipo text default 'richiesta')
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; n text := trim(coalesce(p_nome, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+ ]', '', 'g'), ''); e text := nullif(lower(trim(coalesce(p_email, ''))), '');
        s text := nullif(regexp_replace(trim(coalesce(p_servizio, '')), '\s+', ' ', 'g'), ''); d text := nullif(trim(coalesce(p_descrizione, '')), '');
        g text := coalesce(nullif(trim(p_interesse), ''), 'base'); t text := coalesce(nullif(trim(p_tipo), ''), 'richiesta'); s0 text; nid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if char_length(n) not between 2 and 80 then return jsonb_build_object('errore', 'scrivi nome e cognome (da 2 a 80 caratteri)'); end if;
  if a is not null and char_length(a) > 80 then return jsonb_build_object('errore', 'l''azienda può avere al massimo 80 caratteri'); end if;
  if tel is not null and char_length(regexp_replace(tel, '[^0-9]', '', 'g')) not between 6 and 15 then return jsonb_build_object('errore', 'telefono non valido'); end if;
  if e is not null and e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('errore', 'email non valida'); end if;
  if s is not null and char_length(s) > 60 then return jsonb_build_object('errore', 'il servizio può avere al massimo 60 caratteri'); end if;
  if d is not null and char_length(d) > 4000 then return jsonb_build_object('errore', 'la descrizione può avere al massimo 4000 caratteri'); end if;
  if g not in ('base', 'medio', 'alto') then return jsonb_build_object('errore', 'grado di interesse non valido'); end if;
  if t not in ('feedback', 'richiesta', 'segnalazione') then return jsonb_build_object('errore', 'tipo non valido'); end if;
  -- servizio già usato con altre maiuscole: si riusa la stessa scrittura
  if s is not null then select servizio into s0 from efg_contatti where lower(servizio) = lower(s) order by creato limit 1; s := coalesce(s0, s); end if;
  if p_id is null then
    insert into efg_contatti(nome, azienda, telefono, email, servizio, descrizione, interesse, tipo, inserito_da)
      values (n, a, tel, e, s, d, g, t, efg_chi_inserisce(p_key)) returning id into nid;
    insert into efg_log(kind, detail) values ('admin: contatto aggiunto', jsonb_build_object('id', nid, 'nome', n, 'tipo', t, 'servizio', s, 'interesse', g));
  else
    update efg_contatti set nome = n, azienda = a, telefono = tel, email = e, servizio = s, descrizione = d, interesse = g, tipo = t, modificato = now()
      where id = p_id returning id into nid;
    if nid is null then return jsonb_build_object('errore', 'contatto non trovato'); end if;
    insert into efg_log(kind, detail) values ('admin: contatto modificato', jsonb_build_object('id', nid, 'nome', n));
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.efg_admin_contatto_elimina(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  delete from efg_contatti where id = p_id returning nome into n;
  if n is null then return jsonb_build_object('errore', 'contatto non trovato'); end if;
  insert into efg_log(kind, detail) values ('admin: contatto eliminato', jsonb_build_object('id', p_id, 'nome', n));
  return jsonb_build_object('ok', true, 'nome', n);
end $$;

revoke all on function public.efg_chi_inserisce(text), public.efg_admin_contatti(text),
  public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text,text), public.efg_admin_contatto_elimina(text,bigint) from public;
grant execute on function public.efg_admin_contatti(text),
  public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text,text), public.efg_admin_contatto_elimina(text,bigint) to anon, authenticated;

-- backup: anche i contatti
create or replace function public.efg_snapshot()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'creato', now(),
    'giocatori', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from efg_players p), '[]'::jsonb),
    'punteggi',  coalesce((select jsonb_agg(to_jsonb(s) order by s.email, s.game) from efg_scores s), '[]'::jsonb),
    'contatti',  coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from efg_contatti c), '[]'::jsonb));
$$;
revoke all on function public.efg_snapshot() from public, anon, authenticated;

create or replace function public.efg_admin_backups(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'creato', created_at, 'nota', note,
      'giocatori', jsonb_array_length(data->'giocatori'), 'punteggi', jsonb_array_length(data->'punteggi'),
      'contatti', case when data ? 'contatti' then jsonb_array_length(data->'contatti') end) order by id desc)
    from efg_backups), '[]'::jsonb);
end $$;
revoke all on function public.efg_admin_backups(text) from public;
grant execute on function public.efg_admin_backups(text) to anon, authenticated;

-- ripristino (come in supabase-campi-registrazione.sql) + i contatti, se il backup li contiene
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
  if d ? 'contatti' then
    delete from efg_contatti where true;
    insert into efg_contatti(id, creato, modificato, nome, azienda, telefono, email, servizio, descrizione, interesse, tipo, inserito_da)
      overriding system value
      select x.id, coalesce(x.creato, now()), x.modificato, x.nome, x.azienda, x.telefono, x.email, x.servizio, x.descrizione,
             coalesce(x.interesse, 'base'), coalesce(x.tipo, 'richiesta'), x.inserito_da
      from jsonb_populate_recordset(null::efg_contatti, d->'contatti') x;
    perform setval(pg_get_serial_sequence('public.efg_contatti', 'id'), greatest(coalesce((select max(id) from efg_contatti), 0), 1), (select count(*) > 0 from efg_contatti));
  end if;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;
revoke all on function public.efg_admin_restore(text,bigint) from public;
grant execute on function public.efg_admin_restore(text,bigint) to anon, authenticated;

notify pgrst, 'reload schema';
