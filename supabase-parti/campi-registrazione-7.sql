-- EFUTURE GAMES — supabase-campi-registrazione.sql, PARTE 7 DI 8
-- Esegui le parti in ordine, una alla volta (ognuna si può rieseguire). Ultima riga di questa parte: "-- fine parte 7".

grant execute on function public.efg_board(text), public.efg_board_group(text, text) to anon, authenticated;

-- 6. admin: elenco utenti, categoria, ripristino
create or replace function public.efg_admin_players(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  return coalesce((select jsonb_agg(x order by x.created_at) from (
    select p.name, p.azienda, p.cellulare, p.categoria, p.email, p.created_at, p.tipo, p.disabilitato, (p.admin_key_hash is not null) as chiave,
      p.recensione_clic, p.recensione_ok,
      (select count(*) from efg_scores s where s.email = p.email and s.levels > 0) as giochi,
      (select coalesce(sum(s.levels),0) from efg_scores s where s.email = p.email) as livelli,
      (select coalesce(sum(s.score),0) from efg_scores s where s.email = p.email) as punti,
      (select jsonb_object_agg(s.game, jsonb_build_object('livelli', s.levels, 'punti', s.score, 'quando', s.updated_at))
         from efg_scores s where s.email = p.email) as dettaglio
    from efg_players p) x), '[]'::jsonb);
end $$;

create or replace function public.efg_admin_set_categoria(p_key text, p_email text, p_categoria text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare err text; e text := lower(trim(p_email)); n text;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_categoria not in ('staff', 'sponsor', 'ospite') then return jsonb_build_object('errore', 'categoria non valida'); end if;
  update efg_players set categoria = p_categoria where email = e returning name into n;
  if n is null then return jsonb_build_object('errore', 'utente non trovato'); end if;
  insert into efg_log(kind, email, detail) values ('admin: categoria', e, jsonb_build_object('nome', n, 'categoria', p_categoria));
  return jsonb_build_object('ok', true, 'nome', n, 'categoria', p_categoria);
end $$;

revoke all on function public.efg_admin_set_categoria(text,text,text) from public;

grant execute on function public.efg_admin_set_categoria(text,text,text) to anon, authenticated;
-- fine parte 7
