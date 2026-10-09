# App dei giocatori – documento tecnico

Questo documento descrive il codice dell'app dei giocatori (`index.html`, `hub.js`, `backend.js`, `config.js`, `sw.js`, `manifest.webmanifest`) e, in breve, di `classifica.html` e `admin.html`. Il comportamento funzionale è nelle specifiche:

- [../specifiche/app-giocatori.md](../specifiche/app-giocatori.md)
- [../specifiche/classifica.md](../specifiche/classifica.md)
- [../specifiche/admin.md](../specifiche/admin.md)
- [../specifiche/database.md](../specifiche/database.md)

L'architettura generale della piattaforma è in [piattaforma.md](piattaforma.md).

## 1. File e ordine di caricamento

| File | Ruolo |
|---|---|
| `index.html` | Markup, CSS inline (tema chiaro) e modali. In fondo carica gli script e registra il service worker |
| `hub.js` | Tutta la logica dell'app, in una IIFE `"use strict"` |
| `backend.js` | Accesso ai dati: espone `window.EFG_BACKEND`, `window.EFG_FRIENDLY`, `window.EFG_GATE_PHASE` |
| `config.js` | Espone `window.EFG_CONFIG` |
| `sw.js` | Service worker |
| `manifest.webmanifest` | Manifest della PWA |

Ordine degli script in `index.html`:

```
config.js?v=N → vendor/supabase.js → backend.js?v=N → vendor/jsQR.js → hub.js?v=N
```

Al `load` uno script inline chiama `navigator.serviceWorker.register('sw.js')`.

### config.js

```
window.EFG_CONFIG = {
  SUPABASE_URL:      "…",   // URL del progetto Supabase
  SUPABASE_ANON_KEY: "…",   // chiave pubblica anon
  PUBLIC_URL:        "…"    // indirizzo pubblico dell'app (QR e link alla classifica)
}
```

Se `SUPABASE_URL` o `SUPABASE_ANON_KEY` sono vuoti, l'app va in modalità demo.

## 2. Struttura di index.html

### Schermate

| id | Contenuto |
|---|---|
| `lobby` | Home: `header` (titolo, edizione, tagline) e `main` |
| `gateBar` (`gateTxt`, `gateClock`) | Barra del countdown di apertura o chiusura |
| `grid` | Griglia dei 4 giochi, generata da `renderGrid()` |
| `dock` | Pulsanti in basso: `dockOut` (`btnAuth`), `dockIn` (`who`, `btnLogout`), `btnBoard`, `btnInstall`, `btnHelp`, e la nota `modeNote` con modalità e versione |
| `player` | Player a tutto schermo: `playerBar` (`btnBack`, `playerTitle`, `playerClock`, logo) e `iframe#frame` |
| `toast` | Messaggio temporaneo |

### Modali (`div.modal`, chiuse con `hidden`)

| id | Scopo | Elementi principali |
|---|---|---|
| `mHelp` | Istruzioni | `hTitle` |
| `mUnlock` | Sblocco di un gioco | `uIcon`, `uTitle`, `uQrText`, `btnCam`, `camBox` con `camVideo`, `camMsg`, form `uForm` con `uCode` e `uMsg` |
| `mAuth` | Registrazione e accesso | `aTitle`, tab `tabSignup` / `tabLogin`, form `fSignup` (`sName`, `sEmail`, `sMsg`), form `fLogin` (`lEmail`, `lMsg`) |
| `mBoard` | Classifica in app | `bTitle`, `bTabs`, lista `bList`, `bNote`, link `lnkBoard` a `classifica.html` |
| `mResult` | Risultato della partita | `rsIcon`, `rsTitle`, `rsGame`, `rsScore`, `rsLevels`, `rsTime`, `rsMsg`, `rsAgain`, `rsHome` |
| `mInstall` | Installazione della PWA | `iTitle`, `iAuto` (`btnDoInstall`), `iIos`, `iSamsung` (`btnOpenChrome`), `iAndroid`, `btnInstallLater` |

Comportamento comune: un clic sullo sfondo o su un elemento `[data-close]` chiude la modale (tranne `mResult`, che si chiude solo con i suoi pulsanti); `Esc` chiude `mUnlock`, `mAuth`, `mBoard`, `mInstall`, `mHelp` e spegne la fotocamera.

## 3. hub.js

### Costanti e stato

```
GAMES          // [{id, name, sponsor, icon, path, hash}] dei 4 giochi
LEVELS = 3, LEVEL_SECONDS = 60
unlocked       // Set degli id sbloccati (efgUnlocked)
bests          // record locali {id: {l, s}} (efgBests4)
session        // {id, email, nickname} oppure null
ranks          // posizione in classifica per gioco: n, -1 (non in classifica), -2 (oltre il 50°)
gate, gateOffset, lastPhase   // stato del countdown e scarto con l'ora del server
playing        // gioco in corso nel player
```

### Funzioni

**Utilità**

| Funzione | Cosa fa |
|---|---|
| `$(id)` | `document.getElementById` |
| `store.get(k, d)` / `store.set(k, v)` | Lettura e scrittura JSON in `localStorage`, protette da try/catch |
| `sha256(txt)` | Hash SHA-256 esadecimale con Web Crypto |
| `normCode(c)` | Codice in maiuscolo, solo lettere e cifre |
| `fmt(s)` | Secondi in `m:ss` |
| `toast(msg, ms)` | Mostra il toast (3,2 s di default) |
| `setMsg(el, text, kind)` | Testo e classe (`ok`, `err`) di un messaggio |
| `openModal(id)` | Mostra una modale |
| `better(a, b)` | `true` se il risultato `a` batte `b` (prima livelli, poi punti) |
| `fmtRes(r)` | Testo `L/3 liv · S pt` |

**Home (lobby)**

| Funzione | Cosa fa |
|---|---|
| `renderGrid()` | Disegna le 4 schede dei giochi con stato, posizione in classifica e record; le disabilita se la gara è in attesa o chiusa. Il clic porta all'accesso, al gioco o allo sblocco |
| `loadRanks()` | Per ogni gioco chiama `Backend.board(id)` e cerca il `pid` del giocatore. Ogni 30 s e al ritorno di visibilità, se il player è chiuso |
| `renderDock()` | Mostra i pulsanti in base alla sessione e la nota di modalità con la versione (`· v37`) |

**Sblocco**

| Funzione | Cosa fa |
|---|---|
| `askUnlock(g)` | Prepara e apre `mUnlock` per il gioco |
| `unlockWith(code)` | Confronta `sha256('efg:' + normCode(code))` con gli hash di `GAMES`; se trova il gioco lo aggiunge a `efgUnlocked` |
| `codeFromText(t)` | Se il testo del QR è un URL, ne estrae `?sblocca=`; altrimenti restituisce il testo |
| `unlocked_ok(g)` | Chiude la modale, mostra il toast e avvia il gioco se era quello richiesto |
| `startCam()` | Apre la fotocamera posteriore e legge i QR con `jsQR` a ogni frame (canvas largo 480 px) |
| `stopCam()` | Ferma lo scan e le tracce video |
| `unlockFromUrl()` | All'avvio gestisce `?sblocca=CODICE` e pulisce l'URL |

**Gara**

| Funzione | Cosa fa |
|---|---|
| `play(g)` | Controlla sessione e countdown, poi apre il player con `g.path + '?hub=1'` |
| `closePlayer()` | Chiude il player, svuota l'iframe (`about:blank`), ridisegna la griglia e ricarica le posizioni |
| listener `message` | Riceve gli eventi del gioco (vedi [protocollo](#protocollo-postmessage-gioco--app)) |
| `showResult(g, ok, reason, seconds, level, used, times, lives)` | Calcola il punteggio, aggiorna il record locale, invia il record e mostra `mResult` |

**Account**

| Funzione | Cosa fa |
|---|---|
| `showAuth(view)` | Mostra il form `signup` o `login` |
| `validEmail(e)` | Regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
| `loggedIn(user)` | Salva la sessione, reinvia con `Backend.submit` i record locali con almeno un livello, ricarica le posizioni |
| submit di `fSignup` / `fLogin` | Validano i campi e chiamano `Backend.signUp` / `Backend.signIn` |
| `btnLogout` | `Backend.signOut()` e azzera la sessione |

**Classifica in app**

| Funzione | Cosa fa |
|---|---|
| `renderBoardTabs()` | Tab Totale + 4 giochi |
| `boardMessage(text)` | Riga di messaggio nella lista |
| `loadBoard()` | `Backend.board(boardTab)` e disegno delle righe; evidenzia la riga del giocatore (`pid`) |

**Installazione**

| Funzione | Cosa fa |
|---|---|
| `isStandalone()` | `display-mode: standalone` o `navigator.standalone` |
| `installedRecently()` | `efgInstalled` più recente di 3 giorni |
| `canInstall()` | Non installata, pagina non in iframe, e arrivo da QR, Samsung Internet o installazione non recente |
| `openInstall()` | Sceglie il pannello (`iAuto`, `iIos`, `iSamsung`, `iAndroid`) e apre `mInstall` |
| `updateInstallBtn()` | Mostra o nasconde `btnInstall` |
| `autoInstallDue()` / `autoInstall()` | Apertura automatica solo dal QR di installazione (`?installa=1`) |

Eventi: `beforeinstallprompt` (salvato in `installEvt`, ignorato su Samsung Internet), `appinstalled`. `btnOpenChrome` usa un URL `intent://…;package=com.android.chrome` per riaprire la pagina in Chrome.

**Countdown**

| Funzione | Cosa fa |
|---|---|
| `gatePhase()` | `EFG_GATE_PHASE(gate, Date.now() + gateOffset)` |
| `isBlocked()` | `true` in fase `prima` o `chiuso` |
| `loadGate()` | `Backend.gate()` e calcolo di `gateOffset`; ogni 15 s, al ritorno di visibilità e, in demo, sull'evento `storage` di `efgDemoGate` |
| `renderGate()` | Ogni secondo aggiorna `gateBar`; al cambio di fase ridisegna la griglia, mostra un toast e chiude il player se la gara si chiude |

**Avvio:** `renderGrid()`, `renderDock()`, `loadGate()`, poi `Backend.current()` per recuperare la sessione e `loadRanks()`. Se `PUBLIC_URL` è impostato, `lnkBoard` punta a `PUBLIC_URL + 'classifica.html'`.

## 4. backend.js

### Interfaccia `Backend` (`window.EFG_BACKEND`)

| Membro | Online (Supabase) | Demo (`localStorage`) |
|---|---|---|
| `remote` | `true` | `false` |
| `current()` | Legge `efgSessionLive` | Legge `efgSession3` |
| `signUp({name, email})` | RPC `efg_register`; salva la sessione | Aggiunge a `efgDemoUsers3` con `pid` `local-…`; errore `already registered` |
| `signIn(email)` | RPC `efg_login`; nessuna riga → errore `not found` | Cerca in `efgDemoUsers3` |
| `signOut()` | Azzera `efgSessionLive` | Azzera `efgSession3` |
| `submit(user, game, score, levels)` | RPC `efg_submit`; restituisce `true` se nuovo record | Aggiorna `efgDemoScores4` solo se migliora |
| `board(game, group)` | Con `group` diverso da `tutti`: `efg_board_group`, con ripiego su `efg_board` e flag `filtroMancante` se la funzione non esiste; altrimenti `efg_board` | Somma per giocatore, filtro Efuture/ospiti, ordine livelli e punti, 50 righe |
| `gate()` | RPC `efg_gate_state`; se la funzione non esiste restituisce `{mode:null}` | Legge `efgDemoGate` e aggiunge `now` |
| `gateSet(mode, minutes)` | – | Solo demo: scrive `efgDemoGate` |

La sessione è sempre `{id: pid, email (minuscola), nickname: name}`. Il client Supabase è creato con `auth: { persistSession: false }`. Le email sono normalizzate con `trim().toLowerCase()`.

### Altre funzioni esposte

| Nome | Cosa fa |
|---|---|
| `window.EFG_GATE_PHASE(g, nowMs)` | Restituisce `{phase, left}` con `phase` = `libero`, `prima`, `aperto` (con `closing: true` durante la chiusura, `justOpened` dopo l'apertura) o `chiuso` |
| `window.EFG_FRIENDLY(err)` | Traduce gli errori in messaggi in italiano: `gara chiusa`, `account disabilitato`, errori di rete, `not found`, `already registered` / `duplicate`, `invalid email`, `invalid name` |

## 5. Storage del browser

### localStorage (valori JSON)

| Chiave | Contenuto | Scritta da |
|---|---|---|
| `efgUnlocked` | Array degli id sbloccati | `hub.js` |
| `efgBests4` | Record locali `{id: {l, s}}` | `hub.js` |
| `efgInstalled` | Ora (ms) dell'installazione accettata | `hub.js` |
| `efgInstallLater` | Ora (ms) del "Più tardi" (scritta, non letta) | `hub.js` |
| `efgSessionLive` | Sessione online | `backend.js` |
| `efgSession3` | Sessione demo | `backend.js` |
| `efgDemoUsers3` | Utenti demo `{email: {pid, email, name}}` | `backend.js` |
| `efgDemoScores4` | Punteggi demo `{"email|gioco": {email, game, score, levels}}` | `backend.js` |
| `efgDemoGate` | Countdown demo `{mode, minutes, ends_at}` | `backend.js` |
| `efgBoardView3` | Scelte di visualizzazione della classifica `{board, top, group, qr}` | `classifica.html` |

### sessionStorage

| Chiave | Contenuto | Usata da |
|---|---|---|
| `efgAdminKey` | Chiave admin della scheda corrente | `admin.html`, `classifica.html` (countdown) |

## 6. Protocollo postMessage (gioco → app)

Il gioco invia `window.parent.postMessage({type:'efg', ev, …}, '*')` solo quando è dentro un iframe. L'app accetta il messaggio solo se `data.type === 'efg'`, c'è una partita in corso (`playing`) e `event.source === frame.contentWindow`. L'app non invia messaggi al gioco: l'unico segnale è `?hub=1`.

| `ev` | Campi inviati dai giochi | Uso nell'app |
|---|---|---|
| `start` | – | Azzera l'orologio della barra |
| `tick` | `level`, `max`, `t` (secondi usati nel livello), `used` | Mostra `Liv level/3 · ⏱ m:ss` con `60 − t`; rosso negli ultimi 10 s. Inviato circa ogni 0,25 s |
| `result` | `ok`, `reason` (`'time'` o altro), `level`, `max`, `used`, `times` (secondi per livello superato), `lives` (vite rimaste per livello superato), `seconds` | Calcolo del punteggio e risultato. `max` e `seconds` non sono usati dal calcolo |

Alcuni giochi inviano anche un messaggio più vecchio `{type:'efg-score', game, score, level, won}`, che l'app ignora.

## 7. Calcolo del punteggio

In `showResult()`:

1. Se `times` manca, i livelli superati sono 3 (se `ok`) o `level − 1`, e `used` si divide in parti uguali.
2. Si considerano al massimo 3 livelli: `levels = times.length`.
3. Per ogni livello `i` (da 1): `left = max(0, round(60 − times[i]))`, `v = max(0, lives[i])` (1 se `lives` manca), punti = `i × left × v`.
4. `score` = somma dei punti dei livelli superati. Il massimo teorico per gioco è (1+2+3) × 60 × 3 = 1080.
5. Il risultato `{l: levels, s: score}` è un record se `levels > 0` e `better(res, bests[id])`. Il record si salva in `efgBests4` e, con la sessione attiva, si invia con `Backend.submit`.
6. `rsTime` mostra la somma dei tempi dei livelli superati.

## 8. Service worker e installazione PWA

- **Manifest:** `name` "Efuture Games – CARE Conference Edition", `short_name` "Efuture Games", `lang it`, `id`, `start_url` e `scope` `./`, `display standalone`, `orientation any`, `background_color` e `theme_color` `#eef4fa`, icone 192, 512 e maskable 512.
- **`index.html`** aggiunge i meta `apple-mobile-web-app-*`, `mobile-web-app-capable`, `theme-color` e l'`apple-touch-icon`.
- **`sw.js`:**
  - `CACHE = 'efuture-games-v37'` e la lista `ASSETS` (app, giochi, font, icone, immagini, `classifica.html`, `qr/qr-app.*`, librerie `vendor/` tranne `qrcode.js`);
  - `install` → `cache.addAll(ASSETS)` + `skipWaiting()`;
  - `activate` → cancella le cache vecchie + `clients.claim()`;
  - `fetch` → per navigazioni, `.html`, `.js`, `.webmanifest`: rete con `cache: 'no-cache'`, copia in cache, e in caso di errore la copia salvata (`ignoreSearch`) o `index.html`; per il resto: cache, poi rete. Solo GET della stessa origine.
- **Installazione:** su Android/Chrome si usa `beforeinstallprompt` (`btnDoInstall` → `prompt()`); su iPhone/iPad istruzioni manuali (`iIos`); su Samsung Internet si propone Chrome (`iSamsung`); su Android senza richiesta del browser istruzioni (`iAndroid`). Dettagli in [../specifiche/app-giocatori.md](../specifiche/app-giocatori.md#installazione).

## 9. classifica.html (in breve)

- **Script:** `config.js?v=N`, `vendor/supabase.js`, `backend.js?v=N`, poi uno script inline. Usa `Backend.board`, `Backend.gate`, `Backend.gateSet` (demo) ed `EFG_GATE_PHASE`.
- **Struttura:** barra in alto con stato (`dot`, `status`), `btnFull`, `btnGate`, link `btnAdmin` ad `admin.html`; `gateBar`; controlli a segmenti (`lbBoard`, `lbTop`, `lbWho`, `lbQr`); `main` con `secTotal` (`list-all`), `games` (pannelli `list-<id>` generati), `qrBig` (immagine `qr/qr-app.svg`); `demoNote`; finestra countdown `gateDlg` (`gdMode`, `gdMin`, `gdKeyRow`/`gdKey`, `gdStart`, `gdStop`, `gdClose`, `gdMsg`).
- **Funzioni principali:**

| Funzione | Cosa fa |
|---|---|
| `render(key, rows, top)` | Ordina, taglia a `top` e aggiorna le righe riusandole per `pid`; anima ingressi e spostamenti (FLIP) e evidenzia le righe cambiate |
| `view.apply()` / `choose(key, v)` | Applicano le scelte Classifica / Top / Giocatori / QR e le salvano in `efgBoardView3` |
| `refresh()` | Carica Totale e 4 giochi con il gruppo scelto, ogni 15 s; mostra l'avviso se manca `efg_board_group` |
| `loadGate()` / `renderGate()` | Stato del countdown (ogni 10 s) e barra (ogni secondo) |
| `gateCommand(mode, minutes)` | Online: RPC `efg_admin_gate` con la chiave admin scritta in `gdKey` (ricordata in `sessionStorage`); demo: `Backend.gateSet` |

- **Parametri URL:** `classifica`, `top`, `giocatori`, `qr` (vedi [../specifiche/classifica.md](../specifiche/classifica.md#pulsanti-di-visualizzazione-e-parametri-url)).

## 10. admin.html (in breve)

- **Script:** `config.js?v=N`, `vendor/supabase.js`, `vendor/qrcode.js`, poi uno script inline. Non usa `backend.js`: crea un proprio client Supabase. Senza configurazione mostra `noRemote` e si ferma.
- **Struttura:** form di accesso `fLogin` (`key`, `lMsg`); `dash` con riquadri `stats`, menu laterale `side` (pulsanti `.tab[data-tab]`) e sezioni `section[data-pane]`: `players` (Utenti), `qr`, `links`, `videos`, `tutorials`, `skills`, `faq`, `docs` (Documentazione), `log`, `backup`, `key`, `reset`; finestre `pEdit` (modifica utente) e `pAsk` (conferma).
- **Funzioni principali:**

| Funzione | Cosa fa |
|---|---|
| `call(fn, args)` | Chiama una RPC aggiungendo `p_key`; trasforma `{errore}` in eccezione (con `auth` se riguarda la chiave) |
| `enter()` / `logout()` | Accesso con `efg_admin_login` e uscita (azzera la chiave in `sessionStorage`) |
| `renderStats()` / `refreshStats()` | Riquadri con i conteggi |
| `loadPlayers()`, `openEdit()`, `setTipo()`, `act()` | Tabella utenti e popup Modifica (tipo, disabilita, elimina) |
| `loadLogs()` | Registro con filtro e aggiornamento automatico ogni 15 s |
| `loadBackups()`, `doReset()` | Backup (crea, scarica, ripristina) e reset con parola di conferma |
| `loadHashes()`, `findCode()`, `renderQr()`, `qrSvg()` | Legge gli hash da `hub.js`, ricava i codici e genera i QR in SVG |
| `renderLinks()`, `renderVideos()`, `renderTutorials()`, `renderSkills()`, `renderFaq()`, `renderDocs()` | Sezioni di contenuto statico; `renderDocs()` unisce e scarica i Markdown di `docs/` |
| `download()`, `toCsv()`, `copyText()` | Download di file, CSV con `;` e BOM, copia negli appunti |

## 11. Dipendenze dal database

| Pagina | RPC usate |
|---|---|
| `index.html` (tramite `backend.js`) | `efg_register`, `efg_login`, `efg_submit`, `efg_board`, `efg_gate_state` |
| `classifica.html` (tramite `backend.js` + script) | `efg_board`, `efg_board_group`, `efg_gate_state`, `efg_admin_gate` |
| `admin.html` | `efg_admin_login`, `efg_admin_players`, `efg_admin_set_tipo`, `efg_admin_set_disabilitato`, `efg_admin_delete_player`, `efg_admin_logs`, `efg_admin_backups`, `efg_admin_backup`, `efg_admin_backup_get`, `efg_admin_restore`, `efg_admin_reset`, `efg_admin_set_key` |

Le funzioni sono descritte in [piattaforma.md](piattaforma.md#42-funzioni-rpc) e in [../specifiche/database.md](../specifiche/database.md).

---
Ultimo aggiornamento: 09/10/2026 (v37)
