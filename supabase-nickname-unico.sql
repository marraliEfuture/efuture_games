-- ============================================================
-- EFUTURE GAMES — registrazione: nickname ed email devono essere nuovi
-- Da eseguire nel SQL Editor di Supabase. Si può rieseguire.
--  1. efg_register rifiuta un nickname già usato da un altro utente
--     (senza distinguere maiuscole/minuscole e spazi ai lati): errore
--     'name taken'. L'email già registrata dà, come prima, 'already registered'.
--  2. efg_signup_check(p_email, p_name) dice all'app, mentre il giocatore
--     scrive, se nickname ed email sono già usati: {nome_usato, email_usata}.
--     Non restituisce altri dati.
--  3. Indice unico sul nickname (efg_players_name_unique), creato solo se
--     nel database non ci sono già due utenti con lo stesso nickname:
--     altrimenti resta il controllo della funzione e compare un avviso.
-- Senza questo file l'app funziona lo stesso: blocca le email già usate,
-- ma non i nickname.
-- ============================================================

-- 1. registrazione
drop function if exists public.efg_register(text,text,text);
create function public.efg_register(p_email text, p_name text, p_phone text default null)
returns table (pid uuid, name text)
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if char_length(trim(p_name)) not between 2 and 20 then raise exception 'invalid name'; end if;
  if exists (select 1 from efg_players where efg_players.email = e) then raise exception 'already registered'; end if;
  if exists (select 1 from efg_players where lower(trim(efg_players.name)) = lower(trim(p_name))) then raise exception 'name taken'; end if;
  insert into efg_log(kind, email, detail) values ('registrazione', e, jsonb_build_object('nome', trim(p_name)));
  return query insert into efg_players(email, name) values (e, trim(p_name))
    returning efg_players.pid, efg_players.name;
end $$;
revoke all on function public.efg_register(text,text,text) from public;
grant execute on function public.efg_register(text,text,text) to anon, authenticated;

-- 2. controllo mentre si scrive
create or replace function public.efg_signup_check(p_email text, p_name text)
returns table (nome_usato boolean, email_usata boolean)
language sql stable security definer set search_path = public as $$
  select
    coalesce(trim(p_name), '') <> '' and exists (select 1 from efg_players p where lower(trim(p.name)) = lower(trim(p_name))),
    coalesce(trim(p_email), '') <> '' and exists (select 1 from efg_players p where p.email = lower(trim(p_email)));
$$;
revoke all on function public.efg_signup_check(text,text) from public;
grant execute on function public.efg_signup_check(text,text) to anon, authenticated;

-- 3. indice unico, solo se non ci sono già doppioni
do $$
begin
  if exists (select 1 from efg_players group by lower(trim(name)) having count(*) > 1) then
    raise notice 'Ci sono già utenti con lo stesso nickname: indice unico non creato (la registrazione controlla comunque i nuovi).';
  else
    create unique index if not exists efg_players_name_unique on public.efg_players (lower(trim(name)));
  end if;
end $$;
