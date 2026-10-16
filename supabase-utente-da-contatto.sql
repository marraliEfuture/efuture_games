-- ============================================================================
-- EFUTURE GAMES — creare un utente da un contatto (16/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase, dopo supabase-contatti-utente.sql. Rieseguibile, non tocca i dati.
-- Admin › Contatti › Modifica › "👤 Crea utente": crea un giocatore con i dati del contatto
-- (nome, azienda, email, cellulare = telefono) e collega il contatto al nuovo utente.
--   efg_admin_utente_da_contatto(p_key, p_id)
--     - senza email il giocatore riceve l'identificativo interno <codice>@senza-email.invalid
--       (come chi si registra senza email): potrà giocare dopo che l'admin gli aggiunge l'email;
--     - se l'email è già di un utente non crea niente e risponde {errore:'email già registrata', email, nome}
--       (l'admin può collegare il contatto a quell'utente);
--     - nome da 2 a 40 caratteri; nome + azienda non già usati da un altro utente.
-- ============================================================================

create or replace function public.efg_admin_utente_da_contatto(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; c efg_contatti%rowtype; e text; n text; a text; tel text; u uuid; altro text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select * into c from efg_contatti where id = p_id;
  if c.id is null then return jsonb_build_object('errore', 'contatto non trovato'); end if;
  n := trim(coalesce(c.nome, '')); a := nullif(trim(coalesce(c.azienda, '')), '');
  tel := nullif(regexp_replace(coalesce(c.telefono, ''), '[^0-9+]', '', 'g'), '');
  e := nullif(lower(trim(coalesce(c.email, ''))), '');
  if char_length(n) not between 2 and 40 then return jsonb_build_object('errore', 'per creare l''utente il nome deve avere da 2 a 40 caratteri'); end if;
  if a is not null and char_length(a) > 40 then return jsonb_build_object('errore', 'per creare l''utente l''azienda può avere al massimo 40 caratteri'); end if;
  if tel is not null and char_length(tel) not between 6 and 16 then tel := null; end if;   -- telefono strano: l'utente nasce senza cellulare
  if e is not null then
    select name into altro from efg_players where email = e;
    if altro is not null then return jsonb_build_object('errore', 'email già registrata', 'email', e, 'nome', altro); end if;
  end if;
  if exists (select 1 from efg_players p where lower(trim(p.name)) = lower(n) and lower(trim(coalesce(p.azienda, ''))) = lower(coalesce(a, ''))) then
    return jsonb_build_object('errore', 'nome e azienda sono già di un altro utente');
  end if;
  if e is null then e := replace(gen_random_uuid()::text, '-', '') || '@senza-email.invalid'; end if;
  insert into efg_players(email, name, azienda, cellulare) values (e, n, a, tel) returning pid into u;
  update efg_contatti set utente_pid = u where id = p_id;
  insert into efg_log(kind, email, detail) values ('admin: utente da contatto', e, jsonb_build_object('contatto', p_id, 'nome', n, 'azienda', a));
  return jsonb_build_object('ok', true, 'email', e, 'nome', n);
end $$;
revoke all on function public.efg_admin_utente_da_contatto(text,bigint) from public;
grant execute on function public.efg_admin_utente_da_contatto(text,bigint) to anon, authenticated;

notify pgrst, 'reload schema';
