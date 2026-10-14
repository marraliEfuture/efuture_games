-- ============================================================================
-- EFUTURE GAMES — il reset dall'admin riblocca i giochi sui telefoni (14/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Lo sblocco dei giochi è salvato sul
-- telefono: finora il reset cancellava punti e giocatori ma i giochi restavano
-- sbloccati. Ora:
--   efg_admin_reset(p_key, p_what)  come prima, e in più segna il "numero di reset"
--                                   (data e ora del reset) in efg_settings.
--                                   "Cancella tutto" toglie solo i giocatori: gli utenti
--                                   admin e admin_giocatore restano (perdono solo i punti)
--   efg_reset_id()                  l'app lo legge all'apertura: se è cambiato,
--                                   riblocca i 4 giochi e cancella i record del telefono
-- Non tocca i dati. Rieseguibile senza problemi.
-- Vale dal prossimo reset: dopo averlo eseguito, fai di nuovo il reset dall'admin.
-- Serve supabase-tipi-utenti.sql (colonna tipo), già eseguito.
-- ============================================================================

create table if not exists public.efg_settings (
  key   text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.efg_settings enable row level security;   -- nessun accesso diretto: solo dalle funzioni

-- azzera: 'punti' = cancella i punteggi (i giocatori restano registrati);
--         'tutto' = anche gli utenti di tipo giocatore (admin e admin_giocatore restano, senza punti).
-- Prima fa sempre un backup automatico. In entrambi i casi i giochi tornano da sbloccare sui telefoni.
create or replace function public.efg_admin_reset(p_key text, p_what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; bid bigint; np int; ns int; na int := 0;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_what not in ('punti', 'tutto') then return jsonb_build_object('errore', 'scelta non valida'); end if;
  insert into efg_backups(note, data) values ('automatico prima del reset (' || p_what || ')', efg_snapshot()) returning id into bid;
  select count(*) into ns from efg_scores; select count(*) into np from efg_players;
  delete from efg_scores where true;
  if p_what = 'tutto' then
    delete from efg_players where coalesce(tipo, 'giocatore') not in ('admin', 'admin_giocatore');
    get diagnostics np = row_count;
    select count(*) into na from efg_players;
  else np := 0; end if;
  insert into efg_settings(key, value, updated_at) values ('reset_id', to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into efg_log(kind, detail) values ('admin: reset ' || p_what, jsonb_build_object('backup', bid, 'punteggi_cancellati', ns, 'giocatori_cancellati', np, 'admin_tenuti', na));
  return jsonb_build_object('backup', bid, 'punteggi', ns, 'giocatori', np, 'admin_tenuti', na);
end $$;
revoke all on function public.efg_admin_reset(text,text) from public;
grant execute on function public.efg_admin_reset(text,text) to anon, authenticated;

-- app: numero dell'ultimo reset (null se non c'è ancora stato un reset con questa versione)
create or replace function public.efg_reset_id() returns text
language sql stable security definer set search_path = public as $$
  select value from efg_settings where key = 'reset_id'
$$;
revoke all on function public.efg_reset_id() from public;
grant execute on function public.efg_reset_id() to anon, authenticated;

-- fa vedere subito le nuove funzioni all'app (senza aspettare)
notify pgrst, 'reload schema';
