-- EFUTURE GAMES — supabase-contatti.sql, PARTE 4 DI 5: backup con i contatti
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 4".

-- backup: anche i contatti
create or replace function public.efg_snapshot()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'creato', now(),
    'giocatori', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from efg_players p), '[]'::jsonb),
    'punteggi',  coalesce((select jsonb_agg(to_jsonb(s) order by s.email, s.game) from efg_scores s), '[]'::jsonb),
    'contatti',  coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from efg_contatti c), '[]'::jsonb));
$$;
revoke all on function public.efg_snapshot() from public, anon, authenticated;

create or replace function public.efg_admin_backups(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'creato', created_at, 'nota', note,
      'giocatori', jsonb_array_length(data->'giocatori'), 'punteggi', jsonb_array_length(data->'punteggi'),
      'contatti', case when data ? 'contatti' then jsonb_array_length(data->'contatti') end) order by id desc)
    from efg_backups), '[]'::jsonb);
end $$;
revoke all on function public.efg_admin_backups(text) from public;
grant execute on function public.efg_admin_backups(text) to anon, authenticated;

notify pgrst, 'reload schema';
-- fine parte 4
