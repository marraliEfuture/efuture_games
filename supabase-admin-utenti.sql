-- ============================================================
-- EFUTURE GAMES — amministratori personali (al posto della chiave condivisa)
-- Da eseguire nel SQL Editor di Supabase (si può rieseguire senza problemi).
-- Gli admin entrano con email + password (Supabase Auth) e possono
-- recuperare la password via email. Il diritto admin sta sull'utente
-- (efg_players.is_admin): deve restarne sempre almeno uno e un admin
-- non si può eliminare finché ha il diritto.
-- ============================================================

-- 1. diritto di amministratore sull'utente
alter table efg_players add column if not exists is_admin boolean not null default false;

-- 2. regole garantite dal database (valgono anche dal Table Editor)
create or replace function efg_players_admin_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(424242);          -- due modifiche insieme non possono lasciare zero admin
  if tg_op = 'DELETE' then
    if old.is_admin then
      raise exception 'Togli prima il diritto di amministratore a % per poterlo eliminare', old.email;
    end if;
    return old;
  end if;
  if old.is_admin and not new.is_admin
     and not exists (select 1 from efg_players where is_admin and pid <> old.pid) then
    raise exception 'Deve restare almeno un amministratore';
  end if;
  return new;
end $$;

drop trigger if exists efg_players_admin_guard on efg_players;
create trigger efg_players_admin_guard
  before update of is_admin or delete on efg_players
  for each row execute function efg_players_admin_guard();

-- 3. chi chiama è un admin? Account Supabase Auth con email confermata + diritto sull'utente
create or replace function efg_is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from auth.users u
    join efg_players p on p.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null and p.is_admin
  );
$$;

-- 4. le funzioni admin esistenti (reset, backup, ripristino, registro…) chiamano efg_admin_auth:
--    ora accettano l'admin collegato. La vecchia chiave resta valida finché non la disattivi (passo 7).
create or replace function efg_admin_auth(p_key text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare h text; fails int;
begin
  if efg_is_admin() then return null; end if;
  select count(*) into fails from efg_log where kind = 'admin: chiave errata' and at > now() - interval '10 minutes';
  if fails >= 8 then return 'troppi tentativi sbagliati: riprova tra 10 minuti'; end if;
  select key_hash into h from efg_admin where id = 1;
  if h is null then return 'accesso riservato agli amministratori'; end if;
  if crypt(coalesce(p_key, ''), h) <> h then
    insert into efg_log(kind) values ('admin: chiave errata');
    return 'accesso riservato agli amministratori';
  end if;
  return null;
end $$;

-- efg_admin_init cambiava la chiave senza chiedere quella vecchia: non deve essere chiamabile dal sito
revoke execute on function efg_admin_init(text) from public, anon, authenticated;

-- 5. funzioni del pannello utenti
create or replace function efg_admin_me() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'admin', efg_is_admin(),
    'email', (select lower(email) from auth.users where id = auth.uid()),
    'name',  (select p.name from efg_players p join auth.users u on p.email = lower(u.email) where u.id = auth.uid()),
    'admins', (select count(*) from efg_players where is_admin)
  );
$$;

create or replace function efg_admin_users()
returns table(pid text, name text, email text, phone text, created_at timestamptz, is_admin boolean, games bigint, levels bigint, score bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not efg_is_admin() then raise exception 'accesso riservato agli amministratori'; end if;
  return query
    select p.pid::text, p.name::text, p.email::text, p.phone::text, p.created_at::timestamptz, p.is_admin,
           count(s.game) filter (where s.levels > 0), coalesce(sum(s.levels), 0)::bigint, coalesce(sum(s.score), 0)::bigint
    from efg_players p left join efg_scores s on s.email = p.email
    group by p.pid, p.name, p.email, p.phone, p.created_at, p.is_admin
    order by p.is_admin desc, p.created_at desc;
end $$;

create or replace function efg_admin_set_role(p_email text, p_admin boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not efg_is_admin() then return jsonb_build_object('errore', 'accesso riservato agli amministratori'); end if;
  update efg_players set is_admin = p_admin where email = lower(p_email);
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('errore', 'utente non trovato'); end if;
  insert into efg_log(kind, email, detail)
    values (case when p_admin then 'admin: diritto dato' else 'admin: diritto tolto' end, lower(p_email), jsonb_build_object('da', auth.jwt()->>'email'));
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('errore', sqlerrm);
end $$;

create or replace function efg_admin_delete_user(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not efg_is_admin() then return jsonb_build_object('errore', 'accesso riservato agli amministratori'); end if;
  if exists (select 1 from efg_players where email = lower(p_email) and is_admin) then
    return jsonb_build_object('errore', 'Togli prima il diritto di amministratore per poterlo eliminare');
  end if;
  delete from efg_scores where email = lower(p_email);
  delete from efg_players where email = lower(p_email);
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('errore', 'utente non trovato'); end if;
  insert into efg_log(kind, email, detail) values ('admin: utente eliminato', lower(p_email), jsonb_build_object('da', auth.jwt()->>'email'));
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('errore', sqlerrm);
end $$;

grant execute on function efg_is_admin(), efg_admin_me(), efg_admin_users(),
  efg_admin_set_role(text, boolean), efg_admin_delete_user(text) to anon, authenticated;

-- 5b. reset e ripristino rispettano gli amministratori
--     (prima cancellavano tutti i giocatori: ora gli admin restano, così non si resta mai senza)
create or replace function efg_admin_reset(p_key text, p_what text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text; bid bigint; np int; ns int;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  if p_what not in ('punti', 'tutto') then return jsonb_build_object('errore', 'scelta non valida'); end if;
  insert into efg_backups(note, data) values ('automatico prima del reset (' || p_what || ')', efg_snapshot()) returning id into bid;
  select count(*) into ns from efg_scores;
  delete from efg_scores where true;
  if p_what = 'tutto' then
    select count(*) into np from efg_players where not is_admin;
    delete from efg_players where not is_admin;          -- gli amministratori non si cancellano
  else np := 0; end if;
  insert into efg_log(kind, email, detail) values ('admin: reset ' || p_what, auth.jwt()->>'email',
    jsonb_build_object('backup', bid, 'punteggi_cancellati', ns, 'giocatori_cancellati', np));
  return jsonb_build_object('backup', bid, 'punteggi', ns, 'giocatori', np);
end $$;

create or replace function efg_admin_restore(p_key text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text; d jsonb; bid bigint;
begin
  err := efg_admin_auth(p_key); if err is not null then return jsonb_build_object('errore', err); end if;
  select data into d from efg_backups where id = p_id;
  if d is null then return jsonb_build_object('errore', 'backup non trovato'); end if;
  insert into efg_backups(note, data) values ('automatico prima del ripristino del backup ' || p_id, efg_snapshot()) returning id into bid;
  delete from efg_scores where true;
  delete from efg_players where not is_admin;            -- gli admin attuali restano admin
  insert into efg_players(email, pid, name, phone, created_at, is_admin)
    select x.email, x.pid, x.name, x.phone, x.created_at, coalesce(x.is_admin, false)
    from jsonb_populate_recordset(null::efg_players, d->'giocatori') x
    where not exists (select 1 from efg_players p where p.email = x.email or p.pid = x.pid);
  insert into efg_scores(email, game, score, levels, updated_at)
    select x.email, x.game, x.score, coalesce(x.levels, 0), x.updated_at
    from jsonb_populate_recordset(null::efg_scores, d->'punteggi') x
    where exists (select 1 from efg_players p where p.email = x.email);
  insert into efg_log(kind, email, detail) values ('admin: ripristino', auth.jwt()->>'email', jsonb_build_object('da_backup', p_id, 'backup_prima', bid));
  return jsonb_build_object('ripristinato', p_id, 'backup_prima', bid);
end $$;

-- 6. PRIMO AMMINISTRATORE: metti la tua email (devi esserti già registrato nell'app)
update efg_players set is_admin = true where email = lower('marrali@efuture.it');
select email, name, is_admin from efg_players where is_admin;   -- controllo: deve comparire almeno una riga

-- 7. quando hai verificato che il nuovo pannello funziona, disattiva la vecchia chiave condivisa:
-- delete from efg_admin;
