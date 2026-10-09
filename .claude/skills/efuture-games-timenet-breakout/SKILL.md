---
name: efuture-games-timenet-breakout
description: Mette Claude in "modalità Timenet Breakout" per Efuture Games. Da quel momento ogni richiesta dell'utente riguarda il gioco Timenet Breakout (cartella games/timenet, stand Timenet) — delfino, pallone, mattoncini, capsule bonus, livelli dalle 08:00 alle 18:00, logo, trascinamento, suoni, grafica, testi, modalità gara — finché non dice altro. Usala quando l'utente scrive /efuture-games-timenet-breakout o dice che vuole lavorare, modificare, provare o fare domande su Timenet Breakout, sul gioco di Timenet o sul gioco del delfino e dei mattoncini.
---

# Efuture Games – modalità Timenet Breakout

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda il gioco Timenet Breakout** (`games/timenet/`). Se una frase è ambigua ("rendilo più facile", "cambia il colore", "aggiungi un livello"), intendi questo gioco. Se la richiesta tocca chiaramente altro (admin, app, classifica, un altro gioco), fallo notare in una riga e procedi.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi la specifica del gioco, `docs/specifiche/gioco-timenet.md`, le parti comuni `docs/specifiche/giochi-comune.md` e il documento tecnico `docs/tecnico/gioco-timenet.md`. Apri `games/timenet/game.js` e `index.html` solo nelle parti che servono.
2. Fai vedere il gioco com'è adesso con l'anteprima della skill `efuture-games-preview` (sta accanto a questa: `<skill>/../efuture-games-preview`; se non c'è, usa quella del repository, cartella `efuture-games-preview` dentro `.claude/skills`):
   ```
   node <skill>/../efuture-games-preview/scripts/anteprima.mjs <scratchpad>/preview
   ```
   Invia con SendUserFile (display `render`) `06-timenet.png`, la schermata iniziale del gioco sul telefono. Le altre immagini mandale solo se servono.
3. Rispondi in 3-4 righe: sei in modalità Timenet Breakout, versione dell'app (`efuture-games-vN` in `sw.js`), in breve le regole (5 livelli liberi, dalle 08:00 alle 18:00, in gara i primi 3 da 1 minuto con 3 palloni; il delfino fa rimbalzare il pallone e rompe i mattoncini, dietro c'è il logo). Chiedi cosa vuole cambiare.

## 2. Com'è fatto Timenet Breakout

- **Cos'è:** Breakout (rompi-mattoncini). Il delfino di Timenet nuota sul pelo dell'acqua e fa rimbalzare un pallone da spiaggia contro un muro di mattoncini; dietro c'è il logo Timenet. Se tutti i palloni cadono in acqua si perde una vita. Dai mattoncini cadono capsule: `C` 3 palloni, `S` rete, `✓` delfino grande, `T` pallone grande, `+` un pallone in più.
- **File:** `games/timenet/index.html` (HUD, schermate, fascia di trascinamento, stile CSS) e `games/timenet/game.js` (tutta la logica). Immagini in `img/` (`timenet-logo.png`, `delfino.png` che guarda a sinistra e viene specchiato), poi `fonts/` e `icons/`. La scocca "Game Boy" in verticale è `games/gameboy.css` + `games/gameboy.js` con `data-game="strip"` (A = pausa, B = musica). Suoni sintetizzati con Web Audio, nessun file audio.
- **Livelli:** 5, ognuno un'ora della giornata — 08:00 Apertura, 10:30 Riunione, 13:00 Pausa pranzo (quelli della gara), 16:00 Scadenza, 18:00 Chiusura. Sono in `LEVELS` (`clock`, `name`, `text`, `speed`, `dw` larghezza del delfino, `bh`, `r` raggio del pallone, `map` del muro, `revealAtEnd`); i tipi di mattoncino sono in `BRICK` (azzurro e blu scuro 1 colpo, blu medio 2 colpi, dorato ★ con capsula sicura), le capsule in `POWERS`. Campo logico 360 × 600.
- **Stato e ciclo:** variabile `state` (`title`, `intro`, `levelcard`, `play`, `paused`, `clear`, `over`, `win`), ciclo `loop(ts)` che chiama `update(dt)` e `render()`. Nel codice la scheda del livello non viene mostrata: `showLevelCard()` preme subito Via! (la specifica funzionale la descrive ancora: se tocchi quella parte, allineala).
- **Comandi:** ← → / A D muovi, spazio lancia, P / Esc pausa, Invio per avanzare nelle schermate. Sul telefono: trascinare sulla fascia sotto il gioco (come un touchpad, × 1,3) o sul campo, tocco per lanciare; col mouse il delfino segue il puntatore. Pulsanti `♪` musica e `II` pausa.
- **Modalità gara** (`?hub=1`): l'app apre il gioco in un iframe con `games/timenet/index.html?hub=1`. Solo i primi 3 livelli, 60 secondi e 3 palloni per livello (la capsula `+` non supera 3), niente "Continua". L'oggetto `EFG` (`max: 3`, `limit: 60`) tiene i tempi; `efgPost()` manda all'app `{type:'efg', ev:…}`: `start` al livello 1 (dopo l'animazione iniziale), `tick` ogni 0,25 s mentre si gioca (anche col pallone fermo sul delfino), `result` una volta sola (`efgEnd(ok, reason)`, con `reason` `'time'` o `'lives'`) con tempi e vite per livello. I punti in classifica li calcola l'app (`hub.js`): livello × secondi avanzati × vite rimaste. Il punteggio dell'HUD (record `timenetBreakBest`) non va in classifica.
- **Dove cambiare la difficoltà:** `speed`, `dw`, `r` in `LEVELS`; accelerazione del pallone in `stepBall()`; frequenza delle capsule in `damage()` e `dropCapsule()`; durata dei poteri in `applyPower()`. Il resto è nella sezione "Come modificare" di `docs/tecnico/gioco-timenet.md`.

## 3. Regole per le modifiche

- **Solo questo gioco:** cambia `games/timenet/`. Se una modifica richiede `games/gameboy.css` o `games/gameboy.js`, avvisa che cambia la scocca di tutti e 4 i giochi. `EFG.max` e `EFG.limit` vanno cambiati solo insieme al calcolo dei punti nell'app (`hub.js`, `docs/specifiche/app-giocatori.md`).
- **Muri:** tutte le righe di `map` devono avere la stessa lunghezza e il muro deve coprire il logo (righe × `bh` circa 150).
- **File nuovi** (immagini, suoni): aggiungili all'elenco `ASSETS` di `sw.js`, così il gioco funziona anche offline.
- **Documenti:** aggiorna `docs/specifiche/gioco-timenet.md` (cosa vede il giocatore) e `docs/tecnico/gioco-timenet.md` (come è fatto il codice) nello stesso commit. Se cambi una parte comune, aggiorna anche `docs/specifiche/giochi-comune.md`.
- **Prova sempre** prima di salvare: rilancia l'anteprima, guarda `06-timenet.png` e controlla che lo script non stampi errori JavaScript. Per provare un comportamento (un livello, una capsula, la modalità gara), scrivi un piccolo script Playwright nello scratchpad che apre `games/timenet/index.html` (anche con `?hub=1`), preme i pulsanti e fa una schermata.
- **Mai mostrare** i codici di sblocco dei giochi (sono in `LEGGIMI.txt` e nel database), la chiave admin o i dati dei giocatori.
- **Salvataggio:** usa la skill `efuture-games-commit`. Quando cambia un file del gioco va aumentata la versione dell'app; pubblicare su main solo se l'utente lo chiede.

## 4. Uscire dalla modalità

Se l'utente dice "basta Timenet" (o "basta Breakout"), chiede di lavorare su un'altra pagina o su un altro gioco, o richiama un'altra skill di Efuture Games, la modalità Timenet Breakout finisce.
