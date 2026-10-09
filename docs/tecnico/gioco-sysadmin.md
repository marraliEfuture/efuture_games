# Efuture Bros – documentazione tecnica

Questo documento spiega **come è fatto il codice** del gioco Efuture Bros. Cosa vede e fa il giocatore (schermate, regole, comandi) è descritto nelle specifiche funzionali, che qui non si ripetono:

- [../specifiche/gioco-sysadmin.md](../specifiche/gioco-sysadmin.md) – specifica del gioco;
- [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md) – parti comuni ai 4 giochi (modalità gara, scocca "Game Boy").

Tutto il gioco (HTML, CSS e logica) è in un solo file: `games/sysadmin/index.html`, circa 2700 righe.

## File e risorse

| Percorso | Contenuto | Usato da |
|---|---|---|
| `games/sysadmin/index.html` | Pagina, stile inline (due blocchi `<style>`), script del gioco inline (IIFE) e piccolo script per il pulsante Istruzioni | – |
| `img/logo-testa.png` | Logo Efuture usato come testa del giocatore | `HEAD_LOGO` → `drawLogoHead()` / `drawHumanLogoFigure()` |
| `img/efuture-white.png` | Logo bianco, ricolorato in `#004675` su un canvas fuori schermo e disegnato in filigrana nel cielo | `BG_LOGO`, `BG_LOGO_TINT` → `drawBgLogo()` |
| `fonts/` | Press Start 2P (400) e IBM Plex Mono (400, 500, 600) in `woff2`, con le licenze. Press Start 2P è anche in `<link rel="preload">` | `@font-face` nel primo `<style>` |
| `icons/` | `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `<link rel="icon">`, `<link rel="apple-touch-icon">` |
| `../gameboy.css` | Scocca "Game Boy" in verticale | `<link rel="stylesheet">` dentro `<body>` |
| `../gameboy.js` | Script della scocca | `<script src="../gameboy.js" data-game="sysadmin" data-select="btnHow" data-pause="pauseBtn" data-paused="ov-pause" data-primary=".overlay button.game-btn:not(.secondary)">` |

Il gioco non usa librerie esterne né file audio.

## Struttura della pagina

Tutto sta dentro `#app`.

| Elemento | Id | Contenuto |
|---|---|---|
| HUD | `#hud` | `#lives` (cuori), `#timerWrap` (⏱ tempo della partita), `#levelWrap` ("Ticket N/10 · cliente"), `#scoreWrap` (punti), `#pauseBtn` (`II`) |
| Area di gioco | `#stage` | Contiene il canvas e tutte le schermate |
| Canvas | `#game` | Campo logico 960 × 540, scalato con `fitCanvas()` |
| Messaggi | `#toast` | Messaggio verde temporaneo (classe `show`, 2,2 s) |
| Barra del boss | `#bossBarWrap` → `#bossBarInner` | Vita dell'hacker; visibile (classe `show`) solo nel livello 10 durante il gioco |
| Schermata titolo | `#ov-title` | `#kickerLv`, record (`#bestTimeLineTitle`, `#bestDebugLineTitle`), `#btnStart`, `#btnContinue` (`#continueLevel`), `#btnHow`, `#howBox` |
| Scheda del livello | `#ov-intro` | `#introTag`, `#introTheme`, `#introMsg`, `#btnGo` |
| Cliente non convinto | `#ov-complaint` | `#complaintTitle`, `#complaintMsg`, `#complaintCount`, `#btnComplaintBack`, `#btnComplaintFinish` |
| Livello completato | `#ov-complete` | `#completeTitle`, `#completeMsg`, `#completeScore`, `#btnNext` |
| Vittoria | `#ov-victory` | `#victoryCanvas` (scena animata 480 × 224), `#victoryScore`, `#victoryTime`, `#recordLine`, `#victoryDebug`, `#recordDebugLine`, `#btnRestartAll` |
| Game over | `#ov-gameover` | `#overScore`, `#overLevel`, `#btnRetryLevel`, `#btnMainMenu` |
| Pausa | `#ov-pause` | `#btnResume`, `#btnPauseRestart`, `#btnPauseMenu` |
| Comandi touch | `#controls` | `#joyWrap` → `#joy` (frecce `.jarr` + `#joyKnob`); `#actions` → `#btnSpecial` (ANTIVIRUS), `#btnThrow` (MOUSE), `#btnJump` (SALTA) |

- Le schermate hanno la classe `.overlay` e si mostrano o nascondono con l'attributo `hidden`. `hideAllOverlays()` le chiude tutte.
- I tasti azione sono `<div class="abtn">`, non `<button>`: rispondono ai pointer event tramite `bindHold()`.
- Il CSS ha tre `@media`: verticale basso (`max-height:640px`), orizzontale (`max-height:560px`, griglia `hud / joy stage act`, overlay `position:fixed`) e orizzontale molto basso (`max-height:360px`).

## Architettura dello script

Lo script principale è una IIFE con `"use strict"`, organizzata in sezioni segnate da commenti `/* ===== */`: competition mode, CONSTANTS, DOM, RNG, GAME STATE, LEVEL BUILDING, PLAYER / ENTITIES, INPUT, PHYSICS / COLLISION, UPDATE, RENDER, HUD / overlays, FLOW / BUTTONS, HOT RELOAD SNAPSHOT, MAIN LOOP, BOOT.

### Variabili di stato principali

| Variabile | Significato |
|---|---|
| `state` | Stato del gioco (vedi sotto) |
| `levelIndex` | Livello corrente, da 0 a 9 |
| `level` | Oggetto del livello creato da `buildNormalLevel()` o `buildBossLevel()` |
| `player` | Giocatore: posizione, velocità, `onGround`, `facing`, `invuln`, `throwCd`, `specialCd`, `coyote` |
| `score`, `lives` | Punti interni e vite |
| `runTimer` | Tempo totale della partita (HUD e record) |
| `elapsed` | Tempo del livello, usato per le animazioni di nemici e trappole |
| `camX` | Scorrimento orizzontale della telecamera |
| `bestUnlocked` | Livello più alto raggiunto (pulsante Continua) |
| `bestTime`, `bestDebugPercent` | Record locali |
| `runKillsTotal`, `runEnemiesTotal` | Bug eliminati / totali della partita (percentuale di pulizia) |
| `projectiles`, `particles` | Proiettili (mouse, antivirus, colpi dell'hacker) e particelle |
| `goalReached` | Il giocatore ha già toccato il cliente in questo livello (tiene aperta la porta) |
| `doorOpen`, `doorT` | Apertura della porta (0–1) e ultimo istante disegnato, per `drawDoor()` |
| `keys`, `touch` | Stato dei comandi tenuti premuti |
| `jumpPressedEdge`, `throwPressedEdge`, `specialPressedEdge` | Pressioni "una tantum", consumate da `updatePlayer()` |
| `el` | Riferimenti a tutti gli elementi del DOM |
| `EFG` | Stato della modalità gara (vedi [Integrazione con l'app](#integrazione-con-lapp)) |

### Macchina a stati

Il commento nel codice elenca solo una parte degli stati; i valori reali di `state` sono:

| `state` | Quando | Cosa si aggiorna nel loop |
|---|---|---|
| `title` | Avvio, pulsanti Menu, Nuova chiamata | Solo il disegno |
| `intro` | `showIntro()`: scheda del livello | Solo il disegno |
| `playing` | `beginPlaying()`, dopo una caduta, "Torna a debuggare" | Giocatore, nemici, trappole, tempi, HUD |
| `paused` | `togglePause()` da `playing` | Solo il disegno |
| `complaint` | `openComplaint()`: cliente toccato con bug vivi | Solo il disegno |
| `complete` | `onLevelComplete()`; in gara anche `efgEnd(true)` | Solo il disegno |
| `gameover` | Vite finite; in gara anche `efgEnd(false, …)` | Solo il disegno |
| `victory` | `enterVictory()` dopo il boss | Disegno + `drawVictoryScene()` |

Flusso tipico: `title` → (`btnStart`) `startLevel(0)` → `intro` → (`btnGo`) `playing` → cliente toccato → `complete` oppure `complaint` → (`btnNext`) `startLevel(n+1)` … → livello 10 → `complete` → `victory`.

### Game loop e timing

- `loop(ts)` gira con `requestAnimationFrame`. `dt` è in secondi ed è limitato a **1/30 s**, così dopo un blocco della pagina il gioco non "salta".
- Solo in `playing`: aumenta `elapsed` e `runTimer`, poi `updatePlayer(dt)`, `updateEnemiesAndCombat(dt, elapsed)`, calcolo di `camX` (giocatore al 40% dello schermo) e `updateHud()`.
- In modalità gara, sempre solo in `playing`, aumenta `EFG.lvT` e ogni 0,25 s parte un `tick`.
- `render(t)` viene chiamato a ogni fotogramma in qualunque stato.
- Avvio: `boot()` legge i progressi (`window.claude.hot` se presente, altrimenti `localStorage`), chiama `fitCanvas()`, `updateHud()`, `refreshTitleContinue()` e avvia il loop.

## Funzioni principali

### Costruzione dei livelli

| Funzione | Cosa fa |
|---|---|
| `mulberry32(seed)` | Generatore pseudo-casuale deterministico: stesso seme, stesso livello |
| `buildNormalLevel(idx)` | Crea i livelli 1–9: tratti di terreno e burroni, piattaforme, bug, bug volanti, trappole, scala e cliente |
| `placeTrap(minSegW, hazardW, build)` | (interna) Piazza una trappola con 110 px liberi prima e dopo, senza sovrapporla ad altre |
| `buildBossLevel()` | Crea il livello 10: arena fissa, hacker, una scossa e una sega |
| `startLevel(idx)` | Imposta il livello, gestisce vite e messaggi della gara, chiama `resetLevelRuntime()` e `showIntro()` |
| `resetLevelRuntime()` | Rimette giocatore, nemici, boss e seghe al punto di partenza; svuota proiettili e particelle |
| `spawnPlayer()` | Crea l'oggetto `player` all'inizio del livello |

### Fisica e movimento

| Funzione | Cosa fa |
|---|---|
| `allSolids()` | Elenco di terreno, piattaforme e scala su cui si può stare |
| `resolveVertical(ent, dt, solids)` | Gravità, caduta massima e atterraggio solo dall'alto |
| `updatePlayer(dt)` | Movimento, salto con coyote time e buffer, caduta nel burrone, lancio di mouse e antivirus, arrivo al cliente |

### Nemici e IA

| Funzione | Cosa fa |
|---|---|
| `updateBug(e, dt)` | Bug a terra (e virus del boss): avanti e indietro tra `patrolMin` e `patrolMax` |
| `updateFlyBug(e, dt, t)` | Bug volante: pattuglia orizzontale e onda sinusoidale in verticale |
| `updateBoss(e, dt)` | Hacker: pattuglia, spara, raddoppia il colpo sotto metà vita, chiama i virus di supporto (max 2) |
| `fireBossShot(e)` | Crea un colpo (`kind:'bolt'`) verso il giocatore a 360 px/s |
| `updateTraps(dt, t)` | Muove le seghe, accende e spegne le scosse, controlla il contatto con il giocatore |
| `trapRect(tr)` | Rettangolo di collisione di una trappola (la scossa va da `topY` al terreno) |

### Collisioni e danni

| Funzione | Cosa fa |
|---|---|
| `aabb(a, b)` | Collisione tra due rettangoli |
| `updateEnemiesAndCombat(dt, t)` | Aggiorna i nemici, gestisce pestate, contatti, proiettili, particelle e trappole |
| `killEnemy(e, stomped)` | Elimina un nemico, assegna punti, aumenta `kills` e `killStreak` |
| `damageBoss(e, dmg)` | Toglie vita all'hacker (pausa di 0,35 s tra un colpo e l'altro); a zero chiude il livello |
| `hurtPlayer()` | Colpo subito: perde l'antivirus o la serie, toglie una vita, invulnerabilità e rinculo; a zero vite → game over |
| `loseLife(reason)` | Caduta nel burrone: toglie una vita e riparte il livello con `resetLevelRuntime()` |

### Punteggio, fine livello e record

| Funzione | Cosa fa |
|---|---|
| `checkSpecialUnlock()` | Alla terza eliminazione di fila sblocca l'antivirus; altrimenti mostra "N/3" |
| `openComplaint()` | Apre "Cliente non convinto" con il numero di bug rimasti |
| `onLevelComplete()` | Punti di fine livello (500 o 200), totali di pulizia, `bestUnlocked`, schermata completato, `saveSnapshot()`; in gara registra il tempo |
| `enterVictory()` | Calcola e salva i record di tempo e di pulizia, prepara i coriandoli |
| `saveSnapshot()` | Salva `bestUnlocked` in `localStorage` (e in `window.claude.hot`, se c'è) |

### Rendering

| Funzione | Cosa fa |
|---|---|
| `fitCanvas()` | Adatta il canvas allo spazio di `#stage` mantenendo 960:540 (densità fino a 2×) |
| `sizeVictoryCanvas()` | Dimensiona il canvas della vittoria (campo logico 480 × 224) |
| `render(t)` | Disegna tutto, in ordine: sfondo, terreno, scala, trappole, cliente, nemici, proiettili, particelle, giocatore, vignettatura |
| `drawSceneSoft(kind, t)` | Disegna lo sfondo con `drawScene` sulla tela piccola `BG_CV` (1/`BG_K` = 1/3 di 960×540, scambiando temporaneamente `ctx`, che per questo è `let`), lo ingrandisce sul canvas (sfocatura) e ci passa sopra il velo `SCENE_VEIL[kind]` che smorza i colori |
| `drawScene(kind, t)` | Sfondi dei primi 3 livelli (`theme.scene`): `alba` (campo di grano con `drawWheat`, sole che sorge, `drawHouse` all'inizio e `drawClientOffice` dietro la scala; usa `img/alba.jpg` se c'è), `openspace` (ufficio: vetrate sul tramonto, scrivanie, stampanti con fogli che volano), `notte` (casa in smart working: finestre sulla città, orologio, scrivania con portatile e lampada, libreria, divano, luce d'emergenza) |
| `drawBackground(t)` | Se il tema ha `scene` chiama `drawScene`; altrimenti cielo a gradiente, puntini, effetto del tema, filigrana del logo, oggetti di sfondo in parallasse |
| `drawThemeFX(fx, t)` | Effetto animato della stanza (scansione, braci, radar, pioggia di codice…) |
| `propIcon(kind, x, y, s, t)` | Oggetti di sfondo (monitor, rack, router, database…) |
| `drawBgLogo()` | Logo Efuture in trasparenza |
| `drawGround()`, `drawStairs(t)`, `drawTraps(t)`, `drawGoal(t)` | Terreno, scala, trappole, cliente sul pianerottolo |
| `drawPlayer(t)` | Giocatore (lampeggia se invulnerabile); con il logo usa `drawHumanLogoFigure()`, altrimenti un disegno di riserva |
| `drawLogoHead()`, `drawHumanLogoFigure()`, `limb()`, `drawHoodRim()` | Parti della figura del giocatore |
| `drawPersonFigure()` | Clienti e Capo (forme `suit`, `labcoat`, `hoodie2`… e accessori) |
| `drawBug()`, `drawFlyBug()`, `drawBugSpecies()`, `drawBugEyes()`, `polyPath()` | Bug delle varie specie |
| `drawBoss(e, t)`, `drawProjectile(p)`, `drawParticles()` | Hacker, proiettili, particelle |
| `drawVictoryScene(t)`, `drawSysadminFigure()` | Scena animata della vittoria |
| `shadeColor(hex, pct)` | Schiarisce o scurisce un colore |

### Input

| Funzione | Cosa fa |
|---|---|
| listener `keydown` / `keyup` su `window` | Tastiera (vedi [Input](#input)) |
| `bindHold(elmt, onDown, onUp)` | Collega un tasto touch ai pointer event con `setPointerCapture` |
| `joyUpdate(ev)`, `joyRelease(ev)` | Joystick: posizione della manopola, destra/sinistra, spinta in alto = salto |

### UI e overlay

| Funzione | Cosa fa |
|---|---|
| `showIntro()` | Compila e mostra la scheda del livello |
| `beginPlaying()` | Passa a `playing` e chiude le schermate |
| `updateHud()` | Cuori, punti, tempo, ticket, barra del boss, stato del tasto ANTIVIRUS |
| `hideAllOverlays()` | Nasconde tutte le schermate |
| `togglePause()` | Alterna `playing` ↔ `paused` |
| `showToast(msg)` | Mostra un messaggio per 2,2 s |
| `refreshTitleContinue()` | Pulsante Continua e righe dei record nella schermata titolo |
| `fmtTime(s)` | Formatta i secondi in `mm:ss` |

### Audio

Il gioco non ha suoni: non c'è codice audio.

## Dati dei livelli

I dati sono nello script, sezione CONSTANTS:

- `THEMES`: 13 temi. I primi 3 livelli usano `alba`, `openspace` e `notte`, che hanno anche `scene` (sfondo disegnato da `drawScene`); la notte ha i bug `hoodBug` (cappuccio e occhi rossi). Gli altri: (`office`, `server`, `firewall`, `network`, `cloud`, `control`, `code`, `database`, `critical`, `bunker`). Ognuno ha `name`, `sky` (2 colori), `ground`, `groundTop`, `props` (oggetti di sfondo), `fx` (effetto), `bug` (`species` e `color`) e `fly` (colore dei bug volanti).
- `CLIENTS`: 10 clienti in ordine di livello, con `name`, `theme`, `msg` (scheda), `thanks` (ringraziamento) e aspetto (`shape`, `color`, `skin`, `accessory`). Il decimo (`???`, tema `bunker`) è il boss.
- `CAPO`: aspetto del Capo nella scena di vittoria.

I livelli 1–9 **non sono scritti a mano**: li genera `buildNormalLevel(idx)` con il seme `1000 + idx × 37`. Il livello 10 è fisso in `buildBossLevel()`.

### Regole del generatore (`idx` da 0 a 8)

| Parametro | Formula nel codice |
|---|---|
| Livelli 1–3 | Parametri fissi in `LV3[idx]`: `width`, `bugs`, `fly`, `spikes`, `zappers`, `saws`, `gap` (probabilità di burrone), `bugSpeed`, `sawSpeed`, `zapOn` (durata della scossa). Tratti 320–600 px, pattuglia dei bug 60–140 px, fino a 300 tentativi per trappola |
| Ordine | Prima le trappole (`placeTrap`), poi i bug a terra (zona della trappola + 50 px vietata), poi i bug volanti (non sopra le trappole, margine 60 px) |
| Lunghezza base | `3400 + idx × 520` px, poi allungata per far stare la scala |
| Tratto iniziale sicuro | 340 px |
| Tratti di terreno | 220–440 px |
| Probabilità di burrone dopo un tratto | `min(0.16 + idx × 0.05, 0.58)` |
| Larghezza del burrone | `90 + rand × 55 + min(idx × 4, 35)` px |
| Piattaforme | probabilità `0.4 + idx × 0.02` per tratto; larghe 110–180 px, alte 92–130 px sopra il terreno |
| Bug a terra | `6 + round(idx × 1.4)` (meno se non trovano posto), 38 × 30 px, velocità `55 + idx × 7 + rand × 30` px/s, pattuglia 90–180 px, percorsi non sovrapposti |
| Bug volanti | da `idx ≥ 3`: `min(idx − 2, 6)`, 34 × 26 px |
| Chiodi | da `idx ≥ 1`: `1 + floor(idx × 0.55)` |
| Scosse | da `idx ≥ 2`: `1 + floor((idx − 1) × 0.6)`, alte 134 px, periodo 1,9–2,9 s, accese 0,7–1,05 s |
| Seghe | da `idx ≥ 3`: `1 + floor((idx − 2) × 0.55)`, 36 px, velocità `85 + idx × 9` px/s |
| Scala | 6 gradini (passo 44 × 25 px) + pianerottolo 110 px con il cliente |

### Risultato per livello

Conteggi ottenuti eseguendo il generatore del codice attuale (le trappole sono quelle piazzate davvero):

| Liv. | Cliente – stanza | Lunghezza (px) | Burroni | Piattaforme | Bug a terra | Bug volanti | Chiodi | Scosse | Seghe |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Marco – Alba: da casa al cliente | 6384 | 1 | 2 | 15 | 2 | 2 | 1 | 0 |
| 2 | Giulia – In ufficio al tramonto | 7184 | 5 | 3 | 15 | 4 | 3 | 2 | 2 |
| 3 | Paolo – Notte in smart working | 8095 | 8 | 4 | 17 | 5 | 4 | 4 | 2 |
| 4 | Elena – Sala Rete | 5225 | 2 | 6 | 7 | 1 | 2 | 2 | 1 |
| 5 | Davide – Data Center Cloud | 5810 | 4 | 7 | 8 | 2 | 3 | 2 | 1 |
| 6 | Sara – Sala Controllo | 6318 | 6 | 9 | 9 | 3 | 3 | 3 | 1 |
| 7 | Fabio – Sala Sviluppo | 6743 | 10 | 10 | 9 | 4 | 4 | 4 | 0 |
| 8 | Ilaria – Sala Database | 7382 | 12 | 9 | 6 | 5 | 4 | 4 | 2 |
| 9 | Team IT – Difesa Critica | 7744 | 8 | 11 | 12 | 6 | 5 | 5 | 0 |
| 10 | Bunker dell'Hacker | 1500 | 0 | 3 | boss | – | – | 1 | 1 |

> I primi 3 livelli usano i parametri di `LV3`; dal 4 valgono le formule sopra. I bug a terra possono essere meno dell'obiettivo: si piazzano dopo le trappole e solo dove restano ad almeno 50 px da ognuna.

### Livello 10 (`buildBossLevel`)

| Parametro | Valore |
|---|---|
| Larghezza | 1500 px, nessun burrone |
| Piattaforme | x 340 e 1030 (alte 125 px), x 660 (alta 230 px) |
| Hacker | 76 × 96 px, `hp` 6, velocità 60 px/s, pattuglia da `width − 560` a `width − 160` |
| Primo colpo | dopo 2,2 s; poi ogni 2,0 s, sotto metà vita ogni 1,35 s + secondo colpo dopo 0,35 s |
| Virus di supporto | primo dopo 3,5 s, poi ogni 4,2 s, al massimo 2 vivi; velocità 70 px/s |
| Trappole | scossa a x 500 (periodo 2,2 s, accesa 0,8 s); sega tra x 760 e 960 a 110 px/s |
| Antivirus | sbloccato dall'inizio (`specialUnlocked: true`) |

## Costanti di gioco

Definite in cima allo script (sezione CONSTANTS) o direttamente nelle funzioni indicate.

| Costante | Valore | Significato |
|---|---|---|
| `VW`, `VH` | 960, 540 | Campo logico |
| `GROUND_Y` | 470 (`VH − 70`) | Altezza del terreno |
| `GRAVITY` | 2200 px/s² | Gravità |
| `MAX_FALL` | 1200 px/s | Velocità massima di caduta |
| `JUMP_V` | −800 px/s | Velocità iniziale del salto |
| `MOVE_SPEED` | 350 px/s | Velocità orizzontale del giocatore |
| `COYOTE_TIME` | 0,09 s | Salto ancora valido dopo aver lasciato il bordo |
| `JUMP_BUFFER` | 0,12 s | Salto premuto poco prima di atterrare |
| `STOMP_BOUNCE` | −520 px/s | Rimbalzo dopo una pestata (×0,8 sull'hacker) |
| `THROW_COOLDOWN` | 0,42 s | Pausa tra due lanci del mouse |
| `PROJ_SPEED`, `PROJ_W`, `PROJ_H` | 680 px/s, 26 × 16 px | Proiettile mouse |
| `SPECIAL_SPEED` | 560 px/s | Proiettile antivirus (40 × 30 px) |
| `SPECIAL_COOLDOWN` | 1,0 s | Pausa dopo l'antivirus (vedi Limiti noti) |
| `INVULN_TIME` | 1,3 s | Invulnerabilità dopo un colpo |
| `LIVES_START` | 3 | Vite iniziali |
| `TOTAL_LEVELS` | 10 | Numero di livelli: dichiarata ma non usata, nel codice 9 e 10 sono scritti a mano |
| Giocatore | 50 × 68 px, parte a x 60 | `spawnPlayer()` |
| Rinculo dopo un colpo | `vy` −420, `vx` 180 all'indietro | `hurtPlayer()` |
| Caduta nel burrone | `player.y > VH + 120` | `updatePlayer()` |
| Colpo dell'hacker | 360 px/s, 24 × 20 px | `fireBossShot()` |
| Pausa tra colpi all'hacker | 0,35 s | `damageBoss()` |
| Toast | 2,2 s | `showToast()` |

**Punti** (`killEnemy`, `damageBoss`, `onLevelComplete`): pestata 100, colpo di mouse o antivirus 150, hacker 200 per punto vita, ticket pulito 500, ticket con bug rimasti 200.

## Integrazione con l'app

La modalità gara si attiva con `?hub=1` nell'indirizzo. Regole e protocollo completi: [../specifiche/giochi-comune.md](../specifiche/giochi-comune.md#modalità-libera-e-modalità-gara).

```
const EFG = { on, max:3, limit:60, used:0, times:[], livesAt:[], lvT:0, tickT:0, done:false };
function efgPost(m)   // postMessage({type:'efg', ...m}, '*') al parent, solo se in iframe
function efgEnd(ok, reason)
```

| Campo di `EFG` | Significato |
|---|---|
| `on` | `true` se l'indirizzo contiene `hub=1` |
| `max` | Livelli della gara (3) |
| `limit` | Secondi per livello (60) |
| `lvT` | Secondi giocati nel livello corrente (solo in `playing`) |
| `used`, `times`, `livesAt` | Tempo totale dei livelli superati, tempi per livello, vite rimaste per livello |
| `tickT` | Conto alla rovescia per il prossimo `tick` |
| `done` | `result` già inviato |

### Messaggi inviati

| `ev` | Dove nel codice | Campi |
|---|---|---|
| `start` | `startLevel(0)` | solo `ev` |
| `tick` | `loop()`, ogni 0,25 s in `playing` | `level`, `max`, `t` (= `EFG.lvT`), `used` |
| `result` | `efgEnd()` | `ok`, `reason` (`''`, `'time'`, `'lives'`), `level`, `max`, `used`, `times`, `lives` (= `livesAt`), `seconds` |

Tutti i messaggi hanno anche `type: 'efg'`. `seconds` vale `used`, più `lvT` se la partita è persa.

### Limiti e differenze in gara

- `startLevel()` rimette `lives = 3` e azzera `EFG.lvT` a ogni livello.
- `loop()`: quando `EFG.lvT ≥ 60` chiama `efgEnd(false, 'time')`, che mette `state = 'gameover'` senza mostrare schermate.
- `hurtPlayer()` / `loseLife()`: a zero vite `efgEnd(false, 'lives')` e poi la schermata GAME OVER.
- `onLevelComplete()`: somma `lvT` a `used`, salva tempo e vite; al terzo livello `efgEnd(true)` (`state = 'complete'`, nessuna schermata) ed esce subito, senza punti di fine livello.
- `#kickerLv` diventa "3 livelli · 1 minuto · 3 vite"; `refreshTitleContinue()` nasconde Continua; HUD e scheda mostrano "/3".
- "Riparti dal ticket" (pausa) in gara non ridà le vite e non azzera `EFG.lvT`.

## Input

### Tastiera (listener su `window`)

| Tasto | Azione | Variabile |
|---|---|---|
| ← / A | Sinistra (tenuto) | `keys.left` |
| → / D | Destra (tenuto) | `keys.right` |
| ↑ / Spazio / W | Salto | `jumpPressedEdge`, `keys.jumpHeld` |
| X / Shift | Mouse | `throwPressedEdge` |
| V / C | Antivirus | `specialPressedEdge` |
| P | Pausa / riprendi | `togglePause()` |
| Esc | Pausa (solo in `playing`) | `togglePause()` |

Le frecce, lo spazio e le lettere del gioco hanno `preventDefault()` per non far scorrere la pagina.

### Touch

- **Joystick `#joy`:** `pointerdown` prende il dito con `setPointerCapture`. `joyUpdate()` limita la manopola al 62% del raggio; zona morta `JOY_DEAD = 0.2` per destra e sinistra (`touch.left`, `touch.right`); salto quando la spinta in alto supera `JOY_UP_ON = 0.6` ed è più verticale che orizzontale; per un nuovo salto si torna sotto `JOY_UP_OFF = 0.35`. Classi CSS `held`, `left`, `right`, `up` per la grafica.
- **Tasti `#btnJump`, `#btnThrow`, `#btnSpecial`:** collegati con `bindHold()`; classe `active` mentre sono premuti. `#btnSpecial` ha la classe `unlocked` quando l'antivirus è pronto (impostata da `updateHud()`).
- Su `#controls` sono bloccati `touchstart`, `touchmove`, `touchend` e il menu contestuale.

### Scocca "Game Boy"

`gameboy.js` (con `data-game="sysadmin"`) aggiunge i tastini ISTRUZIONI (preme `#btnHow`) e AVVIA/PAUSA (preme `#pauseBtn` o il primo `.overlay button.game-btn:not(.secondary)` visibile). SysAdmin non usa `data-a`/`data-b`: i suoi tre tasti sono disposti dal CSS.

## Come modificare

### Cambiare la difficoltà

| Cosa | Dove |
|---|---|
| Velocità, salto, gravità, invulnerabilità, ricarica delle armi | Costanti in cima allo script (`MOVE_SPEED`, `JUMP_V`, `GRAVITY`, `INVULN_TIME`, `THROW_COOLDOWN`…) |
| Numero e velocità dei bug | `buildNormalLevel()`: `numBugs`, `speed`, `numFly` |
| Burroni | `buildNormalLevel()`: `gapChance` e larghezza `gap` |
| Trappole | `buildNormalLevel()`: `numSpikes`, `numZappers`, `numSaws` e i loro parametri |
| Lunghezza dei livelli | `buildNormalLevel()`: `width = 3400 + idx*520` |
| Hacker | `buildBossLevel()` (`hp`, `vx`, `attackTimer`, `spawnTimer`) e `updateBoss()` (1.35 / 2.0 s, 4.2 s, massimo 2 virus) |
| Bug per sbloccare l'antivirus | `checkSpecialUnlock()`: `level.killStreak >= 3` |
| Vite | `LIVES_START` |
| Tempo e livelli della gara | `EFG.limit` e `EFG.max` (devono restare allineati con l'app) |

Dopo aver cambiato il generatore conviene ricontrollare i livelli: ogni modifica a `buildNormalLevel()` che cambia il numero di chiamate a `rand()` cambia anche la forma di tutti i livelli successivi.

### Aggiungere un livello normale

1. Aggiungere un tema in `THEMES` (colori, `props`, `fx`, specie di bug). Per una specie o un effetto nuovi servono anche un ramo in `drawBugSpecies()` o `drawThemeFX()`.
2. Inserire il cliente in `CLIENTS` **prima** del boss (`???`).
3. Aggiornare i numeri scritti a mano (`TOTAL_LEVELS` non viene letta): l'indice del boss (`idx === 9` in `startLevel()`, `levelIndex === 9` in `showIntro()`, `onLevelComplete()` e sul pulsante `btnNext`), `CLIENTS[9]` in `buildBossLevel()`, il controllo `bestUnlocked < 10` in `refreshTitleContinue()`, i testi "/10" e "/9" (`updateHud()`, `showIntro()`, `#kickerLv`, `#ov-gameover`).

### Cambiare una grafica

| Cosa | Dove |
|---|---|
| Testa del giocatore | Sostituire `img/logo-testa.png`; centratura in `drawLogoHead()` (`E_CENTER`) |
| Filigrana nel cielo | `img/efuture-white.png`, colore in `BG_LOGO.onload`, opacità in `drawBgLogo()` |
| Colori di una stanza | `THEMES.<tema>.sky`, `ground`, `groundTop` |
| Aspetto di un cliente | `CLIENTS[i].shape`, `color`, `skin`, `accessory` (disegnati da `drawPersonFigure()`) |
| Bug | `THEMES.<tema>.bug` e `drawBugSpecies()` |
| Colori dell'interfaccia | Variabili CSS in `:root` (`--accent`, `--ef-blue`, `--av`, `--hacker`…) |
| Testi delle schermate | HTML degli overlay e funzioni `showIntro()`, `openComplaint()`, `onLevelComplete()` |

## Limiti noti

- **Antivirus una sola volta per livello:** dopo il lancio `updatePlayer()` mette `specialUnlocked = false` e `specialUsed = true` ("Antivirus usato!"), e `checkSpecialUnlock()` non lo sblocca più in quel livello. Quindi `SPECIAL_COOLDOWN` di fatto non serve, e la specifica funzionale (che parla di un colpo ogni 1 s) non è allineata.
- **Ripartenza del livello:** caduta, "Riparti dal ticket" e "Riprova ticket" usano `resetLevelRuntime()` sullo stesso oggetto `level`: i bug tornano vivi ma `kills`, `killStreak` e `specialUsed` restano. Si può arrivare al cliente senza la schermata "Cliente non convinto" e la pulizia è calcolata con `min(kills, totalEnemies)`.
- **Dati del generatore diversi dalla specifica:** numero di bug a terra e dimensione del giocatore (50 × 68 nel codice, 44 × 60 nella specifica).
- **Commento degli stati incompleto:** il commento accanto a `let state` non elenca `complaint`.
- **Nessuna pausa automatica** quando la pagina va in secondo piano (non c'è un listener `visibilitychange`); il loop si ferma comunque perché il browser sospende `requestAnimationFrame`, e `dt` è limitato a 1/30 s.
- **Gara:** dopo `efgEnd(true)` il gioco resta in `complete` senza schermata (la copre il risultato dell'app). "Riparti dal ticket" non azzera il tempo del livello.
- Il toast "ANTIVIRUS SBLOCCATO! Premi V" cita la tastiera anche sul telefono.
- Restano le chiamate a `window.claude.hot` (`boot()`, `saveSnapshot()`), usate solo in un ambiente di sviluppo.
- Se `img/logo-testa.png` non si carica, `drawPlayer()` disegna una figura di riserva.

---
Ultimo aggiornamento: 2026-10-09 (v37)
