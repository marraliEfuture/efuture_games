-- ============================================================================
-- EFUTURE GAMES — l'admin corregge i dati di un utente (15/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-campi-registrazione.sql.
-- Rieseguibile. Admin › Utenti › Modifica › Dati: nome, azienda, email, cellulare.
--  1. Cambiando l'email i punteggi seguono l'utente (chiave esterna "on update cascade").
--  2. efg_admin_set_dati: controlla nome (2-40), azienda (max 40), email valida e
--     non usata, cellulare, e che nome e azienda insieme non siano già di un altro.
--     Scrive nel log cosa è cambiato.
-- ============================================================================

-- 1. i punteggi seguono il cambio di email
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.efg_scores'::regclass and contype = 'f' and confrelid = 'public.efg_players'::regclass
  loop
    execute format('alter table public.efg_scores drop constraint %I', c);
  end loop;
  alter table public.efg_scores add constraint efg_scores_email_fkey
    foreign key (email) references public.efg_players(email) on update cascade on delete cascade;
end $$;

-- 2. modifica dei dati
create or replace function public.efg_admin_set_dati(p_key text, p_email text, p_name text, p_azienda text, p_new_email text, p_cellulare text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); ne text := lower(trim(coalesce(p_new_email, '')));
        n text := trim(coalesce(p_name, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_cellulare, ''), '[^0-9+]', '', 'g'), ''); old efg_players%rowtype;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select * into old from efg_players where email = e;
  if old.email is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  if ne = '' then ne := e; end if;
  if char_length(n) not between 2 and 40 then return jsonb_build_object('errore', 'il nome deve avere da 2 a 40 caratteri'); end if;
  if a is not null and char_length(a) > 40 then return jsonb_build_object('errore', 'l''azienda può avere al massimo 40 caratteri'); end if;
  if ne !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('errore', 'email non valida'); end if;
  if tel is not null and char_length(tel) not between 6 and 16 then return jsonb_build_object('errore', 'cellulare non valido'); end if;
  if ne <> e and exists (select 1 from efg_players where email = ne) then return jsonb_build_object('errore', 'email già usata da un altro utente'); end if;
  if exists (select 1 from efg_players p where p.email <> e and lower(trim(p.name)) = lower(n) and lower(trim(coalesce(p.azienda, ''))) = lower(coalesce(a, ''))) then
    return jsonb_build_object('errore', 'nome e azienda sono già di un altro utente');
  end if;
  update efg_players set name = n, azienda = a, email = ne, cellulare = tel where email = e;
  insert into efg_log(kind, email, detail) values ('admin: dati utente', ne, jsonb_strip_nulls(jsonb_build_object(
    'nome', case when old.name is distinct from n then old.name || ' → ' || n end,
    'azienda', case when old.azienda is distinct from a then coalesce(old.azienda, '—') || ' → ' || coalesce(a, '—') end,
    'email', case when e <> ne then e || ' → ' || ne end,
    'cellulare', case when old.cellulare is distinct from tel then 'cambiato' end)));
  return jsonb_build_object('ok', true, 'email', ne, 'nome', n, 'azienda', a);
end $$;
revoke all on function public.efg_admin_set_dati(text,text,text,text,text,text) from public;
grant execute on function public.efg_admin_set_dati(text,text,text,text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
