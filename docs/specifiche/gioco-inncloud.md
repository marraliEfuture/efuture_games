# Gioco inncloud Invaders

## In breve

Sparatutto nello stile di Space Invaders. Il giocatore guida la nuvola di inncloud lungo il fondo dello schermo; il suo cannone è il pallino rosso della "i" del logo e **spara solo quando il giocatore lo comanda** (tasto **SPARA**, Spazio). Dalla v28 non c'è più il fuoco automatico. Dall'alto scende una formazione di bug, virus e hacker che spara codici verdi. Ci si ripara dietro 4 nuvolette-firewall. All'ultimo livello c'è il boss Ransomware.

- Modalità libera: 5 livelli, nessun limite di tempo.
- Modalità gara (`?hub=1`): i primi 3 livelli, 1 minuto e 3 vite ciascuno.
- Le parti comuni ai 4 giochi (modalità gara, scocca "Game Boy") sono in [giochi-comune.md](giochi-comune.md).

| File | Ruolo |
|---|---|
| `games/inncloud/index.html` | HUD, canvas, schermate, fascia di trascinamento, tasto SPARA (`fireBtn`), stile |
| `games/inncloud/game.js` | Logica del gioco |
| `games/gameboy.css`, `games/gameboy.js` | Scocca "Game Boy" in verticale (`data-game="strip"`) |
| `img/inncloud-logo.png` | Logo: schermata titolo, animazione iniziale, filigrana nel cielo |
| `fonts/`, `icons/` | Font locali e icone. L'icona (anche `img/g-inncloud.png` nella home), su fondo scuro con bordo rosso: invasore verde in alto, sotto a sinistra la "i" bianca con il puntino rosso di inncloud e a destra, ben staccata, la nuvola bianca. `img/efuture-white.png` è presente ma non usato |

## Storia

- Gli attacchi al cloud diventano sempre più seri: Login sospetto, Phishing, Malware, Botnet e infine il Ransomware, un lucchetto con il teschio e la scritta "PAY $".
- Il logo inncloud è una filigrana blu nel cielo: più attaccanti si abbattono, più diventa nitido.

## Schermate

| Schermata | Contenuto | Pulsanti |
|---|---|---|
| **Titolo** (`ov-title`) | Logo inncloud su badge bianco, INVADERS, "Guida la nuvola di inncloud e ferma gli hacker.", "Record: N" se esiste. Sul campo, la nuvola | **Inizia**, **Continua · Liv. N** (solo modalità libera, se c'è un livello raggiunto), **Istruzioni** |
| **Istruzioni** (`howBox`) | Tre righe con disegnino: "Premi SPARA per colpire, trascina per muoverti.", "Abbatti tutti, schiva i codici verdi.", "Riparati dietro le nuvolette." "5 livelli, boss finale." Tasti: Trascina o frecce · Spazio spara · P pausa | – |
| **Animazione iniziale** | Dopo **Inizia** (e **Gioca ancora**): un hacker scende sul logo, il pallino rosso della "i" parte e lo abbatte, il logo scivola giù e diventa la nuvola, compare INVADERS. Dura 4,3 s; "TOCCA PER SALTARE": un tocco o un tasto la salta | – |
| **Scheda del livello** (`ov-level`) | **Non compare più:** il livello parte subito, senza nome né frase di spiegazione (la scheda resta nella pagina ma non viene mostrata) | – |
| **Livello superato** (`ov-clear`) | Dopo 1,1 s: "Attacco respinto", "Livello N superato!", punti, attaccanti abbattuti, tempo | **Prossimo livello** |
| **Pausa** (`ov-pause`) | PAUSA | **Riprendi**, **Menu** |
| **Game over** (`ov-over`) | "Cloud violato", GAME OVER, "Difese bucate.", punti, livello N/5 (gara N/3) | **Riprova livello**, **Menu** |
| **Vittoria** (`ov-win`) | "Missione compiuta", CLOUD AL SICURO, "Ransomware sconfitto: dati al sicuro.", punteggio finale, record, "Nuovo record!" o "Record da battere: N" | **Gioca ancora** |

**HUD:** Punti, Vite (nuvolette con il pallino rosso), "Liv. N/5 · *nome*", pulsante musica `♪` (spento: `×`), pulsante pausa `II`.

**Scritte sul campo:** messaggi brevi a metà schermo ("+200 · DOPPIO COLPO", "RANSOMWARE SCONFITTO +2000"), `x2 N` in basso a sinistra durante il doppio colpo, barra "RANSOMWARE" in cima al campo (y = 14) nel livello del boss.

## Modalità libera e modalità gara

Regole comuni e protocollo: [giochi-comune.md](giochi-comune.md#modalità-libera-e-modalità-gara).

| | Modalità libera | Modalità gara (`?hub=1`) |
|---|---|---|
| Livelli | 5 | 3: Login sospetto, Phishing, Malware. Niente boss |
| Vite | 3 a inizio partita, si portano da un livello all'altro | 3 a ogni livello |
| Progressi | `inncloudInvReached`: pulsante **Continua** | Nessun Continua |
| Fine | Vittoria dopo il boss | `result` alla fine del livello 3 |

**Messaggi all'app:**
- `start`: all'avvio del livello 1, cioè dopo l'animazione iniziale.
- `tick`: ogni 0,25 s nello stato di gioco, più uno al momento in cui il livello è superato.
- Livello superato: salva tempo e vite; al livello 3 manda `result` con `ok: true`.
- Vite finite (anche quando la formazione arriva in fondo): `result` con `reason: 'lives'`, poi GAME OVER.
- 60 s nel livello: `result` con `reason: 'time'`; il gioco si ferma senza schermata.

## Livelli

Campo logico 360 × 600. La nuvola sta a y = 548; le 4 nuvolette-firewall a y = 468.

| Liv. | Nome | Frase (non più mostrata) | File (dall'alto) | Attaccanti | Velocità formazione | Fuoco nemico | Velocità codici |
|---|---|---|---|---|---|---|---|
| 1 | Login sospetto | "Tre file lente: prendi la mira." | K V B | 3 × 8 = 24 | 16 | 0,55 | 170 |
| 2 | Phishing | "Virus via email: più file, più veloci." | K V V B | 4 × 8 = 32 | 20 | 0,85 | 185 |
| 3 | Malware | "Cinque file, più colpi. Usa le nuvolette." | K V V B B | 5 × 8 = 40 | 24 | 1,15 | 200 |
| 4 | Botnet | "Hacker coordinati, più aggressivi." | K K V V B B | 6 × 8 = 48 | 23 | 1,3 | 210 |
| 5 | Ransomware | "Boss finale: svuota la sua barra." | V B + boss | 2 × 7 = 14 + boss | 22 | 1,1 | 220 |

- Velocità in unità logiche al secondo. "Fuoco nemico" è un moltiplicatore: un colpo ogni (0,7–1,5 s) ÷ valore.
- La formazione parte in alto, con un piccolo margine: prima fila a y = 34, subito sotto la corsia del drone (boss: prima fila a y = 116, sotto il boss). Prima della v28 partiva a y = 84 (boss: 150). È centrata, con almeno 60 px liberi per spostarsi. Le nuvolette-firewall restano a y = 468: c'è più spazio (e tempo) prima che la formazione arrivi in fondo.
- In gara si giocano solo le prime 3 righe.

**Attaccanti** (sprite pixel 11 × 9, due fotogrammi):

| Sigla | Chi | Colore | Punti |
|---|---|---|---|
| `B` | Bug | Verde `#13a04a` | 10 |
| `V` | Virus | Viola `#7b47d6` | 20 |
| `K` | Hacker col cappuccio | Grigio-blu `#4f6478` | 30 |

## Meccaniche

**Nuvola (giocatore):**
- con le frecce si muove a 260 unità/s; trascinando segue il dito con un leggero ritardo; resta tra x = 24 e x = 336;
- **spara solo a comando** (tasto SPARA, Spazio / ↑ / Z, tasto sinistro del mouse sul campo): un pallino rosso a 520 unità/s. Tra un colpo e l'altro ci sono almeno 0,3 s (prima della v28 il fuoco automatico era ogni 0,34 s), con al massimo 3 colpi in volo;
- un tocco spara un colpo; se arriva durante la ricarica viene ricordato per 0,25 s e parte appena possibile. Tenendo premuto si spara a raffica, al ritmo massimo consentito;
- il pallino sulla nuvola si "ricarica" tra un colpo e l'altro; a inizio livello il primo colpo è pronto dopo 0,25 s;
- i suoi colpi possono annullare i codici nemici che incontrano;
- i colpi della nuvola passano attraverso le nuvolette-firewall.

**Formazione:**
- marcia di lato e, a ogni bordo, cambia verso e scende di 12;
- accelera quando restano pochi attaccanti (fino a 3,4 volte) e quando è scesa (fino a +50%); anche la marcia sonora accelera;
- spara dal più basso di ogni colonna; nel 55% dei casi dal più vicino alla nuvola. I codici sono `0` e `1` verdi;
- se arriva in fondo (vicino alla nuvola) la partita finisce subito, qualunque sia il numero di vite.

**Nuvolette-firewall:** 4 nuvole di quadratini da 4 px. Ogni codice nemico che le tocca porta via un quadratino; anche gli attaccanti che ci passano sopra le rovinano.

**Drone bonus:** dalla prima comparsa dopo 7–12 s, attraversa il cielo in alto (non nel livello del boss). Vola a y = 16, sopra la formazione. Colpito vale 100, 150, 200 o 300 punti a caso e dà il **doppio colpo** per 10 s: ogni colpo sparato fa partire due pallini insieme, con ricarica di 0,18 s e fino a 6 in volo. Poi ricompare dopo 12–20 s.

**Boss Ransomware** (livello 5):
- 20 punti vita, si muove avanti e indietro in alto (centro a y = 62);
- spara a ventaglio 3 codici ogni 1,8 s; sotto metà vita 5 codici ogni 1,25 s;
- ogni colpo vale 25 punti, la sconfitta 2000. Quando cade, cadono anche gli attaccanti rimasti (senza punti).
- Il livello è superato quando non restano attaccanti e il boss è sconfitto.

**Colpito:** si perde una vita, esplosione, 1,4 s di attesa; i codici in volo spariscono. La nuvola rinasce al centro, invulnerabile (lampeggia) per 1,8 s. A inizio livello è invulnerabile per 1,2 s.

**Punteggio interno** (HUD, non va in classifica): attaccanti 10/20/30, drone 100–300, boss 25 a colpo + 2000. Record in `inncloudInvBest`.

## Comandi

| Azione | Tastiera | Touch / mouse |
|---|---|---|
| Muovi | ← → oppure A D | Trascinare sulla fascia sotto il gioco, oppure trascinare sul campo |
| Sparare | Spazio, ↑ oppure Z (tenere premuto = raffica) | Tasto rotondo rosso **SPARA** (tocco = un colpo, tenuto premuto = raffica); col mouse, tasto sinistro sul campo |
| Pausa | P oppure Esc | Pulsante `II` dell'HUD (in verticale anche il tastino AVVIA/PAUSA) |
| Avanti nelle schermate | Invio (Inizia, Via!, Prossimo livello) | Pulsanti |
| Musica | – | Pulsante `♪` (in verticale: tasto B) |

- **Fascia di trascinamento** ("Trascina per muoverti · SPARA per colpire"; in verticale solo "Trascina per muoverti", perché la pista è stretta): funziona come un touchpad, spostamento del dito × 1,3.
- **Tasto SPARA** (`fireBtn`): rotondo, rosso inncloud con la scritta bianca, almeno 76 px (88 px in orizzontale). Risponde al dito appena appoggiato (non al rilascio) e non fa mai partire il trascinamento della nuvola.
- **Sul campo:** la nuvola va dove si tocca e segue il dito.
- **Mouse:** la nuvola segue il puntatore anche senza cliccare.
- Multi-touch: un dito muove la nuvola (fascia o campo) e intanto un altro può tenere premuto SPARA. Per il movimento si segue un solo dito alla volta.
- La pagina va in pausa da sola quando passa in secondo piano.

## Layout

- **Verticale:** scocca "Game Boy" ([giochi-comune.md](giochi-comune.md#scocca-game-boy-verticale)): fascia scura di trascinamento a sinistra, A = **SPARA** (rosso, 76 px, più grande degli altri tasti), B = MUSICA, tastini ISTRUZIONI e AVVIA/PAUSA sotto la fascia. La pausa si fa con il tastino AVVIA/PAUSA (o con `II`, che resta nell'HUD).
- **Orizzontale** (altezza ≤ 560 px): la fascia diventa una colonna verticale di 120 px a sinistra del campo; il tasto SPARA (88 px) sta a destra del campo, centrato in altezza, mai sopra al gioco.
- Schermi larghi non bassi (computer): SPARA sta a destra della fascia, sotto al campo.
- Il campo mantiene il rapporto 360:600 e si adatta allo spazio libero (densità fino a 2,5×).

## Colori

| Variabile | Colore | Uso |
|---|---|---|
| `--ic-red` | `#c00000` | Rosso del pallino della "i": colpi, pulsanti, tasto SPARA, titoli |
| `--ic-red-hi` | `#ff3b3b` | Riflesso dei colpi, barra del boss |
| `--ic-ink` | `#272727` | Grigio della scritta inncloud |
| `--navy` | `#004675` | Punti, valori, filigrana del logo |
| `--hack` | `#13843f` | Verde degli attaccanti nei testi (sul campo `#13a04a`) |
| `--danger` | `#d93a33` | Game over |

Il cielo va da `#cfe3f5` a `#f2f7fc`, con nuvole bianche su tre piani che scorrono a velocità diverse. La nuvola del giocatore è bianca con il bordo `#56718a`.

## Audio

Effetti sintetizzati con Web Audio (nessun file audio): colpo, abbattimento, marcia a 4 note della formazione, nuvola colpita, drone, colpo del boss, avvio e livello superato (arpeggi). Il pulsante `♪` li accende e spegne; la scelta resta in `inncloudInvSound`.

## Limiti noti

- Le nuvolette proteggono solo dai codici nemici: i colpi del giocatore le attraversano.
- Se il logo non si carica, l'animazione iniziale e la filigrana non compaiono.

---
Ultimo aggiornamento: 08/10/2026 (v28)
