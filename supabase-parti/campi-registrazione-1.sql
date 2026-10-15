-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 1 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 1".

-- 1. colonne nuove
alter table public.efg_players add column if not exists azienda text;

alter table public.efg_players add column if not exists cellulare text;

alter table public.efg_players add column if not exists categoria text not null default 'ospite';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'efg_players_categoria_check') then
    alter table public.efg_players add constraint efg_players_categoria_check check (categoria in ('staff', 'sponsor', 'ospite'));
  end if;
end $$;

-- utente di Efuture: email @efuture.it (anche @reparto.efuture.it) oppure azienda "efuture"
create or replace function public.efg_is_efuture(p_email text, p_azienda text) returns boolean
language sql immutable set search_path = public as $$
  select lower(trim(coalesce(p_email, ''))) ~ '@([a-z0-9-]+\.)*efuture\.it$' or lower(trim(coalesce(p_azienda, ''))) = 'efuture';
$$;

-- in automatico: azienda "Efuture" per le email @efuture.it, e categoria Staff (solo se era Ospite)
create or replace function public.efg_players_efuture() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(trim(new.azienda), '') = '' and lower(trim(new.email)) ~ '@([a-z0-9-]+\.)*efuture\.it$' then new.azienda := 'Efuture'; end if;
  if lower(trim(coalesce(new.azienda, ''))) = 'efuture' then new.azienda := 'Efuture'; end if;   -- sempre scritto uguale
  if new.categoria = 'ospite' and efg_is_efuture(new.email, new.azienda)
     and (tg_op = 'INSERT' or coalesce(old.azienda, '') is distinct from coalesce(new.azienda, '')) then
    new.categoria := 'staff';
  end if;
  return new;
end $$;

drop trigger if exists efg_players_efuture on public.efg_players;

create trigger efg_players_efuture before insert or update of azienda on public.efg_players
  for each row execute function public.efg_players_efuture();

-- utenti già registrati (una volta sola: tocca solo chi è ancora Ospite o senza azienda)
update public.efg_players set azienda = 'Efuture'
 where coalesce(trim(azienda), '') = '' and lower(trim(email)) ~ '@([a-z0-9-]+\.)*efuture\.it$';
-- fine parte 1
