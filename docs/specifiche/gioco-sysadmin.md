# Gioco Efuture Bros (Efuture)

Fino alla v41 si chiamava "SysAdmin Runner". La cartella resta `games/sysadmin/` e l'id del gioco resta `sysadmin` (classifica e codici non cambiano).

## In breve

Platform a scorrimento orizzontale. Il giocatore è il sysadmin di guardia (la testa è il logo Efuture): attraversa le stanze dei clienti, elimina i bug saltandoci sopra o lanciando il mouse, evita trappole e burroni, sale la scala e risolve il ticket del cliente. Dopo 9 clienti c'è l'hacker finale nel suo bunker.

- Modalità libera: 10 livelli (9 clienti + boss), nessun limite di tempo.
- Modalità gara (`?hub=1`): i primi 3 livelli, 1 minuto e 3 vite ciascuno.
- Tutto il gioco (stile e logica) è in un solo file: `games/sysadmin/index.html`.
- Le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](giochi-comune.md).

| File | Ruolo |
|---|---|
| `games/sysadmin/index.html` | HUD, canvas, schermate, comandi touch, stile e tutta la logica |
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale (`data-game="sysadmin"`) |
| `img/logo-testa.png` | Logo Efuture usato come testa del giocatore |
| `img/efuture-white.png` | Logo bianco, ricolorato in blu e usato come filigrana nel cielo |
| `fonts/`, `icons/` | Font locali (Press Start 2P, IBM Plex Mono 400/500/600) e icone. L'icona (anche `img/g-sysadmin.png` nella home) mostra l'omino del gioco con la testa "e" di Efuture su sfondo azzurro dell'ufficio, con un bug rosso a destra e il bordo giallo; è disegnata con la stessa funzione del gioco (`drawHumanLogoFigure`) |

## Storia

- Ogni livello è il **ticket di un cliente**, in una stanza a tema. Il cliente aspetta in cima a una scala alla fine del livello.
- I clienti: Marco (Alba: da casa al cliente), Giulia (In ufficio al tramonto), Paolo (Notte in smart working), Elena (Sala Rete), Davide (Data Center Cloud), Sara (Sala Controllo), Fabio (Sala Sviluppo), Ilaria (Sala Database), Team IT (Difesa Critica).
- Livello 10: **l'hacker** nel Bunker dell'Hacker. Sconfitto lui, il Capo promuove il giocatore a "Senior Sysadmin".

## Schermate

Le schermate sono overlay sopra il canvas, con una card bianca al centro.

| Schermata | Contenuto | Pulsanti |
|---|---|---|
| **Titolo** (`ov-title`) | Riga piccola "Livello 1 di 10 · missione IT" (in gara: "3 livelli · 1 minuto · 3 vite"), titolo EFUTURE BROS, "Sei il sistemista di Efuture: elimina i bug del cliente. Ne sarà soddisfatto!" In modalità libera anche "Record attuale" (tempo) e "Miglior pulizia" (%), se esistono | **Inizia**, **Continua · Liv. N** (solo modalità libera, se c'è un livello raggiunto), **Istruzioni** |
| **Istruzioni** (`howBox`, dentro il titolo) | Salta sui bug o lanciagli il mouse · Schiva chiodi, scosse e seghe · 3 bug di fila: sblocchi l'antivirus · Sali la scala e raggiungi il cliente. Sotto: ← → muovi · ↑ salta · X mouse · V antivirus | – |
| **Scheda del livello** (`ov-intro`) | Etichetta "Cliente N/9" (gara: "Livello N/3"; boss: "Livello finale", viola), "Ticket di *Nome*" (boss: "*Nome* — *Stanza*"), messaggio del cliente (per esempio "È l'alba: gioca d'anticipo e ferma i bug prima che arrivino in ufficio!") | **Risolvi!** (boss: **Affrontalo**) |
| **Cliente non convinto** (`ov-complaint`) | Si apre se si arriva al cliente con bug ancora vivi: "*Nome* non è convinto", "Ci sono ancora N bug in giro. Torni a stanarli?" | **Torna a debuggare** (riporta il giocatore prima della scala), **Chiudi il ticket** |
| **Livello completato** (`ov-complete`) | "Problema risolto", "*Nome* ringrazia!" con il ringraziamento del cliente; se rimasti bug: "*Nome* ringrazia, ma..." e "Ma qualche bug è rimasto in giro." Punteggio | **Prossimo ticket** |
| **Pausa** (`ov-pause`) | PAUSA | **Riprendi**, **Riparti dal ticket**, **Menu** |
| **Game over** (`ov-gameover`) | "Sistema compromesso", GAME OVER, "Stavolta hanno vinto i bug.", punteggio e "Cliente N di 10" | **Riprova ticket**, **Menu** |
| **Vittoria** (`ov-victory`) | Scena animata (clienti che arrivano, il Capo con il diploma, coriandoli, "★ PROMOSSO A SENIOR SYSADMIN ★"), "Promozione!", SYSADMIN SUPREMO, "Hacker sconfitto: il capo ti promuove!", punteggio finale, tempo, bug risolti (N/M e %), righe di record | **Nuova chiamata** (azzera i progressi) |

Toast in alto (verde) durante il gioco: "N/3 bug per l'antivirus", "ANTIVIRUS SBLOCCATO! Premi V", "Hai perso l'antivirus!", "Combo bug interrotta!".

**HUD:** cuori delle vite (3), tempo totale della partita `⏱ mm:ss`, "Ticket N/10 · *cliente*" (gara: N/3), punti, pulsante pausa `II`. Nel livello del boss compare la barra della vita dell'hacker ("L'HACKER").

## Modalità libera e modalità gara

Regole comuni e protocollo: [giochi-comune.md](giochi-comune.md#modalità-libera-e-modalità-gara).

| | Modalità libera | Modalità gara (`?hub=1`) |
|---|---|---|
| Livelli | 10 (Marco … Team IT, poi l'hacker) | 3: Marco (Alba: da casa al cliente), Giulia (In ufficio al tramonto), Paolo (Notte in smart working). Niente boss |
| Vite | 3 a inizio partita, si portano da un livello all'altro; **Continua** e **Riprova ticket** le riportano a 3. La vita dal cielo ne aggiunge una (massimo 5) | 3 a ogni livello, più la vita dal cielo. "Riparti dal ticket" (pausa) non ridà le vite |
| Progressi | `sysadminRunnerProgress` (`bestUnlocked`): pulsante **Continua** | Nessun Continua |
| Fine | Vittoria dopo il boss | `result` alla fine del livello 3 (senza schermata del gioco) |

**Messaggi all'app:**
- `start`: all'avvio del livello 1 (pulsante **Inizia**).
- `tick`: ogni 0,25 s nello stato di gioco. Il tempo si ferma su pausa, scheda del livello, "Cliente non convinto" e livello completato.
- Livello superato (anche con **Chiudi il ticket**, cioè con bug rimasti): salva tempo e vite; al livello 3 manda `result` con `ok: true`.
- Vite finite: `result` con `reason: 'lives'`, poi la schermata GAME OVER.
- **Riprova il livello:** dopo una sconfitta (vite finite o tempo scaduto) `result` ha anche `retry: true`. L'app mostra il punteggio (già salvato) e il pulsante **Riprova livello N**: manda al gioco `{type:'efg-cmd', cmd:'retry'}` e il gioco (`efgRetry()`) riparte dalla scheda dello stesso livello, con 3 vite e il minuto da capo; i livelli già superati restano. Anche **Riprova ticket** del GAME OVER, in gara, fa la stessa cosa. Alla fine il gioco manda un nuovo `result`: in classifica conta il migliore.
- 60 s nel livello: `result` con `reason: 'time'`; il gioco si ferma senza schermata.

## Livelli

Campo logico 960 × 540, terreno a y = 470. I livelli 1–9 sono generati da un generatore pseudo-casuale con seme fisso per livello (`1000 + indice × 37`): ogni livello è **sempre uguale**.

**I primi 3 livelli** (quelli della gara) raccontano una giornata di lavoro e sono più lunghi, con più bug (circa 35–45 secondi sul minuto a disposizione):

| Liv. | Sfondo | Cosa rappresenta | Parametri (`LV3` nel codice) |
|---|---|---|---|
| 1 | **Alba: da casa al cliente**: l'omino **parte da casa sua** (casetta con la porta aperta e il camino che fuma, senza scritte) e attraversa un campo di grano all'alba (sole che sorge, colline, nuvole rosate); in fondo, dietro la scala, c'è **l'ufficio del cliente** (palazzo con un'insegna blu, senza scritte). Se esiste `games/sysadmin/img/alba.jpg` (l'immagine dell'evento) il cielo e il campo sono quella foto | Proattività: si parte presto | lunghezza 6000, 12 nemici a terra, 2 volanti, 2 chiodi, 1 scossa, nessuna sega, burroni 14%, nemici 55 px/s, pedane 100% |
| 2 | **In ufficio al tramonto**: l'omino è **in ufficio**: vetrate sul tramonto con lo skyline, file di scrivanie con pc e stampanti da cui volano via i fogli | Quasi fine giornata | lunghezza 7000, 16 nemici a terra, 3 volanti, 3 chiodi, 2 scosse, 1 sega, burroni 22%, nemici 72 px/s, pedane 50% |
| 3 | **Notte in smart working**: l'omino è **a casa sua, di notte, in smart working**: stanza con finestre sulla città di notte (stelle, luna), orologio e quadri, scrivania con il portatile acceso e la lampada, libreria e divano; luce rossa d'emergenza che lampeggia. Bug **cattivi con il cappuccio** e occhi rossi (anche quelli volanti) | Emergenza | lunghezza 8400, 21 nemici a terra, 5 volanti, 4 chiodi, 4 scosse (accese più a lungo), 3 seghe più veloci (140 px/s), burroni 30%, nemici 90 px/s, pedane 75% |

**Sfondi lontani e sfocati:** i tre sfondi si disegnano su una tela grande un quarto e poi si ingrandiscono, quindi risultano morbidi e sfocati; sopra c'è un velo chiaro (scuro di notte, circa 45%) che smorza i colori. Scrivanie e mobili stanno più in fondo: tra loro e il terreno di gioco c'è una fascia di pavimento di 50 px. Così l'omino, i nemici, le pedane e le trappole, che sono nitidi, non si confondono con lo sfondo.

**In ordine di difficoltà:** dal livello 1 al 3 crescono nemici, nemici volanti, trappole, burroni e velocità dei nemici, e le pedane calano (risultato reale: 13, 11 e 10 pedane; nemici a terra 12, 16 e 18; trappole 3, 6 e 11; burroni 1, 5 e 8).

**Pedane (livelli 1–3):** su ogni tratto di terreno con la probabilità `plat` del livello (100%, 50%, 75%), due sui tratti lunghi oltre 470 px (probabilità `plat` × 0,7), larghe 100–160 px e alte 92–130 px sul terreno. Hanno un'ombra sotto e un filo chiaro sopra per staccarsi dallo sfondo. Le genera un generatore a parte (seme `3000 + i × 41`), così il resto del livello non cambia.

**Non solo bug:** in tutti i livelli circa il 30% dei nemici a terra sono **alert** (cartello giallo di pericolo con il punto esclamativo, che cammina) e circa la metà di quelli in volo sono **email spam** (busta con le ali e la scritta SPAM). Si comportano come i bug: si eliminano saltandoci sopra o con il mouse e contano come bug eliminati.

**Vita dal cielo:** in ogni livello normale cade **una vita in più**, una sola volta. Quando l'omino supera il 30% del livello compare il messaggio "Una vita cade dal cielo: prendila!" e un cuore con il paracadute scende piano, ondeggiando, circa 320 px davanti a lui. Se la prende guadagna una vita (fino a 5; se ha già il massimo, +300 punti). Se tocca terra resta lì per 9 secondi (lampeggia negli ultimi 3) e poi sparisce; se cade in un burrone si perde. Una volta presa o persa non torna, nemmeno se il livello riparte.

Nei primi 3 livelli i tratti di terreno sono più ampi (320–600 px) e i bug pattugliano 60–140 px. I numeri sono obiettivi: se un bug o una trappola non trova posto non viene messo (vedi la tabella sotto).

**Bug e trappole non si sovrappongono mai:** prima si piazzano le trappole, poi i bug a terra, che restano ad almeno 50 px da ogni trappola (per una sega: da tutto il suo percorso). I bug volanti non volano sopra le trappole (60 px di margine).

**Regole di generazione dei livelli 4–9 (indice i = 3…8):**
- lunghezza base 3400 + 520·i px, più la scala finale;
- tratti di terreno da 220–440 px; probabilità di burrone dopo un tratto min(0,16 + 0,05·i; 0,58), largo 90–145 px (+ fino a 35);
- piattaforme sospese (110–180 px) con probabilità 0,4 + 0,02·i per tratto;
- bug a terra: 6 + round(1,4·i) (meno se non trovano posto lontano dalle trappole), velocità 55 + 7·i (+0…30) px/s, pattugliano 90–180 px;
- bug volanti: dal livello 4, min(i − 2; 6), ondeggiano in verticale;
- chiodi dal livello 2, scosse elettriche dal livello 3, seghe dal livello 4 (velocità 85 + 9·i px/s). Ogni trappola ha almeno 110 px di terreno libero prima e dopo;
- in fondo una scala di 6 gradini con il pianerottolo (150 px) e la **porta del piano superiore** (46×80 px, anta in legno con finestrella e maniglia, cartello verde "PIANO SUP."). Il **cliente sta davanti alla porta**, un po' spostato a destra. La porta si apre (anta che ruota sul cardine sinistro e luce verde dentro, con ▲) quando il giocatore arriva a meno di 120 px, e si richiude se si allontana.
- **Clienti:** figure umane con testa, capelli, occhi, sorriso, collo, mani e scarpe; l'abito dipende dal cliente (giacca, camice, divisa, felpa, abito, grembiule). Si alternano **uomo e donna** a ogni ticket (Marco, Giulia, Paolo, Elena, Davide, Sara, Fabio, Ilaria, Team IT): le donne hanno capelli lunghi e gonna con abito o camice.

**Risultato (conteggi reali del generatore):**

| Liv. | Cliente – stanza | Lunghezza (px) | Burroni | Piattaforme | Bug a terra | Bug volanti | Chiodi | Scosse | Seghe |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Marco – Alba: da casa al cliente | 6184 | 1 | 13 | 12 | 2 | 2 | 1 | 0 |
| 2 | Giulia – In ufficio al tramonto | 7184 | 5 | 11 | 16 | 3 | 3 | 2 | 1 |
| 3 | Paolo – Notte in smart working | 8584 | 8 | 10 | 18 | 5 | 4 | 4 | 3 |
| 4 | Elena – Sala Rete | 5225 | 2 | 6 | 7 | 1 | 2 | 2 | 1 |
| 5 | Davide – Data Center Cloud | 5810 | 4 | 7 | 8 | 2 | 3 | 2 | 1 |
| 6 | Sara – Sala Controllo | 6318 | 6 | 9 | 9 | 3 | 3 | 3 | 1 |
| 7 | Fabio – Sala Sviluppo | 6743 | 10 | 10 | 9 | 4 | 4 | 4 | 0 |
| 8 | Ilaria – Sala Database | 7382 | 12 | 9 | 6 | 5 | 4 | 4 | 2 |
| 9 | Team IT – Difesa Critica | 7744 | 8 | 11 | 12 | 6 | 5 | 5 | 0 |
| 10 | Bunker dell'Hacker | 1500 | 0 | 3 | boss | – | – | 1 | 1 |

In gara si giocano solo le prime 3 righe.

**Livello 10 (boss):** arena di 1500 px senza burroni, 3 piattaforme, una scossa e una sega fisse. L'hacker (6 punti vita) pattuglia la parte destra e:
- spara un colpo verso il giocatore ogni 2 s; sotto metà vita ogni 1,35 s, con un secondo colpo dopo 0,35 s;
- ogni 4,2 s (il primo dopo 3,5 s) chiama un virus di supporto, al massimo 2 alla volta.

L'antivirus è sbloccato dall'inizio.

**Temi:** i primi 3 livelli hanno uno sfondo disegnato a parte (alba, open space, notte: vedi sopra). Le altre stanze hanno cielo, terreno, oggetti sullo sfondo (monitor, rack, router, nuvole, database…), un effetto animato (scansione, braci, radar, pioggia di codice, allarme rosso, matrice…) e una specie di bug con il suo colore.

## Meccaniche

**Giocatore** (44 × 60 px):
- velocità 350 px/s, gravità 2200, salto −800 px/s, caduta massima 1200 px/s;
- salto "tollerante": vale ancora per 0,09 s dopo aver lasciato il bordo e se premuto fino a 0,12 s prima di toccare terra;
- si gira nella direzione di marcia (anche la testa-logo è specchiata).

**Armi:**
- **Mouse** (X): proiettile dritto a 680 px/s, una volta ogni 0,42 s. Elimina un bug; sull'hacker toglie 1 vita.
- **Antivirus** (V): si sblocca con **3 bug eliminati di fila senza essere colpiti**. Proiettile verde a 560 px/s, ogni 1 s, che attraversa i nemici e li elimina tutti; sull'hacker toglie 2 vite. Si perde quando si viene colpiti.

**Collisioni:**
- **Pestare un bug** (cadendoci sopra): lo elimina e fa rimbalzare. Funziona anche mentre il giocatore lampeggia dopo un colpo.
- Saltare sull'hacker dall'alto gli toglie 1 vita; ogni altro contatto con un nemico, con un colpo dell'hacker o con una trappola attiva toglie una vita.
- Dopo un colpo: 1,3 s di invulnerabilità (il giocatore lampeggia) e un piccolo rinculo. Il livello continua.
- **Caduta in un burrone:** si perde una vita e il livello riparte dall'inizio (nemici e trappole al loro posto).
- **Trappole:** chiodi (sempre attivi), scosse (attive per 0,7–1,05 s ogni 1,9–2,9 s; spente si vede una linea tratteggiata), seghe che pattugliano avanti e indietro.

**Fine del livello:**
- livelli 1–9: toccare il cliente sul pianerottolo. Se tutti i bug sono eliminati il ticket si chiude; altrimenti si apre "Cliente non convinto";
- livello 10: azzerare la vita dell'hacker.

**Punteggio interno** (HUD, non va in classifica):

| Azione | Punti |
|---|---|
| Bug pestato | 100 |
| Bug colpito col mouse o con l'antivirus | 150 |
| Colpo all'hacker | 200 per punto vita tolto |
| Ticket chiuso con tutti i bug eliminati | 500 |
| Ticket chiuso con bug rimasti | 200 |

**Record locali** (solo modalità libera, in vittoria):
- `sysadminRunnerBestTime`: tempo totale più basso;
- `sysadminRunnerBestDebug`: percentuale più alta di bug eliminati sul totale.

## Comandi

| Azione | Tastiera | Touch |
|---|---|---|
| Muovi | ← → oppure A D | Joystick: manopola a destra o a sinistra |
| Salta | ↑, spazio oppure W | Tasto **SALTA**, oppure spingere il joystick in alto |
| Mouse | X oppure Shift | Tasto **MOUSE** |
| Antivirus | V oppure C | Tasto **ANTIVIRUS** (grigio tratteggiato finché bloccato, verde pulsante quando pronto) |
| Pausa | P, oppure Esc durante il gioco | Pulsante `II` nell'HUD (in verticale: tastino AVVIA/PAUSA) |

**Joystick:**
- la manopola segue il dito fino al 62% del raggio e torna al centro al rilascio;
- zona morta del 20%: movimento digitale, alla stessa velocità delle frecce;
- salto: spinta in alto oltre il 60% e più verticale che orizzontale; per ripetere il salto si torna sotto il 35%;
- la manopola diventa arancio mentre è tenuta, la freccia attiva si colora.

**Multi-touch:** joystick e tasti seguono ciascuno il proprio dito (`setPointerCapture`), quindi si può correre e intanto saltare o lanciare. Sulla fascia comandi sono bloccati scroll, zoom e menu del tocco prolungato.

## Layout

- **Verticale:** scocca "Game Boy" ([giochi-comune.md](giochi-comune.md#scocca-game-boy-verticale)). Schermo 16:9; joystick a sinistra; a destra SALTA (A, arancio, grande), MOUSE (B, blu) e ANTIVIRUS (piccolo, sopra MOUSE). Il pulsante `II` è nascosto: la pausa si fa con il tastino AVVIA/PAUSA. Le schermate coprono tutta la console, tranne i tastini.
- **Orizzontale** (altezza ≤ 560 px): HUD sottile in alto; joystick nella colonna di sinistra; ANTIVIRUS, MOUSE e SALTA impilati nella colonna di destra; gioco al centro. Le schermate coprono tutto lo schermo. Sotto i 360 px di altezza i tasti si rimpiccioliscono.
- **Schermo grande** (computer): gioco al centro, fascia comandi touch sotto.
- Il canvas mantiene il rapporto 960:540 e si adatta allo spazio libero (densità fino a 2×).

## Colori

| Variabile | Colore | Uso |
|---|---|---|
| `--bg` | `#eef4fa` | Sfondo |
| `--ef-blue` / `--accent-2` | `#004675` | Titoli, tasto MOUSE, manopola del joystick |
| `--accent` | `#f18c22` | Pulsanti principali, tasto SALTA |
| `--ef-yellow` | `#c56a0c` | Punti e valori evidenziati |
| `--hacker` | `#8a2fc9` | Barra e scheda dell'hacker |
| `--av` | `#39e07a` | Antivirus e toast |
| `--danger` / `--ok` | `#d93a2b` / `#1f9d55` | Cuori e game over / ticket risolto |

Ogni stanza ha i suoi colori di cielo e terreno (vedi `THEMES` nel sorgente).

## Audio

Il gioco non ha suoni.

## Limiti noti

- Se il logo della testa non si carica, il giocatore è disegnato come un ragazzo con la felpa.
- Quando il livello riparte (caduta in un burrone, "Riparti dal ticket", "Riprova ticket") i bug tornano vivi, ma il conteggio dei bug eliminati e la serie per l'antivirus non si azzerano. Così si può arrivare al cliente con bug vivi senza la schermata "Cliente non convinto", e la percentuale di pulizia può risultare più alta del reale (è limitata al 100% per livello).
- Il toast "ANTIVIRUS SBLOCCATO! Premi V" cita il tasto della tastiera anche sul telefono.
- Restano chiamate a `window.claude.hot` (salvataggio dei progressi in un ambiente di sviluppo). Fuori da quell'ambiente non fanno nulla.

---
Ultimo aggiornamento: 07/10/2026 (v27)
