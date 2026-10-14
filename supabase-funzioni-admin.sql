-- ============================================================================
-- EFUTURE GAMES — funzioni admin mancanti (14/10/2026)
-- ============================================================================
-- Da eseguire UNA volta nel SQL Editor di Supabase. Aggiunge solo tre funzioni
-- che sul database mancavano (copiate identiche da supabase-tipi-utenti.sql e
-- supabase-recensioni.sql), senza toccare tabelle, dati o altre funzioni:
--   efg_admin_me(p_key)            chi è collegato al pannello (chiave principale o nome)
--   efg_admin_set_user_key(...)    imposta, cambia o toglie la chiave personale di un admin
--   efg_admin_set_impostazione(...) salva le impostazioni (visualizzazione dei giochi, punti del bonus)
-- Rieseguibile senza problemi.
-- ============================================================================

create or replace function public.efg_admin_me(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  e := current_setting('efg.admin_email', true);
  if coalesce(e, '') = '' then return jsonb_build_object('principale', true); end if;
  return (select jsonb_build_object('principale', false, 'email', email, 'nome', name, 'tipo', tipo) from efg_players where email = e);
end $$;
revoke all on function public.efg_admin_me(text) from public;
grant execute on function public.efg_admin_me(text) to anon, authenticated;

create or replace function public.efg_admin_set_user_key(p_key text, p_email text, p_new text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare err text; e text := lower(trim(p_email)); n text; t text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select name, tipo into n, t from efg_players where email = e;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  if coalesce(p_new, '') = '' then
    update efg_players set admin_key_hash = null where email = e;
    insert into efg_log(kind, email, detail) values ('admin: chiave utente tolta', e, jsonb_build_object('nome', n));
    return jsonb_build_object('ok', true, 'nome', n, 'chiave', false);
  end if;
  if t = 'giocatore' then return jsonb_build_object('errore', 'prima rendi l''utente admin: un giocatore non ha la chiave'); end if;
  if char_length(p_new) < 10 then return jsonb_build_object('errore', 'la chiave deve avere almeno 10 caratteri'); end if;
  update efg_players set admin_key_hash = crypt(p_new, gen_salt('bf')) where email = e;
  insert into efg_log(kind, email, detail) values ('admin: chiave utente impostata', e, jsonb_build_object('nome', n));
  return jsonb_build_object('ok', true, 'nome', n, 'chiave', true);
end $$;
revoke all on function public.efg_admin_set_user_key(text,text,text) from public;
grant execute on function public.efg_admin_set_user_key(text,text,text) to anon, authenticated;

create or replace function public.efg_admin_set_impostazione(p_key text, p_nome text, p_valore text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; v text := trim(coalesce(p_valore, ''));
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_nome = 'vista_default' then
    if v not in ('game', 'light', 'dark') then return jsonb_build_object('errore', 'visualizzazione non valida'); end if;
  elsif p_nome = 'recensione_punti' then
    if v !~ '^[0-9]+$' or v::int > 5000 then return jsonb_build_object('errore', 'i punti devono essere un numero da 0 a 5000'); end if;
    v := (v::int)::text;
  else
    return jsonb_build_object('errore', 'impostazione sconosciuta');
  end if;
  insert into efg_settings(key, value, updated_at) values (p_nome, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into efg_log(kind, detail) values ('admin: impostazione', jsonb_build_object('nome', p_nome, 'valore', v));
  return efg_impostazioni();
end $$;
revoke all on function public.efg_admin_set_impostazione(text,text,text) from public;
grant execute on function public.efg_admin_set_impostazione(text,text,text) to anon, authenticated;
