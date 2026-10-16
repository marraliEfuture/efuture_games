-- EFUTURE GAMES — supabase-contatti.sql, PARTE 2 DI 5: salvataggio di un contatto
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 2".

drop function if exists public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text);
create or replace function public.efg_admin_contatto_salva(p_key text, p_id bigint, p_nome text, p_azienda text, p_telefono text,
  p_email text, p_servizio text, p_descrizione text, p_interesse text, p_tipo text default 'richiesta')
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; n text := trim(coalesce(p_nome, '')); a text := nullif(trim(coalesce(p_azienda, '')), '');
        tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+ ]', '', 'g'), ''); e text := nullif(lower(trim(coalesce(p_email, ''))), '');
        s text := nullif(regexp_replace(trim(coalesce(p_servizio, '')), '\s+', ' ', 'g'), ''); d text := nullif(trim(coalesce(p_descrizione, '')), '');
        g text := coalesce(nullif(trim(p_interesse), ''), 'base'); t text := coalesce(nullif(trim(p_tipo), ''), 'richiesta'); s0 text; nid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if char_length(n) not between 2 and 80 then return jsonb_build_object('errore', 'scrivi nome e cognome (da 2 a 80 caratteri)'); end if;
  if a is not null and char_length(a) > 80 then return jsonb_build_object('errore', 'l''azienda può avere al massimo 80 caratteri'); end if;
  if tel is not null and char_length(regexp_replace(tel, '[^0-9]', '', 'g')) not between 6 and 15 then return jsonb_build_object('errore', 'telefono non valido'); end if;
  if e is not null and e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('errore', 'email non valida'); end if;
  if s is not null and char_length(s) > 60 then return jsonb_build_object('errore', 'il servizio può avere al massimo 60 caratteri'); end if;
  if d is not null and char_length(d) > 4000 then return jsonb_build_object('errore', 'la descrizione può avere al massimo 4000 caratteri'); end if;
  if g not in ('base', 'medio', 'alto') then return jsonb_build_object('errore', 'grado di interesse non valido'); end if;
  if t not in ('feedback', 'richiesta', 'segnalazione') then return jsonb_build_object('errore', 'tipo non valido'); end if;
  -- servizio già usato con altre maiuscole: si riusa la stessa scrittura
  if s is not null then select servizio into s0 from efg_contatti where lower(servizio) = lower(s) order by creato limit 1; s := coalesce(s0, s); end if;
  if p_id is null then
    insert into efg_contatti(nome, azienda, telefono, email, servizio, descrizione, interesse, tipo, inserito_da)
      values (n, a, tel, e, s, d, g, t, efg_admin_chi(p_key)) returning id into nid;
    insert into efg_log(kind, detail) values ('admin: contatto aggiunto', jsonb_build_object('id', nid, 'nome', n, 'tipo', t, 'servizio', s, 'interesse', g));
  else
    update efg_contatti set nome = n, azienda = a, telefono = tel, email = e, servizio = s, descrizione = d, interesse = g, tipo = t, modificato = now()
      where id = p_id returning id into nid;
    if nid is null then return jsonb_build_object('errore', 'contatto non trovato'); end if;
    insert into efg_log(kind, detail) values ('admin: contatto modificato', jsonb_build_object('id', nid, 'nome', n));
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

notify pgrst, 'reload schema';
-- fine parte 2
