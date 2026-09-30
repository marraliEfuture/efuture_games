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
  phone      text not null check (phone ~ '^\+\d{8,15}$'),
  created_at timestamptz not null default now()
);

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

alter table public.efg_players enable row level security;
alter table public.efg_scores  enable row level security;
-- nessuna policy: da fuori si passa solo dalle funzioni

-- registrazione
create or replace function public.efg_register(p_email text, p_name text, p_phone text)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if char_length(trim(p_name)) not between 2 and 20 then raise exception 'invalid name'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  return query insert into efg_players(email, name, phone) values (e, trim(p_name), p_phone)
    returning efg_players.pid, efg_players.name;
end $$;

-- accesso con la sola email
create or replace function public.efg_login(p_email text)
returns table (pid uuid, name text)
language sql security definer set search_path = public as $$
  select pid, name from efg_players where email = lower(trim(p_email));
$$;

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
