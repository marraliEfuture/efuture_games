---
name: efuture-games-coretech-pac
description: Mette Claude in "modalità CoreTech Pac" per Efuture Games. Da quel momento ogni richiesta dell'utente riguarda il gioco CoreTech Pac (cartella games/coretech, stand CoreTech) — labirinti, monetine, floppy, bug Glitch, Loop, Leak e Crash, velocità, joystick, animazione del logo, suoni, grafica, testi, modalità gara — finché non dice altro. Usala quando l'utente scrive /efuture-games-coretech-pac o dice che vuole lavorare, modificare, provare o fare domande su CoreTech Pac, sul gioco di CoreTech o sul Pac-Man dell'app.
---

# Efuture Games – modalità CoreTech Pac

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda il gioco CoreTech Pac** (`games/coretech/`). Se una frase è ambigua ("rendilo più facile", "cambia il colore", "aggiungi un livello"), intendi questo gioco. Se la richiesta tocca chiaramente altro (admin, app, classifica, un altro gioco), fallo notare in una riga e procedi.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi la specifica del gioco, `docs/specifiche/gioco-coretech.md`, le parti comuni `docs/specifiche/giochi-comune.md` e il documento tecnico `docs/tecnico/gioco-coretech.md`. Apri `games/coretech/game.js` e `index.html` solo nelle parti che servono.
2. Fai vedere il gioco com'è adesso con l'anteprima della skill `efuture-games-preview` (sta accanto a questa: `<skill>/../efuture-games-preview`; se non c'è, usa quella del repository, cartella `efuture-games-preview` dentro `.claude/skills`):
   ```
   node <skill>/../efuture-games-preview/scripts/anteprima.mjs <scratchpad>/preview
   ```
   Invia con SendUserFile (display `render`) `05-coretech.png`, la schermata iniziale del gioco sul telefono. Le altre immagini mandale solo se servono.
3. Rispondi in 3-4 righe: sei in modalità CoreTech Pac, versione dell'app (`efuture-games-vN` in `sw.js`), in breve le regole (5 labirinti liberi, in gara i primi 3 da 1 minuto con 3 vite; mangia tutte le monetine, scappa dai bug, col floppy li mangi tu). Chiedi cosa vuole cambiare.

## 2. Com'è fatto CoreTech Pac

- **Cos'è:** labirinto nello stile di Pac-Man. Il giocatore guida la **C del logo CoreTech**, mangia monetine e floppy (la "patch") e scappa da 4 bug: **Glitch** (rosso, insegue), **Loop** (rosa, punta davanti), **Leak** (azzurro, aggira), **Crash** (arancio, timido). Ogni labirinto ha un'uscita laterale che fa rientrare dal lato opposto. Il livello finisce quando non restano monetine né floppy.
- **File:** `games/coretech/index.html` (HUD, schermate, joystick, stile CSS) e `games/coretech/game.js` (tutta la logica). Logo in `img/coretech-logo.png` (titolo e animazione iniziale in cui la C "mangia" le lettere), poi `fonts/` e `icons/`. La scocca "Game Boy" in verticale è `games/gameboy.css` + `games/gameboy.js` con `data-game="joy"` (A = pausa, B = musica). Suoni sintetizzati con Web Audio (`sfx`, `beep()`), nessun file audio.
- **Livelli:** 5 — Rete aziendale, Server farm, Cloud ibrido (quelli della gara, semplificati dalla v29), Data center, Core di sistema. I labirinti sono disegnati a mano in `MAZES` (`#` muro, `.` monetina, `o` floppy, `P` partenza, `G` casetta dei bug, `-` porta, `B` uscita della casetta); velocità, numero di bug, durata della patch e comportamento dei bug sono in `LEVELS` (`pac`, `bug`, `fright`, `frightTime`, `bugs`, `rand`, `release`, `cycle`). Il numero 5 è scritto a mano in alcuni punti (vedi il documento tecnico).
- **Stato e ciclo:** variabile `state` (`title`, `intro`, `levelcard`, `ready`, `play`, `dying`, `clear`, `over`, `win`, `paused`), ciclo `loop(ts)` che chiama `update(dt)` e `render()`.
- **Comandi:** frecce o W A S D, P / Esc pausa, Invio per avanzare nelle schermate. Sul telefono: joystick a 4 direzioni (zona morta, isteresi, diagonale "furba") oppure scorrere il dito sul labirinto; la direzione resta **prenotata** fino al prossimo incrocio, con l'aiuto in curva (`CORNER`). Pulsanti `♪` musica e `II` pausa.
- **Modalità gara** (`?hub=1`): l'app apre il gioco in un iframe con `games/coretech/index.html?hub=1`. Solo i primi 3 livelli, 60 secondi e 3 vite per livello, niente "Continua". L'oggetto `EFG` (`max: 3`, `limit: 60`) tiene i tempi; `efgPost()` manda all'app `{type:'efg', ev:…}`: `start` alla scheda del livello 1 (dopo l'animazione iniziale), `tick` ogni 0,25 s mentre si gioca (il tempo è fermo durante PRONTI! e la vita persa), `result` una volta sola (`efgEnd(ok, reason)`, con `reason` `'time'` o `'lives'`) con tempi e vite per livello. I punti in classifica li calcola l'app (`hub.js`): livello × secondi avanzati × vite rimaste. Il punteggio dell'HUD (record `coretechPacBest`) non va in classifica.
- **Dove cambiare la difficoltà:** `LEVELS` (velocità, bug, patch, casualità, uscita dalla casetta, alternanza dispersione/inseguimento), `bugTarget()` per il carattere dei bug, `CORNER` per l'aiuto in curva, `DEAD` e `HYST` per il joystick. Il resto è nella sezione "Come modificare" di `docs/tecnico/gioco-coretech.md`.

## 3. Regole per le modifiche

- **Solo questo gioco:** cambia `games/coretech/`. Se una modifica richiede `games/gameboy.css` o `games/gameboy.js`, avvisa che cambia la scocca di tutti e 4 i giochi. `EFG.max` e `EFG.limit` vanno cambiati solo insieme al calcolo dei punti nell'app (`hub.js`, `docs/specifiche/app-giocatori.md`).
- **Labirinti:** tutte le righe di un labirinto devono avere la stessa lunghezza, tutte le monetine devono essere raggiungibili e i primi 3 livelli devono restare fattibili in meno di un minuto.
- **File nuovi** (immagini, suoni): aggiungili all'elenco `ASSETS` di `sw.js`, così il gioco funziona anche offline.
- **Documenti:** aggiorna `docs/specifiche/gioco-coretech.md` (cosa vede il giocatore) e `docs/tecnico/gioco-coretech.md` (come è fatto il codice) nello stesso commit. Se cambi una parte comune, aggiorna anche `docs/specifiche/giochi-comune.md`.
- **Prova sempre** prima di salvare: rilancia l'anteprima, guarda `05-coretech.png` e controlla che lo script non stampi errori JavaScript. Per provare un comportamento (un labirinto, il joystick, la modalità gara), scrivi un piccolo script Playwright nello scratchpad che apre `games/coretech/index.html` (anche con `?hub=1`), preme i pulsanti e fa una schermata.
- **Mai mostrare** i codici di sblocco dei giochi (sono in `LEGGIMI.txt` e nel database), la chiave admin o i dati dei giocatori.
- **Salvataggio:** usa la skill `efuture-games-commit`. Quando cambia un file del gioco va aumentata la versione dell'app; pubblicare su main solo se l'utente lo chiede.

## 4. Uscire dalla modalità

Se l'utente dice "basta CoreTech" (o "basta Pac"), chiede di lavorare su un'altra pagina o su un altro gioco, o richiama un'altra skill di Efuture Games, la modalità CoreTech Pac finisce.
