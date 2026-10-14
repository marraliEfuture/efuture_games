-- ============================================================================
-- EFUTURE GAMES — pulizia delle funzioni admin vecchie (14/10/2026)
-- ============================================================================
-- Da eseguire nel SQL Editor di Supabase. Toglie le funzioni di un vecchio sistema
-- admin (basato su is_admin ed efg_is_admin()) che l'app non usa più, così non
-- restano raggiungibili da internet:
--   efg_admin_me()  (solo la versione SENZA argomenti: quella con p_key resta)
--   efg_admin_users, efg_admin_set_role, efg_admin_delete_user, efg_is_admin
-- Non tocca tabelle né dati. Se una funzione è ancora usata da qualcos'altro
-- (per esempio una regola di accesso di una tabella) NON viene tolta: nel
-- risultato compare "lasciata: usata da altro".
-- Rieseguibile senza problemi.
-- ============================================================================

create temp table if not exists efg_pulizia (funzione text, esito text);
truncate efg_pulizia;

do $$
declare f record; nome text;
begin
  for f in
    select 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (p.proname in ('efg_admin_users', 'efg_admin_set_role', 'efg_admin_delete_user', 'efg_is_admin')
           or (p.proname = 'efg_admin_me' and p.pronargs = 0))
  loop
    nome := f.firma;
    begin
      execute 'drop function ' || nome;
      insert into efg_pulizia values (nome, 'tolta');
    exception when dependent_objects_still_exist then
      insert into efg_pulizia values (nome, 'lasciata: usata da altro');
    end;
  end loop;
end $$;

select coalesce(funzione, '(nessuna)') as funzione, coalesce(esito, 'niente da togliere') as esito
from (select 1) x left join efg_pulizia on true
order by 1;
