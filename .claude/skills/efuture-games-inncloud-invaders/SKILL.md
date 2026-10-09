---
name: efuture-games-inncloud-invaders
description: Mette Claude in "modalità inncloud Invaders" per Efuture Games. Da quel momento ogni richiesta dell'utente riguarda il gioco inncloud Invaders (cartella games/inncloud, stand inncloud) — nuvola, tasto SPARA, formazione di bug, virus e hacker, nuvolette-firewall, drone bonus, boss Ransomware, trascinamento, suoni, grafica, testi, modalità gara — finché non dice altro. Usala quando l'utente scrive /efuture-games-inncloud-invaders o dice che vuole lavorare, modificare, provare o fare domande su inncloud Invaders, sul gioco di inncloud o sullo Space Invaders dell'app.
---

# Efuture Games – modalità inncloud Invaders

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md). Scrivi sempre **inncloud** con la i minuscola.

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda il gioco inncloud Invaders** (`games/inncloud/`). Se una frase è ambigua ("rendilo più facile", "cambia il colore", "aggiungi un livello"), intendi questo gioco. Se la richiesta tocca chiaramente altro (admin, app, classifica, un altro gioco), fallo notare in una riga e procedi.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi la specifica del gioco, `docs/specifiche/gioco-inncloud.md`, le parti comuni `docs/specifiche/giochi-comune.md` e il documento tecnico `docs/tecnico/gioco-inncloud.md`. Apri `games/inncloud/game.js` e `index.html` solo nelle parti che servono.
2. Fai vedere il gioco com'è adesso con l'anteprima della skill `efuture-games-preview` (sta accanto a questa: `<skill>/../efuture-games-preview`; se non c'è, usa quella del repository, cartella `efuture-games-preview` dentro `.claude/skills`):
   ```
   node <skill>/../efuture-games-preview/scripts/anteprima.mjs <scratchpad>/preview
   ```
   Invia con SendUserFile (display `render`) `07-inncloud.png`, la schermata iniziale del gioco sul telefono. Le altre immagini mandale solo se servono.
3. Rispondi in 3-4 righe: sei in modalità inncloud Invaders, versione dell'app (`efuture-games-vN` in `sw.js`), in breve le regole (5 livelli liberi con il boss Ransomware alla fine, in gara i primi 3 da 1 minuto con 3 vite; la nuvola spara col tasto SPARA e abbatte la formazione, ci si ripara dietro le nuvolette). Chiedi cosa vuole cambiare.

## 2. Com'è fatto inncloud Invaders

- **Cos'è:** sparatutto nello stile di Space Invaders. Il giocatore guida la nuvola di inncloud lungo il fondo; il cannone è il pallino rosso della "i" del logo e **spara solo a comando** (dalla v28 niente fuoco automatico). Dall'alto scende una formazione di bug (`B`), virus (`V`) e hacker (`K`) che spara codici verdi `0` e `1`; ci si ripara dietro 4 nuvolette-firewall. Un drone bonus in alto dà il **doppio colpo** per 10 s. Se la formazione arriva in fondo la partita finisce subito.
- **File:** `games/inncloud/index.html` (HUD, schermate, fascia di trascinamento, tasto rosso SPARA `fireBtn`, stile CSS) e `games/inncloud/game.js` (tutta la logica). Logo in `img/inncloud-logo.png` (titolo, animazione iniziale, filigrana nel cielo che si schiarisce abbattendo nemici; le misure del logo sono scritte a mano nell'oggetto `LOGO`), poi `fonts/` e `icons/`. La scocca "Game Boy" in verticale è `games/gameboy.css` + `games/gameboy.js` con `data-game="strip"` (A = SPARA, B = musica). Suoni sintetizzati con Web Audio, nessun file audio.
- **Livelli:** 5 — Login sospetto, Phishing, Malware (quelli della gara), Botnet, Ransomware (boss con 20 punti vita che spara a ventaglio). Sono in `LEVELS` (`name`, `text`, `rows`, `cols`, `speed`, `fire`, `bspeed`, `boss`); gli attaccanti sono disegnati in `SPRITES`, il drone in `DRONE`. Campo logico 360 × 600. La scheda del livello non compare più: il livello parte subito.
- **Stato e ciclo:** variabile `state` (`title`, `intro`, `levelcard`, `play`, `paused`, `clear`, `over`, `win`), ciclo `loop(ts)` che chiama `update(dt)` e `render()`.
- **Comandi:** ← → / A D muovi, Spazio / ↑ / Z spara (tenuto premuto = raffica, almeno 0,3 s tra un colpo e l'altro, massimo 3 in volo), P / Esc pausa, Invio per avanzare nelle schermate. Sul telefono: trascinare sulla fascia sotto il gioco (× 1,3) o sul campo, e tasto rotondo rosso SPARA (multi-touch: un dito muove, l'altro spara). Pulsanti `♪` musica e `II` pausa.
- **Modalità gara** (`?hub=1`): l'app apre il gioco in un iframe con `games/inncloud/index.html?hub=1`. Solo i primi 3 livelli (niente boss), 60 secondi e 3 vite per livello, niente "Continua". L'oggetto `EFG` (`max: 3`, `limit: 60`) tiene i tempi; `efgPost()` manda all'app `{type:'efg', ev:…}`: `start` al livello 1 (dopo l'animazione iniziale), `tick` ogni 0,25 s mentre si gioca, `result` una volta sola (`efgEnd(ok, reason)`, con `reason` `'time'` o `'lives'`) con tempi e vite per livello. I punti in classifica li calcola l'app (`hub.js`): livello × secondi avanzati × vite rimaste. Il punteggio dell'HUD (record `inncloudInvBest`) non va in classifica.
- **Dove cambiare la difficoltà:** `speed`, `fire`, `bspeed`, `rows`, `cols` in `LEVELS`; ritmo di sparo `FIRE_CD`, `FIRE_CD_X2` e `maxShots` in `update()`; accelerazione e discesa della formazione in `update()`; boss in `loadLevel()` e nel blocco `// boss` di `update()`. Il resto è nella sezione "Come modificare" di `docs/tecnico/gioco-inncloud.md`.

## 3. Regole per le modifiche

- **Solo questo gioco:** cambia `games/inncloud/`. Se una modifica richiede `games/gameboy.css` o `games/gameboy.js`, avvisa che cambia la scocca di tutti e 4 i giochi. `EFG.max` e `EFG.limit` vanno cambiati solo insieme al calcolo dei punti nell'app (`hub.js`, `docs/specifiche/app-giocatori.md`).
- **Formazione:** con molte file parte più vicina alle nuvolette; i primi 3 livelli devono restare fattibili in meno di un minuto.
- **File nuovi** (immagini, suoni): aggiungili all'elenco `ASSETS` di `sw.js`, così il gioco funziona anche offline.
- **Documenti:** aggiorna `docs/specifiche/gioco-inncloud.md` (cosa vede il giocatore) e `docs/tecnico/gioco-inncloud.md` (come è fatto il codice) nello stesso commit. Se cambi una parte comune, aggiorna anche `docs/specifiche/giochi-comune.md`.
- **Prova sempre** prima di salvare: rilancia l'anteprima, guarda `07-inncloud.png` e controlla che lo script non stampi errori JavaScript. Per provare un comportamento (un livello, il tasto SPARA, la modalità gara), scrivi un piccolo script Playwright nello scratchpad che apre `games/inncloud/index.html` (anche con `?hub=1`), preme i pulsanti e fa una schermata.
- **Mai mostrare** i codici di sblocco dei giochi (sono in `LEGGIMI.txt` e nel database), la chiave admin o i dati dei giocatori.
- **Salvataggio:** usa la skill `efuture-games-commit`. Quando cambia un file del gioco va aumentata la versione dell'app; pubblicare su main solo se l'utente lo chiede.

## 4. Uscire dalla modalità

Se l'utente dice "basta inncloud" (o "basta Invaders"), chiede di lavorare su un'altra pagina o su un altro gioco, o richiama un'altra skill di Efuture Games, la modalità inncloud Invaders finisce.
