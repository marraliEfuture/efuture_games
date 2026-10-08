-- ============================================================
-- EFUTURE GAMES — database della classifica per Supabase
-- Incolla tutto nel "SQL Editor" del progetto e premi "Run".
-- Accesso senza password: il giocatore è identificato dall'email.
-- Le tabelle non sono leggibili direttamente dal sito: il sito usa
-- solo le funzioni qui sotto, e la classifica espone solo i nomi.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.efg_players (
  email      text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  pid        uuid not null unique default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 20),
  created_at timestamptz not null default now()
);

-- niente cellulare (tolto il 07/10): aggiornamento di un database già creato
alter table public.efg_players drop column if exists phone;

create table if not exists public.efg_scores (
  email      text not null references public.efg_players(email) on delete cascade,
  game       text not null check (game in ('sysadmin','coretech','timenet','inncloud')),
  score      integer not null check (score between 0 and 100000),
  levels     integer not null default 0 check (levels between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (email, game)
);
-- aggiornamento di un database già creato: livelli superati per ogni record, punti = livello x secondi x vite
alter table public.efg_scores drop constraint if exists efg_scores_score_check;
alter table public.efg_scores add constraint efg_scores_score_check check (score between 0 and 100000);
alter table public.efg_scores add column if not exists levels integer not null default 0 check (levels between 0 and 3);
create index if not exists efg_scores_game_score on public.efg_scores (game, levels desc, score desc);
drop function if exists public.efg_submit(text,text,integer);
drop function if exists public.efg_board(text);

-- registro eventi (registrazioni, accessi, punteggi, operazioni di amministrazione)
create table if not exists public.efg_log (
  id     bigserial primary key,
  at     timestamptz not null default now(),
  kind   text not null,
  email  text,
  game   text,
  detail jsonb
);
create index if not exists efg_log_at on public.efg_log (at desc);

-- copie di sicurezza della classifica (fatte dal pannello admin e prima di ogni reset)
create table if not exists public.efg_backups (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  note       text,
  data       jsonb not null
);

-- chiave del pannello admin (solo l'impronta cifrata, mai la chiave in chiaro)
create table if not exists public.efg_admin (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);

alter table public.efg_players enable row level security;
alter table public.efg_scores  enable row level security;
alter table public.efg_log     enable row level security;
alter table public.efg_backups enable row level security;
alter table public.efg_admin   enable row level security;
-- nessuna policy: da fuori si passa solo dalle funzioni

-- registrazione: nome ed email (p_phone resta solo per le app vecchie e viene ignorato)
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

-- accesso con la sola email
create or replace function public.efg_login(p_email text)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  insert into efg_log(kind, email, detail) values ('accesso', e,
    jsonb_build_object('esito', case when exists (select 1 from efg_players where efg_players.email = e) then 'ok' else 'email sconosciuta' end));
  return query select efg_players.pid, efg_players.name from efg_players where efg_players.email = e;
end $$;

-- salva un risultato, tenendo solo il migliore:
-- prima contano i livelli superati, a parità di livelli i punti
create or replace function public.efg_submit(p_email text, p_game text, p_score integer, p_levels integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); n int;
begin
  if not exists (select 1 from efg_players where email = e) then raise exception 'not found'; end if;
  insert into efg_scores(email, game, score, levels) values (e, p_game, p_score, p_levels)
  on conflict (email, game) do update set score = excluded.score, levels = excluded.levels, updated_at = now()
    where (efg_scores.levels, efg_scores.score) < (excluded.levels, excluded.score);
  get diagnostics n = row_count;
  insert into efg_log(kind, email, game, detail) values ('partita', e, p_game,
    jsonb_build_object('punti', p_score, 'livelli', p_levels, 'record', n > 0));
  return n > 0;
end $$;

-- classifica: 'all' = somma dei 4 giochi, oppure l'id di un gioco
create or replace function public.efg_board(p_game text)
returns table (pid uuid, name text, levels integer, score integer, games integer)
language sql stable security definer set search_path = public as $$
  select p.pid, p.name, sum(s.levels)::int as levels, sum(s.score)::int as score,
         (count(*) filter (where s.levels > 0))::int as games
  from efg_scores s join efg_players p on p.email = s.email
  where p_game = 'all' or s.game = p_game
  group by p.pid, p.name
  order by levels desc, score desc, max(s.updated_at) asc
  limit 50;
$$;

revoke all on function public.efg_register(text,text,text), public.efg_login(text),
  public.efg_submit(text,text,integer,integer), public.efg_board(text) from public;
grant execute on function public.efg_register(text,text,text), public.efg_login(text),
  public.efg_submit(text,text,integer,integer), public.efg_board(text) to anon, authenticated;

-- ============================================================
-- PANNELLO ADMIN (admin.html): tutte le funzioni chiedono la chiave admin.
-- La chiave si imposta UNA volta dallo SQL Editor con:
--   select efg_admin_init('LA-TUA-CHIAVE');
-- (non va scritta in questo file, che è pubblico su GitHub)
-- ============================================================
create or replace function public.efg_admin_init(p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(p_new) < 10 then raise exception 'chiave troppo corta (minimo 10 caratteri)'; end if;
  insert into efg_admin(id, key_hash) values (1, crypt(p_new, gen_salt('bf')))
  on conflict (id) do update set key_hash = excluded.key_hash;
end $$;
revoke all on function public.efg_admin_init(text) from public, anon, authenticated;

-- controllo chiave, con blocco dopo 8 tentativi sbagliati in 10 minuti
drop function if exists public.efg_admin_auth(text);
create or replace function public.efg_admin_auth(p_key text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text; fails int;
begin
  -- restituisce null se la chiave è giusta, altrimenti il messaggio di errore
  -- (niente eccezioni: così il tentativo sbagliato resta nel registro)
  select count(*) into fails from efg_log where kind = 'admin: chiave errata' and at > now() - interval '10 minutes';
  if fails >= 8 then return 'troppi tentativi sbagliati: riprova tra 10 minuti'; end if;
  select key_hash into h from efg_admin where id = 1;
  if h is null then return 'chiave admin non ancora impostata'; end if;
  if crypt(coalesce(p_key, ''), h) <> h then
    insert into efg_log(kind) values ('admin: chiave errata');
    return 'chiave admin errata';
  end if;
  return null;
end $$;
revoke all on function public.efg_admin_auth(text) from public, anon, authenticated;

create or replace function public.efg_snapshot()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'creato', now(),
    'giocatori', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from efg_players p), '[]'::jsonb),
    'punteggi',  coalesce((select jsonb_agg(to_jsonb(s) order by s.email, s.game) from efg_scores s), '[]'::jsonb));
$$;
revoke all on function public.efg_snapshot() from public, anon, authenticated;

create or replace function public.efg_admin_login(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  insert into efg_log(kind) values ('admin: accesso');
  return jsonb_build_object(
    'giocatori', (select count(*) from efg_players),
    'punteggi',  (select count(*) from efg_scores),
    'eventi',    (select count(*) from efg_log),
    'backup',    (select count(*) from efg_backups),
    'ultimo_backup', (select max(created_at) from efg_backups));
end $$;

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

create or replace function public.efg_admin_logs(p_key text, p_limit int default 300, p_kind text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.id desc) from (
    select * from efg_log where p_kind is null or kind like p_kind || '%'
    order by id desc limit least(greatest(p_limit, 1), 2000)) l), '[]'::jsonb);
end $$;

create or replace function public.efg_admin_backup(p_key text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; d jsonb := efg_snapshot(); bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  insert into efg_backups(note, data) values (coalesce(nullif(trim(p_note), ''), 'backup manuale'), d) returning id into bid;
  insert into efg_log(kind, detail) values ('admin: backup', jsonb_build_object('id', bid, 'giocatori', jsonb_array_length(d->'giocatori'), 'punteggi', jsonb_array_length(d->'punteggi')));
  return jsonb_build_object('id', bid, 'data', d);
end $$;

create or replace function public.efg_admin_backups(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'creato', created_at, 'nota', note,
      'giocatori', jsonb_array_length(data->'giocatori'), 'punteggi', jsonb_array_length(data->'punteggi')) order by id desc)
    from efg_backups), '[]'::jsonb);
end $$;

create or replace function public.efg_admin_backup_get(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return (select data from efg_backups where id = p_id);
end $$;

-- azzera: 'punti' = cancella i punteggi (i giocatori restano registrati); 'tutto' = anche i giocatori.
-- Prima fa sempre un backup automatico.
create or replace function public.efg_admin_reset(p_key text, p_what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; bid bigint; np int; ns int;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_what not in ('punti', 'tutto') then return jsonb_build_object('errore', 'scelta non valida'); end if;
  insert into efg_backups(note, data) values ('automatico prima del reset (' || p_what || ')', efg_snapshot()) returning id into bid;
  select count(*) into ns from efg_scores; select count(*) into np from efg_players;
  delete from efg_scores where true;
  if p_what = 'tutto' then delete from efg_players where true; else np := 0; end if;
  insert into efg_log(kind, detail) values ('admin: reset ' || p_what, jsonb_build_object('backup', bid, 'punteggi_cancellati', ns, 'giocatori_cancellati', np));
  return jsonb_build_object('backup', bid, 'punteggi', ns, 'giocatori', np);
end $$;

-- ripristina un backup (prima salva lo stato attuale)
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

-- elimina un giocatore: via dai giocatori e dalla classifica, il registro resta
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

drop function if exists public.efg_admin_set_key(text,text);
create or replace function public.efg_admin_set_key(p_key text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if char_length(p_new) < 10 then return jsonb_build_object('errore', 'la nuova chiave deve avere almeno 10 caratteri'); end if;
  update efg_admin set key_hash = crypt(p_new, gen_salt('bf')) where id = 1;
  insert into efg_log(kind) values ('admin: chiave cambiata');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.efg_admin_login(text), public.efg_admin_players(text), public.efg_admin_logs(text,int,text),
  public.efg_admin_backup(text,text), public.efg_admin_backups(text), public.efg_admin_backup_get(text,bigint),
  public.efg_admin_reset(text,text), public.efg_admin_restore(text,bigint), public.efg_admin_set_key(text,text),
  public.efg_admin_delete_player(text,text) from public;
grant execute on function public.efg_admin_login(text), public.efg_admin_players(text), public.efg_admin_logs(text,int,text),
  public.efg_admin_backup(text,text), public.efg_admin_backups(text), public.efg_admin_backup_get(text,bigint),
  public.efg_admin_reset(text,text), public.efg_admin_restore(text,bigint), public.efg_admin_set_key(text,text),
  public.efg_admin_delete_player(text,text) to anon, authenticated;
