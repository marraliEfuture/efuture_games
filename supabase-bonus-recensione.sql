-- ============================================================================
-- EFUTURE GAMES — punti del Bonus Recensione scelti in admin (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Rieseguibile, non tocca i dati.
-- Nel database c'era ancora la prima versione di efg_bonus_recensione(), che dava sempre 200:
-- Admin › Utenti › Punti salvava il numero, ma app e classifiche continuavano a usare 200.
-- Questa versione legge i punti salvati dall'admin (efg_settings 'recensione_punti'), 200 se non impostati.
-- ============================================================================

create table if not exists public.efg_settings (
  key   text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.efg_settings enable row level security;

create or replace function public.efg_bonus_recensione() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select value::int from efg_settings where key = 'recensione_punti' and value ~ '^[0-9]+$'), 200)
$$;
revoke all on function public.efg_bonus_recensione() from public;
grant execute on function public.efg_bonus_recensione() to anon, authenticated;

notify pgrst, 'reload schema';

-- controllo: deve mostrare i punti scelti in admin
select efg_bonus_recensione() as punti_bonus_recensione;
