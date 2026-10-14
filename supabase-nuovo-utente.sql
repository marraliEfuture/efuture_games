-- ============================================================================
-- EFUTURE GAMES — nuovo utente dal pannello admin
-- ============================================================================
-- Da eseguire UNA volta nel SQL Editor di Supabase, DOPO supabase-tipi-utenti.sql.
-- Aggiunge efg_admin_create_user: un admin collegato crea un utente scegliendo
-- il tipo: 'giocatore', 'admin_giocatore' (pannello e giochi) o 'admin' (solo
-- pannello), senza che la persona si registri prima nell'app.
-- Per i tipi admin serve la chiave personale: arriva dal pannello (generata nel
-- browser e mostrata una sola volta) e qui viene salvata SOLO cifrata (bcrypt).
-- Se l'email esiste già, l'utente diventa del tipo scelto (nome e punteggi
-- restano): da admin riceve la nuova chiave, da giocatore la chiave viene tolta.
-- ============================================================================

create or replace function public.efg_admin_create_user(p_key text, p_email text, p_name text, p_tipo text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare err text; e text := lower(trim(p_email)); n text := trim(coalesce(p_name, '')); old text; h text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('errore', 'email non valida'); end if;
  if p_tipo not in ('giocatore', 'admin_giocatore', 'admin') then return jsonb_build_object('errore', 'tipo non valido'); end if;
  if p_tipo <> 'giocatore' and char_length(coalesce(p_new, '')) < 10 then return jsonb_build_object('errore', 'la chiave deve avere almeno 10 caratteri'); end if;
  h := case when p_tipo = 'giocatore' then null else crypt(p_new, gen_salt('bf')) end;   -- un giocatore non entra nel pannello
  select name into old from efg_players where email = e;
  if old is null then
    if char_length(n) < 2 or char_length(n) > 20 then return jsonb_build_object('errore', 'il nome deve avere da 2 a 20 caratteri'); end if;
    if exists (select 1 from efg_players where lower(trim(name)) = lower(n)) then return jsonb_build_object('errore', 'nome già usato da un altro utente'); end if;
    insert into efg_players(email, name, tipo, admin_key_hash) values (e, n, p_tipo, h);
    insert into efg_log(kind, email, detail) values ('admin: nuovo utente', e, jsonb_build_object('nome', n, 'tipo', p_tipo));
    return jsonb_build_object('ok', true, 'nome', n, 'tipo', p_tipo, 'nuovo', true);
  end if;
  update efg_players set tipo = p_tipo, admin_key_hash = h where email = e;   -- blocco, nome e punteggi restano com'erano
  insert into efg_log(kind, email, detail) values ('admin: tipo utente', e, jsonb_build_object('nome', old, 'dopo', p_tipo, 'da', 'nuovo utente'));
  return jsonb_build_object('ok', true, 'nome', old, 'tipo', p_tipo, 'nuovo', false);
end $$;
revoke all on function public.efg_admin_create_user(text,text,text,text,text) from public;
grant execute on function public.efg_admin_create_user(text,text,text,text,text) to anon, authenticated;
