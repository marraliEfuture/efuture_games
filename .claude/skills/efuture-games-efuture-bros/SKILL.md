---
name: efuture-games-efuture-bros
description: Mette Claude in "modalità Efuture Bros" per Efuture Games. Da quel momento ogni richiesta dell'utente riguarda il gioco Efuture Bros (cartella games/sysadmin, ex "SysAdmin Runner", stand Efuture) — livelli, clienti, bug, hacker finale, salto, mouse, antivirus, joystick, grafica, testi, modalità gara — finché non dice altro. Usala quando l'utente scrive /efuture-games-efuture-bros o dice che vuole lavorare, modificare, provare o fare domande su Efuture Bros, sul gioco di Efuture o sul platform del sysadmin.
---

# Efuture Games – modalità Efuture Bros

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda il gioco Efuture Bros** (`games/sysadmin/`). Se una frase è ambigua ("rendilo più facile", "cambia il colore", "aggiungi un livello"), intendi questo gioco. Se la richiesta tocca chiaramente altro (admin, app, classifica, un altro gioco), fallo notare in una riga e procedi.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi la specifica del gioco, `docs/specifiche/gioco-sysadmin.md`, le parti comuni `docs/specifiche/giochi-comune.md` e il documento tecnico `docs/tecnico/gioco-sysadmin.md`. Apri `games/sysadmin/index.html` solo nelle parti che servono (è lungo quasi 3000 righe).
2. Fai vedere il gioco com'è adesso con l'anteprima della skill `efuture-games-preview` (sta accanto a questa: `<skill>/../efuture-games-preview`; se non c'è, usa quella del repository, cartella `efuture-games-preview` dentro `.claude/skills`):
   ```
   node <skill>/../efuture-games-preview/scripts/anteprima.mjs <scratchpad>/preview
   ```
   Invia con SendUserFile (display `render`) `04-sysadmin.png`, la schermata iniziale del gioco sul telefono. Le altre immagini mandale solo se servono.
3. Rispondi in 3-4 righe: sei in modalità Efuture Bros, versione dell'app (`efuture-games-vN` in `sw.js`), in breve le regole (10 livelli liberi, in gara i primi 3 da 1 minuto con 3 vite; salta sui bug, lancia il mouse, sali la scala dal cliente). Chiedi cosa vuole cambiare.

## 2. Com'è fatto Efuture Bros

- **Cos'è:** platform a scorrimento orizzontale. Il giocatore è il sistemista di Efuture (la testa è il logo): elimina i bug saltandoci sopra o lanciando il mouse, evita chiodi, scosse, seghe e burroni, sale la scala e chiude il ticket del cliente. Se arriva con bug ancora vivi si apre "Cliente non convinto".
- **Nome:** il nome visibile è **Efuture Bros**. Fino alla v41 si chiamava "SysAdmin Runner": la cartella `games/sysadmin/`, l'id `sysadmin` e le chiavi `localStorage` (`sysadminRunnerProgress`, `sysadminRunnerBestTime`, `sysadminRunnerBestDebug`) restano così, perché classifica e codici usano l'id. Non rinominarli.
- **File:** tutto il gioco (HTML, CSS e script) è in **un solo file**, `games/sysadmin/index.html`; non c'è `game.js`. Immagini in `img/` (`logo-testa.png` per la testa, `efuture-white.png` come filigrana, `alba.jpg` facoltativa per il cielo del livello 1), poi `fonts/` e `icons/`. La scocca "Game Boy" in verticale è `games/gameboy.css` + `games/gameboy.js` con `data-game="sysadmin"` (condivise dai 4 giochi). Il gioco non ha suoni.
- **Livelli:** 10. I clienti sono in `CLIENTS` (Marco, Giulia, Paolo, Elena, Davide, Sara, Fabio, Ilaria, Team IT) e le stanze in `THEMES`. I livelli 1–3 (quelli della gara: Marco, Giulia e Paolo, una giornata di lavoro dall'alba alla notte, con sfondi disegnati a parte da `drawScene`; i nomi delle stanze sono in `THEMES` e nella specifica) hanno i parametri fissi in `LV3`; i livelli 4–9 sono generati da `buildNormalLevel(idx)` con seme fisso `1000 + idx × 37`, quindi sono sempre uguali; il 10 è l'hacker nel bunker, `buildBossLevel()`. Attenzione: se cambi il numero di chiamate a `rand()` nel generatore cambiano anche i livelli successivi.
- **Stato e ciclo:** variabile `state` (`title`, `intro`, `playing`, `paused`, `complaint`, `complete`, `gameover`, `victory`), ciclo `loop(ts)` con `requestAnimationFrame`, disegno in `render(t)`.
- **Comandi:** ← → / A D muovi, ↑ / spazio / W salta, X / Shift mouse, V / C antivirus (si sblocca con 3 bug eliminati di fila), P / Esc pausa. Sul telefono: joystick (su = salto) e tasti SALTA, MOUSE, ANTIVIRUS; in verticale i tastini ISTRUZIONI e AVVIA/PAUSA della scocca.
- **Modalità gara** (`?hub=1`): l'app apre il gioco in un iframe con `games/sysadmin/index.html?hub=1`. Solo i primi 3 livelli, 60 secondi e 3 vite per livello, niente boss né "Continua". L'oggetto `EFG` (`max: 3`, `limit: 60`) tiene i tempi; `efgPost()` manda all'app `{type:'efg', ev:…}`: `start` all'inizio del livello 1, `tick` ogni 0,25 s mentre si gioca, `result` una volta sola (`efgEnd(ok, reason)`, con `reason` `'time'` o `'lives'`) con tempi e vite per livello. I punti in classifica li calcola l'app (`hub.js`): livello × secondi avanzati × vite rimaste. Il punteggio dell'HUD non va in classifica.
- **Dove cambiare la difficoltà:** costanti in cima allo script (`MOVE_SPEED`, `JUMP_V`, `GRAVITY`, `INVULN_TIME`, `THROW_COOLDOWN`, `LIVES_START`), `LV3` per i livelli 1–3, `buildNormalLevel()` per i 4–9, `buildBossLevel()` e `updateBoss()` per l'hacker. Il resto è nella sezione "Come modificare" di `docs/tecnico/gioco-sysadmin.md`.

## 3. Regole per le modifiche

- **Solo questo gioco:** cambia `games/sysadmin/`. Se una modifica richiede `games/gameboy.css` o `games/gameboy.js`, avvisa che cambia la scocca di tutti e 4 i giochi. `EFG.max` e `EFG.limit` vanno cambiati solo insieme al calcolo dei punti nell'app (`hub.js`, `docs/specifiche/app-giocatori.md`).
- **File nuovi** (immagini, suoni): aggiungili all'elenco `ASSETS` di `sw.js`, così il gioco funziona anche offline.
- **Documenti:** aggiorna `docs/specifiche/gioco-sysadmin.md` (cosa vede il giocatore) e `docs/tecnico/gioco-sysadmin.md` (come è fatto il codice) nello stesso commit. Se cambi una parte comune, aggiorna anche `docs/specifiche/giochi-comune.md`.
- **Prova sempre** prima di salvare: rilancia l'anteprima, guarda `04-sysadmin.png` e controlla che lo script non stampi errori JavaScript. Per provare un comportamento (un livello, la modalità gara), scrivi un piccolo script Playwright nello scratchpad che apre `games/sysadmin/index.html` (anche con `?hub=1`), preme i pulsanti e fa una schermata.
- **Mai mostrare** i codici di sblocco dei giochi (sono in `LEGGIMI.txt` e nel database), la chiave admin o i dati dei giocatori.
- **Salvataggio:** usa la skill `efuture-games-commit`. Quando cambia un file del gioco va aumentata la versione dell'app; pubblicare su main solo se l'utente lo chiede.

## 4. Uscire dalla modalità

Se l'utente dice "basta Efuture Bros", chiede di lavorare su un'altra pagina o su un altro gioco, o richiama un'altra skill di Efuture Games, la modalità Efuture Bros finisce.
