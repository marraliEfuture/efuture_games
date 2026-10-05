-- ============================================================
-- EFUTURE GAMES — countdown di apertura / chiusura della gara
-- Da eseguire nel SQL Editor di Supabase (si può rieseguire).
-- - Apertura: finché il conto alla rovescia non arriva a zero i 4 giochi
--   sono bloccati, poi si aprono da soli.
-- - Chiusura: si gioca finché il conto non arriva a zero, poi i giochi si
--   bloccano e i punteggi non vengono più accettati (classifica definitiva).
-- - Stop: annulla il countdown, i giochi tornano liberi.
-- L'ora di riferimento è quella del database, uguale per tutti i telefoni.
-- ============================================================
create table if not exists public.efg_gate (
  id         int primary key default 1 check (id = 1),
  mode       text check (mode in ('apertura', 'chiusura')),
  ends_at    timestamptz,
  minutes    int,
  updated_at timestamptz not null default now()
);
alter table public.efg_gate enable row level security;     -- nessun accesso diretto: solo dalle funzioni
insert into public.efg_gate(id) values (1) on conflict (id) do nothing;

-- stato pubblico del countdown (lo leggono app e classifica)
create or replace function public.efg_gate_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', g.mode, 'ends_at', g.ends_at, 'minutes', g.minutes, 'now', now())
  from efg_gate g where g.id = 1;
$$;

-- si può giocare adesso? (p_grace: tolleranza per le partite finite proprio allo scadere)
create or replace function public.efg_gate_open(p_grace interval default interval '0 seconds') returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case g.mode
                            when 'apertura' then now() >= g.ends_at
                            when 'chiusura' then now() <  g.ends_at + p_grace
                            else true end
                   from efg_gate g where g.id = 1), true);
$$;

-- avvio / stop dal pannello (solo amministratori)
create or replace function public.efg_admin_gate(p_key text, p_mode text, p_minutes int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_mode is null or p_mode = 'stop' then
    update efg_gate set mode = null, ends_at = null, updated_at = now() where id = 1;
    insert into efg_log(kind, email) values ('admin: countdown fermato', auth.jwt()->>'email');
  else
    if p_mode not in ('apertura', 'chiusura') then return jsonb_build_object('errore', 'tipo di countdown non valido'); end if;
    if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then return jsonb_build_object('errore', 'i minuti devono essere tra 1 e 1440'); end if;
    update efg_gate set mode = p_mode, minutes = p_minutes, ends_at = now() + make_interval(mins => p_minutes), updated_at = now() where id = 1;
    insert into efg_log(kind, email, detail) values ('admin: countdown ' || p_mode, auth.jwt()->>'email', jsonb_build_object('minuti', p_minutes));
  end if;
  return efg_gate_state();
end $$;

-- i punteggi arrivano solo a gara aperta (10 secondi di tolleranza alla chiusura per la rete)
create or replace function public.efg_submit(p_email text, p_game text, p_score integer, p_levels integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n int;
begin
  if not exists (select 1 from efg_players where email = e) then raise exception 'not found'; end if;
  if not efg_gate_open(interval '10 seconds') then raise exception 'gara chiusa'; end if;
  insert into efg_scores(email, game, score, levels) values (e, p_game, p_score, p_levels)
  on conflict (email, game) do update set score = excluded.score, levels = excluded.levels, updated_at = now()
    where (efg_scores.levels, efg_scores.score) < (excluded.levels, excluded.score);
  get diagnostics n = row_count;
  insert into efg_log(kind, email, game, detail) values ('partita', e, p_game,
    jsonb_build_object('punti', p_score, 'livelli', p_levels, 'record', n > 0));
  return n > 0;
end $$;

revoke all on function public.efg_gate_state(), public.efg_gate_open(interval), public.efg_admin_gate(text, text, int) from public;
grant execute on function public.efg_gate_state(), public.efg_admin_gate(text, text, int) to anon, authenticated;
