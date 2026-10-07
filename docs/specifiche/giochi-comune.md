# Giochi – parti comuni

## In breve

I 4 giochi sono pagine statiche a sé in `games/<id>/`, senza librerie esterne: disegnano tutto su un `<canvas>` e funzionano anche aperti da soli. Hanno in comune:
- la **modalità gara** (`?hub=1`), con le stesse regole e gli stessi messaggi verso l'app;
- la **scocca "Game Boy"** in verticale (`games/gameboy.css` + `games/gameboy.js`);
- la struttura delle cartelle, i font locali e il tema chiaro.

Qui si descrive una volta sola ciò che è comune. Le specifiche dei singoli giochi rimandano a questo file.

| Gioco | Specifica |
|---|---|
| SysAdmin Runner | [gioco-sysadmin.md](gioco-sysadmin.md) |
| CoreTech Pac | [gioco-coretech.md](gioco-coretech.md) |
| Timenet Breakout | [gioco-timenet.md](gioco-timenet.md) |
| Inncloud Invaders | [gioco-inncloud.md](gioco-inncloud.md) |

## File e cartelle

| Percorso | Contenuto |
|---|---|
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale, condivisa dai 4 giochi |
| `games/<id>/index.html` | Pagina del gioco: HUD, canvas, overlay (schermate), comandi touch, stile |
| `games/<id>/game.js` | Logica del gioco (CoreTech, Timenet, Inncloud). SysAdmin ha tutto dentro `index.html` |
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
- **Codice non usato:** Timenet, Inncloud e CoreTech definiscono in `index.html` anche `window.efgReport` (messaggio `efg-score`). Nessuno lo chiama e l'app non lo ascolta.

## Scocca "Game Boy" (verticale)

Si attiva **solo con il telefono in verticale** (`@media (orientation:portrait)`). In orizzontale ogni gioco usa il suo layout, descritto nella sua specifica. Lo script non cambia la logica dei giochi: aggiunge parti decorative e due tastini che premono pulsanti già esistenti.

### Aspetto

- **Corpo:** la pagina (`#app`) diventa la scocca grigio chiaro (`#e6e3dc` → `#c9c5bd`), larga al massimo 500 px, con l'angolo in basso a destra molto arrotondato. Lo sfondo intorno è `#b7b2a8`.
- **Cornice dello schermo** (`#4a4e5a`), dall'alto:
  - riga con led rosso, scritta `ON` e due righe arancio e azzurra;
  - HUD del gioco su una fascia chiara, come il display;
  - schermo del gioco (`#stage`), con l'angolo in basso a destra arrotondato.
- Sotto lo schermo: scritta **EFUTURE GAMES** in corsivo blu `#004675`.
- **Fascia comandi:** al posto della croce c'è il joystick (SysAdmin, CoreTech) o la fascia di trascinamento (Timenet, Inncloud); al posto di A e B ci sono i tasti del gioco; in basso i due tastini inclinati **ISTRUZIONI** e **AVVIA/PAUSA**.
- **Griglia dell'altoparlante:** 6 fessure inclinate in basso a destra (non nei giochi con la fascia).
- Telefoni bassi (altezza ≤ 700 px): cornice e scritta più sottili. Telefoni grandi (≥ 390 × 780 px): joystick e tasti più grandi in SysAdmin e CoreTech.

### Attributi dello script

`<script src="../gameboy.js" data-…>` in fondo alla pagina del gioco:

| Attributo | Significato |
|---|---|
| `data-game` | Variante della scocca: `sysadmin`, `joy` (CoreTech) o `strip` (Timenet, Inncloud) |
| `data-a`, `data-b` | Id dei pulsanti da spostare nei tasti A (arancio, in alto) e B (blu, in basso) |
| `data-select` | Id del pulsante premuto da ISTRUZIONI |
| `data-pause` | Id del pulsante pausa |
| `data-paused` | Id della schermata di pausa |
| `data-primary` | Selettore del pulsante principale delle schermate |

### Tastini centrali

- **ISTRUZIONI:** preme il pulsante Istruzioni del gioco. È attivo solo quando quel pulsante è visibile, cioè sulla schermata titolo; altrimenti è sbiadito.
- **AVVIA / PAUSA:** il testo cambia da solo (controllo ogni 0,3 s).
  - Schermata di pausa aperta: scritta PAUSA, il tocco preme il pulsante pausa e il gioco riprende.
  - Una schermata con un pulsante principale visibile (Inizia, Via!, Prossimo livello, Riprova…): scritta AVVIA, il tocco preme il primo visibile.
  - Durante il gioco: scritta PAUSA, il tocco mette in pausa.
- I tastini scattano al rilascio del dito. Non fanno partire trascinamenti o lanci del gioco sotto.

### Tasti A e B

- In verticale i pulsanti indicati da `data-a` e `data-b` vengono spostati nella coppia A/B. Tornano al loro posto (segnato da un commento nel DOM) in orizzontale. Al cambio di orientamento lo script ridisegna il gioco.
- Nella coppia A/B il pulsante scatta al rilascio del dito, senza doppioni con il click.
- Sotto i tasti compare una didascalia: `PAUSA` per `#pauseBtn`, `MUSICA` per `#soundBtn`.
- SysAdmin non usa `data-a`/`data-b`: i suoi tasti SALTA, MOUSE e ANTIVIRUS sono disposti dal CSS come A, B e un terzo tasto.

### Mappa per gioco

| Gioco | `data-game` | Croce | A | B | ISTRUZIONI | AVVIA / PAUSA |
|---|---|---|---|---|---|---|
| SysAdmin Runner | `sysadmin` | Joystick (destra/sinistra, su = salto) | SALTA | MOUSE (+ ANTIVIRUS piccolo sopra) | `btnHow` | Pulsante arancio della schermata, oppure pausa |
| CoreTech Pac | `joy` | Joystick a 4 direzioni | PAUSA | MUSICA | `btnHow` | Pulsante principale, oppure pausa |
| Timenet Breakout | `strip` | Fascia di trascinamento | PAUSA | MUSICA | `btnHow` | Pulsante principale, oppure pausa |
| Inncloud Invaders | `strip` | Fascia di trascinamento | PAUSA | MUSICA | `btnHow` | Pulsante principale, oppure pausa |

Dettagli per gioco:
- **SysAdmin:** lo schermo è 16:9 e il pulsante pausa dell'HUD è nascosto (la pausa si fa con il tastino). Le schermate (overlay) coprono tutta la console tranne la fila dei tastini, che resta usabile.
- **CoreTech:** lo schermo ha le proporzioni del labirinto più alto (19:21,6); lo spazio in più va ai comandi.
- **Timenet e Inncloud:** la fascia di trascinamento diventa una pista scura arrotondata alta 62 px, a sinistra di A/B.

## Limiti comuni

- Record, progressi e audio si salvano nel `localStorage` del dispositivo, con chiavi diverse per gioco. Non vanno in classifica.
- Il tempo di gara è misurato dal gioco nel telefono: va bene per l'evento, non per premi di valore.
- I giochi non ricevono messaggi dall'app: l'unico segnale è `?hub=1`.

---
Ultimo aggiornamento: 07/10/2026 (v27)
