-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 5 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 5".

create function public.efg_signup_check(p_email text, p_name text, p_azienda text default null)
returns table (nome_usato boolean, email_usata boolean)
language sql stable security definer set search_path = public as $$
  select
    coalesce(trim(p_name), '') <> '' and exists (select 1 from efg_players p where lower(trim(p.name)) = lower(trim(p_name))
      and lower(trim(coalesce(p.azienda, ''))) = lower(trim(coalesce(p_azienda, '')))),
    coalesce(trim(p_email), '') <> '' and exists (select 1 from efg_players p where p.email = lower(trim(p_email)));
$$;

revoke all on function public.efg_signup_check(text,text,text) from public;

grant execute on function public.efg_signup_check(text,text,text) to anon, authenticated;

-- 4. l'app chiede l'azienda a chi non l'ha (solo se è vuota: non si cambia quella di un altro)
create or replace function public.efg_profilo(p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', p.name, 'azienda', p.azienda,
           'manca_azienda', coalesce(trim(p.azienda), '') = '' and efg_campi()->>'azienda' = 'obbligatorio')
  from efg_players p where p.email = lower(trim(p_email));
$$;

create or replace function public.efg_set_azienda(p_email text, p_azienda text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email)); a text := trim(coalesce(p_azienda, '')); n text;
begin
  if char_length(a) not between 1 and 40 then raise exception 'invalid company'; end if;
  select name into n from efg_players where email = e and coalesce(trim(azienda), '') = '';
  if n is null then raise exception 'not found'; end if;
  if exists (select 1 from efg_players p where p.email <> e and lower(trim(p.name)) = lower(trim(n)) and lower(trim(coalesce(p.azienda, ''))) = lower(a)) then
    raise exception 'name taken';
  end if;
  update efg_players set azienda = a where email = e;
  insert into efg_log(kind, email, detail) values ('azienda aggiunta', e, jsonb_build_object('azienda', a));
  return efg_profilo(e);
end $$;

revoke all on function public.efg_profilo(text), public.efg_set_azienda(text,text) from public;

grant execute on function public.efg_profilo(text), public.efg_set_azienda(text,text) to anon, authenticated;
-- fine parte 5
