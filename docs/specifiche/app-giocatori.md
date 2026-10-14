# App giocatori

## In breve

È la pagina principale (`index.html`), una PWA installabile sul telefono. Mostra i 4 giochi:
- un gioco bloccato si sblocca con il QR dello stand o con il suo codice;
- un gioco sbloccato si gioca in modalità gara (3 livelli × 1 minuto) dentro un iframe.

Il giocatore si registra con nome ed email e accede con la sola email. I record vanno in classifica. Senza Supabase l'app funziona in modalità demo, tutta sul telefono.

| File | Ruolo |
|---|---|
| `index.html` | Struttura, stile (tema chiaro) e finestre (modali) |
| `hub.js` | Logica: elenco giochi, sblocco, gara e punteggio, account, classifica in app, installazione, countdown |
| `backend.js` | Accesso ai dati: Supabase oppure demo. Condiviso con `classifica.html` |
| `config.js` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PUBLIC_URL` |
| `sw.js` | Service worker: cache offline e aggiornamenti |
| `manifest.webmanifest` | Nome, icone, `display: standalone`, `start_url ./` |
| `icons/` | Icona dell'app: `app-favicon.png`, `app-apple-touch-icon.png`, `app-icon-192.png`, `app-icon-512.png`, `app-icon-maskable-512.png` (nomi cambiati nella v60 perché i telefoni scarichino la nuova icona): la "e" arancione di Efuture con i quadratini bianchi, la stessa della testa di Efuture Bros (`games/sysadmin/img/logo-testa.png`), su sfondo blu `#004675`; sotto, la scritta "GAMES" in Press Start 2P a pixel pieni, staccata dalla "e", con fasce dal giallo all'arancione efuture (senza toni rossi) e ombra blu scuro come nei giochi anni '80 (la favicon ha solo la "e") |
| `vendor/supabase.js`, `vendor/jsQR.js` | Client Supabase, lettura dei QR |

Ordine degli script in `index.html`: `config.js?v=N`, `vendor/supabase.js`, `backend.js?v=N`, `vendor/jsQR.js`, `hub.js?v=N`. Al `load` della pagina viene registrato `sw.js`.

## Giochi

Elenco `GAMES` in `hub.js`:

| id | Nome | Stand (sponsor) | Icona | Pagina |
|---|---|---|---|---|
| `sysadmin` | Efuture Bros | Efuture | `img/g-sysadmin.png` | `games/sysadmin/index.html` |
| `coretech` | CoreTech Pac | CoreTech | `img/g-coretech.png` | `games/coretech/index.html` |
| `timenet` | Timenet Breakout | Timenet | `img/g-timenet.png` | `games/timenet/index.html` |
| `inncloud` | inncloud Invaders | inncloud | `img/g-inncloud.png` | `games/inncloud/index.html` |

Ogni voce contiene anche `hash`, l'impronta del codice di sblocco (vedi [Sblocco](#sblocco)). Gli stessi id si usano nel database (`efg_scores.game`), nella classifica e nell'admin.

## Home

Dall'alto in basso:

1. **Intestazione:**
   - titolo `EFUTURE GAMES` ("GAMES" in arancio);
   - sotto, "**CARE** Conference Edition";
   - la frase **"Sblocca, gioca e vinci!"**.
2. **Barra del countdown**, se attivo. Vedi [Countdown](#countdown-di-apertura-e-chiusura).
3. **Griglia 2×2 dei giochi.** Ogni card mostra:
   - icona e nome;
   - stato: `Gioca ▶` se sbloccato (pillola arancio), `🔒 Da sbloccare` se bloccato (icona in grigio);
   - `Record: L/3 liv · P pt`, se c'è un record (dalla v66 è quello della classifica online, vedi Record).

   Tocco su un gioco sbloccato: si gioca. Tocco su un gioco bloccato: si apre la finestra di sblocco. Durante l'attesa di apertura o a gara chiusa le card sono disabilitate.
4. **Fascia in basso**, fissa:
   - non collegato: pulsante **Registrati / Accedi**;
   - collegato: **"Ciao, *nome*"** e il link **Esci**;
   - sempre, 3 pulsanti: **Classifica · Installa app · Istruzioni**. "Installa app" si vede solo se l'installazione è possibile (vedi [Installazione](#installazione));
   - nota di modalità: `Classifica online · v29`, oppure `Modalità demo: account e classifica restano su questo telefono. · v29`.

**Istruzioni** (finestra `mHelp`): spiega che i giochi si sbloccano con il QR e richiama le regole:
- 3 livelli per gioco, 1 minuto ciascuno;
- punti = livello × secondi avanzati × vite;
- contano prima i livelli, poi i punti.

I comandi di ogni gioco sono nelle Istruzioni del gioco stesso.

Chiusura delle finestre: ✕, tocco sullo sfondo oppure tasto Esc. Fa eccezione la finestra del risultato, che non si chiude né toccando lo sfondo né con Esc.

## Sblocco

**Meccanismo.** I codici non sono scritti nel sito. Il codice inserito o letto viene trattato così:
1. normalizzato: maiuscolo, solo A–Z e 0–9 (il trattino si toglie);
2. trasformato con SHA-256 di `"efg:" + codice`;
3. confrontato con gli `hash` di `GAMES`.

Se l'hash corrisponde a un gioco, quel gioco si sblocca. L'id del gioco va in `efgUnlocked` e resta sbloccato su quel telefono fino al prossimo reset dell'admin.

**Reset dall'admin.** All'apertura l'app legge `efg_reset_id()`. Se il valore è diverso da quello salvato sul telefono (`efgResetId`, anche se manca), lo salva e, se c'erano giochi sbloccati o record, riblocca i 4 giochi (`efgUnlocked` vuoto) e cancella `efgBests4`, con l'avviso "Nuova gara: sblocca di nuovo i giochi agli stand.". Restano sbloccati i giochi sbloccati in quella stessa apertura (per esempio arrivando da un QR con `?sblocca=`), e in quel caso l'avviso non compare. Se il database non ha la funzione o non c'è ancora stato un reset, non cambia niente.

- Formato dei codici: 3 lettere, trattino, 4 cifre.
- I codici reali sono in `LEGGIMI.txt` e si ricavano dall'admin (scheda QR). **Non vanno scritti nelle specifiche.**

Lo sblocco avviene sul telefono. Un utente esperto potrebbe ricavare i codici dagli hash: ci sono solo 10.000 combinazioni per prefisso. Per l'evento va bene, per premi di valore no.

**Finestra di sblocco** (`mUnlock`): mostra icona e nome del gioco e due opzioni.

1. **Inquadra il QR**, con il testo "Trovi il QR allo stand *Sponsor*…".
   - "Apri la fotocamera" usa la fotocamera posteriore (`facingMode: environment`) e analizza i fotogrammi con jsQR, ridotti a 480 px di larghezza.
   - Il QR può contenere un link con `?sblocca=CODICE` oppure il codice nudo.
   - QR valido: vibrazione di 60 ms, sblocco, la finestra si chiude, toast "*Gioco* sbloccato!".
   - Se il gioco sbloccato è quello della finestra, parte subito.
   - QR non valido: "Questo QR non sblocca nessun gioco.", poi nuovo tentativo dopo 1,2 s.
   - Fotocamera assente o permesso negato: un messaggio invita a scrivere il codice.
2. **Inserisci il codice**, nel campo "Codice sotto il QR" (massimo 12 caratteri).
   - Campo vuoto: "Scrivi il codice che trovi sotto il QR."
   - Codice errato: "Codice non valido. Controlla le lettere e riprova."

**Link `?sblocca=CODICE`.** È il caso del QR letto con la fotocamera del telefono.
- All'avvio l'app prova a sbloccare, poi toglie i parametri dall'indirizzo con `history.replaceState`.
- Toast: "*Gioco* sbloccato! Toccalo per giocare." oppure "Questo QR non è valido.".
- Il gioco non parte da solo.

## Account (senza password)

Finestra `mAuth` con due schede: **Registrati** e **Accedi**.

- **Registrazione:** nome (2–20 caratteri, visibile in classifica) ed email. Il cellulare non si chiede più dalla v23.
  - Validazione nel client: lunghezza del nome ed email nel formato `x@y.z`.
  - Chiama `Backend.signUp`, cioè `efg_register`. L'email è salvata in minuscolo e senza spazi.
  - **Nickname ed email devono essere nuovi.** Mentre il giocatore scrive (400 ms dopo l'ultimo tasto) l'app chiama `Backend.checkSignup`, cioè `efg_signup_check`. Se il nickname è già usato (senza distinguere maiuscole e minuscole) compare sotto il campo, in rosso, "Nickname già utilizzato"; se l'email è già registrata, "Indirizzo email già utilizzato". Il campo si colora di rosso e **Registrati e gioca** resta disattivato finché non si scrive un nickname o un'email nuovi. Lo stesso succede se è il server a rifiutare la registrazione (`name taken` o `already registered`).
  - Senza `supabase-nickname-unico.sql` il controllo mentre si scrive non c'è e il server blocca solo le email già usate.
- **Accesso:** basta l'email. Chiama `Backend.signIn`, cioè `efg_login`. Se l'email non esiste: "Nessun giocatore registrato con questa email: usa Registrati."
- **Errori tradotti** da `EFG_FRIENDLY`:
  - nickname già usato: "Nickname già utilizzato: scegline un altro.";
  - email già registrata: "Indirizzo email già utilizzato: usa Accedi oppure un'altra email.";
  - email o nome non validi;
  - nessuna connessione;
  - gara chiusa.
- **Sessione:** `{id: pid, email, nickname}` salvata in `localStorage`:
  - online: `efgSessionLive`;
  - demo: `efgSession3`.

  Resta finché non si preme **Esci**, che cancella solo la sessione: record locali e sblocchi restano.
- **Al login o alla registrazione:** toast "Benvenuto, *nome*!". Dalla v66 l'app **non** rimanda più al server i record del telefono: dopo un azzeramento dall'admin riporterebbe in classifica i punti vecchi (e senza accesso non si può giocare).

## Gara

**Regole** (costanti in `hub.js`: `LEVELS = 3`, `LEVEL_SECONDS = 60`):
- 3 livelli, al massimo 60 s ciascuno, 3 vite per livello (le vite le gestisce il gioco);
- punti di un livello superato = **n. livello × secondi avanzati × vite rimaste**, con secondi avanzati = `max(0, round(60 − tempo usato))`;
- il livello in cui scade il tempo o finiscono le vite vale 0, quelli già superati restano;
- punteggio della partita = somma dei livelli superati;
- esempio: livello 1 finito in 35 s con 2 vite vale 1×25×2 = 50; livello 2 con 20 s avanzati e 3 vite vale 2×20×3 = 120.

**Avvio:**
- Se la gara è in attesa di apertura o chiusa, il gioco non parte. Toast: "I giochi non sono ancora aperti." oppure "La gara è chiusa.".
- Altrimenti si apre il **player** a tutto schermo con una barra in alto:
  - `← Torna ai giochi` (pulsante blu Efuture `--ef-navy` con scritta bianca);
  - nome del gioco;
  - orologio del livello;
  - logo.
- L'iframe con `games/<id>/index.html?hub=1` occupa tutto lo schermo e la barra gli sta sopra. Il parametro `hub=1` dice al gioco di usare le regole di gara.
- **La barra si vede solo mentre il gioco si carica** (dalla v67): appena il gioco risponde (`efg-ui`) scorre via e non torna, così non copre punti e vite. "← Torna ai giochi" è dentro la schermata iniziale e la pausa del gioco (vedi `giochi-comune.md`); il tempo del livello si vede nella scocca.
- **Uscita con conferma:** con una partita in corso (dopo `start` e prima di `result`) l'uscita apre la finestra `mExit`: "Uscire dal gioco? Perderai il livello in corso. I livelli già superati e il tuo record restano." con **Resta** / **Esci**. Prima di iniziare si esce subito.
- Con il telefono in orizzontale (altezza ≤ 560 px) la barra si assottiglia.

### Protocollo postMessage (gioco → app)

L'app accetta un messaggio solo se:
- `data.type === 'efg'`;
- c'è una partita in corso;
- `event.source` è l'iframe del gioco.

L'app non manda messaggi al gioco: l'unico segnale verso il gioco è il parametro `?hub=1`.

| `ev` | Campi | Effetto nell'app |
|---|---|---|
| `start` | – | Nuova partita: azzera l'orologio della barra |
| `tick` | `level` (1–3), `t` (secondi usati nel livello) | Barra: `Liv {level}/3 · ⏱ m:ss`, con il tempo rimasto = `60 − t`. Diventa rossa negli ultimi 10 s |
| `result` | `ok` (bool, tutti e 3 i livelli superati), `reason` (`'time'` = tempo scaduto, altrimenti vite finite), `level` (livello raggiunto), `used` (secondi usati in totale), `seconds` (letto ma non usato), `times` (array dei secondi usati per ogni livello **superato**), `lives` (array delle vite rimaste per ogni livello superato) | Calcola il punteggio e mostra il risultato |

Quando `times` manca, i livelli superati sono 3 se `ok` è vero, altrimenti `level − 1`, e `used` si divide in parti uguali tra loro. Quando `lives` manca, vale 1 vita per livello. Si considerano al massimo 3 livelli. Il lato del gioco è descritto nelle specifiche dei singoli giochi.

### Risultato (`mResult`)

- **Titolo:** "🎉 Complimenti, hai finito!" (con sotto "<gioco> · tutti e 3 i livelli superati" e i fuochi d'artificio per 7 s), "Tempo scaduto" oppure "Vite finite".
- **Contenuto:**
  - punti in grande;
  - "N livelli superati su 3";
  - riga `Livelli superati L/3`;
  - riga `Calcolo`, per esempio `1×25×2 + 2×20×3 = 170`;
  - riga `Tempo`, la somma dei tempi dei livelli superati;
  - riga `Il tuo record`.
- **Record:** il miglior risultato per gioco è in `efgBests4`, nella forma `{id: {l: livelli, s: punti}}`. Dalla v66 la fonte è la classifica online: ogni volta che l'app legge le classifiche dei 4 giochi (`loadRanks`) riscrive `efgBests4` con livelli e punti del giocatore sul server, e cancella i record che sul server non ci sono (per esempio dopo un azzeramento). La copia del telefono resta solo se la classifica non si legge o se il giocatore è oltre il 50° posto. In home la riga sotto il gioco dice "In classifica: N°", "Oltre il 50° posto", "Non ancora in classifica" o "Supera almeno un livello per entrare in classifica". È migliore chi ha più livelli; a parità di livelli, più punti. Una partita con 0 livelli non è mai un record.
- **Messaggi:**
  - 0 livelli: "Supera almeno un livello entro il minuto per entrare in classifica." (più "Il tuo record resta valido." se un record esiste);
  - non è un record: "Il tuo record resta … in classifica conta solo il risultato migliore.";
  - record senza account: "Nuovo record! Registrati o accedi per entrare in classifica.";
  - record con account: invio con `Backend.submit(session, game, punti, livelli)`, cioè `efg_submit`. Poi "Nuovo record salvato in classifica!" oppure l'errore, per esempio "La gara è chiusa…".
- **Pulsanti:** **Riprova livello N** (solo dopo una sconfitta e solo se il gioco lo consente, cioè se `result` ha `retry: true`: oggi Efuture Bros; chiude il riepilogo e manda al gioco `{type:'efg-cmd', cmd:'retry'}`, che riparte dal livello perso tenendo i livelli già superati), **Rigioca** (stesso gioco, da capo) e **Torna ai giochi**.
- Solo i nuovi record locali vengono inviati al server. Il server comunque tiene solo il migliore (vedi [database.md](database.md)).

## Countdown di apertura e chiusura

Lo avvia un amministratore da `classifica.html`. L'app lo legge con `Backend.gate()`, cioè `efg_gate_state`:
- all'avvio;
- ogni 15 s;
- quando la pagina torna visibile;
- in demo, anche all'evento `storage` su `efgDemoGate`.

L'orologio usa l'ora del server: l'app calcola lo scarto tra l'ora del server (`now`) e quella del telefono. Lo stato si ricalcola ogni secondo con `EFG_GATE_PHASE` (in `backend.js`):

| Fase | Quando | Cosa vede il giocatore |
|---|---|---|
| `libero` | Nessun countdown | Niente barra, giochi utilizzabili |
| `prima` | Apertura non ancora scaduta | Barra "🔒 I giochi si aprono tra h:mm:ss / m:ss". Card disabilitate |
| `aperto` (da apertura) | Apertura arrivata a zero | Niente barra. Toast "I giochi sono aperti: buon divertimento!" |
| `aperto` + `closing` | Chiusura in corso | Barra "⏳ La gara si chiude tra …", rossa nell'ultimo minuto. Si gioca |
| `chiuso` | Chiusura arrivata a zero | Barra "🏁 Gara chiusa: la classifica è definitiva". Card disabilitate. Una partita in corso viene chiusa. Toast "Tempo scaduto: la gara è chiusa." |

Il server rifiuta i punteggi a gara chiusa, con una tolleranza di 10 s (vedi [database.md](database.md)).

## Bonus Recensione

- In home, sotto i giochi, chi ha fatto l'accesso vede il pulsante giallo **⭐ Bonus Recensione** con la spiegazione dei punti. Il tocco apre subito la pagina delle recensioni Google di efuture (il link scelto in admin, altrimenti la ricerca su Google Maps) e registra il clic (`efg_recensione_click`).
- Dopo il clic: "Grazie! Quando confermiamo la tua recensione su Google ricevi +N punti…". Quando l'admin la conferma il pulsante diventa verde, **✅ Bonus Recensione ottenuto**, e il testo dice "I tuoi +N punti si sommano ai tuoi record nella classifica generale".
- Nella classifica generale (app e schermo) chi ha il bonus ha l'etichetta **⭐ +N bonus**; la nota dice "Totale = somma dei 4 giochi + ⭐ bonus recensione".
- Senza `supabase-recensioni.sql` il pulsante non compare.

## Visualizzazione dei giochi

All'avvio l'app legge `efg_impostazioni` e salva la visualizzazione predefinita scelta in admin in `efgViewDefault`; i giochi la usano finché il giocatore non ne sceglie una con il pulsante in alto nel gioco (vedi [giochi-comune.md](giochi-comune.md#visualizzazione-game-light-dark)).

## Classifica in app

Si apre con il pulsante **Classifica** (finestra `mBoard`).
- In cima solo il titolo "Classifica" e la ✕, senza logo efuture (v61).
- Dalla v62 non c'è più il link "Apri la classifica a schermo intero": dall'app la classifica da proiettare non si apre mai.
- **Schede:** **Totale** e i 4 giochi. Ogni cambio di scheda ricarica i dati con `Backend.board(id)`, cioè `efg_board`. Non c'è filtro per gruppo.
  Le schede sono staccate dalla prima posizione: 14 px di spazio e una riga sottile sotto (`#bTabs`).
- **Riga su due livelli:**
  - posizione: tondo oro, argento o bronzo per i primi 3;
  - nome grande e, sotto, il dettaglio: `G/4 giochi · L/12 livelli` nel Totale, `L/3 livelli` nei giochi;
  - punti a destra.
- La riga del giocatore collegato è evidenziata, confrontando il `pid`.
- **Ordine:** quello del server, cioè livelli, poi punti, poi chi ha fatto il record prima. Massimo 50 righe.
- **Messaggi:**
  - "Carico la classifica…";
  - "Ancora nessun punteggio. Gioca e sii il primo!";
  - "Classifica non raggiungibile: controlla la connessione.".
- **Nota** sotto la lista: "Totale = somma dei 4 giochi.". In demo: "Modalità demo: solo i giocatori di questo telefono.".
- **Link** "Apri la classifica a schermo intero ↗": porta a `PUBLIC_URL + classifica.html`, sempre il sito pubblico.

## Installazione

- **Si apre da sola solo dal QR di installazione** (`?installa=1`). Il parametro si toglie subito dall'indirizzo. Altrimenti c'è il pulsante **Installa app** in fondo alla home.
- **Installazione possibile** (`canInstall`) quando valgono tutte e tre:
  - l'app non è già aperta come app installata (`display-mode: standalone` o `navigator.standalone`);
  - la pagina non è dentro un iframe;
  - si arriva da un QR (`?sblocca` o `?installa`), oppure si usa Samsung Internet, oppure l'installazione non è avvenuta negli ultimi 3 giorni (`efgInstalled`).
- **Pulsante Installa app:** visibile se l'installazione è possibile e c'è la richiesta del browser, oppure il telefono è iPhone/iPad o Android.
- **Finestra `mInstall`:** titolo "Installa l'app", sottotitolo "Installa sul tuo dispositivo", testo "Installando quest'app sul tuo dispositivo, avrai i giochi sempre a disposizione." Contenuto in base al dispositivo:

| Dispositivo | Cosa compare |
|---|---|
| Android / Chrome con richiesta del browser (`beforeinstallprompt`) | Pulsante **Installa Efuture Games**, che apre la richiesta di sistema. Se l'utente accetta, si salva `efgInstalled` |
| iPhone / iPad (Safari) | Istruzioni: Condividi ↑ › Aggiungi alla schermata Home › Aggiungi |
| Samsung Internet | La sua installazione non si usa, perché Google Play Protect blocca il pacchetto. Pulsante **Apri in Chrome e installa** (link `intent://…?installa=1#Intent;scheme=https;package=com.android.chrome;end`), oppure menu ≡ › Aggiungi pagina a › Schermata Home |
| Android senza richiesta del browser | Istruzioni: menu ⋮ › Installa app / Aggiungi a schermata Home |
| Computer senza richiesta del browser | La finestra non si apre |

- **Apertura automatica dal QR:**
  - iPhone: dopo 1,2 s;
  - Android: si aspetta la richiesta del browser, che apre la finestra dopo 0,6 s; se entro 3,5 s non arriva, compaiono le istruzioni.
- **Fine installazione** (`appinstalled`): si salva `efgInstalled`, la finestra si chiude e compare il toast "App installata: la trovi nella schermata Home.".
- **"Più tardi"** o chiusura della finestra: si salva `efgInstallLater`.

## Modalità demo e online

- **Online:** `config.js` ha `SUPABASE_URL` e `SUPABASE_ANON_KEY` e il client Supabase è caricato. Tutto passa dalle funzioni RPC. La sessione Supabase non viene salvata (`persistSession: false`).
- **Demo:** nessun server.
  - Utenti in `efgDemoUsers3` (`{email: {pid: 'local-…', email, name}}`).
  - Punteggi in `efgDemoScores4` (`{"email|gioco": {email, game, score, levels}}`), con la stessa regola del migliore.
  - Classifica calcolata nel browser: stesso ordine, massimo 50 righe, filtri Efuture/Ospiti con la stessa regola dell'email.
  - Countdown in `efgDemoGate`. App e classifica aperte nello stesso browser se lo scambiano con l'evento `storage`.

## Aggiornamenti, versione e cache

- La versione (oggi **v29**) compare in fondo alla home, nella nota di modalità. Come si aumenta è spiegato nel [README](README.md#versione-dellapp-e-aggiornamenti).
- **Service worker** (`sw.js`):
  - **install:** apre la cache `efuture-games-vN`, scarica tutti gli `ASSETS` e chiama `skipWaiting`. Se un file dell'elenco manca, l'installazione fallisce.
  - **activate:** cancella le cache con nome diverso e chiama `clients.claim`.
  - **fetch**, solo per richieste GET della stessa origine:
    - pagine (navigazione), `.html`, `.js` e `.webmanifest`: prima la rete (`cache: no-cache`) e aggiornamento della copia; senza rete, la copia salvata (ignorando i parametri) o `index.html`;
    - tutto il resto (immagini, font): prima la cache, poi la rete.
  - Le richieste verso Supabase (altra origine) non passano dal service worker: classifica e login vanno sempre in rete.
- Il parametro `?v=N` sugli script evita copie vecchie nella cache HTTP del browser.
- Chi aggiunge un file al sito che deve funzionare offline lo aggiunge anche ad `ASSETS` in `sw.js`.

## Chiavi di localStorage

| Chiave | Contenuto | Scritta da |
|---|---|---|
| `efgUnlocked` | Array degli id dei giochi sbloccati | `hub.js` |
| `efgBests4` | Record per gioco su questo telefono: `{id: {l, s}}` | `hub.js` |
| `efgSessionLive` | Sessione online `{id, email, nickname}` | `backend.js` (online) |
| `efgSession3` | Sessione demo | `backend.js` (demo) |
| `efgDemoUsers3` | Utenti demo | `backend.js` (demo) |
| `efgDemoScores4` | Punteggi demo | `backend.js` (demo) |
| `efgDemoGate` | Countdown demo `{mode, minutes, ends_at}` | `backend.js` (demo) |
| `efgViewDefault` | Visualizzazione predefinita dei giochi (`game`, `light`, `dark`) scelta in admin | `hub.js` |
| `efgView` | Visualizzazione scelta dal giocatore con il pulsante nel gioco | `games/gameboy.js` |
| `efgDemoReview` | Clic demo sul Bonus Recensione | `backend.js` (demo) |
| `efgInstalled` | Data e ora (ms) dell'installazione accettata | `hub.js` |
| `efgInstallLater` | Data e ora (ms) del "Più tardi". Oggi non viene letta | `hub.js` |

I valori sono in JSON e ogni accesso è protetto da try/catch. `efgBoardView3` e la chiave admin in `sessionStorage` sono della classifica e dell'admin.

## Tema e colori

Tema chiaro dalla v25. Variabili in `:root` di `index.html`:

| Variabile | Colore | Uso |
|---|---|---|
| `--bg` | `#eef4fa` | Sfondo (con sfumatura radiale `#d6e8f7` in alto) |
| `--panel` / `--panel-2` | `#ffffff` / `#f2f7fc` | Card e finestre / righe e riquadri |
| `--line` | `#cddcea` | Bordi |
| `--text` / `--dim` | `#0d2b45` / `#56718a` | Testo / testo secondario |
| `--ef-navy` | `#004675` | Blu Efuture: titolo, scheda attiva |
| `--ef-orange` | `#f18c22` | Arancio Efuture: pulsanti, "GAMES", focus |
| (testi arancio) | `#c56a0c` | Tagline, punti, risultato |
| `--ok` / `--danger` | `#1f9d55` / `#d93a2b` | Messaggi positivi / errori, ultimi secondi |

- **Font:**
  - Press Start 2P (stile pixel) per titoli, pulsanti e numeri grandi;
  - IBM Plex Mono per il resto.
- Il player del gioco ha lo sfondo nero.

---
Ultimo aggiornamento: 07/10/2026 (v27)

## Avvio e schermo intero (v62)

- **App installata:** all'apertura compare per 1,5 s una schermata bianca con l'icona al centro e in basso "Powered by" con il logo efuture (`#splash` in `index.html`, solo in `display-mode: standalone`), poi sfuma nella home. Su Android la prima schermata è quella del sistema (logo tondo su bianco, non modificabile): dalla v65 la nostra non ripete l'icona e mostra solo "Powered by" con sotto il logo efuture, al centro, in dissolvenza. Su iPhone "Powered by" e sotto il logo stanno in basso, sotto l'icona. Dopo 1,4 s il logo efuture esplode in mattoncini (canvas, 1 s; non con "riduci movimento") e la schermata sfuma. L'icona maskable ha "e" e "GAMES" più piccole, con più margine blu. Il manifest ha `background_color` bianco, così la schermata di avvio di Android (icona su bianco, non modificabile dal sito) si lega senza stacco. Su iPhone le immagini `icons/avvio/avvio-LxA.png` (`apple-touch-startup-image`, 10 misure di iPhone in verticale) mostrano la stessa schermata già prima che la pagina si carichi.
- **Presentazione nel browser (app non installata, pagina non in un iframe):** a ogni apertura per 1,3 s compare l'icona dell'app al centro su bianco, poi al suo posto "Powered by" con il logo efuture; a 2,4 s il logo esplode in mattoncini e la schermata sfuma nella home (classi `splash splash-web`, poi `#splash.step2`). Con "riduci movimento" niente esplosione.
- **Spazio sicuro del gioco:** `#player` lascia libere tacca, fotocamera e barre di sistema (`padding` con `env(safe-area-inset-*)`), così i tasti in alto del gioco (MODE ☀/☾/🎮, pausa) si toccano anche a schermo intero (dentro l'iframe i giochi non conoscono queste zone).
- **App aperta dal browser del telefono (non installata):** al primo tocco la pagina va a schermo intero senza barre del browser (`requestFullscreen`, `hub.js`); se si esce, ci torna al tocco successivo. Solo su dispositivi touch e fuori dall'iframe. Su iPhone Safari non è possibile: serve installare l'app.

## Leggibilità (v66)

- Viewport della home senza `maximum-scale` e `user-scalable=no`: si può ingrandire (nei giochi lo zoom resta bloccato).
- Testi della home a 12-13 px (titoli in carattere pixel a 11 px); grigio `--dim` `#4a6580` (contrasto 5,5:1 sullo sfondo).
- Aree di tocco di almeno 44 px: Esci, ✕ delle finestre, pulsanti Classifica / Installa / Istruzioni; pulsante Gioca e schede della classifica più alti.
- Nei giochi aperti dall'app la schermata iniziale mostra **Record in gara: L/3 liv · P pt** (lo stesso della home, passato nell'URL come `rec`), al posto del record interno del gioco.

## Home: barra in basso, classifica e bonus (v67)

- La barra in basso (Registrati / Ciao… Esci / Classifica / Installa / Istruzioni) sul telefono in verticale resta fissa, con sfondo pieno e una riga sottile sopra; con poca altezza (≤ 500 px, telefono in orizzontale) e sul computer (≥ 900 px con mouse) non è fissa e sta subito sotto le schede.
- Schede della finestra Classifica senza barra di scorrimento; con il mouse vanno a capo.
- Bonus Recensione ottenuto: etichetta verde chiara non cliccabile (`disabled`).

