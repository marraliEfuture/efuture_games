# Gioco CoreTech Pac

## In breve

Labirinto nello stile di Pac-Man. Il giocatore guida la **C del logo CoreTech**, mangia tutte le monetine e scappa dai bug. Con il floppy (la "patch") per qualche secondo è lui a mangiare i bug, che poi non tornano più. Ogni labirinto ha un'uscita laterale che fa rientrare dal lato opposto.

- Modalità libera: 5 livelli, labirinti sempre più grandi e bug più veloci.
- Modalità gara (`?hub=1`): i primi 3 livelli, 1 minuto e 3 vite ciascuno.
- Le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](giochi-comune.md).

| File | Ruolo |
|---|---|
| `games/coretech/index.html` | HUD, canvas, schermate, joystick, stile |
| `games/coretech/game.js` | Logica del gioco: labirinti, livelli, movimento, bug |
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale (`data-game="joy"`) |
| `img/coretech-logo.png` | Logo: schermata titolo e animazione iniziale |
| `fonts/`, `icons/` | Font locali e icone. `img/efuture-white.png` è presente ma non usato |

## Storia

- La C di CoreTech ripulisce i sistemi di un'azienda, livello dopo livello: Rete aziendale, Server farm, Cloud ibrido, Data center, Core di sistema.
- I 4 bug hanno un nome e un carattere: **Glitch** (rosso, insegue direttamente), **Loop** (rosa, punta davanti al giocatore), **Leak** (azzurro, aggira insieme a Glitch), **Crash** (arancio, timido: si allontana quando è vicino).

## Schermate

| Schermata | Contenuto | Pulsanti |
|---|---|---|
| **Titolo** (`ov-title`) | Logo CoreTech, PAC, "Guida la C di CoreTech e ripulisci il labirinto dai bug.", "Record: N" se esiste | **Inizia**, **Continua · Liv. N** (solo modalità libera, se c'è un livello raggiunto), **Istruzioni** |
| **Istruzioni** (`howBox`) | Tre righe con disegnino: "Mangia tutte le monetine.", "Evita i bug: costano una vita.", "Col floppy mangi tu i bug: non tornano più." "5 livelli, sempre più veloci." Tasti: Usa il joystick, scorri o le frecce · P pausa | – |
| **Animazione iniziale** | Dopo **Inizia** (e **Gioca ancora**): la C del logo si stacca e "mangia" le lettere di "oreTech", poi compare PAC. Dura circa 4,2 s; "TOCCA PER SALTARE": un tocco o un tasto la salta | – |
| **Scheda del livello** (`ov-level`) | "Livello 1/5" (gara: "/3"), nome, frase e numero di bug (per esempio "Labirinto piccolo, bug lenti. Bug: 2.") | **Via!** |
| **Pronti** | Dopo Via! e dopo ogni vita persa: scritta PRONTI! sul labirinto per 1,8 s, poi si parte | – |
| **Livello completato** (`ov-clear`) | Dopo 0,9 s: "Sistema ripulito", "Livello N completato!", punti, bug mangiati, tempo | **Prossimo livello** |
| **Pausa** (`ov-pause`) | PAUSA | **Riprendi**, **Menu** |
| **Game over** (`ov-over`) | "Sistema compromesso", GAME OVER, "I bug hanno vinto, per stavolta.", punti, livello N/5 (gara N/3) | **Riprova livello**, **Menu** |
| **Vittoria** (`ov-win`) | "Missione compiuta", CORE PULITO, "Tutti i 5 livelli ripuliti!", punteggio finale, record, "Nuovo record!" o "Record da battere: N" | **Gioca ancora** |

**HUD:** Punti, Vite (piccole C blu), "Liv. N/5 · *nome*", pulsante musica `♪` (spento: `×`), pulsante pausa `II`. Sul labirinto compaiono i punti dei bug mangiati.

## Modalità libera e modalità gara

Regole comuni e protocollo: [giochi-comune.md](giochi-comune.md#modalità-libera-e-modalità-gara).

| | Modalità libera | Modalità gara (`?hub=1`) |
|---|---|---|
| Livelli | 5 | 3: Rete aziendale, Server farm, Cloud ibrido |
| Vite | 3 a inizio partita, si portano da un livello all'altro; nessuna vita extra | 3 a ogni livello |
| Progressi | `coretechPacReached`: pulsante **Continua** | Nessun Continua |
| Fine | Vittoria dopo il livello 5 | `result` alla fine del livello 3 |

**Messaggi all'app:**
- `start`: alla scheda del livello 1, cioè dopo l'animazione iniziale.
- `tick`: ogni 0,25 s nello stato di gioco, più uno al momento in cui il livello è superato. Il tempo non scorre durante PRONTI! (1,8 s) né durante l'animazione della vita persa (1,5 s).
- Livello superato (ultima monetina o floppy mangiato): salva tempo e vite; al livello 3 manda `result` con `ok: true`.
- Vite finite: `result` con `reason: 'lives'`, poi GAME OVER.
- 60 s nel livello: `result` con `reason: 'time'`; il gioco si ferma senza schermata.

## Livelli

I labirinti sono disegnati a mano in `MAZES` (`#` muro, `.` monetina, `o` floppy, spazio corridoio vuoto, `B` uscita della casetta dei bug, `-` porta, `G` casetta, `P` partenza). Tutte le monetine sono raggiungibili e non ci sono vicoli ciechi.

| Liv. | Nome | Labirinto (colonne × righe) | Monetine | Floppy | Uscita laterale | Bug | Velocità C | Velocità bug | Bug spaventati | Durata patch |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Rete aziendale | 13 × 13 | 61 | 4 | Riga 8 | 2 | 4,8 | 2,5 | 1,7 | 10,0 s |
| 2 | Server farm | 17 × 13 | 83 | 4 | Riga 8 | 3 | 5,0 | 2,8 | 1,8 | 9,0 s |
| 3 | Cloud ibrido | 19 × 15 | 85 | 4 | Riga 8 | 3 | 5,3 | 3,1 | 2,0 | 8,0 s |
| 4 | Data center | 19 × 21 | 144 | 4 | Riga 10 | 4 | 6,3 | 4,7 | 2,4 | 4,8 s |
| 5 | Core di sistema | 19 × 21 | 149 | 4 | Riga 10 | 4 | 6,4 | 5,1 | 2,5 | 3,6 s |

Velocità in caselle al secondo.

**Livelli 1–3 semplificati (v29)**, perché sono quelli della gara (1 minuto ciascuno):
- labirinti simmetrici con poche svolte: righe lunghe da un lato all'altro in alto e in basso, due corridoi verticali ai lati della casetta, nessuna sacca;
- i corridoi dell'uscita laterale (e nel livello 3 l'anello intorno alla casetta) non hanno monetine;
- la C è circa il 15% più lenta della v28 (prima 5,6 / 5,9 / 6,2) e i bug rallentano nella stessa proporzione (prima 2,9 / 3,3 / 3,7; spaventati 2,0 / 2,1 / 2,3), così non diventano più veloci rispetto alla C; la patch dura 1 s in più (prima 9 / 8 / 7 s);
- un giro che va sempre alla monetina più vicina, senza bug, finisce il livello in 18 s, 23 s e 22 s.

Il livello 3 ha la casetta dei bug sulla riga dell'uscita laterale. I livelli 4 e 5 hanno ciascuno il suo labirinto e non sono cambiati.

**Comportamento dei bug per livello:**

| Liv. | Scelta a caso agli incroci | Uscita dalla casetta (s dall'inizio) | Alternanza dispersione / inseguimento (s) |
|---|---|---|---|
| 1 | 45% | 0, 5 | 9 / 15 / 9 / 15 / 7 / poi sempre inseguimento |
| 2 | 38% | 0, 4, 9 | 8 / 17 / 8 / 17 / 6 / … |
| 3 | 30% | 0, 4, 8 | 8 / 18 / 7 / 18 / 5 / … |
| 4 | 8% | 0, 2, 4, 7 | 5 / 22 / 4 / 22 / 3 / … |
| 5 | 3% | 0, 1, 2,5, 4 | 4 / 24 / 3 / 24 / 2 / … |

Il primo bug parte già fuori dalla casetta; gli altri escono ai tempi indicati.

## Meccaniche

**La C (giocatore):**
- parte ferma e si muove solo quando si sceglie una direzione;
- la direzione scelta è **prenotata**: la C svolta al primo incrocio in cui è possibile; l'inversione di marcia è immediata anche a metà corridoio. La prenotazione resta valida finché la C non svolta o non si sceglie un'altra direzione; se è uguale alla direzione in cui la C sta già andando, scade dopo 0,6 s;
- **aiuto in curva** (v29): se la C è entro 0,35 caselle dal centro di un incrocio, prima o appena dopo, la svolta prenotata viene presa subito. La C viene messa sul centro dell'incrocio e solo il disegno scivola sulla nuova corsia, così non resta mai incastrata nei muri. Non torna indietro sull'incrocio dove ha appena svoltato o da cui è partita;
- si ferma pulita contro un muro; mangia monetine e floppy passando sopra le caselle;
- uscendo dall'uscita laterale rientra dal lato opposto (anche i bug, che lì rallentano al 55%).

**Bug:**
- alternano **dispersione** (ognuno verso il suo angolo) e **inseguimento** (ognuno con il suo bersaglio, vedi [Storia](#storia)); a ogni cambio invertono la marcia;
- a ogni incrocio, con la probabilità del livello, scelgono una strada a caso;
- quando restano meno di 20 monetine accelerano del 6%;
- non attraversano la porta della casetta, tranne per uscirne.

**Floppy (patch):** vale 50 punti e per la durata del livello tutti i bug diventano blu e lenti, anche quelli ancora nella casetta (escono subito). Nell'ultimo 1,6 s lampeggiano. Durante la patch l'alternanza dispersione/inseguimento si ferma.

**Collisioni** (distanza meno di circa due terzi di casella):
- bug spaventato: viene mangiato. Vale 200, 400, 800, 1600 punti per i bug mangiati di fila con la stessa patch. **Il bug mangiato non torna più per tutto il livello**, neanche dopo una vita persa;
- bug normale: si perde una vita. Animazione di 1,5 s, poi tutti tornano alla partenza (i bug mangiati restano fuori), PRONTI! e si riparte. Le monetine già mangiate restano mangiate.

**Fine del livello:** quando non restano monetine né floppy.

**Punteggio interno** (HUD, non va in classifica): monetina 10, floppy 50, bug 200/400/800/1600. Record in `coretechPacBest`.

## Comandi

| Azione | Tastiera | Touch |
|---|---|---|
| Direzione | Frecce oppure W A S D | Joystick sotto il labirinto, oppure scorrere il dito sul labirinto |
| Pausa | P oppure Esc | Pulsante `II` (in verticale: tasto A o tastino AVVIA/PAUSA) |
| Avanti nelle schermate | Invio (Inizia, Via!, Prossimo livello) | Pulsanti |
| Musica | – | Pulsante `♪` (in verticale: tasto B) |

- **Joystick a 4 direzioni:** la manopola segue il pollice entro la base e torna al centro al rilascio. La freccia della direzione scelta si colora di arancio. La direzione resta prenotata anche dopo aver lasciato il joystick. Dalla v29:
  - **zona morta del 30%**: dentro non cambia direzione;
  - **isteresi**: per passare dall'asse orizzontale a quello verticale (o viceversa) l'altro asse deve essere più marcato almeno del 20%, così vicino alla diagonale la direzione non salta avanti e indietro;
  - **manopola in diagonale** (i due assi entro il 20%): sceglie la direzione che la C può prendere al prossimo incrocio (entro 4 caselle davanti a lei; da ferma, quella libera). Mentre si tiene la diagonale, il gioco ricontrolla a ogni fotogramma: se la C sta andando nella direzione scelta e l'altra si apre all'incrocio successivo, passa all'altra; se la C è ferma contro un muro, passa a quella libera.
- **Scorrere sul labirinto:** ogni spostamento di almeno 16 px sceglie una direzione, prenotata come per il joystick (con lo stesso aiuto in curva); si possono concatenare più svolte senza staccare il dito.
- **Multi-touch:** il joystick segue un solo dito (`setPointerCapture`); lo scorrimento sul labirinto è indipendente. Sulla fascia comandi sono bloccati scroll, zoom e menu del tocco prolungato.
- La pausa è possibile anche durante PRONTI!. La pagina va in pausa da sola quando passa in secondo piano.

## Layout

- **Verticale:** scocca "Game Boy" ([giochi-comune.md](giochi-comune.md#scocca-game-boy-verticale)). Lo schermo ha le proporzioni del labirinto più alto (19:21,6) e lo spazio in più va ai comandi: joystick a sinistra, A = PAUSA e B = MUSICA a destra, tastini ISTRUZIONI e AVVIA/PAUSA sotto.
- **Orizzontale** (altezza ≤ 560 px): il joystick va in una colonna a sinistra del labirinto. Sugli schermi larghi almeno 760 px a destra c'è uno spazio vuoto della stessa misura, così il labirinto resta al centro.
- **Schermo grande** (computer): labirinto al centro, joystick sotto.
- Le caselle sono quadrate: il lato è il massimo intero che fa stare il labirinto nello spazio libero (almeno 8 px, densità fino a 2,5×).

## Colori

| Variabile | Colore | Uso |
|---|---|---|
| `--ct` | `#4b8ac9` | Blu CoreTech: la C, i bordi dei muri, il floppy, i pulsanti |
| `--ct-light` / `--ct-deep` | `#2f6399` | Testi blu, bordo dei pulsanti |
| `--coin-fill` | `#ffcf4a` | Monetine |
| `--coin` | `#c56a0c` | Punti, PRONTI!, PAC |
| `--navy` | `#004675` | Titoli delle card |
| `--danger` | `#d93a33` | Game over |

Labirinto: fondo `#f7fbff` con una griglia leggera, muri `#d9e7f5` con il bordo blu luminoso, porta della casetta rosa `#e0559f`. Bug: Glitch `#ff5d56`, Loop `#ff8ad8`, Leak `#5ee0ff`, Crash `#ffae42`; spaventati blu `#2340a8`.

## Audio

Effetti sintetizzati con Web Audio (nessun file audio): monetina (due note alternate), floppy, bug mangiato, vita persa, avvio e livello completato (arpeggi). Le lettere mangiate nell'animazione iniziale suonano come monetine. Il pulsante `♪` li accende e spegne; la scelta resta in `coretechPacSound`.

## Limiti noti

- Se il logo non si carica, l'animazione iniziale mostra solo la C e la scritta PAC.

---
Ultimo aggiornamento: 08/10/2026 (v29)
