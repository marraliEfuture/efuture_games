# Timenet Breakout – documentazione tecnica

Questo documento spiega **come è fatto il codice** di Timenet Breakout. Le regole del gioco, le schermate e i testi sono nella specifica funzionale [gioco-timenet.md](../specifiche/gioco-timenet.md); le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](../specifiche/giochi-comune.md).

## File e risorse

| Percorso | Contenuto |
|---|---|
| `games/timenet/index.html` | Pagina: meta, CSS inline (variabili colore in `:root`), HUD, canvas, overlay, fascia di trascinamento, piccoli script inline |
| `games/timenet/game.js` | Tutta la logica del gioco (circa 785 righe), in una IIFE |
| `games/timenet/img/timenet-logo.png` | Logo 720 × 258. Usato nell'overlay titolo (`#logoImg`), nell'animazione iniziale e nel pannello che si scopre dietro i mattoncini |
| `games/timenet/img/delfino.png` | Delfino 320 × 280, guarda a sinistra. Caricato da `game.js` come `DOLPHIN_IMG` |
| `games/timenet/img/efuture-white.png` | Presente ma non usato dal gioco |
| `games/timenet/fonts/` | Press Start 2P e IBM Plex Mono (400, 600) in `woff2`, con le licenze. Dichiarati con `@font-face` nel CSS |
| `games/timenet/icons/` | `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |
| `games/gameboy.css` | Scocca "Game Boy" in verticale, caricata con `<link rel="stylesheet" href="../gameboy.css">` |
| `games/gameboy.js` | Script della scocca, caricato prima di `game.js` con `data-game="strip"` |

Non ci sono file audio: i suoni sono sintetizzati con Web Audio. Non ci sono librerie esterne.

Ordine degli script in fondo a `index.html`:
1. `../gameboy.js` con gli attributi `data-a="pauseBtn"`, `data-b="soundBtn"`, `data-select="btnHow"`, `data-pause="pauseBtn"`, `data-paused="ov-pause"`, `data-primary=".overlay button.btn:not(.alt)"`;
2. script inline che definisce `window.efgReport` (messaggio `efg-score`, oggi non usato da nessuno);
3. `game.js`;
4. script inline che apre e chiude il riquadro Istruzioni (`btnHow` ↔ `howBox`).

## Struttura della pagina

```
#app
├─ #hud            Punti (#score) · Palloni (#lives) · #levelName · #soundBtn · #pauseBtn
└─ #main
   ├─ #stage       contenitore del campo e degli overlay
   │  ├─ canvas#game
   │  ├─ .overlay#ov-title   logo (#logoImg), #bestLine/#bestVal, #btnStart, #btnContinue (#continueLvl), #btnHow, #howBox
   │  ├─ .overlay#ov-level   #lvTag, #lvName, #lvText, #btnGo
   │  ├─ .overlay#ov-clear   #clearTitle, #clearScore, #clearBugs, #clearTime, #btnNext
   │  ├─ .overlay#ov-over    #overScore, #overLvl, #btnRetry, #btnMenu
   │  ├─ .overlay#ov-win     #winScore, #winBest, #winRecord, #btnAgain
   │  └─ .overlay#ov-pause   #btnResume, #btnPauseMenu
   └─ #controls
      └─ #strip    fascia "Trascina il delfino / tocca per lanciare"
```

- Le **icone della legenda** nelle istruzioni sono tre piccoli canvas (`#lgBrick`, `#lgBall`, `#lgPow`) disegnati da `drawLegend()`.
- Le **vite** sono `<span class="life">` creati da `updateHud()` (pallini con gradiente conico come il pallone).
- In orizzontale basso (`orientation:landscape` e `max-height:560px`) `#main` va in riga e `#strip` diventa una colonna di 120 px a sinistra.

## Architettura dello script

### IIFE e stato globale

`game.js` è un'unica funzione anonima autoeseguita, in `"use strict"`. Nulla viene esposto su `window`. Le variabili "globali" sono quindi locali all'IIFE:

| Variabile | Significato |
|---|---|
| `EFG` | Stato della modalità gara (vedi [Integrazione con l'app](#integrazione-con-lapp)) |
| `state`, `prevState` | Stato corrente e stato da cui si è entrati in pausa |
| `lvIndex`, `L` | Indice del livello (0–4) e oggetto `LEVELS[lvIndex]` |
| `bricks`, `breakable` | Mattoncini presenti e quanti ne restano da rompere |
| `balls`, `caps`, `parts`, `toasts` | Palloni, capsule in caduta, particelle, messaggi brevi |
| `score`, `levelStartScore`, `lives`, `levelBroken`, `levelTime` | Punti, punti a inizio livello (per "Riprova"), vite, mattoncini rotti, secondi nel livello |
| `dolphin` | `{ x, w, face, nod, hop }`: posizione, larghezza, verso (1/-1), "cenno" dopo un rimbalzo |
| `bigTimer`, `slowTimer`, `net`, `speedMul` | Timer delle capsule ✓ e T, rete attiva, moltiplicatore velocità dei rimbalzi |
| `targetX`, `keyDir` | Bersaglio del trascinamento e direzione da tastiera (-1, 0, 1) |
| `clock`, `scale`, `dpr` | Tempo totale, scala del canvas, densità pixel |
| `intro` | Stato dell'animazione iniziale |
| `cells`, `revealLayer`, `reveal`, `endRevealAt` | Pannello del logo che si scopre dietro il muro |
| `best`, `reached`, `audioOn` | Record, livello raggiunto e audio, letti da `localStorage` |

Le costanti `BALL_R`, `COLS`, `BW`, `BH` sono `let`: `loadLevel()` le reimposta per ogni livello.

### Macchina a stati

| `state` | Quando | Cosa aggiorna `update()` |
|---|---|---|
| `'title'` | Avvio e `toMenu()` | Solo particelle e messaggi. `render()` disegna mare e delfino |
| `'intro'` | Dopo Inizia / Gioca ancora (`playIntro()`) | `updateIntro()` |
| `'levelcard'` | Dentro `showLevelCard()` | Stato di passaggio: subito dopo diventa `'play'` (vedi sotto) |
| `'play'` | Dopo `btnGo.onclick` | Tutto: tempo, gara, delfino, palloni, capsule |
| `'paused'` | `togglePause()` da `'play'` | Niente: il loop salta `update()` |
| `'clear'` | `levelCleared()` | Solo particelle |
| `'over'` | `gameOver()` o `efgEnd(false, …)` | Solo particelle |
| `'win'` | `win()` dopo l'ultimo livello | Solo particelle |

Gli overlay si mostrano con `showOnly(o)`, che nasconde tutti gli altri (`showOnly(null)` li nasconde tutti).

**Nota:** `showLevelCard()` imposta i testi di `#ov-level` ma poi chiama subito `$('btnGo').onclick()` ("niente frase prima del livello: si gioca subito"). Quindi la scheda del livello non viene mai mostrata e il gioco passa direttamente a `'play'`.

### Game loop e timing

- `loop(ts)` è chiamato da `requestAnimationFrame`. Calcola `dt` in secondi, lo limita a `1/30` (sotto i 30 fps il gioco rallenta invece di saltare) e chiama `update(dt)` se lo stato non è `'paused'`, poi sempre `render()`.
- Avvio: `loadLevel(0); fit(); refreshTitle(); refreshSoundBtn(); updateHud(); drawLegend();`, poi un primo `requestAnimationFrame` che inizializza `last`.
- Il movimento del pallone è suddiviso in **sotto-passi**: `steps = ceil(velocità × dt / 4)`, cioè al massimo 4 unità logiche per passo, così il pallone non attraversa i mattoncini.
- Le pause tra le schermate usano `setTimeout` (900 ms o 1900 ms dopo il livello completato).
- `visibilitychange`: se la pagina va in secondo piano durante `'play'`, chiama `togglePause()`.

## Funzioni principali

**Costruzione livelli**
- `loadLevel(i)` – imposta `L`, `COLS`, `BW`, `BH`, `BALL_R`, crea `bricks` e `cells` dalla mappa, azzera timer, capsule e particelle, chiama `buildReveal()` e `resetBall()`.
- `buildReveal()` – disegna il logo su un canvas fuori schermo (`revealLayer`, a 3×) grande quanto il muro.
- `resetBall()` – rimette il delfino al centro con la larghezza del livello e un pallone fermo sul muso; azzera `speedMul`, `bigTimer`, `slowTimer`, capsule.

**Fisica e movimento**
- `update(dt)` – aggiornamento di un fotogramma (vedi stati).
- `stepBall(b, h)` – un sotto-passo: pareti, mattoncini (prima asse x poi y), rimbalzo sul delfino, rete, caduta in acqua.
- `launch()` – lancia i palloni fermi verso il lato in cui guarda il delfino (angolo 0,25–0,75 rad).
- `ballSpeed()` – `L.speed × speedMul × (0,68 se T attivo)`.
- `retimeBalls()` – riporta tutti i palloni in volo alla velocità `ballSpeed()`.
- `rad(b)`, `growBall(b, dt)`, `ballFits(b, r)` – raggio attuale, crescita graduale col potere T, controllo che il pallone grande ci stia.

**Collisioni**
- `hitBricks(b, axis)` – urto cerchio/rettangolo sull'asse indicato, rimbalzo, correzione delle traiettorie quasi orizzontali (componente verticale almeno 30%), chiama `damage()`.
- `damage(br, smash)` – toglie un colpo (o tutti se `smash`, cioè pallone grande), assegna punti, rimuove il mattoncino, apre la cella del logo, decide la capsula, chiama `levelCleared()` se `breakable` arriva a 0.

**Bonus / capsule**
- `dropCapsule(x, y)` – sceglie a caso il tipo di capsula e la aggiunge a `caps`.
- `applyPower(k)` – applica l'effetto (`C`, `S`, `V`, `T`, `L`) e aggiunge 100 punti.

**Punteggio e flusso**
- `loseBall()` – toglie una vita; se finite `gameOver()`, altrimenti `resetBall()`.
- `levelCleared()` – gestisce gara, record, `reached`, poi mostra `ov-clear` o chiama `win()`.
- `gameOver()`, `win()` – schermate finali e salvataggio record.
- `showLevelCard(i)`, `startGame(from)`, `toMenu()`, `togglePause()`, `refreshTitle()` – flusso tra le schermate.
- `fmt(s)` – formatta i secondi come `m:ss`.

**Animazione iniziale**
- `playIntro()`, `updateIntro(dt)`, `renderIntro()`, `endIntro()` – il delfino salta, lancia il pallone, il logo si rompe (durata 4,2 s).
- `shatterLogo(hx, hy)`, `logoH()` – trasforma il logo in particelle quadrate da 5 px leggendo i pixel con `getImageData`.

**Rendering**
- `fit()` – calcola `scale` e `dpr` (max 2,5) e ridimensiona il canvas; chiamata su `resize` e `orientationchange`.
- `render()` – disegna il fotogramma: mare, logo scoperto, mattoncini, capsule, delfino, palloni con alone, particelle, timer dei poteri, ora, messaggi.
- `drawSea()`, `drawReveal()`, `drawEndReveal()`, `drawBrick(br)`, `drawBeachBall(x, y, r, spin)`, `drawDolphin(x, y, w, face, rot, nod)`, `drawCapsule(c)`, `drawParts()`, `roundRect(...)`.
- `burst(...)`, `splash(x)`, `toast(text, color)`, `updateParts(dt)` – particelle e messaggi brevi.

**Input**
- `onDown(e)`, `onMove(e)`, `onUp()` – puntatore su campo e fascia.
- `fieldX(clientX)` – converte la x dello schermo in x logica del campo.
- `updateKeyDir()` – ricalcola `keyDir` dai tasti premuti.

**Audio**
- `beep(freq, dur, type, vol, slide)` – un suono con oscillatore e inviluppo.
- `sfx.{brick, hard, steel, dolphin, wall, power, lost, clear, start, splash}` – effetti del gioco.
- `refreshSoundBtn()` – aggiorna il pulsante `♪` / `×`.

**UI / overlay**
- `showOnly(o)`, `updateHud()`, `drawLegend()`.

**Gara**
- `efgPost(m)`, `efgEnd(ok, reason)`.

## Dati dei livelli

I livelli sono nell'array `LEVELS` all'inizio di `game.js`. Ogni elemento ha:

| Campo | Significato |
|---|---|
| `clock`, `name`, `text` | Ora, nome e frase del livello |
| `speed` | Velocità base del pallone (unità logiche/s) |
| `dw` | Larghezza del delfino |
| `bh` | Altezza dei mattoncini |
| `r` | Raggio del pallone (`BALL_R`) |
| `map` | Righe di caratteri, una lettera per mattoncino (`.` = vuoto) |
| `revealAtEnd` | Se `true`, il logo compare solo a livello finito |

| Liv. | `clock` | `name` | Griglia | `speed` | `dw` | `bh` | `r` | `revealAtEnd` |
|---|---|---|---|---|---|---|---|---|
| 1 | 08:00 | Apertura | 4 × 3 | 430 | 98 | 50 | 12,5 | – |
| 2 | 10:30 | Riunione | 5 × 4 | 365 | 92 | 37,5 | 11 | – |
| 3 | 13:00 | Pausa pranzo | 6 × 5 | 395 | 86 | 30 | 9,5 | – |
| 4 | 16:00 | Scadenza | 7 × 6 | 435 | 80 | 25 | 8 | sì |
| 5 | 18:00 | Chiusura | 8 × 7 | 470 | 74 | 21,43 | 7 | sì |

- La larghezza dei mattoncini è calcolata: `BW = (W − 2·BX0) / colonne`. Il muro è sempre alto circa 150 (righe × `bh`).
- I tipi di mattoncino sono nell'oggetto `BRICK`:

| Lettera | `hp` | `pts` | Colore | Usato nelle mappe |
|---|---|---|---|---|
| `a` | 1 | 50 | `TN_LIGHT` `#46a0d2` | sì |
| `b` | 1 | 50 | `TN_DARK` `#195087` | sì |
| `g` | 2 | 100 | `TN_MID` `#2d74a8` | sì |
| `h` | 3 | 150 | `#123a66` | no |
| `x` | `Infinity` (acciaio) | 0 | `#8a9bb0` | no |
| `o` | 1 | 200, lascia sempre una capsula | `SUN` `#ffcf4a` | sì |

- Le capsule sono nell'oggetto `POWERS` (chiave interna → etichetta): `C` CONNESSI, `S` SICURI, `V` SODDISFATTI (disegnata con `✓`), `T` TEMPO, `L` +1 PALLONE (disegnata con `+`).

## Costanti di gioco

| Costante / valore | Dove | Valore | Effetto |
|---|---|---|---|
| `W`, `H` | costanti | 360 × 600 | Campo logico |
| `WATER_Y` | costanti | 512 | Superficie del mare |
| `DOLPHIN_TOP` | costanti | 494 | Quota del rimbalzo sul delfino |
| `BX0`, `BY0` | costanti | 12, 28 | Angolo in alto a sinistra del muro |
| `HUD_Y` | costanti | 14 | Riga dei timer e dell'ora nel canvas |
| `BIG_BALL` | costanti | 1,7 | Moltiplicatore del raggio con T |
| Vite iniziali | `startGame`, `btnStart` | 3 | |
| Vite massime | `applyPower('L')` | 6 (gara: 3) | |
| Velocità delfino da tastiera | `update` | 440 /s | |
| Inseguimento del dito | `update` | fattore `dt × 18` | Leggero ritardo nel trascinamento |
| Delfino grande | `applyPower('V')` | ×1,4 per 15 s | |
| Pallone lento | `applyPower('T')`, `ballSpeed` | ×0,68 per 10 s | |
| Accelerazione rimbalzi | `stepBall` | ×1,015 a rimbalzo, max 1,3 | |
| Angolo massimo sul delfino | `stepBall` | 1,05 rad (circa 60°) | |
| Quota della rete | `stepBall` | `H − 18` | |
| Componente verticale minima | `hitBricks` | 30% della velocità | |
| Caduta capsule | `update` | 130 /s | |
| Probabilità capsula | `damage` | 9% (sempre per `o`) | |
| Tipi capsula | `dropCapsule` | `L` 5%, `C` 27%, `S` 24%, `V` 24%, `T` 20% | |
| Punti colpo su mattoncino che resiste | `damage` | 10 | |
| Punti capsula | `applyPower` | 100 | |
| Pallone grande che sfonda | `hitBricks` | se raggio > `BALL_R × 1,3` | Rompe il mattoncino al primo colpo |
| Fattore della fascia | `onMove` | 1,3 | Spostamento del dito × 1,3 |
| Attesa prima di "Livello completato" | `levelCleared` | 900 ms (1900 ms con `revealAtEnd`) | |

Chiavi di `localStorage` (tramite l'oggetto `store`, valori in JSON): `timenetBreakBest` (record), `timenetBreakReached` (livello per "Continua"), `timenetBreakSound` (audio).

## Integrazione con l'app

Il protocollo è descritto in [giochi-comune.md](../specifiche/giochi-comune.md#lato-gioco-del-protocollo) e in [app-giocatori.md](../specifiche/app-giocatori.md#protocollo-postmessage-gioco--app). Qui solo il lato codice.

```js
const EFG = { on, max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m)   // postMessage({type:'efg', ...m}, '*') al parent, solo se in iframe
function efgEnd(ok, reason)
```

- `EFG.on` è vero se l'URL contiene `hub=1` (regex `/[?&]hub=1\b/`).
- `EFG.max = 3` livelli, `EFG.limit = 60` secondi per livello.
- In gara `showLevelCard()` rimette `lives = 3` a ogni livello; la capsula `L` non supera 3; il pulsante Continua viene nascosto in `refreshTitle()`.

| `ev` | Quando (nel codice) | Campi |
|---|---|---|
| `start` | `showLevelCard(0)` in gara: azzera `used`, `times`, `livesAt`, `done` | – |
| `tick` | In `update()` ogni 0,25 s nello stato `'play'`; uno in più in `levelCleared()` | `level`, `max`, `t` (secondi nel livello), `used` |
| `result` | `efgEnd()`, una sola volta (`EFG.done`) | `ok`, `reason` (`''`, `'time'`, `'lives'`), `level`, `max`, `used`, `times`, `lives` (copia di `livesAt`), `seconds` |

- **Livello superato** (`levelCleared`): `used += levelTime`, `times.push(levelTime)`, `livesAt.push(lives)`; al livello 3 `efgEnd(true)` e nessuna schermata del gioco.
- **Tempo scaduto**: `levelTime >= 60` → `efgEnd(false, 'time')`, che mette `state = 'over'` senza mostrare overlay.
- **Vite finite**: `gameOver()` → `efgEnd(false, 'lives')`, poi l'overlay GAME OVER.
- `seconds = used + (ok ? 0 : levelTime)`.
- Il gioco non ascolta messaggi dall'app.

## Input

| Azione | Tastiera | Touch / mouse | Codice |
|---|---|---|---|
| Muovi | ← → / A D | Trascinare su `#strip` (come un touchpad) o sul campo | `keydown`/`keyup` → `updateKeyDir()`; `onDown`/`onMove` → `targetX` |
| Lancia | Spazio | Tocco senza spostamento (meno di 8 px) | `launch()`, chiamato da `keydown` o da `onUp()` |
| Pausa | P, Esc | `#pauseBtn` | `togglePause()` |
| Avanti | Invio | Pulsanti degli overlay | `keydown`: clic su `btnStart`, `btnGo` o `btnNext` se visibili |
| Salta animazione | Qualsiasi tasto | Qualsiasi tocco | `endIntro()` |
| Audio | – | `#soundBtn` | Inverte `audioOn` e lo salva |

- Gli eventi `pointerdown` sono su `#stage` e su `#controls`; `pointermove`, `pointerup`, `pointercancel` su `window`.
- `drag = { sx, sy, moved, startDolphin, strip }` segue un solo puntatore. Sulla fascia: `targetX = startDolphin + Δx / larghezzaCanvas × W × 1,3`. Sul campo: `targetX = fieldX(clientX)`.
- Col mouse, senza clic, il delfino segue il puntatore.
- I tocchi sugli overlay vengono ignorati (`e.target.closest('.overlay')`).
- I tasti freccia, Spazio, A e D hanno `preventDefault()` per non far scorrere la pagina.
- In verticale `gameboy.js` sposta `#pauseBtn` nel tasto A e `#soundBtn` nel tasto B; i tastini ISTRUZIONI e AVVIA/PAUSA premono `btnHow`, il pulsante principale visibile o la pausa.

## Come modificare

Dopo ogni modifica ricordarsi di aumentare la versione dell'app (cache del service worker `sw.js`), per esempio con la skill `efuture-games-commit`.

**Cambiare la difficoltà**
- Velocità del pallone, larghezza del delfino e raggio del pallone: campi `speed`, `dw`, `r` del livello in `LEVELS`.
- Accelerazione a ogni rimbalzo: `speedMul * 1.015` e il tetto `1.3` in `stepBall()`.
- Frequenza delle capsule: `Math.random() < 0.09` in `damage()`; distribuzione dei tipi in `dropCapsule()`.
- Durata dei poteri: `bigTimer = 15` e `slowTimer = 10` in `applyPower()`.
- Vite iniziali: `lives = 3` in `startGame()`, `btnStart`, `btnRetry`, `btnAgain` e `showLevelCard()` (gara). Vite massime: `applyPower('L')`.
- Limiti di gara: `EFG.max` e `EFG.limit`. Attenzione: l'app calcola il punteggio su 3 livelli da 60 s, quindi va cambiata insieme (vedi [app-giocatori.md](../specifiche/app-giocatori.md)).

**Aggiungere un livello**
1. Aggiungere un oggetto in `LEVELS` con `clock`, `name`, `text`, `speed`, `dw`, `bh`, `r`, `map` (ed eventualmente `revealAtEnd: true`). Tutte le righe di `map` devono avere la stessa lunghezza; per non coprire meno del logo, tenere righe × `bh` ≈ 150.
2. Il totale dei livelli è scritto a mano in due punti: `'/' + (EFG.on ? EFG.max : 5)` in `showLevelCard()` e in `gameOver()`. Sostituire `5` con `LEVELS.length`.
3. Aggiornare il testo "5 livelli, dalle 08:00 alle 18:00." nel `#howBox` di `index.html` e la `meta description`.
4. `win()` scatta dopo l'ultimo elemento di `LEVELS` (`lvIndex === LEVELS.length-1`), quindi non serve altro.

**Aggiungere un tipo di mattoncino**
- Nuova lettera in `BRICK` con `hp`, `pts`, `color`; se serve un aspetto speciale, aggiungerlo in `drawBrick()`.

**Cambiare una grafica**
- Logo: sostituire `img/timenet-logo.png` (letto da `#logoImg`). Le proporzioni vengono lette dall'immagine (`naturalWidth/naturalHeight`).
- Delfino: sostituire `img/delfino.png`. Deve guardare a sinistra (il codice lo specchia con `ctx.scale(-face, 1)`). Dimensione e posizione in `drawDolphin()` (`dw = w*0.92`, ancoraggio `-dh*0.42`).
- Pallone: colori degli spicchi in `drawBeachBall()` (e in `drawLegend()` per l'icona).
- Mare e cielo: `drawSea()`. Colori del marchio: `TN_DARK`, `TN_LIGHT`, `TN_MID`, `SUN` in `game.js` e le variabili `--tn-*` nel CSS.
- Icone e titolo dell'app: cartella `icons/` e meta in `index.html`.

**Cambiare un testo**
- Nomi e frasi dei livelli: `LEVELS`. Etichette delle capsule: `POWERS`. Testi delle schermate: `index.html`. Testi sul campo (`'Tocca per lanciare'`, `'Salvato!'`, `'TOCCA PER SALTARE'`, `'BREAKOUT'`): `game.js`.

## Limiti noti

- La scheda del livello (`#ov-level`) non compare mai: `showLevelCard()` chiama subito `btnGo.onclick()`. La specifica funzionale la descrive ancora con il pulsante **Via!**.
- Il numero di livelli `5` è scritto a mano in `showLevelCard()` e `gameOver()`.
- `dt` è limitato a 1/30 s: su dispositivi lenti il gioco rallenta (anche il tempo di gara scorre più piano del tempo reale).
- Il tempo di gara scorre anche mentre il pallone aspetta il lancio sul delfino.
- Se `delfino.png` non si carica, il delfino è disegnato in vettoriale; se il logo non si carica, il pannello dietro il muro resta vuoto e l'animazione iniziale non ha i frammenti.
- `shatterLogo()` usa `getImageData`: se il canvas risulta "sporcato" (pagina aperta da `file://` in alcuni browser) i frammenti non compaiono.
- I mattoncini `h` e `x` esistono nel codice ma non sono usati nelle mappe; con un mattoncino `x` il livello resta finibile perché `breakable` non lo conta.
- `window.efgReport` in `index.html` è codice non usato.
- Il campo `hop` di `dolphin` non è usato.

---
Ultimo aggiornamento: 2026-10-09 (v37)
