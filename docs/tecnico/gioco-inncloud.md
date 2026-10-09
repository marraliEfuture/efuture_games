# Inncloud Invaders – documentazione tecnica

Questo documento spiega **come è fatto il codice** di Inncloud Invaders. Le regole del gioco, le schermate e i testi sono nella specifica funzionale [gioco-inncloud.md](../specifiche/gioco-inncloud.md); le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](../specifiche/giochi-comune.md).

## File e risorse

| Percorso | Contenuto |
|---|---|
| `games/inncloud/index.html` | Pagina: meta, CSS inline (variabili colore in `:root`), HUD, canvas, overlay, fascia di trascinamento, tasto SPARA, piccoli script inline |
| `games/inncloud/game.js` | Tutta la logica del gioco (circa 705 righe), in una IIFE |
| `games/inncloud/img/inncloud-logo.png` | Logo 720 × 138. Usato nell'overlay titolo (`#logoImg`), nell'animazione iniziale e come filigrana nel cielo |
| `games/inncloud/img/efuture-white.png` | Presente ma non usato dal gioco |
| `games/inncloud/fonts/` | Press Start 2P e IBM Plex Mono (400, 600) in `woff2`, con le licenze. Dichiarati con `@font-face` nel CSS |
| `games/inncloud/icons/` | `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |
| `games/gameboy.css` | Scocca "Game Boy" in verticale, caricata con `<link rel="stylesheet" href="../gameboy.css">` |
| `games/gameboy.js` | Script della scocca, caricato prima di `game.js` con `data-game="strip"` |

Non ci sono file audio (suoni sintetizzati con Web Audio) né librerie esterne. Attaccanti, drone e boss sono sprite a pixel scritti come stringhe dentro `game.js`.

Ordine degli script in fondo a `index.html`:
1. `../gameboy.js` con `data-a="fireBtn"`, `data-b="soundBtn"`, `data-select="btnHow"`, `data-pause="pauseBtn"`, `data-paused="ov-pause"`, `data-primary=".overlay button.btn:not(.alt)"`;
2. script inline che definisce `window.efgReport` (messaggio `efg-score`, oggi non usato da nessuno);
3. `game.js`;
4. script inline che apre e chiude il riquadro Istruzioni (`btnHow` ↔ `howBox`).

## Struttura della pagina

```
#app
├─ #hud            Punti (#score) · Vite (#lives) · #levelName · #soundBtn · #pauseBtn
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
      ├─ #strip    fascia "Trascina per muoverti · SPARA per colpire" (la parte .fire-hint si nasconde in verticale)
      └─ button#fireBtn   tasto rotondo rosso SPARA
```

- Le **icone della legenda** nelle istruzioni sono tre canvas (`#lgShot`, `#lgBug`, `#lgWall`) disegnati da `drawLegend()`.
- Le **vite** sono `<span class="life">` (nuvoletta con il pallino rosso fatto in CSS) creati da `updateHud()`.
- **Layout del tasto SPARA** (CSS in `index.html`):
  - normale: `#controls` in riga, `#strip` si allarga, `#fireBtn` 80 px a destra;
  - orizzontale basso (`max-height:560px`): `#controls` diventa `display:contents`, la fascia va a sinistra del campo (120 px) e SPARA (88 px) a destra;
  - verticale con scocca (`html[data-gb=strip]`): SPARA prende il posto del tasto A (76 px, classe `gb-a`) e `#soundBtn` diventa il tasto B.

## Architettura dello script

### IIFE e stato globale

`game.js` è un'unica funzione anonima autoeseguita, in `"use strict"`. Nulla viene esposto su `window`.

| Variabile | Significato |
|---|---|
| `EFG` | Stato della modalità gara (vedi [Integrazione con l'app](#integrazione-con-lapp)) |
| `state`, `prevState` | Stato corrente e stato da cui si è entrati in pausa |
| `lvIndex`, `L` | Indice del livello (0–4) e oggetto `LEVELS[lvIndex]` |
| `score`, `levelStartScore`, `lives`, `levelKills`, `levelTime` | Punti, punti a inizio livello (per "Riprova"), vite, abbattuti, secondi nel livello |
| `ship` | `{ x, inv, fireCd, fireMax, dead }`: posizione, invulnerabilità, ricarica, durata della ricarica, attesa dopo un colpo subito |
| `shots`, `ebul`, `parts`, `toasts` | Colpi del giocatore, codici nemici, particelle, messaggi |
| `foes`, `total` | Attaccanti (`{ t, x, y, alive, c }`, posizione relativa alla formazione) e numero iniziale |
| `fx`, `fy`, `fdir` | Spostamento della formazione e verso di marcia (1/-1) |
| `frame`, `frameT`, `fireT` | Fotogramma degli sprite, timer dell'animazione, timer del prossimo colpo nemico |
| `drone`, `droneT`, `doubleT` | Drone bonus, attesa prima della sua comparsa, durata del doppio colpo |
| `walls` | Quadratini delle nuvolette-firewall (`{ x, y, s, dead }`) |
| `boss` | `{ x, y, vx, hp, max, t, shotT, flash }` solo nel livello 5, altrimenti `null` |
| `targetX`, `keyDir` | Bersaglio del trascinamento e direzione da tastiera |
| `drag`, `firePtrs`, `fireQ`, `mouseFire`, `keys` | Stato dell'input (vedi [Input](#input)) |
| `clock`, `scale`, `dpr`, `intro`, `skyLogo` | Tempo totale, scala, densità pixel, animazione iniziale, filigrana del logo |
| `best`, `reached`, `audioOn` | Record, livello raggiunto e audio, letti da `localStorage` |

### Macchina a stati

| `state` | Quando | Cosa aggiorna `update()` |
|---|---|---|
| `'title'` | Avvio e `toMenu()` | Solo particelle. `render()` disegna cielo e nuvola |
| `'intro'` | Dopo Inizia / Gioca ancora (`playIntro()`) | `updateIntro()` |
| `'levelcard'` | `showLevelCard()`: mostra `#ov-level` | Solo particelle |
| `'play'` | Dopo **Via!** (`btnGo`) | Tutto: tempo, gara, nuvola, formazione, boss, drone, colpi |
| `'paused'` | `togglePause()` da `'play'` | Niente: il loop salta `update()` |
| `'clear'` | `levelCleared()` | Solo particelle |
| `'over'` | `gameOver()` o `efgEnd(false, …)` | Solo particelle |
| `'win'` | `win()` dopo il boss | Solo particelle |

Gli overlay si mostrano con `showOnly(o)`, che nasconde tutti gli altri.

### Game loop e timing

- `loop(ts)` è chiamato da `requestAnimationFrame`: calcola `dt` in secondi, lo limita a `1/30`, chiama `update(dt)` se lo stato non è `'paused'`, poi `render()`.
- Avvio: `loadLevel(0); fit(); refreshTitle(); refreshSoundBtn(); updateHud(); drawLegend();`.
- Non ci sono sotto-passi: colpi e codici si spostano di `velocità × dt` e le collisioni sono tra rettangoli (`hit(a, b)`).
- La pausa prima di "Livello superato" è un `setTimeout` di 1100 ms.
- `visibilitychange`: se la pagina va in secondo piano durante `'play'`, chiama `togglePause()`.

## Funzioni principali

**Costruzione livelli**
- `loadLevel(i)` – calcola `GAP_X`, crea `foes` centrati (prima fila a `TOP_Y` o `BOSS_TOP_Y`), azzera formazione, colpi, drone e doppio colpo, crea il boss se `L.boss`, chiama `buildWalls()`, rimette la nuvola al centro (invulnerabile 1,2 s, primo colpo dopo 0,25 s).
- `buildWalls()` – crea le 4 nuvolette-firewall da una forma 12 × 6 a quadratini di 4 px, a y = 468.

**Movimento e giocatore**
- `update(dt)` – aggiornamento di un fotogramma: tempo e gara, nuvola, sparo, formazione, fuoco nemico, boss, drone, colpi, codici, fine livello.
- `fireHeld()` – vero se SPARA, il tasto del mouse o Spazio/↑/Z sono tenuti premuti.
- `pressFire()` – ricorda un tocco di SPARA per 0,25 s (`fireQ`), così parte appena finisce la ricarica.

**Nemici / IA**
- `aliveFoes()`, `foeBox(f)` – attaccanti vivi e loro rettangolo reale (`x + fx`, `y + fy`).
- In `update()`: la formazione marcia, inverte e scende di 12 ai bordi, accelera con meno attaccanti e più discesa; il fuoco sceglie il più basso di ogni colonna e nel 55% dei casi quello più vicino alla nuvola.
- Boss (in `update()`): rimbalza tra x = 60 e x = 300, spara a ventaglio 3 o 5 codici.
- Drone (in `update()`): compare da un lato a y = 16, attraversa a 70 /s; non compare se `boss` esiste.

**Collisioni**
- `hit(a, b)` – sovrapposizione di due rettangoli `{x, y, w, h}`. Usata per colpi/attaccanti, colpi/drone, colpi/boss, codici/nuvolette, codici/nuvola, attaccanti/nuvolette.
- Un colpo del giocatore e un codice nemico si annullano se sono a meno di 6 px in x e 8 px in y.

**Bonus**
- Drone colpito (in `update()`): punti casuali 100/150/200/300, `doubleT = 10`.

**Punteggio e flusso**
- `killFoe(f)` – abbatte un attaccante e assegna i punti del suo tipo.
- `killShip()` – toglie una vita, esplosione, `ship.dead = 1,4`, cancella i codici in volo.
- `levelCleared()`, `gameOver()`, `win()` – fine livello, partita persa, vittoria; salvano record e `reached`.
- `showLevelCard(i)`, `startGame(from)`, `toMenu()`, `togglePause()`, `refreshTitle()`, `fmt(s)`.

**Animazione iniziale**
- `playIntro()`, `updateIntro(dt)`, `renderIntro()`, `endIntro()`, `easeOut(t)` – l'hacker scende, il pallino della "i" lo abbatte, il logo scivola e diventa la nuvola (4,3 s). Le coordinate del pallino nel logo sono nell'oggetto `LOGO`.

**Rendering**
- `fit()` – calcola `scale` e `dpr` (max 2,5) e ridimensiona il canvas.
- `render()` – cielo, linea di terra, nuvolette, attaccanti, boss, drone, codici, colpi, nuvola (lampeggia se invulnerabile), particelle, `x2 N`, messaggi.
- `drawSky()`, `drawCloudShape(...)`, `buildSkyLogo()`, `logoClarity()`, `drawSkyLogo()` – cielo con nuvole in parallasse e filigrana del logo più nitida man mano che cadono gli attaccanti.
- `drawSprite(S, fr, x, y, override)`, `drawShip(x, y, a, dotK)`, `drawShot(x, y, r)`, `drawBoss()`, `drawParts()`, `roundRect(...)`.
- `burst(...)`, `toast(...)`, `updateParts(dt)` – particelle e messaggi.

**Input**
- `onDown(e)`, `onMove(e)`, `onUp(e)`, `fieldX(clientX)`, `updateKeyDir()`, gestori di `#fireBtn`.

**Audio**
- `beep(freq, dur, type, vol, slide)` e `sfx.{shoot, kill, march, hit, drone, boss, clear, start}`. `march()` suona a turno 4 note (`marchStep`).
- `refreshSoundBtn()`.

**UI / overlay**
- `showOnly(o)`, `updateHud()`, `drawLegend()`.

**Gara**
- `efgPost(m)`, `efgEnd(ok, reason)`.

## Dati dei livelli

I livelli sono nell'array `LEVELS` di `game.js`:

| Campo | Significato |
|---|---|
| `name`, `text` | Nome e frase del livello |
| `rows` | Tipi di attaccante per fila, dall'alto (`'K'`, `'V'`, `'B'`) |
| `cols` | Attaccanti per fila |
| `speed` | Velocità base della formazione (unità/s) |
| `fire` | Moltiplicatore del fuoco nemico: un colpo ogni `(0,7 + rand × 0,8) / fire` s |
| `bspeed` | Velocità dei codici nemici (unità/s) |
| `boss` | `true` solo nel livello 5 |

| Liv. | `name` | `rows` | `cols` | Attaccanti | `speed` | `fire` | `bspeed` | `boss` |
|---|---|---|---|---|---|---|---|---|
| 1 | Login sospetto | K V B | 8 | 24 | 16 | 0,55 | 170 | – |
| 2 | Phishing | K V V B | 8 | 32 | 20 | 0,85 | 185 | – |
| 3 | Malware | K V V B B | 8 | 40 | 24 | 1,15 | 200 | – |
| 4 | Botnet | K K V V B B | 8 | 48 | 23 | 1,3 | 210 | – |
| 5 | Ransomware | V B | 7 | 14 | 22 | 1,1 | 220 | sì |

Gli attaccanti sono nell'oggetto `SPRITES`: ogni tipo ha `color`, `pts` e due fotogrammi 11 × 9 (caratteri `X` corpo, `W` bianco, `G` verde, `R` dettaglio scuro, `.` vuoto).

| Tipo | Chi | `color` | `pts` |
|---|---|---|---|
| `B` | Bug | `HACK` `#13a04a` | 10 |
| `V` | Virus | `#7b47d6` | 20 |
| `K` | Hacker | `#4f6478` | 30 |

Il drone è lo sprite `DRONE` (11 × 5); il teschio del boss è disegnato in `drawBoss()`.

## Costanti di gioco

| Costante / valore | Dove | Valore | Effetto |
|---|---|---|---|
| `W`, `H` | costanti | 360 × 600 | Campo logico |
| `SHIP_Y` | costanti | 548 | Quota della nuvola |
| `TOP_Y`, `BOSS_TOP_Y` | costanti | 34, 116 | Prima fila della formazione (normale / livello boss) |
| `FIRE_CD`, `FIRE_CD_X2` | costanti | 0,3 s, 0,18 s | Ricarica minima tra due colpi (normale / doppio colpo) |
| `PX` | costanti | 3 | Lato di un pixel degli sprite (sprite 33 × 27) |
| `DOT_R` | stato | 4,5 | Raggio dei colpi del giocatore |
| `GAP_Y` / `GAP_X` | stato | 10 / da 2 a 6 | Spazio tra file / tra colonne (calcolato per lasciare 60 px di marcia) |
| Vite iniziali | `startGame`, `btnStart`, `showLevelCard` (gara) | 3 | |
| Velocità nuvola da tastiera | `update` | 260 /s | |
| Inseguimento del dito | `update` | fattore `dt × 16` | |
| Limiti della nuvola | `update` | x tra 24 e 336 | |
| Velocità colpi | `update` | 520 /s | |
| Colpi in volo | `update` | 3 (doppio colpo: 6) | |
| Memoria del tocco | `pressFire` | 0,25 s | |
| Accelerazione formazione | `update` | `speed × (1 + 2,4 × (1 − rimasti/totale)) × (1 + min(0,5, fy/400))` | Fino a ×3,4 e +50% |
| Discesa ai bordi | `update` | 12 | Bordi a x = 6 e x = 354 |
| Fine partita per invasione | `update` | fondo formazione ≥ `SHIP_Y − 18` | Vite a 0, poi game over |
| Mira del fuoco nemico | `update` | 55% sul più vicino | |
| Drone | `loadLevel`, `update` | prima comparsa 7–12 s, poi 12–20 s (14 s dopo essere stato colpito), velocità 70 /s | |
| Doppio colpo | `update` | 10 s | |
| Boss | `loadLevel` | 20 vite, `vx` 55, centro a y = 62 | |
| Fuoco del boss | `update` | 3 codici ogni 1,8 s; sotto metà vita 5 ogni 1,25 s; ventaglio 0,28 rad | |
| Punti boss | `update` | 25 a colpo, 2000 alla sconfitta | |
| Colpito | `killShip`, `update` | attesa 1,4 s, poi invulnerabile 1,8 s | |
| Nuvolette | `buildWalls` | 4, quadratini da 4 px, y = 468 | |
| Fattore della fascia | `onMove` | 1,3 | |
| Attesa prima di "Livello superato" | `levelCleared` | 1100 ms | |

Chiavi di `localStorage` (oggetto `store`, valori in JSON): `inncloudInvBest` (record), `inncloudInvReached` (livello per "Continua"), `inncloudInvSound` (audio).

## Integrazione con l'app

Il protocollo è descritto in [giochi-comune.md](../specifiche/giochi-comune.md#lato-gioco-del-protocollo) e in [app-giocatori.md](../specifiche/app-giocatori.md#protocollo-postmessage-gioco--app). Il codice è identico a quello di Timenet.

```js
const EFG = { on, max:3, limit:60, used:0, times:[], livesAt:[], tickT:0, done:false };
function efgPost(m)   // postMessage({type:'efg', ...m}, '*') al parent, solo se in iframe
function efgEnd(ok, reason)
```

- `EFG.on` è vero se l'URL contiene `hub=1`. `EFG.max = 3` livelli (quindi il boss non si gioca), `EFG.limit = 60` secondi per livello.
- In gara `showLevelCard()` rimette `lives = 3` a ogni livello e `refreshTitle()` nasconde Continua.

| `ev` | Quando (nel codice) | Campi |
|---|---|---|
| `start` | `showLevelCard(0)` in gara: azzera `used`, `times`, `livesAt`, `done` | – |
| `tick` | In `update()` ogni 0,25 s nello stato `'play'`; uno in più in `levelCleared()` | `level`, `max`, `t`, `used` |
| `result` | `efgEnd()`, una sola volta (`EFG.done`) | `ok`, `reason` (`''`, `'time'`, `'lives'`), `level`, `max`, `used`, `times`, `lives` (copia di `livesAt`), `seconds` |

- **Livello superato**: `used += levelTime`, `times.push(levelTime)`, `livesAt.push(lives)`; al livello 3 `efgEnd(true)` e nessuna schermata del gioco.
- **Tempo scaduto**: `efgEnd(false, 'time')` mette `state = 'over'` senza overlay.
- **Vite finite** (anche per invasione): dopo l'attesa di 1,4 s `gameOver()` → `efgEnd(false, 'lives')`, poi GAME OVER.
- `seconds = used + (ok ? 0 : levelTime)`.

## Input

| Azione | Tastiera | Touch / mouse | Codice |
|---|---|---|---|
| Muovi | ← → / A D | Trascinare su `#strip` o sul campo; col mouse la nuvola segue il puntatore | `updateKeyDir()`, `onDown`/`onMove` → `targetX` |
| Spara | Spazio, ↑, Z (tenuti = raffica) | `#fireBtn` (tocco o tenuto premuto); tasto sinistro del mouse sul campo | `pressFire()`, `fireHeld()` |
| Pausa | P, Esc | `#pauseBtn` | `togglePause()` |
| Avanti | Invio | Pulsanti degli overlay | `keydown`: clic su `btnStart`, `btnGo` o `btnNext` se visibili |
| Salta animazione | Qualsiasi tasto | Qualsiasi tocco (anche su SPARA) | `endIntro()` |
| Audio | – | `#soundBtn` | Inverte `audioOn` e lo salva |

- **Sparo:** `update()` spara se `fireHeld()` o `fireQ > 0`, la ricarica è finita e i colpi in volo sono meno del massimo. Il primo `keydown` di Spazio/↑/Z chiama `pressFire()`; tenendo premuto spara `fireHeld()`.
- **Multi-touch:** `drag = { id, sx, start, strip }` segue un solo puntatore per il movimento (gli altri vengono ignorati); `firePtrs` (un `Set` di `pointerId`) tiene i diti su SPARA. Così si può trascinare e sparare insieme.
- **`#fireBtn`:** `pointerdown` con `stopPropagation()` e `preventDefault()` (non avvia il trascinamento), aggiunge la classe `down`; `lostpointercapture` e `pointerup` la tolgono; menu contestuale bloccato; Invio sul pulsante chiama `pressFire()`.
- **Mouse:** il tasto sinistro sul campo imposta `mouseFire` e non avvia trascinamenti; il movimento senza clic sposta la nuvola.
- I tasti di gioco hanno `preventDefault()`; i tocchi sugli overlay vengono ignorati.
- In verticale `gameboy.js` sposta `#fireBtn` nel tasto A e `#soundBtn` nel tasto B.

## Come modificare

Dopo ogni modifica ricordarsi di aumentare la versione dell'app (cache del service worker `sw.js`), per esempio con la skill `efuture-games-commit`.

**Cambiare la difficoltà**
- Per livello: `speed`, `fire`, `bspeed`, `rows`, `cols` in `LEVELS`.
- Ritmo di sparo del giocatore: `FIRE_CD`, `FIRE_CD_X2` e il limite dei colpi in volo (`maxShots` in `update()`).
- Accelerazione della formazione: la formula di `speed` in `update()` (i numeri `2.4`, `0.5`, `400`) e la discesa `fy += 12`.
- Precisione del fuoco nemico: `Math.random() < 0.55` in `update()`.
- Boss: `hp:20` e `vx:55` in `loadLevel()`; cadenza e numero di codici nel blocco `// boss` di `update()`.
- Invulnerabilità: `ship.inv = 1.8` (dopo un colpo) e `inv:1.2` in `loadLevel()`.
- Limiti di gara: `EFG.max` e `EFG.limit`, da cambiare solo insieme al calcolo del punteggio nell'app (vedi [app-giocatori.md](../specifiche/app-giocatori.md)).

**Aggiungere un livello**
1. Aggiungere un oggetto in `LEVELS` con `name`, `text`, `rows`, `cols`, `speed`, `fire`, `bspeed` (ed eventualmente `boss: true`). Con molte file la formazione parte più vicina alle nuvolette: ogni fila occupa 37 unità (27 + `GAP_Y`).
2. Il totale `5` è scritto a mano in `showLevelCard()`, `gameOver()` e `updateHud()`: sostituirlo con `LEVELS.length`.
3. Aggiornare "5 livelli, boss finale." nel `#howBox` di `index.html` e la `meta description`.
4. `win()` scatta dopo l'ultimo elemento di `LEVELS`. Se il boss non è più l'ultimo livello, rivedere i testi di `#ov-win`.

**Aggiungere un tipo di attaccante**
- Nuova chiave in `SPRITES` con `color`, `pts` e due fotogrammi 11 × 9, poi usarla in `rows`.

**Cambiare una grafica**
- Logo: sostituire `img/inncloud-logo.png`. Attenzione: l'oggetto `LOGO` (`nw:720, nh:138, dotX, dotY, dotR`) contiene a mano le dimensioni dell'immagine e la posizione del pallino della "i", usate nell'animazione iniziale e nella filigrana. Con un logo diverso vanno aggiornate.
- Attaccanti e drone: le stringhe in `SPRITES` e `DRONE`.
- Nuvola del giocatore: `drawShip()` e `drawCloudShape()`. Boss: `drawBoss()`. Nuvolette: la forma in `buildWalls()` (e in `drawLegend()` per l'icona).
- Cielo: `drawSky()` e l'array `CLOUDS`. Colori: `RED`, `RED_HI`, `INK`, `HACK`, `NAVY`, `OUTLINE` in `game.js` e le variabili `--ic-*` nel CSS.

**Cambiare un testo**
- Nomi e frasi dei livelli: `LEVELS`. Testi delle schermate: `index.html`. Testi sul campo (`'+… · DOPPIO COLPO'`, `'RANSOMWARE SCONFITTO +2000'`, `'TOCCA PER SALTARE'`, `'INVADERS'`, `'PAY $'`): `game.js`.

## Limiti noti

- Le nuvolette proteggono solo dai codici nemici: i colpi del giocatore le attraversano. Non vengono ricostruite dopo un colpo subito, solo a ogni livello.
- Il `setTimeout` di `levelCleared()` non controlla se nel frattempo lo stato è cambiato: se si va al Menu entro 1,1 s, la schermata "Livello superato" compare comunque.
- Quando la formazione arriva in fondo, `lives` diventa negativo (prima messo a 0, poi `killShip()` toglie 1); l'HUD mostra comunque 0.
- Il drone non compare nel livello del boss, nemmeno dopo che il boss è stato sconfitto.
- `dt` è limitato a 1/30 s: su dispositivi lenti il gioco rallenta (anche il tempo di gara).
- Collisioni senza sotto-passi: con fotogrammi molto lunghi un colpo veloce potrebbe saltare un bersaglio sottile.
- Il numero di livelli `5` e le misure del logo (`LOGO`) sono scritti a mano.
- Se il logo non si carica, l'animazione iniziale e la filigrana non lo mostrano.
- `window.efgReport` in `index.html` è codice non usato; lo è anche il parametro `a` di `drawShip()`.

---
Ultimo aggiornamento: 2026-10-09 (v37)
