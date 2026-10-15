-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 4 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 4".

create function public.efg_register(p_email text, p_name text, p_phone text default null, p_azienda text default null)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); c jsonb := efg_campi();
        n text := trim(coalesce(p_name, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if c->>'azienda' = 'nascosto' then a := null; end if;
  if a is null and e ~ '@([a-z0-9-]+\.)*efuture\.it$' then a := 'Efuture'; end if;   -- email di Efuture: l'azienda c'è già
  if c->>'cellulare' = 'nascosto' then tel := null; end if;
  if c->>'nome' = 'nascosto' and n = '' then n := coalesce(a, split_part(e, '@', 1)); end if;
  if char_length(n) not between 2 and 40 then raise exception 'invalid name'; end if;
  if c->>'azienda' = 'obbligatorio' and a is null and p_azienda is not null then raise exception 'invalid company'; end if;
  if a is not null and char_length(a) > 40 then raise exception 'invalid company'; end if;
  if c->>'cellulare' = 'obbligatorio' and tel is null and p_azienda is not null then raise exception 'invalid phone'; end if;
  if tel is not null and char_length(tel) not between 6 and 16 then raise exception 'invalid phone'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  if exists (select 1 from efg_players p where lower(trim(p.name)) = lower(n) and lower(trim(coalesce(p.azienda, ''))) = lower(coalesce(a, ''))) then
    raise exception 'name taken';
  end if;
  insert into efg_log(kind, email, detail) values ('registrazione', e, jsonb_build_object('nome', n, 'azienda', a));
  return query insert into efg_players(email, name, azienda, cellulare) values (e, n, a, tel)
    returning efg_players.pid, efg_players.name;
end $$;

revoke all on function public.efg_register(text,text,text,text) from public;

grant execute on function public.efg_register(text,text,text,text) to anon, authenticated;

drop function if exists public.efg_signup_check(text,text);

drop function if exists public.efg_signup_check(text,text,text);
-- fine parte 4
