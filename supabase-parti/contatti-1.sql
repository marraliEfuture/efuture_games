-- EFUTURE GAMES — supabase-contatti.sql, PARTE 1 DI 5: tabella e elenco dei contatti
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 1".

create table if not exists public.efg_contatti (
  id          bigint generated always as identity primary key,
  creato      timestamptz not null default now(),
  modificato  timestamptz,
  nome        text not null,
  azienda     text,
  telefono    text,
  email       text,
  servizio    text,
  descrizione text,
  interesse   text not null default 'base' check (interesse in ('base', 'medio', 'alto')),
  inserito_da text
);
alter table public.efg_contatti add column if not exists tipo text not null default 'richiesta';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'efg_contatti_tipo_check') then
    alter table public.efg_contatti add constraint efg_contatti_tipo_check check (tipo in ('feedback', 'richiesta', 'segnalazione'));
  end if;
end $$;
alter table public.efg_contatti enable row level security;   -- nessuna regola: si legge e scrive solo dalle funzioni
revoke all on table public.efg_contatti from anon, authenticated;

-- chi ha inserito: l'email dell'admin (chiave personale) o "chiave principale"
create or replace function public.efg_admin_chi(p_key text) returns text
language sql immutable set search_path = public as $$
  select case when position(E'\n' in coalesce(p_key, '')) > 0 then lower(trim(split_part(p_key, E'\n', 1))) else 'chiave principale' end
$$;

create or replace function public.efg_admin_contatti(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return jsonb_build_object(
    'contatti', coalesce((select jsonb_agg(to_jsonb(c) order by c.creato desc, c.id desc) from efg_contatti c), '[]'::jsonb),
    'servizi',  coalesce((select jsonb_agg(s order by lower(s)) from (select distinct on (lower(servizio)) servizio as s
                          from efg_contatti where coalesce(trim(servizio), '') <> '' order by lower(servizio), creato desc) x), '[]'::jsonb));
end $$;

notify pgrst, 'reload schema';
-- fine parte 1
