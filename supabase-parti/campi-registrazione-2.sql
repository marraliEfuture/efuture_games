-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 2 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 2".

-- utenti già registrati (una volta sola: tocca solo chi è ancora Ospite o senza azienda)
update public.efg_players set azienda = 'Efuture'
 where coalesce(trim(azienda), '') = '' and lower(trim(email)) ~ '@([a-z0-9-]+\.)*efuture\.it$';

update public.efg_players set categoria = 'staff' where categoria = 'ospite' and efg_is_efuture(email, azienda);

-- nome e azienda insieme unici (al posto del solo nome)
drop index if exists public.efg_players_name_unique;

do $$ begin
  if exists (select 1 from efg_players group by lower(trim(name)), lower(trim(coalesce(azienda, ''))) having count(*) > 1) then
    raise notice 'Ci sono già utenti con lo stesso nome e la stessa azienda: indice unico non creato (la registrazione controlla comunque i nuovi).';
  else
    create unique index if not exists efg_players_nome_azienda_unique on public.efg_players (lower(trim(name)), lower(trim(coalesce(azienda, ''))));
  end if;
end $$;

-- 2. campi della registrazione
create or replace function public.efg_campi() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', 'obbligatorio', 'azienda', 'obbligatorio', 'cellulare', 'facoltativo')
         || coalesce((select value::jsonb from efg_settings where key = 'campi_registrazione'), '{}'::jsonb)
         || jsonb_build_object('email', 'obbligatorio');
$$;

create or replace function public.efg_impostazioni() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vista_default', coalesce((select value from efg_settings where key = 'vista_default'), 'game'),
    'recensione_punti', efg_bonus_recensione(),
    'recensione_link', (select value from efg_settings where key = 'recensione_link'),
    'campi', efg_campi());
$$;
-- fine parte 2
