# Efuture Games – documento tecnico della piattaforma

Questo documento spiega **come è costruita** la piattaforma. Il comportamento funzionale (cosa vede e fa l'utente) è nelle specifiche, a cui si rimanda:

- indice e architettura in breve: [../specifiche/README.md](../specifiche/README.md)
- app dei giocatori: [../specifiche/app-giocatori.md](../specifiche/app-giocatori.md)
- classifica da proiettare: [../specifiche/classifica.md](../specifiche/classifica.md)
- pannello admin: [../specifiche/admin.md](../specifiche/admin.md)
- database: [../specifiche/database.md](../specifiche/database.md)
- parti comuni dei giochi: [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md)

Il dettaglio tecnico dell'app dei giocatori è in [app.md](app.md).

## 1. Scopo e architettura

Efuture Games – CARE Conference Edition è una web app statica (PWA) con 4 giochi arcade. I giochi si sbloccano con i QR degli stand; i record dei giocatori finiscono in una classifica comune su Supabase. Non c'è un server applicativo: il browser parla direttamente con il database tramite funzioni RPC.

```
 Telefono / PC (browser o PWA installata)
 ┌─────────────────────────────────────────────────────────────┐
 │ index.html + hub.js  ──┐                                    │
 │   │  iframe            │  backend.js  ─────────────┐        │
 │   ▼  games/<id>/?hub=1 │  (Supabase o demo)        │        │
 │ gioco ──postMessage──► │                           │        │
 │                        │                           │        │
 │ classifica.html ───────┘                           │        │
 │ admin.html ── client Supabase proprio ─────────────┤        │
 │ sw.js (cache dei file del sito)                    │        │
 │ localStorage / sessionStorage                      │        │
 └──────────────┬─────────────────────────────────────┼────────┘
                │ HTTPS GET dei file statici          │ HTTPS RPC (chiave anon)
                ▼                                     ▼
       GitHub Pages (ramo main)             Supabase (PostgreSQL)
       file statici, nessun build           solo funzioni efg_* security definer
                                            tabelle con RLS e nessuna policy
```

| Componente | Ruolo |
|---|---|
| Browser / PWA | Esegue tutto il codice. L'app è installabile (`manifest.webmanifest`) e funziona anche con poca rete grazie a `sw.js` |
| GitHub Pages | Serve i file statici dal ramo `main`. Il file `.nojekyll` disattiva l'elaborazione Jekyll |
| Supabase | Database PostgreSQL. Il sito chiama solo funzioni RPC `efg_*` con la chiave pubblica `anon` |
| iframe dei giochi | Ogni gioco è una pagina autonoma; l'app lo apre in un iframe con `?hub=1` e ne riceve gli eventi con `postMessage` |
| Modalità demo | Se Supabase non è configurato, `backend.js` usa il `localStorage` del dispositivo |

## 2. Mappa dei file e delle cartelle

| Percorso | Ruolo |
|---|---|
| `index.html` | App dei giocatori: struttura, stile e modali. Vedi [app.md](app.md) |
| `hub.js` | Logica dell'app: giochi, sblocco, gara, punteggio, account, classifica in app, installazione, countdown |
| `backend.js` | Livello di accesso ai dati condiviso da app e classifica: Supabase oppure demo |
| `config.js` | Configurazione: `window.EFG_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_URL }` |
| `sw.js` | Service worker: cache dei file del sito e aggiornamenti |
| `manifest.webmanifest` | Manifest della PWA (nome, icone, `display: standalone`, `start_url ./`) |
| `classifica.html` | Classifica da proiettare (PC / ledwall), con script inline. Usa `backend.js` |
| `admin.html` | Pannello admin, con script inline. Usa un proprio client Supabase, non `backend.js` |
| `games/sysadmin/`, `games/coretech/`, `games/timenet/`, `games/inncloud/` | I 4 giochi: `index.html` (+ `game.js` per coretech, timenet, inncloud; sysadmin ha tutto in `index.html`), più `fonts/`, `icons/`, `img/` propri |
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale, comune ai giochi. Lo script aggiunge solo parti decorative e due tastini centrali, e sposta i pulsanti indicati nei tasti A/B; non tocca la logica dei giochi |
| `vendor/` | Librerie di terze parti (vedi sotto) |
| `fonts/` | Font locali `.woff2` dell'app, della classifica e dell'admin |
| `icons/` | Favicon, apple-touch-icon e icone della PWA (192, 512, maskable 512) |
| `img/` | Loghi Efuture e icone dei 4 giochi (`g-<id>.png`) |
| `qr/` | `qr-app.png` / `qr-app.svg` (QR dell'app, usato anche dalla classifica), vecchi QR di sblocco in PNG e `stampa.html` (vecchio foglio di stampa; oggi i QR si generano dall'admin) |
| `video/` | Video `.mp4` e copertine `.jpg` della sezione "Video utili" dell'admin |
| `tutorial/` | Immagini dei tutorial a slide dell'admin (`forza4/`, `sheets/`) |
| `supabase*.sql` | Script del database, da eseguire a mano nel SQL Editor di Supabase |
| `docs/specifiche/` | Specifiche funzionali |
| `docs/tecnico/` | Documentazione tecnica (questo file e [app.md](app.md)) |
| `.claude/skills/` | Skill di Claude Code del progetto (`efuture-games-*`), compreso lo script di versione `efuture-games-commit/scripts/prepara.py` |
| `LEGGIMI.txt`, `README.md` | Istruzioni operative e descrizione breve del repository |
| `.nojekyll` | File vuoto per GitHub Pages |

## 3. Stack e dipendenze

- **Nessun build step.** HTML, CSS e JavaScript "vanilla" (IIFE con `"use strict"`), serviti così come sono. Non ci sono `package.json`, bundler o transpiler.
- **Librerie in `vendor/`**, caricate con `<script>` locali (nessuna CDN):

| File | Uso |
|---|---|
| `supabase.js` (+ chunk `591.supabase.js`) | Client Supabase (`window.supabase.createClient`). Licenza in `LICENSE-supabase-js.txt` |
| `jsQR.js` | Lettura dei QR dalla fotocamera nell'app. Licenza in `LICENSE-jsqr.txt` |
| `qrcode.js` | Generazione dei QR in SVG, solo nell'admin |

- **Font locali** in `fonts/` (e copie nelle cartelle dei giochi): Press Start 2P e IBM Plex Mono per app e giochi; Montserrat e Poppins per classifica e admin.
- **API del browser usate:** Web Crypto (`crypto.subtle.digest` SHA-256), `getUserMedia` (fotocamera), Service Worker e Cache API, `beforeinstallprompt` / `appinstalled`, Fullscreen API, Web Animations API (classifica), Clipboard API (admin), `localStorage` / `sessionStorage`.
- **Database:** Supabase (PostgreSQL) con l'estensione `pgcrypto` (bcrypt per la chiave admin, `gen_random_uuid`).

## 4. Database

La descrizione completa (vincoli, formati, registro eventi, backup) è in [../specifiche/database.md](../specifiche/database.md). Qui c'è la sintesi tecnica.

### 4.1 Tabelle

| Tabella | Colonne principali | Note |
|---|---|---|
| `efg_players` | `email` (PK, minuscola), `pid` (uuid unico, id pubblico), `name` (2–20 caratteri), `created_at`; con `supabase-tipi-utenti.sql` anche `tipo` (`giocatore`, `admin_giocatore`, `admin`) e `disabilitato` (boolean) | Giocatori. Nessuna password |
| `efg_scores` | `email` (FK → `efg_players`, on delete cascade), `game`, `score` (0–100000), `levels` (0–3), `updated_at` | PK (`email`, `game`): un solo record per giocatore e gioco. Indice `efg_scores_game_score` |
| `efg_log` | `id`, `at`, `kind`, `email`, `game`, `detail` (jsonb) | Registro eventi, senza FK verso i giocatori |
| `efg_backups` | `id`, `created_at`, `note`, `data` (jsonb) | Copie di giocatori e punteggi |
| `efg_admin` | `id` (sempre 1), `key_hash` | Hash bcrypt della chiave admin |
| `efg_gate` | `id` (sempre 1), `mode` (`apertura`, `chiusura` o null), `ends_at`, `minutes`, `updated_at` | Countdown. Da `supabase-countdown.sql` |

### 4.2 Funzioni RPC

Tutte le funzioni sono `security definer` con `search_path` fissato. Le funzioni "pubbliche" sono concesse con `grant execute` ad `anon` e `authenticated`.

**Giocatore** (usate dall'app):

| Funzione | Parametri | Cosa fa |
|---|---|---|
| `efg_register` | `p_email`, `p_name`, `p_phone` (ignorato) | Crea il giocatore e restituisce `(pid, name)`. Errori `invalid email`, `invalid name`, `already registered` |
| `efg_login` | `p_email` | Restituisce `(pid, name)` o nessuna riga. Scrive sempre il log `accesso`. Con `supabase-tipi-utenti.sql` rifiuta gli utenti disabilitati (`account disabilitato`) |
| `efg_submit` | `p_email`, `p_game`, `p_score`, `p_levels` | Upsert del record solo se (`levels`, `score`) migliora; restituisce `true` se è un nuovo record. Log `partita`. Con il countdown rifiuta a gara chiusa (`gara chiusa`, tolleranza 10 s); con i tipi utente rifiuta i disabilitati |

**Classifica** (usate da app e classifica):

| Funzione | Parametri | Cosa fa |
|---|---|---|
| `efg_board` | `p_game` (`'all'` o id del gioco) | Restituisce al massimo 50 righe `(pid, name, levels, score, games)`, ordinate per livelli, punti e poi data del record più vecchia. Mai le email |
| `efg_board_group` | `p_game`, `p_group` (`'efuture'`, `'ospiti'`, `'tutti'`) | Come `efg_board`, filtrata per dominio dell'email (Efuture = `@efuture.it` o un suo sottodominio) |

**Countdown** (da `supabase-countdown.sql`):

| Funzione | Parametri | Cosa fa |
|---|---|---|
| `efg_gate_state` | – | jsonb `{mode, ends_at, minutes, now}`; `now` è l'ora del server |
| `efg_gate_open` | `p_grace` (interval) | Interna: dice se si può giocare adesso. Usata da `efg_submit` |
| `efg_admin_gate` | `p_key`, `p_mode` (`apertura`, `chiusura`, `stop`/null), `p_minutes` (1–1440) | Avvia o ferma il countdown e restituisce lo stato. Chiede la chiave admin |

**Admin** (tutte chiedono `p_key` e restituiscono jsonb; con chiave errata restituiscono `{errore: '…'}` senza eccezione):

| Funzione | Parametri | Cosa fa |
|---|---|---|
| `efg_admin_login` | `p_key` | Conteggi per la dashboard (giocatori, punteggi, eventi, backup, ultimo backup). Log `admin: accesso` |
| `efg_admin_players` | `p_key` | Elenco utenti con totali e dettaglio per gioco (con `tipo` e `disabilitato` dopo `supabase-tipi-utenti.sql`) |
| `efg_admin_logs` | `p_key`, `p_limit` (1–2000, default 300), `p_kind` (prefisso) | Righe del registro, dalla più recente |
| `efg_admin_backup` | `p_key`, `p_note` | Crea un backup e lo restituisce |
| `efg_admin_backups` | `p_key` | Elenco dei backup con i conteggi |
| `efg_admin_backup_get` | `p_key`, `p_id` | Contenuto di un backup |
| `efg_admin_reset` | `p_key`, `p_what` (`'punti'` o `'tutto'`) | Backup automatico, poi cancella i punteggi (e con `tutto` anche i giocatori) |
| `efg_admin_restore` | `p_key`, `p_id` | Backup automatico dello stato attuale, poi sostituisce giocatori e punteggi con quelli del backup |
| `efg_admin_delete_player` | `p_key`, `p_email` | Elimina un giocatore e, per cascata, i suoi punteggi |
| `efg_admin_set_key` | `p_key`, `p_new` (≥ 10 caratteri) | Cambia la chiave admin |
| `efg_admin_set_tipo` | `p_key`, `p_email`, `p_tipo` | Cambia il tipo di utente. Log `admin: tipo utente`. Da `supabase-tipi-utenti.sql` |
| `efg_admin_set_disabilitato` | `p_key`, `p_email`, `p_on` | Disabilita o riabilita un utente. Log `admin: utente disabilitato` / `riabilitato`. Da `supabase-tipi-utenti.sql` |

**Interne** (permessi tolti ad `anon` e `authenticated`): `efg_admin_init(p_new)` (imposta la chiave, solo da SQL Editor), `efg_admin_auth(p_key)` (verifica la chiave con blocco dopo 8 errori in 10 minuti), `efg_snapshot()` (jsonb del backup).

### 4.3 Sicurezza

- **RLS attiva su tutte le tabelle e nessuna policy:** con la chiave `anon` le tabelle non si leggono né si scrivono direttamente.
- **Solo funzioni `security definer`:** le funzioni girano con i diritti del proprietario e fanno da unico punto d'accesso. Il sito chiama solo `efg_*`.
- **Nessuna email in uscita** dalle funzioni pubbliche: la classifica restituisce `pid`, nome e punti.
- **Chiave admin:** salvata solo come hash bcrypt (`crypt` + `gen_salt('bf')`). Il client la invia a ogni chiamata admin come `p_key` e la conserva solo in `sessionStorage` della scheda (`efgAdminKey`). La prima chiave si imposta solo dallo SQL Editor con `efg_admin_init`.
- **Chiavi admin personali** (`supabase-tipi-utenti.sql`): ogni utente di tipo `admin_giocatore` o `admin` può avere una chiave propria, salvata solo come hash bcrypt in `efg_players.admin_key_hash` (mai restituita: `efg_admin_players` dice solo `chiave` sì/no). Il pannello invia `email` + a capo + `chiave` in `p_key`; `efg_admin_auth` la riconosce, rifiuta utenti giocatore, disabilitati o senza chiave, e mette l'email in `current_setting('efg.admin_email')` per la durata della chiamata (lo usano `efg_admin_me` e `efg_admin_set_key`). La chiave principale in `efg_admin` resta valida. Nota: i backup (`efg_snapshot`) contengono anche gli hash delle chiavi personali.
- **Blocco dei tentativi:** `efg_admin_auth` conta le righe `admin: chiave errata` degli ultimi 10 minuti (globali, non per utente).
- **Chiave `anon`** in `config.js`: è pubblica per definizione e consente solo le funzioni concesse ad `anon`.

### 4.4 File SQL e ordine di esecuzione

I file non si applicano con il push: si incollano ed eseguono a mano in Supabase › SQL Editor. Sono tutti rieseguibili.

| File | Contenuto |
|---|---|
| `supabase.sql` | Base: `pgcrypto`, tabelle, RLS, aggiornamenti dei database vecchi, funzioni giocatore, classifica e admin, permessi. Contiene un `efg_submit` **senza** controllo del countdown |
| `supabase-classifica-gruppi.sql` | `efg_board_group` (senza esclusione dei disabilitati) |
| `supabase-countdown.sql` | Tabella `efg_gate`, `efg_gate_state`, `efg_gate_open`, `efg_admin_gate`, nuovo `efg_submit` con controllo della gara chiusa |
| `supabase-privacy-utenti.sql` | Solo per database creati prima della v23: toglie il cellulare (anche dai backup) e aggiorna alcune funzioni. Già incluso in `supabase.sql` |
| `supabase-tipi-utenti.sql` | Colonne `tipo` e `disabilitato`, `efg_admin_set_tipo`, `efg_admin_set_disabilitato`, e nuove versioni di `efg_admin_players`, `efg_admin_restore`, `efg_login`, `efg_submit`, `efg_board`, `efg_board_group` |

**Ordine su un database nuovo:**

1. `supabase.sql`
2. `supabase-classifica-gruppi.sql`
3. `supabase-countdown.sql`
4. `supabase-tipi-utenti.sql` (il suo `efg_submit` usa `efg_gate_open`, quindi va dopo il countdown)
5. `select efg_admin_init('…');` dallo SQL Editor (la chiave non va mai scritta nei file del repository)

**Riesecuzioni:** ogni file ridefinisce funzioni già create da altri. Rieseguendo un file "precedente" si perdono le versioni più recenti. In pratica, dopo `supabase.sql` vanno rieseguiti nell'ordine anche `supabase-classifica-gruppi.sql`, `supabase-countdown.sql` e `supabase-tipi-utenti.sql`; dopo `supabase-classifica-gruppi.sql` o `supabase-countdown.sql` va rieseguito `supabase-tipi-utenti.sql`.

## 5. Flussi tecnici principali

### 5.1 Registrazione e accesso

1. `hub.js` controlla nome (2–20 caratteri) ed email (regex) nel form.
2. `Backend.signUp({name, email})` → RPC `efg_register` con email in minuscolo; `Backend.signIn(email)` → `efg_login`.
3. La sessione `{id: pid, email, nickname}` viene salvata in `localStorage` (`efgSessionLive` online, `efgSession3` in demo). Non ci sono token né password: l'identità è l'email.
4. Dopo l'accesso, `hub.js` reinvia con `efg_submit` i record locali (`efgBests4`) fatti prima dell'accesso e ricarica le posizioni in classifica.
5. Gli errori del server sono tradotti in italiano da `EFG_FRIENDLY` (`backend.js`).

### 5.2 Sblocco di un gioco

1. Ogni gioco in `GAMES` (`hub.js`) contiene `hash` = SHA-256 di `"efg:" + codice` normalizzato (maiuscolo, solo lettere e cifre).
2. Il codice arriva dal campo di testo, dalla fotocamera (jsQR su un canvas 480 px a ogni frame) o dal parametro `?sblocca=` dell'URL (QR letto con la fotocamera del telefono).
3. `unlockWith()` calcola l'hash con Web Crypto e lo confronta con gli hash dei giochi. Se coincide, l'id va in `efgUnlocked` (`localStorage`).
4. Lo sblocco è solo locale: il server non lo conosce e non lo verifica.

### 5.3 Partita in iframe e invio del record

1. `play(g)` imposta `#frame.src = games/<id>/index.html?hub=1` e mostra il player a tutto schermo. Il parametro `hub=1` attiva nel gioco la modalità gara.
2. Il gioco invia messaggi `{type:'efg', ev:…}` al `parent` con `postMessage`. L'app accetta solo i messaggi con `type === 'efg'`, durante una partita e con `event.source` uguale all'iframe.
3. `tick` aggiorna l'orologio; `result` porta tempi e vite di ogni livello superato.
4. `showResult()` calcola i punti: per ogni livello superato `n × secondi avanzati × vite rimaste`, poi la somma (dettaglio in [app.md](app.md#calcolo-del-punteggio)).
5. Se il risultato batte il record locale (prima i livelli, poi i punti) e il giocatore ha fatto l'accesso, l'app chiama `Backend.submit` → `efg_submit`. Il server aggiorna la riga solo se la coppia (`levels`, `score`) è maggiore di quella salvata.

### 5.4 Classifica e polling

- **In app:** la modale Classifica chiama `Backend.board(tab)` all'apertura e al cambio scheda. Le posizioni del giocatore nei 4 giochi (righe "In classifica") si ricaricano ogni 30 s, quando la pagina torna visibile e alla chiusura del player.
- **`classifica.html`:** ogni 15 s chiama in parallelo `Backend.board(k, gruppo)` per `all` e per i 4 giochi. Le righe sono riusate per `pid` e animate con la tecnica FLIP (Web Animations). Se `efg_board_group` non esiste, `backend.js` ripiega su `efg_board` e segnala `filtroMancante`.
- In demo la classifica si aggiorna anche sull'evento `storage`, quando l'app scrive nello stesso browser.

### 5.5 Countdown di apertura e chiusura

1. Lo stato sta nella riga unica di `efg_gate`. App e classifica lo leggono con `Backend.gate()` → `efg_gate_state` (app ogni 15 s, classifica ogni 10 s, e al ritorno di visibilità).
2. La differenza tra `now` del server e l'orologio locale è salvata in `gateOffset`, così tutti i dispositivi contano sullo stesso orario.
3. `window.EFG_GATE_PHASE(gate, nowMs)` (in `backend.js`) calcola la fase: `libero`, `prima`, `aperto` (con `closing` durante la chiusura) o `chiuso`. L'interfaccia si ridisegna ogni secondo.
4. In fase `prima` o `chiuso` i giochi sono disabilitati nell'app; se la gara si chiude durante una partita, il player si chiude.
5. Il countdown si avvia o ferma da `classifica.html` (pulsante Countdown) con `efg_admin_gate` e la chiave admin. Il server rifiuta i punteggi a gara chiusa in `efg_submit` (tolleranza 10 s).
6. In demo il countdown è in `localStorage` (`efgDemoGate`) e si propaga tra le schede con l'evento `storage`.

## 6. Versione e cache

- La versione **vN** (oggi v37) compare in tre punti, che devono coincidere:
  - `sw.js`: `const CACHE = 'efuture-games-vN'`;
  - gli `.html` nella radice: `config.js?v=N`, `backend.js?v=N`, `hub.js?v=N`;
  - `hub.js`: il testo `· vN` nella nota in fondo alla home.
- **`sw.js`:**
  - `install`: scarica nella cache tutti i file di `ASSETS` e chiama `skipWaiting()`; se un file manca, l'installazione fallisce;
  - `activate`: cancella le cache con nome diverso e chiama `clients.claim()`;
  - `fetch` (solo GET della stessa origine): pagine, `.html`, `.js` e `.webmanifest` prima dalla rete (`cache: 'no-cache'`) con aggiornamento della copia, e dalla cache solo offline; il resto prima dalla cache. Le chiamate a Supabase (altra origine) non passano dal service worker.
  - `admin.html` e `docs/` non sono in `ASSETS`.
- **`?v=N`** sugli script evita che il browser usi copie vecchie dalla cache HTTP.
- **Script `.claude/skills/efuture-games-commit/scripts/prepara.py`:**
  - `controlla`: verifica che ogni file di `ASSETS` esista, controlla la sintassi dei `.js` con `node --check` (escluso `vendor/`) e che la versione sia la stessa ovunque;
  - `versione`: fa i controlli e porta vN a vN+1 in tutti i punti;
  - trova il repository con la variabile `EFG_REPO`, oppure risalendo dalla cartella dello script fino a `config.js`.
- La versione si aumenta quando cambia un file del sito, non per modifiche solo a `docs/`, `.claude/`, SQL o testi. Vedi [../specifiche/README.md](../specifiche/README.md#versione-dellapp-e-aggiornamenti).

## 7. Pubblicazione

- GitHub Pages pubblica il ramo **`main`**. Non c'è una pipeline di build: ciò che è su `main` è online dopo il deploy automatico di Pages ("pages build and deployment" in GitHub Actions).
- Il lavoro si fa su un ramo separato; si pubblica con una **pull request** verso `main` (o con un merge, se richiesto esplicitamente). La skill `/efuture-games-commit` segue questo flusso e non fa push su `main` senza richiesta.
- I file SQL non vengono applicati dalla pubblicazione: vanno eseguiti a mano su Supabase.
- `PUBLIC_URL` in `config.js` è l'indirizzo pubblico usato per i QR e per i link verso la classifica.

## 8. Modalità demo

- Si attiva quando `config.js` non ha `SUPABASE_URL` e `SUPABASE_ANON_KEY`, oppure quando `vendor/supabase.js` non è caricato (`Backend.remote === false`).
- `backend.js` implementa la stessa interfaccia su `localStorage`: utenti (`efgDemoUsers3`), punteggi (`efgDemoScores4`), sessione (`efgSession3`), countdown (`efgDemoGate`).
- La classifica demo ripete in JavaScript le regole del server: somma per giocatore, filtro Efuture/ospiti, ordine per livelli e punti, 50 righe.
- In demo il countdown si comanda dalla classifica senza chiave admin (`Backend.gateSet`).
- L'admin non ha una modalità demo: senza Supabase mostra solo un avviso.

## 9. Come estendere

### Aggiungere un gioco

1. Creare `games/<id>/index.html` con le sue risorse. Il gioco deve leggere `?hub=1` e inviare a `parent` i messaggi `start`, `tick` e `result` (vedi [app.md](app.md#protocollo-postmessage-gioco--app) e [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md)). Per la scocca in verticale si includono `games/gameboy.css` e `games/gameboy.js`.
2. Aggiungere la voce in `GAMES` di `hub.js` (`id`, `name`, `sponsor`, `icon`, `path`, `hash` del codice) e l'icona in `img/`.
3. Aggiornare gli elenchi dei giochi in `classifica.html` (`GAMES`) e in `admin.html` (`GAMES`, `QR_GAMES`, `DOCS`).
4. Database: il vincolo su `efg_scores.game` ammette solo i 4 id attuali e il Totale conta al massimo 12 livelli; vanno aggiornati con un nuovo script SQL. Vanno rivisti anche i testi fissi "/4 giochi" e "/12 liv".
5. Aggiungere i file del gioco ad `ASSETS` in `sw.js`, aumentare la versione con `prepara.py` e scrivere la specifica del gioco.

### Aggiungere una funzione SQL

1. Scriverla in un nuovo file `supabase-<tema>.sql` rieseguibile (`create or replace`), `security definer` con `set search_path = public`.
2. Per le funzioni admin: iniziare con `err := efg_admin_auth(p_key)` e restituire `jsonb_build_object('errore', err)` se la chiave non va; scrivere l'azione in `efg_log`.
3. `revoke all … from public` e `grant execute … to anon, authenticated` solo per ciò che il sito deve chiamare.
4. Lato client, gestire la funzione mancante (errore `PGRST202` o "does not exist") con un messaggio che indica lo script da eseguire, come fanno `backend.js` e `admin.html`.
5. Aggiornare [../specifiche/database.md](../specifiche/database.md) e l'ordine di esecuzione.

### Aggiungere una sezione all'admin

1. In `admin.html` aggiungere un pulsante `<button class="tab sub" data-tab="<nome>">` nel menu `#side` e una `<section data-pane="<nome>" hidden>`.
2. Nel gestore dei tab, chiamare la funzione di caricamento della sezione (come `loadPlayers`, `renderLinks`).
3. Per i dati usare `call('efg_admin_…', {…})`, che aggiunge `p_key` e trasforma `{errore}` in eccezione; gestire gli errori con `onErr`.
4. Aggiornare [../specifiche/admin.md](../specifiche/admin.md).

## 10. Limiti noti e rischi

- **Identità senza password:** chi conosce l'email di un giocatore può accedere al suo posto e inviare punteggi a suo nome.
- **Punteggi non verificati:** il punteggio è calcolato dal telefono; il server controlla solo i vincoli delle colonne (0–100000 punti, 0–3 livelli).
- **Sblocco solo lato client:** gli hash dei codici sono pubblici in `hub.js` e lo spazio dei codici è piccolo (l'admin stesso ricava i codici provando 10.000 combinazioni). Lo sblocco serve a guidare i giocatori agli stand, non è una protezione.
- **Blocco della chiave admin globale:** chiunque sbagli la chiave 8 volte in 10 minuti blocca temporaneamente il pannello e il countdown per tutti.
- **Ordine degli script SQL:** rieseguire un file "vecchio" sovrascrive le versioni più recenti delle funzioni (per esempio `supabase-classifica-gruppi.sql` toglie l'esclusione dei disabilitati da `efg_board_group`).
- **Classifica limitata a 50 righe:** oltre il 50° posto il giocatore vede solo "Oltre il 50° posto".
- **Service worker:** un file di `ASSETS` mancante impedisce l'installazione della cache; senza aumento di versione i telefoni possono tenere file vecchi.
- **Log senza FK:** eliminando un giocatore le righe di registro con la sua email restano.
- **Chiave admin in chiaro nella richiesta** (su HTTPS) e in `sessionStorage` della scheda finché resta aperta.

---
Ultimo aggiornamento: 09/10/2026 (v37)
