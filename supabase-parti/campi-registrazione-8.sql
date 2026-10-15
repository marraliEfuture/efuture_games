-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 8 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 8".

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
-- fine parte 8
