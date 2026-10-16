# Database (Supabase)

## In breve

I dati online stanno in un progetto Supabase, cioè PostgreSQL, nella regione Central EU (Frankfurt). Il modello di accesso è questo:
- tutte le tabelle hanno la **RLS attiva e nessuna policy**, quindi da fuori non si leggono né si scrivono direttamente;
- il sito usa solo **funzioni RPC `security definer`**, chiamate con la chiave pubblica `anon`;
- le funzioni per i giocatori sono aperte a tutti;
- le funzioni admin chiedono la chiave admin, salvata solo come hash bcrypt;
- la classifica restituisce solo `pid`, nome e punti, mai le email.

Lo schema si crea e si aggiorna eseguendo a mano i file `supabase*.sql` nel SQL Editor. Il push su GitHub non li applica.

## Tabelle

### `efg_players`: giocatori

| Colonna | Tipo | Vincoli |
|---|---|---|
| `email` | text | **PK**. Formato `x@y.z` (`~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'`). Salvata in minuscolo e senza spazi dalle funzioni |
| `pid` | uuid | not null, unique, default `gen_random_uuid()`. Id pubblico usato dalla classifica |
| `name` | text | not null, da 2 a 20 caratteri |
| `created_at` | timestamptz | default `now()` |

La colonna `phone` è stata tolta nella v23: `drop column if exists phone`.

Da `supabase-recensioni.sql`: `recensione_clic` (timestamptz, primo clic sul pulsante Bonus Recensione) e `recensione_ok` (timestamptz, recensione confermata dall'admin).

### `efg_settings`: impostazioni (da `supabase-recensioni.sql`)

`key` (text, PK), `value` (text), `updated_at`. RLS senza regole: si legge e scrive solo con le funzioni. Chiavi: `recensione_link` (link alle recensioni Google), `recensione_punti` (punti del bonus, predefinito 200), `vista_default` (`game`, `light` o `dark`, predefinita `game`).

### `efg_scores`: record (il migliore per giocatore e gioco)

| Colonna | Tipo | Vincoli |
|---|---|---|
| `email` | text | FK verso `efg_players(email)` **on delete cascade** |
| `game` | text | `sysadmin`, `coretech`, `timenet` o `inncloud` |
| `score` | integer | da 0 a 100000 |
| `levels` | integer | da 0 a 3, default 0 |
| `updated_at` | timestamptz | default `now()`. Aggiornata a ogni nuovo record |

- PK: (`email`, `game`).
- Indice: `efg_scores_game_score` (`game`, `levels desc`, `score desc`).

### `efg_log`: registro eventi

Colonne: `id` (bigserial PK), `at` (timestamptz, default now), `kind` (text, not null), `email`, `game`, `detail` (jsonb). Indice `efg_log_at` (`at desc`).

Il registro non ha una FK verso i giocatori: quando un giocatore viene eliminato, le sue righe del registro (con l'email) restano.

### `efg_backups`: copie di sicurezza

Colonne: `id` (bigserial PK), `created_at`, `note`, `data` (jsonb, not null). Il formato di `data` è descritto in [Backup e ripristino](#backup-e-ripristino).

### `efg_admin`: chiave admin

Colonne: `id` (int PK, sempre 1, `check (id = 1)`) e `key_hash` (text). L'hash è bcrypt, calcolato con `crypt(chiave, gen_salt('bf'))` di pgcrypto. La chiave in chiaro non si salva mai.

### `efg_gate`: countdown (da `supabase-countdown.sql`)

| Colonna | Tipo | Note |
|---|---|---|
| `id` | int PK | sempre 1 |
| `mode` | text | `apertura`, `chiusura` oppure null (nessun countdown) |
| `ends_at` | timestamptz | quando il conto arriva a zero |
| `minutes` | int | durata impostata |
| `updated_at` | timestamptz | |

La riga 1 viene creata dallo script.

## Funzioni per il sito (anon e authenticated)

| Funzione | Parametri | Restituisce | Effetti e registro |
|---|---|---|---|
| `efg_register` | `p_email`, `p_name`, `p_phone` (facoltativo, **ignorato**: resta solo per le app vecchie) | `(pid, name)` | Controlla email e nome. Errori: `invalid email`, `invalid name`, `already registered`, `name taken` (nickname già usato, senza distinguere maiuscole e minuscole: da `supabase-nickname-unico.sql`). Inserisce il giocatore. Log `registrazione` con `{nome}` |
| `efg_signup_check` | `p_email`, `p_name` | `(nome_usato, email_usata)` booleani | Sola lettura, per l'app mentre il giocatore scrive. Da `supabase-nickname-unico.sql` |
| `efg_login` | `p_email` | `(pid, name)`, oppure nessuna riga se l'email non esiste | Log `accesso` con `{esito: 'ok' \| 'email sconosciuta'}`, anche per email inesistenti |
| `efg_submit` | `p_email`, `p_game`, `p_score`, `p_levels` | boolean: `true` se è un nuovo record | Vedi sotto |
| `efg_board` | `p_game` (`'all'` o id del gioco) | righe `(pid, name, levels, score, games)` | Sola lettura. Vedi sotto |
| `efg_board_group` | `p_game`, `p_group` (`'efuture'`, `'ospiti'` o `'tutti'`, default `'tutti'`) | come `efg_board` | Sola lettura. Da `supabase-classifica-gruppi.sql` |
| `efg_gate_state` | – | jsonb `{mode, ends_at, minutes, now}` | Sola lettura. `now` è l'ora del server. Da `supabase-countdown.sql` |

**`efg_submit`:**
1. Se il giocatore non esiste: errore `not found`.
2. Con `supabase-countdown.sql`, se la gara non è aperta (`efg_gate_open('10 seconds')`): errore `gara chiusa`.
3. Fa un upsert su (`email`, `game`) e aggiorna la riga **solo se** la coppia (`score`, `levels`) nuova è maggiore della vecchia. Contano prima i punti, poi i livelli (v104, `supabase-classifica-punti.sql`; prima il contrario).
4. Scrive sempre il log `partita` con `{punti, livelli, record}`. `record` è vero se la riga è stata scritta.

Il server non verifica che i punti siano coerenti con i livelli: si fida del telefono, a parte i vincoli delle colonne.

**`efg_board` e `efg_board_group`:**
- Per ogni giocatore sommano `levels` e `score` dei suoi record. `games` è il numero di giochi con almeno un livello superato.
- Con `p_game = 'all'` si ottiene il Totale (al massimo 12 livelli); con un id, la classifica di quel gioco.
- **Ordine (v104, `supabase-classifica-punti.sql`):** `score desc`, `levels desc`, `games desc`, poi `max(updated_at) asc`, cioè a parità vince chi ha fatto il record prima. Prima era `levels desc`, `score desc`: rieseguire un file SQL vecchio rimette l'ordine vecchio.
- **Limite:** 50 righe.

**Regola del gruppo "Efuture"** (`efg_board_group`):
- è Efuture chi ha un'email che, dopo `lower(trim())`, soddisfa `@([a-z0-9-]+\.)*efuture\.it$`;
- valgono quindi `@efuture.it` e qualunque sottodominio, per esempio `@reparto.efuture.it`;
- `ospiti` è il contrario; `tutti` (o null) non filtra.

La stessa regola è ripetuta in `backend.js` per la modalità demo.

## Funzioni interne (nessun permesso per anon)

| Funzione | Ruolo |
|---|---|
| `efg_admin_init(p_new)` | Imposta o sostituisce la chiave admin (almeno 10 caratteri). Si usa **solo dallo SQL Editor**: `select efg_admin_init('…');`. Non scrive nel log |
| `efg_admin_auth(p_key)` | Restituisce null se la chiave è giusta, altrimenti un messaggio. Prima controlla il blocco: se nel log ci sono ≥ 8 righe `admin: chiave errata` negli ultimi 10 minuti, risponde "troppi tentativi sbagliati: riprova tra 10 minuti". Senza chiave impostata risponde "chiave admin non ancora impostata". Con una chiave sbagliata scrive il log `admin: chiave errata` e risponde "chiave admin errata". Non lancia eccezioni, così il log del tentativo resta |
| `efg_snapshot()` | Crea il jsonb del backup (vedi sotto) |
| `efg_gate_open(p_grace)` | true se si può giocare. Apertura: `now() >= ends_at`. Chiusura: `now() < ends_at + p_grace`. Nessun countdown: true. Non è concessa ad anon, ma la usa `efg_submit` |

**Bonus Recensione e impostazioni** (da `supabase-recensioni.sql`): `efg_recensione_info(p_email)` → `{link, clic, ok, punti}`; `efg_recensione_click(p_email)` registra il clic (il primo in `recensione_clic`, ogni clic nel log `recensione: clic`); `efg_recensione_bonus()` → `(pid, punti)` di chi ha la recensione confermata (per l'etichetta in classifica); `efg_impostazioni()` → `{vista_default, recensione_punti, recensione_link}`; `efg_bonus_recensione()` → punti del bonus. `efg_board` e `efg_board_group` aggiungono i punti del bonus nella classifica generale (`all`).

## Funzioni admin (anon e authenticated, con chiave)

Tutte iniziano con `efg_admin_auth(p_key)`. Se la chiave non va, restituiscono `{errore: '…'}` senza eccezione. Tutte restituiscono jsonb.

| Funzione | Parametri | Restituisce | Effetti e registro |
|---|---|---|---|
| `efg_admin_login` | `p_key` | `{giocatori, punteggi, eventi, backup, ultimo_backup}` | Log `admin: accesso` |
| `efg_admin_players` | `p_key` | array di `{name, email, created_at, giochi, livelli, punti, dettaglio: {gioco: {livelli, punti, quando}}}`, ordinato per `created_at` | – |
| `efg_admin_logs` | `p_key`, `p_limit` (default 300, tra 1 e 2000), `p_kind` (prefisso del tipo, null = tutti) | array di righe di `efg_log`, dalla più recente | – |
| `efg_admin_backup` | `p_key`, `p_note` | `{id, data}` | Inserisce il backup (nota vuota = "backup manuale"). Log `admin: backup` con `{id, giocatori, punteggi}` |
| `efg_admin_backups` | `p_key` | array di `{id, creato, nota, giocatori, punteggi}`, dal più recente | – |
| `efg_admin_backup_get` | `p_key`, `p_id` | il `data` del backup | – |
| `efg_admin_reset` | `p_key`, `p_what` (`'punti'` o `'tutto'`) | `{backup, punteggi, giocatori}` (i conteggi cancellati) | Prima crea un backup automatico con nota "automatico prima del reset (…)". Cancella tutti gli `efg_scores`, e con `tutto` anche gli `efg_players`. Log `admin: reset punti` o `admin: reset tutto` con `{backup, punteggi_cancellati, giocatori_cancellati}` |
| `efg_admin_restore` | `p_key`, `p_id` | `{ripristinato, backup_prima}` | Errore "backup non trovato" se l'id non esiste. Salva lo stato attuale ("automatico prima del ripristino del backup N"), svuota punteggi e giocatori e li reinserisce dal backup. I `levels` mancanti diventano 0. Log `admin: ripristino` con `{da_backup, backup_prima}` |
| `efg_admin_delete_player` | `p_key`, `p_email` | `{ok, nome, punteggi}` | Errore "giocatore non trovato" se l'email non esiste. Cancella il giocatore e, per cascata, i suoi punteggi. Log `admin: giocatore eliminato` con email e `{nome, punteggi_cancellati}` |
| `efg_admin_set_key` | `p_key`, `p_new` (almeno 10 caratteri) | `{ok: true}` | Nuovo hash bcrypt. Log `admin: chiave cambiata` |
| `efg_admin_gate` | `p_key`, `p_mode` (`'apertura'`, `'chiusura'`, `'stop'` o null), `p_minutes` (1–1440) | lo stato come `efg_gate_state` | Stop azzera `mode` e `ends_at`. Altrimenti imposta `ends_at = now() + minuti`. Log `admin: countdown apertura`, `admin: countdown chiusura` o `admin: countdown fermato`, con `{minuti}`. Da `supabase-countdown.sql` |

## Registro eventi (`efg_log`)

| `kind` | `email` / `game` | `detail` |
|---|---|---|
| `registrazione` | email | `{nome}` |
| `accesso` | email (anche inesistente) | `{esito}` |
| `partita` | email, gioco | `{punti, livelli, record}` |
| `admin: accesso` | – | – |
| `admin: chiave errata` | – | – |
| `admin: chiave cambiata` | – | – |
| `admin: backup` | – | `{id, giocatori, punteggi}` |
| `admin: reset punti` / `admin: reset tutto` | – | `{backup, punteggi_cancellati, giocatori_cancellati}` |
| `admin: ripristino` | – | `{da_backup, backup_prima}` |
| `admin: giocatore eliminato` | email | `{nome, punteggi_cancellati}` |
| `admin: countdown apertura` / `admin: countdown chiusura` | sempre null* | `{minuti}` |
| `admin: countdown fermato` | sempre null* | – |

\* La colonna viene riempita con `auth.jwt()->>'email'`, che per le chiamate anon è null.

Il log `partita` si scrive solo quando l'app chiama `efg_submit`, cioè per un nuovo record locale o per il reinvio dei record al login. Non si scrive per ogni partita giocata.

## Backup e ripristino

Formato di `efg_backups.data`, che è anche il file JSON scaricato dall'admin. Per `efg_admin_backup` il file contiene solo `data`.

```json
{
  "creato": "2026-10-07T10:00:00+00:00",
  "giocatori": [ { "email": "…", "pid": "uuid", "name": "…", "created_at": "…" } ],
  "punteggi":  [ { "email": "…", "game": "sysadmin", "score": 120, "levels": 2, "updated_at": "…" } ]
}
```

- I giocatori sono ordinati per `created_at`, i punteggi per `email` e `game`.
- Il registro e la chiave admin **non** sono nel backup.
- `supabase-privacy-utenti.sql` ha tolto il campo `phone` anche dai backup già salvati.
- Il ripristino sostituisce completamente giocatori e punteggi e conserva i `pid` originali.

## Chiave admin

- Si imposta la prima volta, o si recupera, solo dallo SQL Editor: `select efg_admin_init('CHIAVE-DI-ALMENO-10-CARATTERI');`. Non va mai scritta nei file del repository, che è pubblico.
- Si cambia dall'admin, scheda Chiave (`efg_admin_set_key`).
- Il client la manda in chiaro, su HTTPS, a ogni chiamata admin come `p_key`. Nel browser resta solo in `sessionStorage` della scheda.
- **Blocco:** 8 tentativi sbagliati in 10 minuti, contati in tutto il sistema. Chiunque può quindi bloccare temporaneamente il pannello sbagliando la chiave apposta.

## Chiave anon e sicurezza

- `config.js` contiene `SUPABASE_URL` e la chiave `anon`. È pubblica per definizione e non va copiata nella documentazione.
- Con la chiave anon si possono chiamare solo le funzioni concesse ad `anon`.
- **Limiti accettati per l'evento:**
  - chi conosce l'email di un giocatore può accedere al suo posto e inviare punteggi a suo nome;
  - i punteggi sono calcolati dal telefono e non vengono verificati dal server.

## File SQL

| File | Contenuto | Note |
|---|---|---|
| `supabase.sql` | Estensione pgcrypto. Tabelle `efg_players`, `efg_scores`, `efg_log`, `efg_backups`, `efg_admin` con RLS. Aggiornamenti dei database vecchi: niente `phone`, colonna `levels`, vincolo dei punti. Funzioni `efg_register`, `efg_login`, `efg_submit` (**senza** controllo del countdown), `efg_board`. Tutte le funzioni admin, compresa `efg_admin_delete_player`. Permessi | Base. Rieseguibile. Ridefinisce `efg_submit` senza il controllo della gara chiusa: **dopo va rieseguito `supabase-countdown.sql`** |
| `supabase-classifica-gruppi.sql` | `efg_board_group` e permessi | Rieseguibile. Se manca, la classifica mostra un avviso e tutti i giocatori |
| `supabase-countdown.sql` | Tabella `efg_gate` con la riga 1. Funzioni `efg_gate_state`, `efg_gate_open`, `efg_admin_gate`. Nuova `efg_submit` con il controllo `gara chiusa` (tolleranza 10 s) | Rieseguibile. Se manca, app e classifica funzionano senza countdown e il pulsante Start segnala lo script mancante |
| `supabase-privacy-utenti.sql` | Toglie `phone` da `efg_players` e dai backup salvati (non si può annullare). Nuove `efg_register`, `efg_admin_players`, `efg_admin_restore`, `efg_admin_delete_player` | Per i database creati prima della v23. Il contenuto è già incluso in `supabase.sql` |
| `supabase-tipi-utenti.sql` | Colonne `tipo` (`giocatore`, `admin_giocatore`, `admin`), `disabilitato` e `admin_key_hash` (bcrypt della chiave admin personale) in `efg_players`. Nuove `efg_admin_set_tipo` (tornando giocatore toglie la chiave), `efg_admin_set_disabilitato`, `efg_admin_set_user_key`, `efg_admin_me`; aggiornate `efg_admin_players` (tipo, disabilitato, `chiave` sì/no, mai l'hash), `efg_admin_restore`, `efg_admin_auth` (accetta `email` + a capo + `chiave` per le chiavi personali, oltre alla chiave principale), `efg_admin_set_key` (cambia la chiave di chi è collegato), `efg_login`, `efg_submit`, `efg_board`, `efg_board_group` (escludono i disabilitati) | Dalla v35, anche su un database nuovo, dopo `supabase-countdown.sql`; da rieseguire dalla v37 per le chiavi personali. `supabase.sql` non lo contiene |
| `supabase-nuovo-utente.sql` | Funzione `efg_admin_create_user(p_key, p_email, p_name, p_tipo, p_new)`: un admin collegato crea un utente del tipo scelto (`giocatore`, `admin_giocatore`, `admin`; per gli admin con la chiave personale salvata con bcrypt), oppure cambia il tipo di un utente già registrato. Scrive nel log | Dalla v75, **dopo** `supabase-tipi-utenti.sql`. Rieseguibile |
| `supabase-funzioni-admin.sql` | Solo `efg_admin_auth` (chiave principale o email + chiave personale), `efg_admin_me(p_key)`, `efg_admin_set_user_key` ed `efg_admin_set_impostazione`, copiate identiche da `supabase-tipi-utenti.sql` e `supabase-recensioni.sql`: per un database dove mancavano o erano diverse (14/10/2026: `efg_admin_auth` era una versione con `efg_is_admin()` che accettava solo la chiave principale) | Rieseguibile; non tocca tabelle né dati |
| `supabase-pulizia-funzioni.sql` | Toglie le funzioni di un vecchio sistema admin non usate dall'app: `efg_admin_me()` senza argomenti, `efg_admin_users`, `efg_admin_set_role`, `efg_admin_delete_user`, `efg_is_admin`. Una funzione ancora usata da altro (per esempio una regola di accesso) resta e lo dice nel risultato | Rieseguibile; non tocca tabelle né dati |
| `supabase-campi-registrazione.sql` | Colonne `azienda`, `cellulare`, `categoria` (`staff`/`sponsor`/`ospite`) in `efg_players`; trigger: email @efuture.it o azienda "efuture" → azienda "Efuture" e categoria Staff. Campi della registrazione in `efg_settings` `campi_registrazione` (`efg_campi()`, dentro `efg_impostazioni`). Nuove `efg_register(p_email,p_name,p_phone,p_azienda)`, `efg_signup_check(...,p_azienda)` (nome + azienda unici), `efg_profilo`, `efg_set_azienda`, `efg_admin_set_categoria`; `efg_board`/`efg_board_group` restituiscono anche `azienda` e `nome` e `name` = "Azienda - Nome"; gruppi per categoria (anche più insieme: `ospite,sponsor`). Anche in 8 parti in `supabase-parti/` | Rieseguibile; le app vecchie continuano a funzionare |
| `supabase-home-layout.sql` | `efg_impostazioni` con `home_layout` (di base `lista`) e `efg_admin_set_impostazione` che accetta `home_layout` (`ora`, `alto`, `lista`, `fisso`); identiche a quelle di `supabase-campi-registrazione.sql` | Rieseguibile, da eseguire dopo `supabase-campi-registrazione.sql` |
| `supabase-modifica-utente.sql` | `efg_scores.email` con `on update cascade`; `efg_admin_set_dati(p_key, p_email, p_name, p_azienda, p_new_email, p_cellulare)` per correggere i dati di un utente dall'admin | Rieseguibile, dopo `supabase-campi-registrazione.sql` |
| `supabase-bonus-recensione.sql` | `efg_bonus_recensione()` che legge i punti scelti in admin (`efg_settings.recensione_punti`, 200 se non impostati): sostituisce la prima versione, che dava sempre 200 | Rieseguibile, non tocca i dati; alla fine mostra i punti attuali |
| `supabase-classifica-punti.sql` | `efg_submit` con record = più punti (a parità più livelli); `efg_board`/`efg_board_group` ordinate per punti, livelli, giochi; comprende anche `supabase-classifica-categoria.sql` | Rieseguibile, non tocca i dati; alla fine mostra i primi 5 della generale |
| `supabase-classifica-categoria.sql` | `efg_profilo` restituisce anche `categoria`; `efg_board` e `efg_board_group` restituiscono anche `categoria` di ogni riga (per il resto uguali) | Rieseguibile, non tocca i dati; dopo `supabase-campi-registrazione.sql`; alla fine conta i giocatori per categoria |
| `supabase-utente-da-contatto.sql` | `efg_admin_utente_da_contatto(p_key, p_id)`: crea un giocatore dai dati del contatto e lo collega | Rieseguibile; dopo `supabase-contatti-utente.sql` |
| `supabase-contatti-utente.sql` | Colonna `efg_contatti.utente_pid`, `efg_admin_contatto_utente(p_key, p_id, p_utente)`, `efg_admin_contatti` con `utente {email, nome, azienda}`, `efg_admin_restore` con il collegamento. Anche in 2 parti: `supabase-parti/contatti-utente-1…2.sql` | Rieseguibile; dopo `supabase-contatti.sql` |
| `supabase-contatti.sql` | Tabella `efg_contatti` (solo funzioni admin) e `efg_admin_contatti`, `efg_admin_contatto_salva`, `efg_admin_contatto_elimina`; `efg_snapshot`, `efg_admin_backups` e `efg_admin_restore` con i contatti. Anche in 5 parti: `supabase-parti/contatti-1…5.sql` | Rieseguibile; dopo `supabase-campi-registrazione.sql` |
| `supabase-email-facoltativa.sql` | `efg_campi()` con l'email (predefinito obbligatorio), `efg_admin_set_impostazione` accetta il campo `email`, `efg_register` restituisce anche `email` e senza email crea l'identificativo interno `<codice>@senza-email.invalid` | Rieseguibile, non tocca i dati; dopo `supabase-campi-registrazione.sql` |
| `supabase-classifica-condivisa.sql` | `efg_classifica_vista()` (pubblica: filtri e passo della comparsa) e `efg_admin_set_classifica(p_key, p_vista, p_reveal)` (solo admin) in `efg_settings` (`classifica_vista`, `classifica_reveal`): filtri della classifica condivisi tra PC | Rieseguibile, non tocca i dati |
| `supabase-reset-sblocchi.sql` | Nuova `efg_admin_reset` (come in `supabase.sql`, in più salva `reset_id` in `efg_settings`; "tutto" cancella solo gli utenti di tipo giocatore, admin e admin_giocatore restano senza punti) e `efg_reset_id()` per l'app: dopo un reset i telefoni ribloccano i giochi. Crea `efg_settings` se manca. Rieseguire `supabase.sql` rimetterebbe il reset senza questo segno: in quel caso eseguire di nuovo anche questo file | Rieseguibile; non tocca i dati. Vale dal reset successivo |
| `supabase-recensioni.sql` | Colonne `recensione_clic`, `recensione_ok` (e `tipo`, `disabilitato`, `admin_key_hash` se mancano). Tabella `efg_settings`. Funzioni del Bonus Recensione e delle impostazioni (vedi sopra), `efg_admin_set_recensione`, `efg_admin_set_recensione_link`, `efg_admin_set_impostazione`; aggiornate `efg_admin_players`, `efg_admin_restore`, `efg_board`, `efg_board_group` | Rieseguibile. **Dopo** `supabase-tipi-utenti.sql`: se riesegui quello, riesegui anche questo |
| `supabase-nickname-unico.sql` | Nuova `efg_register` (rifiuta un nickname già usato: `name taken`), nuova `efg_signup_check`, indice unico `efg_players_name_unique` su `lower(trim(name))` creato solo se non ci sono già doppioni | Dalla v42, anche su un database nuovo, **dopo** `supabase.sql` (che ridefinisce `efg_register` senza il controllo del nickname): rieseguirlo dopo ogni riesecuzione di `supabase.sql` |

**Ordine su un progetto nuovo:**
1. `supabase.sql`;
2. `supabase-classifica-gruppi.sql`;
3. `supabase-countdown.sql`;
4. `supabase-tipi-utenti.sql`;
5. `supabase-nickname-unico.sql`;
6. `supabase-recensioni.sql`;
7. `supabase-nuovo-utente.sql`;
8. `select efg_admin_init('…');`.

---
Ultimo aggiornamento: 07/10/2026 (v27)
