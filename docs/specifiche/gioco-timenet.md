# Gioco Timenet Breakout

## In breve

Breakout (rompi-mattoncini) con il delfino di Timenet. Il delfino nuota sul pelo dell'acqua e fa rimbalzare un pallone da spiaggia contro un muro di mattoncini; dietro il muro c'è il logo Timenet. Ogni livello è un'ora della giornata lavorativa, dalle 08:00 alle 18:00. Se il pallone cade in acqua si perde un pallone (vita).

- Modalità libera: 5 livelli, nessun limite di tempo.
- Modalità gara (`?hub=1`): i primi 3 livelli, 1 minuto e 3 palloni ciascuno.
- Le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](giochi-comune.md).

| File | Ruolo |
|---|---|
| `games/timenet/index.html` | HUD, canvas, schermate, fascia di trascinamento, stile |
| `games/timenet/game.js` | Logica del gioco |
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale (`data-game="strip"`) |
| `img/timenet-logo.png` | Logo: schermata titolo, animazione iniziale, pannello dietro i mattoncini |
| `img/delfino.png` | Il delfino (guarda a sinistra, viene specchiato) |
| `fonts/`, `icons/` | Font locali e icone. `img/efuture-white.png` è presente ma non usato |

## Storia

- La giornata di lavoro di Timenet, "Connessi, sicuri, soddisfatti": 08:00 Apertura, 10:30 Riunione, 13:00 Pausa pranzo, 16:00 Scadenza, 18:00 Chiusura.
- Rompendo i mattoncini si scopre il logo Timenet. Negli ultimi due livelli il logo compare solo alla fine.

## Schermate

| Schermata | Contenuto | Pulsanti |
|---|---|---|
| **Titolo** (`ov-title`) | Logo Timenet su badge bianco, BREAKOUT, "Muovi il delfino e rompi i mattoncini col pallone.", "Record: N" se esiste. Sotto, sul campo, il delfino che ondeggia | **Inizia**, **Continua · Liv. N** (solo modalità libera, se c'è un livello raggiunto), **Istruzioni** |
| **Istruzioni** (`howBox`) | Tre righe con disegnino: mattoncini ("alcuni reggono più colpi"), pallone ("Non far cadere il pallone in acqua"), capsule ("C 3 palloni · S rete · ✓ delfino grande · T pallone grande e lento"). "5 livelli, dalle 08:00 alle 18:00." Tasti: Trascina o frecce · spazio lancia · P pausa | – |
| **Animazione iniziale** | Dopo **Inizia** (e **Gioca ancora**): il delfino salta fuori dall'acqua, lancia il pallone, il logo va in frantumi, compare BREAKOUT. Dura 4,2 s; "TOCCA PER SALTARE": un tocco o un tasto la salta | – |
| **Scheda del livello** (`ov-level`) | Etichetta "08:00 · Livello 1/5" (gara: "/3"), nome e frase del livello | **Via!** |
| **Livello completato** (`ov-clear`) | Dopo 0,9 s (1,9 s nei livelli col logo finale): "Livello N completato!", punti, mattoncini rotti, tempo | **Prossimo livello** |
| **Pausa** (`ov-pause`) | PAUSA | **Riprendi**, **Menu** |
| **Game over** (`ov-over`) | "Pallone in acqua", GAME OVER, "Palloni finiti. Riprova!", punti, livello N/5 (gara N/3) | **Riprova livello**, **Menu** |
| **Vittoria** (`ov-win`) | "Missione compiuta", GIORNATA CHIUSA, "Tutti i mattoncini rotti. Connessi, sicuri, soddisfatti.", punteggio finale, record, "Nuovo record!" o "Record da battere: N" | **Gioca ancora** |

**HUD:** Punti, Palloni (pallini colorati come il pallone), nome del livello (`08:00 · Apertura`), pulsante musica `♪` (spento: `×`), pulsante pausa `II`.

**Scritte sul campo:** sulla riga più in alto del campo (y = 14, sopra il muro) a sinistra i timer dei poteri attivi (`✓ 12`, `T 7`, `S rete`), a destra l'ora del livello; sopra il delfino i messaggi brevi ("Tocca per lanciare", "Tocca per rilanciare", "Salvato!", nome del potere preso).

## Modalità libera e modalità gara

Regole comuni e protocollo: [giochi-comune.md](giochi-comune.md#modalità-libera-e-modalità-gara).

| | Modalità libera | Modalità gara (`?hub=1`) |
|---|---|---|
| Livelli | 5 | 3: Apertura, Riunione, Pausa pranzo |
| Palloni (vite) | 3 a inizio partita, si portano da un livello all'altro; massimo 6 con la capsula `+` | 3 a ogni livello; la capsula `+` non supera 3 |
| Progressi | `timenetBreakReached`: pulsante **Continua** | Nessun Continua |
| Fine | Vittoria dopo il livello 5 | `result` alla fine del livello 3 |

**Messaggi all'app:**
- `start`: alla scheda del livello 1, cioè dopo l'animazione iniziale.
- `tick`: ogni 0,25 s nello stato di gioco, anche mentre il pallone è fermo sul delfino in attesa del lancio. Uno in più al momento in cui il livello è superato, con il tempo finale.
- Livello superato: salva tempo e palloni rimasti; al livello 3 manda `result` con `ok: true`.
- Palloni finiti: `result` con `reason: 'lives'`, poi GAME OVER.
- 60 s nel livello: `result` con `reason: 'time'`; il gioco si ferma senza schermata.

## Livelli

Campo logico 360 × 600. Il muro occupa tutta la larghezza (bordi di 12 px) e parte da y = 28 (dalla v28; prima 64): sopra resta solo la riga dei timer e dell'ora. Il mare inizia a y = 512, il pallone rimbalza sul delfino a y = 494.

| Liv. | Ora – nome | Frase | Muro (colonne × righe) | Mattoncini | Da 2 colpi | Dorati ★ | Velocità pallone | Larghezza delfino | Raggio pallone | Logo |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 08:00 Apertura | "12 blocchi: dietro c'è il logo." | 4 × 3 | 12 | 0 | 1 | 430 | 98 | 12,5 | Si scopre a pezzi |
| 2 | 10:30 Riunione | "20 blocchi. I blu medi: 2 colpi." | 5 × 4 | 20 | 4 | 1 | 365 | 92 | 11 | Si scopre a pezzi |
| 3 | 13:00 Pausa pranzo | "30 blocchi, angoli da 2 colpi." | 6 × 5 | 30 | 16 | 2 | 395 | 86 | 9,5 | Si scopre a pezzi |
| 4 | 16:00 Scadenza | "42 blocchi. Il logo appare alla fine." | 7 × 6 | 42 | 26 | 1 | 435 | 80 | 8 | Compare alla fine |
| 5 | 18:00 Chiusura | "56 blocchi. Ultimo sforzo!" | 8 × 7 | 56 | 44 | 2 | 470 | 74 | 7 | Compare alla fine |

- Velocità in unità logiche al secondo; l'altezza dei mattoncini scende da 50 a 21,4 così il muro (alto 150 in tutti i livelli, da y = 28 a 178) copre sempre il logo. Il pannello del logo segue la posizione del muro.
- I muri sono simmetrici: bordo di mattoncini blu medi da 2 colpi, interno azzurro e blu scuro, dorati al centro.

**Tipi di mattoncino:**

| Tipo | Colpi | Punti | Colore |
|---|---|---|---|
| Azzurro (`a`) | 1 | 50 | `#46a0d2` |
| Blu scuro (`b`) | 1 | 50 | `#195087` |
| Blu medio (`g`) | 2 (crepe visibili) | 100 | `#2d74a8` |
| Dorato ★ (`o`) | 1 | 200, lascia sempre una capsula | `#ffcf4a` |

Il codice prevede anche mattoncini da 3 colpi (`h`) e di acciaio indistruttibili (`x`), oggi non usati nelle mappe.

## Meccaniche

**Delfino e pallone:**
- A inizio livello e dopo ogni pallone perso, il pallone è appoggiato sul muso del delfino. Si lancia con un tocco o con spazio, verso il lato in cui guarda il delfino (15–45° dalla verticale).
- Il rimbalzo dipende da dove il pallone tocca il delfino: al centro va dritto, ai lati fino a circa 60°.
- A ogni rimbalzo sul delfino il pallone accelera dell'1,5%, fino a +30%. Il moltiplicatore torna a 1 quando si perde un pallone.
- Il pallone non può prendere traiettorie quasi orizzontali (almeno il 30% della velocità resta verticale).
- Con le frecce il delfino si muove a 440 unità/s; trascinando segue il dito con un leggero ritardo.

**Capsule:** cadono a 130 unità/s da un mattoncino rotto (sempre dai dorati, 9% dagli altri). Si prendono toccandole col delfino. Ogni capsula vale 100 punti.

| Capsula | Nome | Probabilità | Effetto |
|---|---|---|---|
| `C` | CONNESSI | 27% | Ogni pallone in volo (max 3) si divide in 3 |
| `S` | SICURI | 24% | Rete sul fondo: salva un pallone una volta ("Salvato!") |
| `✓` | SODDISFATTI | 24% | Delfino largo 1,4 volte per 15 s |
| `T` | TEMPO | 20% | Per 10 s il pallone è più lento (×0,68) e più grande (raggio ×1,7), con un alone viola. Messaggio "TEMPO · pallone grande e lento" |
| `+` | +1 PALLONE | 5% | Un pallone (vita) in più |

**Pallone grande (capsula `T`):** il raggio cresce e torna normale in modo graduale (circa 0,4 s). Il raggio attuale vale per tutte le collisioni: pareti, mattoncini (colpi più larghi), delfino (più facile da prendere) e rete. Il pallone cresce solo dove c'è spazio libero, quindi non resta mai incastrato in pareti o mattoncini; i palloni nati da `C` mantengono la dimensione del pallone da cui nascono. Il pallone nuovo sul delfino ha la dimensione normale.

**Pallone perso:** quando tutti i palloni in gioco cadono in acqua (spruzzo), si perde una vita; delfino grande, pallone grande e lento e capsule in caduta si annullano, la rete resta.

**Punteggio interno** (HUD, non va in classifica): mattoncino rotto 50/100/200, colpo su un mattoncino che resiste 10, capsula presa 100. Record in `timenetBreakBest`.

## Comandi

| Azione | Tastiera | Touch / mouse |
|---|---|---|
| Muovi | ← → oppure A D | Trascinare sulla fascia sotto il gioco, oppure trascinare sul campo |
| Lancia | Spazio | Tocco senza trascinare (sul campo o sulla fascia) |
| Pausa | P oppure Esc | Pulsante `II` (in verticale: tasto A o tastino AVVIA/PAUSA) |
| Avanti nelle schermate | Invio (Inizia, Via!, Prossimo livello) | Pulsanti |
| Musica | – | Pulsante `♪` (in verticale: tasto B) |

- **Fascia di trascinamento** ("Trascina il delfino / tocca per lanciare"): funziona come un touchpad. Il delfino si sposta della distanza percorsa dal dito, moltiplicata per 1,3, senza saltare sotto il dito.
- **Sul campo:** il delfino va dove si tocca e segue il dito.
- **Mouse:** il delfino segue il puntatore anche senza cliccare.
- Si segue un solo dito alla volta: un secondo dito prende il posto del primo.
- La pagina va in pausa da sola quando passa in secondo piano.

## Layout

- **Verticale:** scocca "Game Boy" ([giochi-comune.md](giochi-comune.md#scocca-game-boy-verticale)): fascia scura di trascinamento a sinistra, A = PAUSA, B = MUSICA, tastini ISTRUZIONI e AVVIA/PAUSA sotto la fascia.
- **Orizzontale** (altezza ≤ 560 px): la fascia di trascinamento diventa una colonna verticale di 120 px a sinistra del campo.
- Il campo mantiene il rapporto 360:600 e si adatta allo spazio libero (densità fino a 2,5×).

## Colori

| Variabile | Colore | Uso |
|---|---|---|
| `--tn-dark` | `#195087` | Blu scuro Timenet: titoli, mattoncini `b`, mare in basso |
| `--tn-mid` | `#2d74a8` | Blu medio: pulsanti, mattoncini da 2 colpi, mare |
| `--tn-light` | `#46a0d2` | Azzurro: mattoncini `a`, frecce della fascia |
| (sole) | `#ffcf4a` | Mattoncini dorati, spicchio del pallone |
| `--sun` | `#c56a0c` | Punti e valori evidenziati |
| `--danger` | `#d8423b` | Game over |

Il cielo va da `#f7fbfe` a `#d5e8f5`, con un riflesso arancio sull'orizzonte. Il pallone da spiaggia ha spicchi bianco, azzurro, giallo, blu e rosso.

## Audio

Effetti sintetizzati con Web Audio (nessun file audio): mattoncino rotto (nota che sale), mattoncino che resiste, rimbalzo sul delfino, pareti, capsula (arpeggio), pallone perso, spruzzo, avvio e livello completato (arpeggi). Il pulsante `♪` li accende e spegne; la scelta resta in `timenetBreakSound`.

## Limiti noti

- Se `delfino.png` non si carica, il delfino è disegnato in vettoriale.
- Il tempo di gara scorre anche mentre il pallone aspetta il lancio.

---
Ultimo aggiornamento: 08/10/2026 (v28)
