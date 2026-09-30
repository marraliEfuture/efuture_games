-- ============================================================
-- EFUTURE GAMES — tabella della classifica per Supabase
-- Incolla tutto nel "SQL Editor" del progetto e premi "Run".
-- ============================================================

create table if not exists public.scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null check (game in ('sysadmin','coretech','timenet','inncloud')),
  score      integer not null check (score >= 0 and score < 10000000),
  nickname   text not null check (char_length(nickname) between 2 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

alter table public.scores enable row level security;

-- chiunque può leggere la classifica
drop policy if exists "classifica pubblica" on public.scores;
create policy "classifica pubblica" on public.scores
  for select using (true);

-- ognuno può scrivere solo i propri punteggi
drop policy if exists "inserisce i propri punti" on public.scores;
create policy "inserisce i propri punti" on public.scores
  for insert with check (auth.uid() = user_id);

drop policy if exists "aggiorna i propri punti" on public.scores;
create policy "aggiorna i propri punti" on public.scores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists scores_game_score on public.scores (game, score desc);
