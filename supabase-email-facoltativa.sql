-- ============================================================================
-- EFUTURE GAMES — anche l'email si sceglie in Admin › Impostazioni (15/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-campi-registrazione.sql.
-- Rieseguibile, non tocca i dati.
-- Finora l'email era sempre obbligatoria. Ora, come nome, azienda e cellulare,
-- può essere obbligatoria (predefinito), facoltativa o non visibile.
--  1. efg_campi: l'email vale "obbligatorio" se l'admin non sceglie altro.
--  2. efg_admin_set_impostazione: accetta anche il campo "email".
--  3. efg_register: chi si registra senza email riceve un identificativo interno
--     "<codice>@senza-email.invalid" (non è un indirizzo vero, non si vede da nessuna
--     parte: l'admin vede "senza email"). La registrazione restituisce anche l'email
--     usata, così l'app resta collegata su quel telefono. Senza email non si può
--     "Accedere" da un altro telefono; l'admin può aggiungere l'email in Utenti › Modifica.
-- ============================================================================

-- 1. campi della registrazione (email compresa, predefinito obbligatorio)
create or replace function public.efg_campi() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', 'obbligatorio', 'azienda', 'obbligatorio', 'email', 'obbligatorio', 'cellulare', 'facoltativo')
         || coalesce((select value::jsonb from efg_settings where key = 'campi_registrazione'), '{}'::jsonb);
$$;

-- 2. impostazioni dall'admin (uguale a prima, con "email" tra i campi)
create or replace function public.efg_admin_set_impostazione(p_key text, p_nome text, p_valore text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; v text := trim(coalesce(p_valore, '')); j jsonb; k text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_nome = 'vista_default' then
    if v not in ('game', 'light', 'dark') then return jsonb_build_object('errore', 'visualizzazione non valida'); end if;
  elsif p_nome = 'recensione_punti' then
    if v !~ '^[0-9]+$' or v::int > 5000 then return jsonb_build_object('errore', 'i punti devono essere un numero da 0 a 5000'); end if;
    v := (v::int)::text;
  elsif p_nome = 'home_layout' then
    if v not in ('ora', 'alto', 'lista', 'fisso') then return jsonb_build_object('errore', 'schermata non valida'); end if;
  elsif p_nome = 'campi_registrazione' then
    begin j := v::jsonb; exception when others then return jsonb_build_object('errore', 'campi non validi'); end;
    if jsonb_typeof(j) <> 'object' then return jsonb_build_object('errore', 'campi non validi'); end if;
    for k in select jsonb_object_keys(j) loop
      if k not in ('nome', 'azienda', 'email', 'cellulare') or j->>k not in ('nascosto', 'facoltativo', 'obbligatorio') then
        return jsonb_build_object('errore', 'campi non validi');
      end if;
    end loop;
    v := j::text;
  else
    return jsonb_build_object('errore', 'impostazione sconosciuta');
  end if;
  insert into efg_settings(key, value, updated_at) values (p_nome, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into efg_log(kind, detail) values ('admin: impostazione', jsonb_build_object('nome', p_nome, 'valore', v));
  return efg_impostazioni();
end $$;
revoke all on function public.efg_campi(), public.efg_admin_set_impostazione(text,text,text) from public;
grant execute on function public.efg_campi(), public.efg_admin_set_impostazione(text,text,text) to anon, authenticated;

-- 3. registrazione: l'email può mancare se in admin non è obbligatoria
drop function if exists public.efg_register(text,text,text,text);
create function public.efg_register(p_email text, p_name text, p_phone text default null, p_azienda text default null)
returns table (pid uuid, name text, email text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); c jsonb := efg_campi();
        n text := trim(coalesce(p_name, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
        senza boolean;
begin
  if c->>'email' = 'nascosto' then e := ''; end if;
  if e like '%@senza-email.invalid' then raise exception 'invalid email'; end if;   -- l'identificativo interno non si sceglie
  senza := e = '';
  if senza and c->>'email' = 'obbligatorio' then raise exception 'invalid email'; end if;
  if not senza and e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if senza then e := replace(gen_random_uuid()::text, '-', '') || '@senza-email.invalid'; end if;
  if c->>'azienda' = 'nascosto' then a := null; end if;
  if a is null and e ~ '@([a-z0-9-]+\.)*efuture\.it$' then a := 'Efuture'; end if;   -- email di Efuture: l'azienda c'è già
  if c->>'cellulare' = 'nascosto' then tel := null; end if;
  if n = '' and c->>'nome' <> 'obbligatorio' then
    n := coalesce(a, case when senza then null else split_part(e, '@', 1) end, 'Giocatore ' || upper(substr(md5(e), 1, 4)));
  end if;
  if char_length(n) not between 2 and 40 then raise exception 'invalid name'; end if;
  if c->>'azienda' = 'obbligatorio' and a is null and p_azienda is not null then raise exception 'invalid company'; end if;
  if a is not null and char_length(a) > 40 then raise exception 'invalid company'; end if;
  if c->>'cellulare' = 'obbligatorio' and tel is null and p_azienda is not null then raise exception 'invalid phone'; end if;
  if tel is not null and char_length(tel) not between 6 and 16 then raise exception 'invalid phone'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  if exists (select 1 from efg_players p where lower(trim(p.name)) = lower(n) and lower(trim(coalesce(p.azienda, ''))) = lower(coalesce(a, ''))) then
    raise exception 'name taken';
  end if;
  insert into efg_log(kind, email, detail) values ('registrazione', e, jsonb_build_object('nome', n, 'azienda', a, 'senza_email', senza));
  return query insert into efg_players(email, name, azienda, cellulare) values (e, n, a, tel)
    returning efg_players.pid, efg_players.name, efg_players.email;
end $$;
revoke all on function public.efg_register(text,text,text,text) from public;
grant execute on function public.efg_register(text,text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
