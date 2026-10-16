-- EFUTURE GAMES — supabase-contatti.sql, PARTE 3 DI 5: eliminazione e permessi
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 3".

create or replace function public.efg_admin_contatto_elimina(p_key text, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  delete from efg_contatti where id = p_id returning nome into n;
  if n is null then return jsonb_build_object('errore', 'contatto non trovato'); end if;
  insert into efg_log(kind, detail) values ('admin: contatto eliminato', jsonb_build_object('id', p_id, 'nome', n));
  return jsonb_build_object('ok', true, 'nome', n);
end $$;

revoke all on function public.efg_admin_chi(text), public.efg_admin_contatti(text),
  public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text,text), public.efg_admin_contatto_elimina(text,bigint) from public;
grant execute on function public.efg_admin_contatti(text),
  public.efg_admin_contatto_salva(text,bigint,text,text,text,text,text,text,text,text), public.efg_admin_contatto_elimina(text,bigint) to anon, authenticated;

notify pgrst, 'reload schema';
-- fine parte 3
