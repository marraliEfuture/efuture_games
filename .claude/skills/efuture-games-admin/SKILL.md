---
name: efuture-games-admin
description: Mette Claude in "modalità admin" per Efuture Games. Da quel momento ogni richiesta dell'utente riguarda il pannello di amministrazione (admin.html) — utenti, log, backup, chiave, reset, QR, link, video, tutorial, skill, menu laterale — finché non dice altro. Usala quando l'utente scrive /efuture-games-admin o dice che vuole lavorare, modificare o fare domande sulla pagina admin di Efuture Games.
---

# Efuture Games – modalità admin

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda il pannello admin** (`admin.html`). Se una frase è ambigua ("aggiungi un pulsante", "cambia il colore", "togli la colonna"), intendi l'admin. Se la richiesta tocca chiaramente un'altra pagina (app, classifica, un gioco), fallo notare in una riga e procedi.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi la specifica: `docs/specifiche/admin.md`. Per il database leggi anche `docs/specifiche/database.md`. Apri `admin.html` solo nelle parti che servono.
2. Fai vedere il pannello com'è adesso, con dati di prova:
   ```
   node <skill>/scripts/anteprima_admin.mjs <scratchpad>/admin
   ```
   Invia con SendUserFile (display `render`) `01-players.png` e `00-telefono.png` (ci sono anche `00-menu.png` e `00-modifica.png`). Le altre schermate (una per sezione) mandale solo se servono.
3. Rispondi in 3-4 righe: sei in modalità admin, versione dell'app (`sw.js`), sezioni del menu. Chiedi cosa vuole cambiare.

## 2. Com'è fatto l'admin

- **Una sola pagina:** `admin.html` contiene HTML, CSS e lo script. Usa `config.js`, `vendor/supabase.js` e `vendor/qrcode.js`.
- **Accesso:** con email + chiave admin personale (utenti di tipo admin) oppure con la sola chiave principale. Le chiavi sono salvate solo cifrate (bcrypt) nel database. Ogni funzione del server riceve `p_key` (`email` + a capo + `chiave`, oppure la chiave principale) e la controlla con `efg_admin_auth`; `efg_admin_me` dice chi è collegato (variabile `ME`).
- **Menu a comparsa** (`nav.side#side`), aperto dal pulsante **Menu** (`#menuBtn`, hamburger) nell'intestazione e chiuso da ✕, dallo sfondo, da Esc o scegliendo una voce: pulsanti `.tab` con `data-tab="…"`. Ogni sezione è un `<section data-pane="…">` e il suo nome compare in `#paneTitle`. I gruppi sono titoli `.grp`; Logout è `#btnOut`. Per una sezione nuova servono il pulsante nel menu, la `section`, ed eventualmente il caricamento nel gestore delle schede (`if (t.dataset.tab === '…') …`).
- **Utenti:** tipo come simbolo (🎮 giocatore, 🛡️🎮 admin e giocatore, 🛡️ solo admin), etichetta "disabilitato". Il pulsante **Modifica** apre il popup `#pEdit` (Tipo, Disabilita/Riabilita, Elimina). Ogni modifica passa da `ask(titolo, conseguenze, pulsante, pericolosa)`, che apre la conferma `#pAsk`: usala per ogni nuova azione che cambia dati.
- **Chiamate al database:** `call('efg_admin_…', {…})`. La funzione aggiunge da sola `p_key`; se la risposta ha `errore` lancia un'eccezione.
- **Tabelle:** `fillTable(tabella, intestazioni, righe, classi)`. Una cella può essere testo o un elemento (pulsante, menu a tendina).
- **CSV:** `toCsv` e `download`. Separatore `;` con BOM, così si aprono bene in Excel.

## 3. Regole per le modifiche

- **Database:** se una modifica richiede dati o funzioni nuove su Supabase, crea un file `supabase-<nome>.sql` rieseguibile, con un'intestazione che spiega cosa fa. Fai funzionare la pagina anche prima che il file sia eseguito: niente errori bloccanti, un messaggio chiaro. Alla fine ricorda all'utente di eseguirlo nel SQL Editor di Supabase. Elencalo in `docs/specifiche/database.md` e in `docs/specifiche/README.md`.
- **Mai mostrare** la chiave admin, i codici di sblocco o i dati veri dei giocatori.
- **Specifica:** aggiorna `docs/specifiche/admin.md` nello stesso commit. Se cambia qualcosa che vede l'organizzatore, aggiorna anche la sezione admin di `LEGGIMI.txt`.
- **Nuova skill:** se nasce una skill nuova, aggiungila all'array `SKILLS` di `admin.html` (sezione Skills).
- **Prova sempre** prima di salvare: rilancia `anteprima_admin.mjs`, guarda le schermate della sezione toccata e controlla che non ci siano errori JavaScript. Per provare un comportamento (per esempio un menu a tendina che chiama il server), puoi aggiungere risposte al database finto dello script.
- **Salvataggio:** usa la skill `efuture-games-commit`. Quando cambia `admin.html` va aumentata la versione dell'app; pubblicare su main solo se l'utente lo chiede.

## 4. Uscire dalla modalità

Se l'utente dice "basta admin", chiede di lavorare su un'altra pagina o richiama un'altra skill di Efuture Games, la modalità admin finisce.
