# CoreTech Pac – documentazione tecnica

Questo documento spiega **come è fatto il codice** del gioco CoreTech Pac. Cosa vede e fa il giocatore (schermate, regole, comandi) è descritto nelle specifiche funzionali, che qui non si ripetono:

- [../specifiche/gioco-coretech.md](../specifiche/gioco-coretech.md) – specifica del gioco;
- [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md) – parti comuni ai 4 giochi (modalità gara, scocca "Game Boy").

Il gioco è diviso in due file: `games/coretech/index.html` (pagina, stile, HUD, schermate, joystick) e `games/coretech/game.js` (tutta la logica, circa 980 righe).

## File e risorse

| Percorso | Contenuto | Usato da |
|---|---|---|
| `games/coretech/index.html` | Pagina, stile inline, HUD, overlay, joystick; due piccoli script inline (`window.efgReport` e pulsante Istruzioni) | – |
| `games/coretech/game.js` | Logica del gioco in una IIFE | `<script src="game.js">` |
| `img/coretech-logo.png` | Logo CoreTech | `<img id="logoImg">` nella schermata titolo; `renderIntro()` lo ritaglia per l'animazione iniziale |
| `img/efuture-white.png` | Logo Efuture bianco | Presente ma non usato |
| `fonts/` | Press Start 2P (400) e IBM Plex Mono (400, 600) in `woff2`, con le licenze | `@font-face` nel `<style>`; il canvas usa `'Press Start 2P'` per PRONTI!, PAC e i punti |
| `icons/` | `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `<link rel="icon">`, `<link rel="apple-touch-icon">` |
| `../gameboy.css` | Scocca "Game Boy" in verticale | `<link rel="stylesheet">` nell'`<head>` |
| `../gameboy.js` | Script della scocca | `<script src="../gameboy.js" data-game="joy" data-a="pauseBtn" data-b="soundBtn" data-select="btnHow" data-pause="pauseBtn" data-paused="ov-pause" data-primary=".overlay button.btn:not(.alt)">` |

Ordine degli script in fondo a `<body>`: `gameboy.js` → `efgReport` inline → `game.js` → script del pulsante Istruzioni. Nessuna libreria esterna e nessun file audio (i suoni sono sintetizzati).

## Struttura della pagina

| Elemento | Id | Contenuto |
|---|---|---|
| Contenitore | `#app` | HUD + `#main` |
| HUD | `#hud` | `#score` (punti), `#lives` (vite, `span.life` creati da `updateHud()`), `#levelName` ("Liv. N/5 · nome"), `#soundBtn` (`♪` / `×`), `#pauseBtn` (`II`) |
| Area di gioco | `#stage` | Canvas e overlay; riceve anche lo scorrimento del dito (swipe) |
| Canvas | `#game` | Labirinto; dimensioni calcolate da `fit()` |
| Titolo | `#ov-title` | `#logoImg`, `#bestLine` / `#bestVal`, `#btnStart`, `#btnContinue` (`#continueLvl`), `#btnHow`, `#howBox` con le icone `#lgCoin`, `#lgBug`, `#lgPatch` (canvas 44 × 44) |
| Scheda del livello | `#ov-level` | `#lvTag`, `#lvName`, `#lvText`, `#btnGo` |
| Livello completato | `#ov-clear` | `#clearTitle`, `#clearScore`, `#clearBugs`, `#clearTime`, `#btnNext` |
| Game over | `#ov-over` | `#overScore`, `#overLvl`, `#btnRetry`, `#btnMenu` |
| Vittoria | `#ov-win` | `#winScore`, `#winBest`, `#winRecord`, `#btnAgain` |
| Pausa | `#ov-pause` | `#btnResume`, `#btnPauseMenu` |
| Comandi | `#controls` | `#joy` con le frecce `#jmU`, `#jmR`, `#jmD`, `#jmL` (classe `on` sulla direzione attiva) e la manopola `#joyKnob` |

- Gli overlay hanno la classe `.overlay` e si mostrano con l'attributo `hidden`. In `game.js` sono nell'oggetto `ov` (`title`, `level`, `clear`, `over`, `win`, `pause`) e `showOnly(o)` lascia visibile solo `o` (con `null` li chiude tutti).
- CSS: in orizzontale basso (`max-height:560px`) `#app` diventa una griglia con l'HUD in colonna a sinistra e il joystick accanto al labirinto.

## Architettura dello script

`game.js` è una IIFE con `"use strict"`, divisa in sezioni con commenti `/* ===== */`: competition mode, DATA, DOM, STORAGE, AUDIO, GAME STATE, MOVEMENT, UPDATE, FLOW, INPUT, RENDER, LOOP, BOOT.

### Variabili di stato principali

| Variabile | Significato |
|---|---|
| `state`, `prevState` | Stato del gioco e stato da riprendere dopo la pausa |
| `lvIndex`, `L` | Indice del livello (0–4) e la sua riga di `LEVELS` |
| `grid` | Labirinto corrente come matrice di caratteri |
| `dots`, `dotsLeft` | Monetine (1) e floppy (2) per casella; quante ne restano |
| `COLS`, `ROWS` | Dimensioni del labirinto corrente |
| `HOUSE_EXIT`, `HOUSE_IN` | Casella sopra la porta (la `B`) e centro della casetta (due righe sotto) |
| `TUNNEL_ROW`, `TUNNEL_LEN` | Riga dell'uscita laterale e lunghezza del tratto dove i bug rallentano |
| `player` | La C: `x`, `y` in caselle, `gx`/`gy` (scostamento del disegno dopo una svolta assistita), `dir`, `face`, `moving`, `mouth`, `turnAt` |
| `bugs` | Bug in gioco: `id`, `name`, `color`, `home`, `x`, `y`, `dir`, `mode`, `release`, `reverse`, `wob` |
| `goneBugs` | Id dei bug mangiati che non devono rinascere |
| `globalMode`, `modeIdx`, `modeTimer` | Alternanza dispersione / inseguimento |
| `frightTimer`, `eatCombo` | Durata residua della patch e bug mangiati di fila |
| `readyTimer`, `dyingTimer` | Timer di PRONTI! e dell'animazione della vita persa |
| `desired`, `desiredAge` | Direzione prenotata e da quanto tempo è uguale a quella attuale |
| `joyTick` | Funzione impostata dal joystick, richiamata a ogni fotogramma |
| `score`, `levelStartScore`, `lives`, `levelBugsEaten`, `levelTime` | Punti, punti a inizio livello (per Riprova), vite, bug mangiati, tempo del livello |
| `best`, `reached`, `audioOn` | Record, livello raggiunto, audio acceso (da `localStorage`) |
| `T`, `dpr`, `mazeLayer` | Lato della casella in px, densità, canvas fuori schermo con i muri già disegnati |
| `clock`, `introT`, `introBites`, `popups` | Tempo totale, animazione iniziale, punti volanti sul labirinto |
| `EFG` | Stato della modalità gara |

### Macchina a stati

Valori di `state` (il commento nel codice non elenca `intro`):

| `state` | Quando | Cosa fa `update()` |
|---|---|---|
| `title` | Avvio, `toMenu()` | Niente |
| `intro` | `playIntro()` dopo Inizia / Gioca ancora | Fa avanzare l'animazione del logo; alla fine `endIntro()` |
| `levelcard` | `showLevelCard()` | Niente (dura un istante, vedi Limiti noti) |
| `ready` | Dopo Via! e dopo ogni vita persa | Scala `readyTimer` (1,8 s), poi `play` |
| `play` | Gioco vero e proprio | Tutto: tempo, gara, modi dei bug, movimento, collisioni |
| `dying` | `loseLife()` | Scala `dyingTimer` (1,5 s), poi `gameOver()` oppure `resetActors()` + `ready` |
| `clear` | `levelCleared()` | Niente; dopo 0,9 s compare `ov-clear` o parte `win()` |
| `over` | `gameOver()`; in gara anche `efgEnd(false, …)` | Niente |
| `win` | `win()` dopo il livello 5 | Niente |
| `paused` | `togglePause()` da `play` o `ready` | `update()` non viene chiamato |

Flusso: `title` → Inizia → `intro` → `endIntro()` → `showLevelCard(0)` → `ready` → `play` → ultima monetina → `clear` → Prossimo livello → `showLevelCard(n+1)` … → dopo il livello 5 `win`.

### Game loop e timing

- `loop(ts)` con `requestAnimationFrame`; `dt` in secondi, limitato a **1/30 s**. Se `state !== 'paused'` chiama `update(dt)`, poi sempre `render()`.
- In `play`: `levelTime += dt`; in gara `tick` ogni 0,25 s e controllo dei 60 s.
- Il movimento è in **caselle al secondo**: `stepEntity()` fa avanzare un'entità di `speed × dt` caselle fermandosi su ogni centro di casella, dove chiama la funzione di decisione (`playerDecide` o `bugDecide`).
- Avvio (BOOT): `loadLevel(0)`, `fit()`, `refreshTitle()`, `refreshSoundBtn()`, `updateHud()`, `drawLegend()`; quando i font sono pronti ridisegna muri e icone; poi parte il loop.
- `visibilitychange`: se la pagina va in secondo piano durante `play` o `ready`, va in pausa.

## Funzioni principali

### Costruzione dei livelli

| Funzione | Cosa fa |
|---|---|
| `loadLevel(i)` | Carica `MAZES[i]` in `grid`, trova casetta e uscita laterale, conta monetine, azzera `goneBugs`, chiama `fit()` e `resetActors()` |
| `findChar(ch)` | Posizione di un carattere nel labirinto (`P`, `B`) |
| `resetActors()` | Rimette la C alla partenza (ferma) e crea i bug del livello, saltando quelli in `goneBugs`; riavvia l'alternanza dei modi; `readyTimer = 1.8` |
| `tileAt(x, y)`, `passable(x, y, e)` | Carattere di una casella (con il giro laterale) e se un'entità può entrarci (porta e casetta solo per i bug in `house`, `exit`, `eaten`) |

### Movimento

| Funzione | Cosa fa |
|---|---|
| `stepEntity(e, speed, dt, decide)` | Avanzamento sulla griglia, con decisione a ogni centro di casella e stop contro i muri |
| `wrapX(e)` | Uscita laterale: rientra dal lato opposto |
| `playerDecide(e, x, y)` | Mangia sulla casella e applica la direzione prenotata se è libera; aggiorna `turnAt` |
| `tryCorner()` | Aiuto in curva: entro `CORNER` (0,35 caselle) dal centro di un incrocio prende subito la svolta prenotata |
| `canTurnSoon(d, max)` | La C potrà svoltare in `d` entro `max` incroci davanti? (usata dal joystick in diagonale) |
| `setDesired(d)` | Prenota una direzione e azzera `desiredAge` |

### Nemici e IA

| Funzione | Cosa fa |
|---|---|
| `bugTarget(b)` | Bersaglio del bug: angolo `home` in dispersione; in inseguimento Glitch = la C, Loop = 4 caselle davanti, Leak = punto simmetrico rispetto a Glitch, Crash = la C se lontano più di 8 caselle, altrimenti il suo angolo |
| `bugDecide(b, x, y)` | Scelta a ogni incrocio: niente inversioni (salvo `reverse`), a caso se spaventato o con probabilità `L.rand`, altrimenti la strada più vicina al bersaglio; gestisce uscita dalla casetta |
| `bugSpeed(b)` | Velocità secondo il modo, la riga dell'uscita laterale e le ultime 20 monetine |

Modi di un bug (`b.mode`): `house` (nella casetta, rimbalza), `exit` (sta uscendo), `scatter`, `chase`, `fright` (spaventato), `eaten`.

### Collisioni, punteggio e fine livello

| Funzione | Cosa fa |
|---|---|
| `eatAt(x, y)` | Monetina +10, floppy +50 e patch (tutti i bug in `fright`, quelli nella casetta escono subito); a zero monetine `levelCleared()` |
| collisioni in `update()` | Distanza al quadrato < 0,45 (circa 0,67 caselle), tenendo conto del giro laterale. Bug spaventato: 200 × 2^(combo−1) punti e popup; altrimenti `loseLife()` |
| `loseLife()` | Toglie una vita, stato `dying` per 1,5 s |
| `levelCleared()` | In gara registra tempo e vite e manda un `tick`; salva `reached` e `best`; dopo 0,9 s mostra `ov-clear` o chiama `win()` |
| `gameOver()` | In gara `efgEnd(false, 'lives')`; salva il record, mostra `ov-over` |
| `win()` | Salva il record, azzera `reached`, mostra `ov-win` |
| `efgEnd(ok, reason)` | Manda `result` una sola volta |
| `fmt(s)` | Secondi in `m:ss` |

### Rendering

| Funzione | Cosa fa |
|---|---|
| `fit()` | Calcola `T` (lato intero della casella, almeno 8 px) e `dpr` (fino a 2,5), dimensiona il canvas, ricostruisce i muri |
| `buildMazeLayer()` | Disegna una volta sola fondo, griglia leggera, muri con bordo blu e porta rosa su `mazeLayer` |
| `render()` | Muri, monetine e floppy, la C (anche il pezzo che esce dall'altro lato), bug, popup dei punti, PRONTI! |
| `renderIntro()` | Animazione iniziale: la C che mangia le lettere del logo, briciole, scritta PAC e "TOCCA PER SALTARE" |
| `drawC()`, `drawBug()`, `drawCoin()`, `drawFloppy()` | Disegno della C, dei bug (normali, spaventati, lampeggianti), delle monetine e del floppy |
| `shade(hex, f)` | Scurisce o schiarisce un colore |
| `drawLegend()` | Icone del riquadro Istruzioni |

### Input

| Funzione | Cosa fa |
|---|---|
| listener `keydown` su `window` | Frecce / WASD, P / Esc, Invio; durante l'animazione iniziale qualsiasi tasto la salta |
| listener `pointerdown/move/up` su `#stage` | Scorrimento del dito sul labirinto |
| IIFE del joystick (`mark`, `openHere`, `pickDiagonal`, `choose`, `apply`, `move`, `release`) | Joystick a 4 direzioni con zona morta, isteresi e gestione della diagonale; imposta `joyTick` |

### Audio

| Funzione | Cosa fa |
|---|---|
| `beep(freq, dur, type, vol, slide)` | Suona una nota con un oscillatore Web Audio (crea `actx` al primo uso); niente se `audioOn` è falso |
| `sfx.coin/patch/eat/die/clear/start` | Effetti: monetina (due note alternate), floppy, bug mangiato, vita persa, livello completato e avvio (arpeggi) |
| `refreshSoundBtn()` | Testo e opacità di `#soundBtn` |

### UI e overlay

| Funzione | Cosa fa |
|---|---|
| `showOnly(o)` | Mostra un solo overlay |
| `playIntro()`, `endIntro()` | Avvia e chiude l'animazione iniziale |
| `showLevelCard(i)` | Vite e messaggio `start` in gara, `loadLevel(i)`, testi della scheda, poi chiama subito `btnGo.onclick()` |
| `startGame(fromLevel)` | Nuova partita da un livello (usata da Continua) |
| `toMenu()`, `togglePause()`, `refreshTitle()`, `updateHud()` | Menu, pausa, schermata titolo, HUD |

Gestori dei pulsanti (assegnati con `onclick`): `btnStart`, `btnContinue`, `btnGo`, `btnNext`, `btnRetry` (vite a 3, punti a `levelStartScore`), `btnMenu`, `btnAgain`, `btnResume`, `btnPauseMenu`, `pauseBtn`, `soundBtn`.

## Dati dei livelli

Tutto è in `game.js`, sezione DATA:

- `MAZES`: 5 labirinti come array di stringhe. Caratteri: `#` muro, `.` monetina, `o` floppy, spazio corridoio vuoto, `B` uscita della casetta, `-` porta, `G` casetta, `P` partenza. La riga dell'uscita laterale è quella aperta a entrambi i bordi.
- `LEVELS`: un oggetto per livello con i parametri sotto.
- `BUGS`: nome, colore e angolo di dispersione dei 4 bug (gli angoli vengono ricalcolati in `loadLevel()` in base alle dimensioni del labirinto).

| Liv. | `name` | Labirinto | Monetine | Floppy | Riga uscita laterale | `bugs` | `pac` | `bug` | `fright` | `frightTime` (s) | `rand` | `release` (s) | `cycle` (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rete aziendale | 13 × 13 | 61 | 4 | 8 | 2 | 4,8 | 2,5 | 1,7 | 10,0 | 0,45 | 0, 5 | 9, 15, 9, 15, 7, 999 |
| 2 | Server farm | 17 × 13 | 83 | 4 | 8 | 3 | 5,0 | 2,8 | 1,8 | 9,0 | 0,38 | 0, 4, 9 | 8, 17, 8, 17, 6, 999 |
| 3 | Cloud ibrido | 19 × 15 | 85 | 4 | 8 | 3 | 5,3 | 3,1 | 2,0 | 8,0 | 0,30 | 0, 4, 8 | 8, 18, 7, 18, 5, 999 |
| 4 | Data center | 19 × 21 | 144 | 4 | 10 | 4 | 6,3 | 4,7 | 2,4 | 4,8 | 0,08 | 0, 2, 4, 7 | 5, 22, 4, 22, 3, 999 |
| 5 | Core di sistema | 19 × 21 | 149 | 4 | 10 | 4 | 6,4 | 5,1 | 2,5 | 3,6 | 0,03 | 0, 1, 2.5, 4 | 4, 24, 3, 24, 2, 999 |

- `pac`, `bug`, `fright`: velocità in caselle al secondo della C, dei bug normali e di quelli spaventati.
- `rand`: probabilità di scelta casuale a ogni incrocio.
- `release`: secondi dopo i quali ogni bug esce dalla casetta (il primo parte già fuori).
- `cycle`: durate alternate dei modi; gli indici pari sono dispersione, i dispari inseguimento; l'ultimo valore (999) di fatto lascia l'inseguimento per sempre.
- `text`: frase della scheda del livello.

## Costanti di gioco

| Costante / valore | Dove | Significato |
|---|---|---|
| Velocità della C e dei bug | `LEVELS` | Vedi tabella sopra |
| Bug mangiato | `bugSpeed()` → 11 | Velocità di rientro (in pratica non usata, vedi Limiti noti) |
| Bug nella casetta / in uscita | `bugSpeed()` → 2,2 / 3,2 | |
| Rallentamento nell'uscita laterale | `bugSpeed()` → ×0,55 | Solo i bug |
| Accelerazione finale | `bugSpeed()` → ×1,06 sotto 20 monetine | Solo bug non spaventati |
| `CORNER` | 0,35 caselle | Raggio dell'aiuto in curva |
| Scadenza della prenotazione | 0,6 s | Se la direzione prenotata è già quella attuale |
| Distanza di collisione | distanza² < 0,45 | Circa 0,67 caselle |
| `readyTimer` | 1,8 s | PRONTI! |
| `dyingTimer` | 1,5 s | Animazione della vita persa |
| Attesa prima di `ov-clear` | 0,9 s | `levelCleared()` |
| Lampeggio dei bug spaventati | ultimi 1,6 s della patch | `drawBug()` |
| Punti | monetina 10, floppy 50, bug 200 / 400 / 800 / 1600 | `eatAt()`, `update()` |
| Vite iniziali | 3 | `btnStart`, `startGame()`, `showLevelCard()` in gara |
| `INTRO` | `hold` 0,7 s, `speed` 300 px logo/s, `tail` 0,7 s | Animazione iniziale (circa 4,2 s, `introDuration()`) |
| `LOGO_W`, `LOGO_H`, `LOGO_C_*`, `BITES` | 720 × 156 e posizioni delle lettere | Geometria del logo usata dall'animazione |
| Joystick `DEAD`, `HYST` | 0,30, 1,2 | Zona morta e isteresi |
| Swipe | 16 px | Spostamento minimo per cambiare direzione |
| `T` | ≥ 8 px | Lato della casella |
| `dpr` | ≤ 2,5 | Densità del canvas |

Colori del canvas: `C_BLUE`, `C_BLUE_L`, `C_DEEP`, `COIN`, `MAZE_BG`, `WALL_FILL`, `TXT_GOLD` in cima a `game.js`; colori dei bug in `BUGS`.

## Integrazione con l'app

La modalità gara si attiva con `?hub=1`. Regole e protocollo completi: [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md#modalità-libera-e-modalità-gara).

```
const EFG = { on, max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m)   // postMessage({type:'efg', ...m}, '*') al parent, solo se in iframe
function efgEnd(ok, reason)
```

Il tempo del livello è `levelTime` (scorre solo in `play`: non durante PRONTI!, la vita persa, la pausa).

### Messaggi inviati

| `ev` | Dove nel codice | Campi |
|---|---|---|
| `start` | `showLevelCard(0)`, cioè dopo l'animazione iniziale | solo `ev` |
| `tick` | `update()` ogni 0,25 s in `play`; uno in più in `levelCleared()` | `level`, `max`, `t` (= `levelTime`), `used` |
| `result` | `efgEnd()` | `ok`, `reason` (`''`, `'time'`, `'lives'`), `level`, `max`, `used`, `times`, `lives` (= `livesAt`), `seconds` |

Tutti hanno anche `type: 'efg'`. `seconds` = `used`, più `levelTime` se la partita è persa.

### Limiti e differenze in gara

- `showLevelCard()` rimette `lives = 3` a ogni livello; al livello 1 azzera `used`, `times`, `livesAt`, `done`.
- `update()`: quando `levelTime ≥ 60` chiama `efgEnd(false, 'time')` (`state = 'over'`, nessuna schermata).
- `gameOver()`: `efgEnd(false, 'lives')`, poi `ov-over`.
- `levelCleared()`: al terzo livello `state = 'clear'`, suono e `efgEnd(true)`, senza schermata e senza salvare `reached` e `best`.
- `refreshTitle()` nasconde Continua; HUD, scheda e game over mostrano "/3".
- `window.efgReport` (in `index.html`, messaggio `efg-score`) esiste ma nessuno lo chiama.

## Input

### Tastiera (`keydown` su `window`)

| Tasto | Azione |
|---|---|
| ← → ↑ ↓, W A S D (maiuscole o minuscole) | Prenota la direzione (`KEYMAP` → `setDesired`) |
| P, Esc | `togglePause()` |
| Invio | Preme Inizia, Via! o Prossimo livello, secondo l'overlay visibile |
| Qualsiasi tasto durante `intro` | Salta l'animazione |

### Touch

- **Swipe su `#stage`:** `pointerdown` fuori dagli overlay salva il punto; a ogni spostamento ≥ 16 px sceglie la direzione dell'asse prevalente e riparte da lì, così si concatenano più svolte. Un tocco durante `intro` la salta.
- **Joystick `#joy`:** un solo dito (`setPointerCapture`). `move()` limita la manopola alla base; dentro la zona morta (30%) non cambia nulla. `choose()` applica l'isteresi (un asse deve superare l'altro del 20%); vicino alla diagonale `pickDiagonal()` sceglie la direzione che la C può prendere entro 4 caselle. Mentre il dito è giù, `joyTick()` ricontrolla la scelta a ogni fotogramma. Al rilascio la manopola torna al centro ma la direzione resta prenotata.
- Su `#controls` sono bloccati `touchstart` e `touchmove`; sul joystick anche `contextmenu`, `selectstart`, `dragstart`.

### Pulsanti e scocca

- `#pauseBtn` → `togglePause()`; `#soundBtn` → accende o spegne l'audio e salva `coretechPacSound`.
- In verticale `gameboy.js` sposta `#pauseBtn` nel tasto A e `#soundBtn` nel tasto B; ISTRUZIONI preme `#btnHow`; AVVIA/PAUSA preme il pulsante principale visibile (`.overlay button.btn:not(.alt)`) o la pausa.
- `resize` e `orientationchange` (dopo 200 ms) richiamano `fit()`.

## Come modificare

### Cambiare la difficoltà

| Cosa | Dove |
|---|---|
| Velocità della C e dei bug | `LEVELS[i].pac`, `.bug`, `.fright` |
| Durata della patch | `LEVELS[i].frightTime` |
| Numero di bug | `LEVELS[i].bugs` (massimo 4: ci sono 4 voci in `BUGS` e 4 posizioni di partenza in `resetActors()`) |
| Bug più o meno prevedibili | `LEVELS[i].rand` |
| Uscita dalla casetta | `LEVELS[i].release` |
| Dispersione / inseguimento | `LEVELS[i].cycle` |
| Comportamento di un bug | `bugTarget()` |
| Aiuto in curva, collisione | `CORNER`; soglia `0.45` in `update()` |
| Joystick | `DEAD`, `HYST` nella IIFE del joystick; soglia di 16 px dello swipe |
| Tempo e livelli della gara | `EFG.limit`, `EFG.max` (devono restare allineati con l'app) |

### Aggiungere un livello

1. Disegnare un nuovo labirinto in `MAZES`, con una `P`, una `B` sopra la porta `-`, la casetta `G` due righe sotto la `B`, e una riga aperta ai due bordi per l'uscita laterale. Tutte le righe devono avere la stessa lunghezza.
2. Aggiungere la riga corrispondente in `LEVELS` (`release` e `cycle` con abbastanza valori).
3. Aggiornare il numero 5 scritto a mano: `showLevelCard()` (`lvTag`), `gameOver()` (`overLvl`), `updateHud()` e i testi in `index.html` ("5 livelli, sempre più veloci", "Tutti i 5 livelli ripuliti!"). La fine partita usa già `LEVELS.length`.

### Cambiare una grafica

| Cosa | Dove |
|---|---|
| Logo del titolo e dell'animazione | `img/coretech-logo.png`; se cambiano le proporzioni, aggiornare `LOGO_W`, `LOGO_H`, `LOGO_C_END`, `LOGO_C_CX`, `LOGO_C_R` e `BITES` |
| La C | `drawC()` |
| Bug | `drawBug()` e i colori in `BUGS` |
| Monetine, floppy | `drawCoin()`, `drawFloppy()`, costante `COIN` |
| Muri e fondo del labirinto | `buildMazeLayer()`, costanti `MAZE_BG`, `WALL_FILL`, `C_BLUE` |
| Interfaccia | Variabili CSS in `:root` di `index.html` (`--ct`, `--coin`, `--navy`…) |
| Suoni | `sfx` e `beep()` |

## Limiti noti

- **Scheda del livello mai visibile:** `showLevelCard()` compila `#ov-level` ma poi chiama subito `$('btnGo').onclick()`, che chiude gli overlay e passa a `ready` (commento nel codice: "niente schermata di spiegazione"). La specifica funzionale descrive ancora la scheda con il pulsante Via!.
- **Bug mangiati e vite perse:** un bug mangiato viene tolto da `bugs` al fotogramma successivo e non torna finché il livello continua; ma `goneBugs` viene riempito **solo nel livello 1** (`lvIndex === 0`). Dal livello 2 in poi, dopo una vita persa `resetActors()` ricrea anche i bug già mangiati. La specifica dice che il bug mangiato non torna più per tutto il livello.
- Per lo stesso motivo il ritorno alla casetta dei bug mangiati (`mode 'eaten'`, `goingIn`, velocità 11) è codice che non si attiva mai.
- Il commento accanto a `let state` non elenca `intro`; il commento su `goneBugs` dice "dal livello 2 sì", in linea con il codice ma non con la specifica.
- In `index.html` c'è uno stile per `.powered-bar` senza elemento corrispondente, e `img/efuture-white.png` non è usato.
- `window.efgReport` non è chiamato da nessuno.
- In gara, dopo `efgEnd(true)` il gioco resta in `clear` senza schermata (la copre il risultato dell'app).
- Se il logo non si carica, l'animazione iniziale mostra solo la C e la scritta PAC.

---
Ultimo aggiornamento: 2026-10-09 (v37)
