-- ============================================================================
-- EFUTURE GAMES — Contatti collegati a un utente (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-contatti.sql. Rieseguibile, non tocca i dati.
-- Admin › Contatti › campo "Utente": il contatto si collega a un utente registrato.
--   colonna efg_contatti.utente_pid    il pid dell'utente (resta valido anche se l'admin gli cambia l'email)
--   efg_admin_contatti(p_key)          come prima, e ogni contatto ha anche "utente" {email, nome, azienda}
--                                      (null se non collegato; {} se l'utente collegato non c'è più)
--   efg_admin_contatto_utente(p_key, p_id, p_utente)   collega (email dell'utente) o scollega (vuoto)
--   efg_admin_restore                  come prima, rimette anche il collegamento
-- ============================================================================

alter table public.efg_contatti add column if not exists utente_pid uuid;

create or replace function public.efg_admin_contatti(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return jsonb_build_object(
    'contatti', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('utente', case when c.utente_pid is null then null
                  when p.pid is null then '{}'::jsonb else jsonb_build_object('email', p.email, 'nome', p.name, 'azienda', p.azienda) end)
                order by c.creato desc, c.id desc)
                from efg_contatti c left join efg_players p on p.pid = c.utente_pid), '[]'::jsonb),
    'servizi',  coalesce((select jsonb_agg(s order by lower(s)) from (select distinct on (lower(servizio)) servizio as s
                          from efg_contatti where coalesce(trim(servizio), '') <> '' order by lower(servizio), creato desc) x), '[]'::jsonb));
end $$;

create or replace function public.efg_admin_contatto_utente(p_key text, p_id bigint, p_utente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; u uuid; n text; e text := nullif(lower(trim(coalesce(p_utente, ''))), '');
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if e is not null then
    select pid, name into u, n from efg_players where email = e;
    if u is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  end if;
  update efg_contatti set utente_pid = u where id = p_id;
  if not found then return jsonb_build_object('errore', 'contatto non trovato'); end if;
  insert into efg_log(kind, email, detail) values ('admin: contatto collegato', e, jsonb_build_object('id', p_id, 'utente', coalesce(n, '—')));
  return jsonb_build_object('ok', true, 'utente', n);
end $$;
revoke all on function public.efg_admin_contatti(text), public.efg_admin_contatto_utente(text,bigint,text) from public;
grant execute on function public.efg_admin_contatti(text), public.efg_admin_contatto_utente(text,bigint,text) to anon, authenticated;

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
    insert into efg_contatti(id, creato, modificato, nome, azienda, telefono, email, servizio, descrizione, interesse, tipo, inserito_da, utente_pid)
      overriding system value
      select x.id, coalesce(x.creato, now()), x.modificato, x.nome, x.azienda, x.telefono, x.email, x.servizio, x.descrizione,
             coalesce(x.interesse, 'base'), coalesce(x.tipo, 'richiesta'), x.inserito_da, x.utente_pid
      from jsonb_populate_recordset(null::efg_contatti, d->'contatti') x;
    perform setval(pg_get_serial_sequence('public.efg_contatti', 'id'), greatest(coalesce((select max(id) from efg_contatti), 0), 1), (select count(*) > 0 from efg_contatti));
  end if;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;
revoke all on function public.efg_admin_restore(text,bigint) from public;
grant execute on function public.efg_admin_restore(text,bigint) to anon, authenticated;

notify pgrst, 'reload schema';
