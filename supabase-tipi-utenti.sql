-- ============================================================
-- EFUTURE GAMES — tipo di utente (pannello admin, sezione Utenti)
-- Da eseguire UNA volta nel SQL Editor di Supabase (si può rieseguire).
--  1. Ogni utente ha un tipo: 'giocatore' (predefinito), 'admin_giocatore'
--     (admin e giocatore) oppure 'admin' (solo admin).
--  2. efg_admin_players restituisce anche il tipo.
--  3. efg_admin_set_tipo cambia il tipo di un utente e lo scrive nel log.
--  4. Il ripristino di un backup conserva il tipo (i backup vecchi,
--     senza tipo, tornano 'giocatore').
-- ============================================================

-- 1. colonna tipo
alter table public.efg_players add column if not exists tipo text not null default 'giocatore';
alter table public.efg_players drop constraint if exists efg_players_tipo_check;
alter table public.efg_players add constraint efg_players_tipo_check check (tipo in ('giocatore','admin_giocatore','admin'));

-- 2. elenco utenti per l'admin, con il tipo
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.email, p.created_at, p.tipo,
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
  insert into efg_players(email, pid, name, created_at, tipo)
    select x.email, x.pid, x.name, x.created_at, coalesce(x.tipo, 'giocatore') from jsonb_populate_recordset(null::efg_players, d->'giocatori') x;
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x;
  insert into efg_log(kind, detail) values ('admin: ripristino', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;
