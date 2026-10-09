# Specifiche di Efuture Games – indice

## In breve

Efuture Games – CARE Conference Edition è una web app (PWA installabile) con 4 giochi arcade. Ogni gioco si sblocca con il QR dello stand del suo marchio. I giocatori si registrano senza password, solo con nome ed email, e i punteggi vanno in una classifica comune. Il sito è statico e sta su GitHub Pages. I dati stanno su Supabase. Se Supabase non è configurato, l'app funziona in modalità demo.

Questa cartella contiene le specifiche funzionali e tecniche di ogni parte. **Per studiare un'app si leggono prima questi file; il sorgente solo se serve.**

## Regola di manutenzione

- **Ogni modifica a un'app aggiorna anche la sua specifica, nello stesso commit.**
- Se una modifica tocca più app (per esempio una nuova funzione SQL usata dall'app), si aggiornano tutte le specifiche coinvolte.
- In fondo a ogni file si aggiorna la riga "Ultimo aggiornamento" con la data e la versione (vN).
- Nelle specifiche non si scrivono mai segreti: niente codici di sblocco, chiave admin, chiavi Supabase o dati dei giocatori.

## Elenco delle app

| App | File principali | Specifica |
|---|---|---|
| App giocatori (home, sblocco, account, gara, classifica in app, installazione) | `index.html`, `hub.js`, `backend.js`, `config.js`, `sw.js`, `manifest.webmanifest` | [app-giocatori.md](app-giocatori.md) |
| Gioco SysAdmin Runner (Efuture) | `games/sysadmin/` | [gioco-sysadmin.md](gioco-sysadmin.md) |
| Gioco CoreTech Pac | `games/coretech/` | [gioco-coretech.md](gioco-coretech.md) |
| Gioco Timenet Breakout | `games/timenet/` | [gioco-timenet.md](gioco-timenet.md) |
| Gioco Inncloud Invaders | `games/inncloud/` | [gioco-inncloud.md](gioco-inncloud.md) |
| Parti comuni dei giochi (modalità gara, scocca "Game Boy" in verticale) | `games/gameboy.css`, `games/gameboy.js` | [giochi-comune.md](giochi-comune.md) |
| Classifica da proiettare (PC / ledwall) | `classifica.html` (+ `backend.js`) | [classifica.md](classifica.md) |
| Pannello admin | `admin.html` | [admin.md](admin.md) |
| Database Supabase (tabelle, funzioni, file SQL) | `supabase*.sql` | [database.md](database.md) |

## Architettura in breve

- **Sito statico** su GitHub Pages, pubblicato dal ramo `main`: https://marraliefuture.github.io/efuture_games/ . Non c'è un server applicativo.
- **Pagine:**
  - `index.html`: l'app dei giocatori. La logica è in `hub.js`.
  - `classifica.html`: la classifica da proiettare.
  - `admin.html`: il pannello admin.
  - `qr/stampa.html`: un vecchio foglio di stampa con i 4 QR di sblocco in PNG. Oggi i QR si generano dalla scheda QR dell'admin.
- **`backend.js`:** è l'accesso ai dati, condiviso da app e classifica. Usa Supabase quando `config.js` contiene `SUPABASE_URL` e `SUPABASE_ANON_KEY` e la libreria `vendor/supabase.js` è caricata. Altrimenti usa la **modalità demo**: account, punteggi e countdown restano nel `localStorage` del dispositivo. L'admin funziona solo online.
- **`config.js`:** contiene l'URL del progetto Supabase, la chiave `anon` e `PUBLIC_URL`, cioè l'indirizzo pubblico usato per i QR e per i link alla classifica. La chiave `anon` è pubblica per definizione. I dati sono protetti da RLS e dalle funzioni, come spiegato in [database.md](database.md).
- **Supabase:** il sito non legge mai le tabelle direttamente: chiama solo funzioni RPC `efg_*`. Le funzioni admin chiedono la chiave admin, che nel database è salvata solo come hash bcrypt.
- **Giochi:** ogni gioco è una pagina a sé in `games/<id>/index.html`. L'app lo apre in un iframe con `?hub=1` (modalità gara) e riceve gli eventi con `postMessage`. Aperto da solo, il gioco ha tutti i livelli e nessun limite. In verticale i giochi hanno la scocca "Game Boy" condivisa (`games/gameboy.css`, `games/gameboy.js`), descritta in [giochi-comune.md](giochi-comune.md).
- **Librerie in `vendor/`:**
  - `supabase.js` (+ `591.supabase.js`): client Supabase;
  - `jsQR.js`: lettura dei QR dalla fotocamera;
  - `qrcode.js`: generazione dei QR, solo in admin.
- **Service worker `sw.js`:** tiene in cache i file elencati in `ASSETS`, così l'app funziona anche con poca rete. Il nome della cache è `efuture-games-vN`, dove N è la versione dell'app (oggi v29).
- **Font locali** in `fonts/`, senza CDN:
  - app e giochi: Press Start 2P e IBM Plex Mono;
  - classifica e admin: Montserrat e Poppins.

## Flusso tipico del giocatore

1. Allo stand o al ledwall il giocatore inquadra il **QR dell'app** (`?installa=1`). L'app si apre e propone l'installazione.
2. Tocca un gioco bloccato 🔒 e lo **sblocca**: inquadra il QR dello stand con la fotocamera dentro l'app, oppure scrive il codice. Il QR letto con la fotocamera del telefono apre l'app con `?sblocca=…` e sblocca il gioco da solo.
3. **Si registra** con nome ed email, oppure **accede** con la sola email.
4. **Gioca:** 3 livelli, al massimo 1 minuto ciascuno, 3 vite per livello.
   - Punti di un livello superato = numero del livello × secondi avanzati × vite rimaste.
   - Il livello perso vale 0.
5. Se il risultato è il suo **record** su quel gioco, l'app lo invia alla classifica. In classifica contano prima i livelli superati, poi i punti. Il Totale è la somma dei record dei 4 giochi.
6. La **classifica** si vede nell'app (pulsante Classifica) e su `classifica.html`, proiettata e aggiornata ogni 15 s.
7. Facoltativo: un admin avvia un **countdown** di apertura o di chiusura della gara, che vale per tutti.

## Versione dell'app e aggiornamenti

- La versione **vN** compare in 3 punti e deve essere uguale ovunque:
  - `sw.js`: `const CACHE = 'efuture-games-vN'`;
  - gli `.html` nella radice del sito: `config.js?v=N`, `backend.js?v=N`, `hub.js?v=N`;
  - `hub.js`: il testo `· vN` mostrato in fondo alla home.
- Si aumenta quando cambia un file del sito: html, js, css, immagini, icone, font, manifest, `qr/`, `games/`. Non serve se cambiano solo `.claude/`, `docs/`, `LEGGIMI.txt`, `README.md` o i file SQL.
- Il comando è `python3 .claude/skills/efuture-games-commit/scripts/prepara.py versione`. Lo usa la skill `/efuture-games-commit`. Lo script:
  1. controlla che ogni file in `ASSETS` di `sw.js` esista;
  2. controlla la sintassi di tutti i `.js` con `node --check` (`vendor/` escluso);
  3. controlla che la versione sia la stessa ovunque;
  4. porta vN a vN+1 in tutti i punti e ricontrolla.
- Con `prepara.py controlla` fa solo i controlli.
- Il cambio del nome della cache fa reinstallare il service worker ai telefoni. Vedi [app-giocatori.md](app-giocatori.md#aggiornamenti-versione-e-cache).

## File SQL (Supabase)

I file SQL **non si applicano con il push**: vanno incollati ed eseguiti a mano in Supabase › SQL Editor. Si possono rieseguire tutti.

| File | Cosa fa | Quando eseguirlo |
|---|---|---|
| `supabase.sql` | Crea tabelle, RLS e funzioni base (registrazione, accesso, punteggi, classifica, pannello admin, backup, reset, elimina giocatore) | La prima volta e ogni volta che cambia. **Dopo averlo rieseguito va rieseguito anche `supabase-countdown.sql`** (vedi sotto) |
| `supabase-classifica-gruppi.sql` | `efg_board_group`: filtro Giocatori Ospiti / Efuture della classifica | Una volta, e di nuovo quando il file cambia. Se manca, la classifica lo segnala |
| `supabase-countdown.sql` | Tabella `efg_gate` e countdown di apertura e chiusura. Ridefinisce `efg_submit` per rifiutare i punteggi a gara chiusa | Una volta, e dopo ogni riesecuzione di `supabase.sql` |
| `supabase-privacy-utenti.sql` | Toglie il cellulare dai giocatori e dai backup salvati. Aggiorna la registrazione e aggiunge "Elimina giocatore" | Una volta, sui database creati prima della v23. Su un database nuovo non serve: `supabase.sql` contiene già tutto |
| `supabase-tipi-utenti.sql` | Tipo di utente (Giocatore, Admin e giocatore, Solo admin) nella sezione Utenti dell'admin | Una volta, dalla v35, su qualsiasi database |

La chiave admin si imposta o si recupera solo dallo SQL Editor con `select efg_admin_init('NUOVA-CHIAVE-LUNGA');`. Il dettaglio è in [database.md](database.md).

## Altri documenti

- `LEGGIMI.txt`: istruzioni operative per mettere online e usare l'app.
- `.claude/skills/efuture-games/memoria.md`: decisioni, cronologia e cose in sospeso.
- Skill di Claude Code in `.claude/skills/`, elencate anche nella scheda Skills dell'admin.

---
Ultimo aggiornamento: 07/10/2026 (v27)
