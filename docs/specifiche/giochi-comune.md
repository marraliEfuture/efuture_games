# Giochi – parti comuni

## In breve

I 4 giochi sono pagine statiche a sé in `games/<id>/`, senza librerie esterne: disegnano tutto su un `<canvas>` e funzionano anche aperti da soli. Hanno in comune:
- la **modalità gara** (`?hub=1`), con le stesse regole e gli stessi messaggi verso l'app;
- la **scocca "Game Boy"** in verticale (`games/gameboy.css` + `games/gameboy.js`);
- la struttura delle cartelle, i font locali e il tema chiaro.

Qui si descrive una volta sola ciò che è comune. Le specifiche dei singoli giochi rimandano a questo file.

| Gioco | Specifica |
|---|---|
| Efuture Bros | [gioco-sysadmin.md](gioco-sysadmin.md) |
| CoreTech Pac | [gioco-coretech.md](gioco-coretech.md) |
| Timenet Breakout | [gioco-timenet.md](gioco-timenet.md) |
| inncloud Invaders | [gioco-inncloud.md](gioco-inncloud.md) |

## File e cartelle

| Percorso | Contenuto |
|---|---|
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale, condivisa dai 4 giochi |
| `games/<id>/index.html` | Pagina del gioco: HUD, canvas, overlay (schermate), comandi touch, stile |
| `games/<id>/game.js` | Logica del gioco (CoreTech, Timenet, inncloud). SysAdmin ha tutto dentro `index.html` |
| `games/<id>/fonts/` | Press Start 2P e IBM Plex Mono in `woff2`, con le licenze |
| `games/<id>/icons/` | `favicon.png`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |
| `games/<id>/img/` | Logo del marchio e altre immagini del gioco; `efuture-white.png` in tutti |

- Ogni pagina ha `lang="it"`, `theme-color` `#eef4fa`, `color-scheme: light` e i meta per l'uso a schermo intero sul telefono.
- Il viewport blocca lo zoom (`user-scalable=no`). Testi non selezionabili, niente menu del tocco prolungato.

## Tema chiaro comune

Dalla v25 i giochi usano lo stesso tema chiaro dell'app (vedi [app-giocatori.md](app-giocatori.md#tema-e-colori)):

| Colore | Uso |
|---|---|
| `#eef4fa` | Sfondo pagina, overlay semitrasparente `rgba(238,244,250,.86)` |
| `#ffffff` / `#f2f7fc` | Card delle schermate / riquadri |
| `#cddcea` | Bordi |
| `#0d2b45` / `#56718a` | Testo / testo secondario |
| `#004675` / `#f18c22` | Blu e arancio Efuture |
| `#c56a0c` | Arancio scuro per punti e testi evidenziati |

Ogni gioco aggiunge i colori del suo marchio, descritti nella sua specifica.

- **Font:** Press Start 2P per titoli, pulsanti e numeri; IBM Plex Mono per il resto.
- **Istruzioni:** in tutti i giochi la schermata titolo ha il pulsante **Istruzioni** (`btnHow`), che mostra o nasconde il riquadro `howBox`. Il testo del pulsante diventa "Nascondi istruzioni".

## Modalità libera e modalità gara

| | Modalità libera (pagina aperta da sola) | Modalità gara (`?hub=1`, dentro l'app) |
|---|---|---|
| Livelli | Tutti (10 in SysAdmin, 5 negli altri) | I primi 3 |
| Tempo | Nessun limite | 60 s per livello |
| Vite | 3 a inizio partita, si portano da un livello all'altro | 3 a ogni livello |
| "Continua dal livello N" | Sì, salvato in `localStorage` | Nascosto |
| Messaggi all'app | Nessuno | `start`, `tick`, `result` |
| Punteggio che conta | Quello interno del gioco (record locale) | Quello calcolato dall'app: livello × secondi avanzati × vite |

Il punteggio interno del gioco (punti nell'HUD) **non** viene inviato all'app e non conta in classifica.

### Lato gioco del protocollo

Il protocollo completo è in [app-giocatori.md](app-giocatori.md#protocollo-postmessage-gioco--app). Tutti i giochi lo realizzano allo stesso modo, con un oggetto `EFG` e la funzione `efgPost`, che manda `{type:'efg', …}` al `parent` con `postMessage(…, '*')` solo se la pagina è in un iframe.

| Messaggio | Quando |
|---|---|
| `start` | All'inizio del livello 1. Azzera tempi e vite salvati |
| `tick` | Ogni 0,25 s mentre si gioca: `level`, `t` (secondi usati nel livello), più `max` e `used`, che l'app ignora |
| `result` | Una sola volta per partita (`EFG.done`): alla fine del livello 3, alla fine delle vite o allo scadere dei 60 s |

- **Tempo del livello:** conta solo nello stato di gioco. Si ferma con la pausa, sulle schermate tra un livello e l'altro, durante le animazioni iniziali e (in SysAdmin) sulla schermata del cliente non convinto.
- **Livello superato:** il gioco aggiunge il tempo usato a `times` e le vite rimaste a `lives`. Al livello 3 manda `result` con `ok: true`.
- **Tempo scaduto:** `result` con `ok: false`, `reason: 'time'`. Il gioco si ferma senza mostrare una sua schermata: copre tutto il risultato dell'app.
- **Vite finite:** `result` con `ok: false`, `reason: 'lives'`. Sotto il risultato dell'app resta la schermata GAME OVER del gioco.
- `seconds` = tempo usato nei livelli superati + tempo del livello in corso se la partita è persa. L'app lo legge ma non lo usa.
- Dopo `result` il gioco può ancora essere usato (per esempio "Riprova"), ma non manda più nulla finché non riparte dal livello 1.
- **Codice non usato:** Timenet, inncloud e CoreTech definiscono in `index.html` anche `window.efgReport` (messaggio `efg-score`). Nessuno lo chiama e l'app non lo ascolta.

## Visualizzazione: Normal, Dark, Game

- Si cambia con il tastino **MODE** della scocca (in verticale) o con il pulsante in alto accanto alla pausa (`#viewBtn`, creato da `gameboy.js`; in verticale nella vista Game è nascosto perché c'è MODE). Ogni tocco passa alla successiva: **☀ Normal** → **☾ Dark** → **🎮 Game** → di nuovo Normal. A ogni tocco compare per un attimo "Visualizzazione …". Nel codice Normal si chiama ancora `light`.
  - **Game:** scocca "Game Boy" con il telefono in verticale (qui sotto); in orizzontale il layout del gioco.
  - **Normal:** tema chiaro, senza scocca: in verticale il gioco usa tutta la larghezza con i comandi sotto.
  - **Dark:** come Normal ma scuro: sfondo `#0e1621`, riquadri `#172230`/`#1e2b3b`, bordi `#33465c`, testo `#e7eef6`, punti `#ffb04a`; schermate con velo scuro; barra, comandi e piste di trascinamento scuri. Il campo di gioco disegnato nel canvas resta com'è.
- La scelta vale per tutti e 4 i giochi e resta sul telefono (`efgView`). Finché il giocatore non sceglie vale la visualizzazione predefinita decisa in admin › Impostazioni (`efgViewDefault`, scritta dall'app all'avvio); senza, Game.
- Come funziona: `gameboy.js` mette `data-view` su `<html>`; fuori da Game spegne `gameboy.css` (`link.disabled`), toglie `data-gb` e la classe `gb` e lascia i tasti A/B al loro posto. Gli stili del pulsante e del tema scuro sono dentro `gameboy.js`, sempre attivi.

## Scocca "Game Boy" (verticale)

Si attiva **solo con il telefono in verticale** (`@media (orientation:portrait)`) e **solo nella visualizzazione Game**. Dalla v56 bordi più sottili; dalla v60 ancora più sottili (corpo 5 px ai lati, cornice dello schermo 5 px) e comandi più compatti (tastini alti 36 px, A/B da 52 px, scritta EFUTURE GAMES più piccola), così lo spazio va allo schermo del gioco. In orizzontale ogni gioco usa il suo layout, descritto nella sua specifica. Lo script non cambia la logica dei giochi: aggiunge parti decorative e due tastini che premono pulsanti già esistenti.

### Aspetto

- **Corpo:** la pagina (`#app`) diventa la scocca grigio chiaro (`#e6e3dc` → `#c9c5bd`), larga al massimo 500 px, con l'angolo in basso a destra molto arrotondato. Lo sfondo intorno è `#b7b2a8`.
- **Cornice dello schermo** (`#4a4e5a`), dall'alto:
  - riga con led rosso, scritta `ON`, due righe arancio e azzurra e, in gara, il tempo del livello (`LIV 1 · 0:45`, rosso negli ultimi 10 s) mandato dall'app;
  - HUD del gioco su una fascia chiara, come il display;
  - schermo del gioco (`#stage`), con l'angolo in basso a destra arrotondato.
- Sotto lo schermo: scritta **EFUTURE GAMES** in corsivo blu `#004675`.
- **Fascia comandi:** al posto della croce c'è il joystick (SysAdmin, CoreTech) o la fascia di trascinamento (Timenet, inncloud); al posto di A e B ci sono i tasti del gioco; in basso i due tastini inclinati **MODE** e **AVVIA/PAUSA**.
- **Griglia dell'altoparlante:** 6 fessure inclinate in basso a destra (non nei giochi con la fascia).
- Telefoni bassi (altezza ≤ 700 px): cornice e scritta più sottili. Telefoni grandi (≥ 390 × 780 px): joystick e tasti più grandi in SysAdmin, joystick un po' più grande in CoreTech.

### Attributi dello script

`<script src="../gameboy.js" data-…>` in fondo alla pagina del gioco:

| Attributo | Significato |
|---|---|
| `data-game` | Variante della scocca: `sysadmin`, `joy` (CoreTech) o `strip` (Timenet, inncloud) |
| `data-a`, `data-b` | Id dei pulsanti da spostare nei tasti A (arancio, in alto) e B (blu, in basso) |
| `data-select` | Id del pulsante Istruzioni (non più usato dai tastini: le istruzioni restano sulla schermata titolo) |
| `data-pause` | Id del pulsante pausa |
| `data-paused` | Id della schermata di pausa |
| `data-primary` | Selettore del pulsante principale delle schermate |

### Tastini centrali

- **MODE:** cambia la visualizzazione (Normal → Dark → Game). Le istruzioni si aprono dal pulsante Istruzioni della schermata titolo.
- **AVVIA / PAUSA:** il testo cambia da solo (controllo ogni 0,3 s).
  - Schermata di pausa aperta: scritta PAUSA, il tocco preme il pulsante pausa e il gioco riprende.
  - Una schermata con un pulsante principale visibile (Inizia, Via!, Prossimo livello, Riprova…): scritta AVVIA, il tocco preme il primo visibile.
  - Durante il gioco: scritta PAUSA, il tocco mette in pausa.
- **Fine livello:** in tutti e 4 i giochi il pulsante per andare avanti (Prossimo livello, Prossimo ticket, Chiudi il ticket) è **arancione** (`#f18c22`, classe `btn go` nei giochi con `game.js`) ed è il primo; le alternative (per esempio Torna a debuggare) sono bianche.
- I tastini scattano al rilascio del dito. Non fanno partire trascinamenti o lanci del gioco sotto.

### Tasti A e B

- In verticale i pulsanti indicati da `data-a` e `data-b` vengono spostati nella coppia A/B. Tornano al loro posto (segnato da un commento nel DOM) in orizzontale. Al cambio di orientamento lo script ridisegna il gioco.
- Nella coppia A/B il pulsante scatta al rilascio del dito, senza doppioni con il click.
- Sotto i tasti compare una didascalia: `PAUSA` per `#pauseBtn`, `MUSICA` per `#soundBtn`. Il tasto SPARA di inncloud (`#fireBtn`) ha la scritta dentro e non ha didascalia; il suo aspetto (rosso, 76 px) e il fuoco tenendo premuto sono gestiti dalla pagina del gioco, non da `gameboy.css`/`gameboy.js`.
- SysAdmin non usa `data-a`/`data-b`: i suoi tasti SALTA, MOUSE e ANTIVIRUS sono disposti dal CSS come A, B e un terzo tasto.

### Mappa per gioco

| Gioco | `data-game` | Croce | A | B | MODE | AVVIA / PAUSA |
|---|---|---|---|---|---|---|
| Efuture Bros | `sysadmin` | Joystick (destra/sinistra, su = salto) | SALTA | MOUSE (+ ANTIVIRUS piccolo sopra) | Visualizzazione | Pulsante arancio della schermata, oppure pausa |
| CoreTech Pac | `joy` | Joystick a 4 direzioni | PAUSA | MUSICA | Visualizzazione | Pulsante principale, oppure pausa |
| Timenet Breakout | `strip` | Fascia di trascinamento | PAUSA | MUSICA | Visualizzazione | Pulsante principale, oppure pausa |
| inncloud Invaders | `strip` | Fascia di trascinamento | LASER (grigio, verde quando è pronto; più grande) | MUSICA | Visualizzazione | Pulsante principale, oppure pausa |

Dettagli per gioco:
- **SysAdmin:** lo schermo è 16:9 e il pulsante pausa dell'HUD è nascosto (la pausa si fa con il tastino). Le schermate (overlay) coprono tutta la console tranne la fila dei tastini, che resta usabile.
- **CoreTech:** dalla v60 lo schermo prende tutto lo spazio libero e i comandi solo quello che serve (joystick 112-132 px).
- **Timenet e inncloud:** la fascia di trascinamento diventa una pista scura arrotondata alta 52 px, a sinistra di A/B.

## Limiti comuni

- Record, progressi e audio si salvano nel `localStorage` del dispositivo, con chiavi diverse per gioco. Non vanno in classifica.
- Il tempo di gara è misurato dal gioco nel telefono: va bene per l'evento, non per premi di valore.
- I giochi non ricevono messaggi dall'app: l'unico segnale è `?hub=1`.

---
Ultimo aggiornamento: 08/10/2026 (v28)

## Fine del gioco: fuochi d'artificio

- In gara, quando si superano tutti e 3 i livelli, l'app mostra il riepilogo con il titolo "🎉 Complimenti, hai finito!" e accende per 7 secondi i fuochi d'artificio su tutto lo schermo (`fuochi.js`, `EFGFuochi.start/stop`). Restano i pulsanti Rigioca e Torna ai giochi; i fuochi si spengono quando si tocca uno dei due.
- Fuori dalla gara (gioco aperto da solo) `gameboy.js` accende gli stessi fuochi quando compare la schermata finale del gioco (`#ov-win`, in Efuture Bros `#ov-victory`) e li spegne quando si chiude. `fuochi.js` viene caricato solo in quel momento.
- Non bloccano i tocchi. Con "riduci movimento" attivo durano al massimo 2,5 s.

## Record in gara

- In gara (`?hub=1&rec=…`) `gameboy.js` nasconde il record interno del gioco (`#bestLine`, in Efuture Bros `#bestTimeLineTitle` e `#bestDebugLineTitle`) e mostra **Record in gara: L/3 liv · P pt**, lo stesso della home; senza record "nessuno, gioca!".

## Barra dell'app durante la gara

- In gara (`?hub=1`) `gameboy.js` manda all'app `{type:'efg-ui', menu}`: al primo messaggio l'app nasconde la sua barra in alto per tutta la partita (v67).
- **Torna ai giochi:** `gameboy.js` aggiunge il pulsante "← Torna ai giochi" (stile dei pulsanti secondari del gioco) nella schermata iniziale e nella pausa; il tocco manda `{type:'efg-exit'}` e l'app chiede conferma se la partita è in corso.
- **Un solo timer:** il tempo del livello lo manda l'app a ogni tick (`{type:'efg-clock', text, warn}`); `gameboy.js` lo mostra nella riga in alto della scocca (vista Game, in verticale) oppure in una pillola più grande in alto a sinistra dello schermo del gioco. Il contatore che sale di Efuture Bros (`#timerWrap`) in gara è nascosto (classe `efg-hub` su `<html>`).
- **Riga delle regole:** in gara CoreTech, Timenet e inncloud hanno in cima alla schermata iniziale "3 livelli · 1 minuto · 3 vite", come Efuture Bros.

## Computer con mouse e tastiera

- Con `(hover:hover) and (pointer:fine)` sono nascosti il joystick di CoreTech, le piste di trascinamento di Timenet e inncloud e il tasto SPARA; al loro posto `gameboy.js` mostra una riga con i tasti (frecce o WASD, Spazio, P pausa).

