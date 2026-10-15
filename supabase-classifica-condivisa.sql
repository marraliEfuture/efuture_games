-- ============================================================================
-- EFUTURE GAMES — filtri della classifica condivisi tra PC (15/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Rieseguibile, non tocca i dati.
-- La pagina classifica.html salva qui i filtri scelti (Fase, Classifica,
-- Visualizzazione, Top, Giocatori, QR) e il passo di "Prossima posizione";
-- le altre classifiche aperte (anche su altri PC) li leggono ogni 3 secondi.
--   efg_classifica_vista()                     lettura (pubblica: solo i filtri, nessun dato personale)
--   efg_admin_set_classifica(p_key, p_vista, p_reveal)   scrittura, solo con la chiave admin
-- Il campo "t" (millisecondi) lo mette il server: vince sempre l'ultima scelta.
-- ============================================================================

create table if not exists public.efg_settings (
  key   text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.efg_settings enable row level security;

create or replace function public.efg_classifica_vista() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vista',  (select value::jsonb from efg_settings where key = 'classifica_vista'),
    'reveal', (select value::jsonb from efg_settings where key = 'classifica_reveal'));
$$;

create or replace function public.efg_admin_set_classifica(p_key text, p_vista jsonb default null, p_reveal jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_vista is not null then
    if jsonb_typeof(p_vista) <> 'object' or length(p_vista::text) > 1000 then return jsonb_build_object('errore', 'filtri non validi'); end if;
    insert into efg_settings(key, value, updated_at) values ('classifica_vista', (p_vista || jsonb_build_object('t', t))::text, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if p_reveal is not null then
    if jsonb_typeof(p_reveal) <> 'object' or jsonb_typeof(p_reveal->'n') <> 'number' then return jsonb_build_object('errore', 'passo non valido'); end if;
    insert into efg_settings(key, value, updated_at) values ('classifica_reveal', jsonb_build_object('n', greatest(0, least(100, (p_reveal->>'n')::int)), 't', t)::text, now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return efg_classifica_vista();
end $$;

revoke all on function public.efg_classifica_vista(), public.efg_admin_set_classifica(text,jsonb,jsonb) from public;
grant execute on function public.efg_classifica_vista(), public.efg_admin_set_classifica(text,jsonb,jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
