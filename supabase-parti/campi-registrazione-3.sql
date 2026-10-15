-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 3 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 3".

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
      if k not in ('nome', 'azienda', 'cellulare') or j->>k not in ('nascosto', 'facoltativo', 'obbligatorio') then
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

revoke all on function public.efg_campi(), public.efg_impostazioni(), public.efg_admin_set_impostazione(text,text,text) from public;

grant execute on function public.efg_campi(), public.efg_impostazioni(), public.efg_admin_set_impostazione(text,text,text) to anon, authenticated;

-- 3. registrazione
drop function if exists public.efg_register(text,text,text);

drop function if exists public.efg_register(text,text,text,text);
-- fine parte 3
