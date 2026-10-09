# Pannello admin

## In breve

`admin.html` è il pannello degli organizzatori. Si entra con la chiave admin, che nel database è salvata solo cifrata. Dal pannello si può:
- vedere gli utenti, cambiarne il tipo, eliminarli ed esportarli in CSV;
- consultare il log degli eventi;
- generare e stampare i QR;
- avere tutti i link a portata di mano;
- vedere skill, video e tutorial;
- fare e ripristinare backup, azzerare la classifica, cambiare la chiave.

Funziona **solo online**: senza Supabase in `config.js` mostra "Il database online non è configurato…" e non presenta il login. La pagina non è indicizzata (`robots: noindex,nofollow`).

Indirizzo: `https://marraliefuture.github.io/efuture_games/admin.html`. Script caricati: `config.js?v=N`, `vendor/supabase.js`, `vendor/qrcode.js` e uno script nella pagina. Stile: quello di efuture.it, lo stesso della classifica.

## Accesso

- Modulo "Accesso amministratore", con i campi **Email** e **Chiave admin**:
  - **chiave personale:** email dell'utente admin + la sua chiave. Il pannello manda al server `email` + a capo + `chiave` in `p_key`;
  - **chiave principale:** email vuota + la chiave principale (quella impostata con `efg_admin_init`), di riserva per il primo accesso e le emergenze.
- Dopo l'ingresso `efg_admin_me` dice chi è collegato: in alto a destra compare "🛡️ *nome*" oppure "🔑 Chiave principale".
- Il logo Efuture non è nell'intestazione ma nel piè di pagina bianco, in basso a destra (nascosto in stampa).
- **Entra** chiama `efg_admin_login(p_key)`.
- Se la chiave è giusta:
  - compare la dashboard;
  - in alto a destra compaiono **Gioca ↗** (apre l'app dei giocatori in una nuova scheda), **Classifica ↗** e **📺 Proietta**;
  - **📺 Proietta** apre la classifica (`classifica.html?proietta=1`) in una finestra a parte sul **secondo monitor** (ledwall o proiettore), mentre l'admin resta sul primo. Con Chrome o Edge usa la Window Management API (`getScreenDetails`) e posiziona la finestra (`window.open` con `left/top/width/height`) sull'altro schermo; la prima volta il browser chiede il permesso "Gestione finestre" e, se la finestra viene bloccata, il messaggio dice di premere di nuovo. Fa la stessa cosa del pulsante 📺 Proietta della classifica. Sulla classifica compare "Clicca qui per lo schermo intero": un clic e va a schermo intero su quel monitor. Senza secondo monitor o con altri browser la finestra si apre normale e il messaggio dice di trascinarla sull'altro schermo;
  - la chiave si salva in `sessionStorage` (`efgAdminKey`). Vale solo per quella scheda del browser e si perde chiudendola.
- Ricaricando la pagina si rientra da soli con la chiave salvata.
- **Errori**, restituiti dal server come `{errore: …}`:
  - "chiave admin errata" (chiave principale) o "email o chiave admin errata" (chiave personale: email sconosciuta, utente non admin, disabilitato, senza chiave o chiave sbagliata);
  - "chiave admin non ancora impostata";
  - "troppi tentativi sbagliati: riprova tra 10 minuti".
- **Blocco:** dopo **8 chiavi sbagliate in 10 minuti**, contate in tutto il sistema e non per persona, ogni funzione admin rifiuta l'accesso per 10 minuti. Vale anche per il Countdown della classifica.
- Ogni chiamata manda la chiave (`p_key`), che il server ricontrolla ogni volta. Se una risposta segnala un errore di chiave o di tentativi, il pannello esce da solo e mostra il messaggio.
- **Logout** (nel menu laterale) dimentica la chiave e torna al login.
- **Chiave persa:** si reimposta da Supabase › SQL Editor con `select efg_admin_init('NUOVA-CHIAVE-LUNGA');`.

## Riquadri in alto

Valori presi da `efg_admin_login`:
- Utenti registrati;
- Record salvati (righe di `efg_scores`);
- Eventi nel log;
- Backup salvati;
- Ultimo backup (data o "mai").

Si aggiornano dopo Elimina, Backup, Ripristino e Reset.

## Menu a comparsa

Si apre con il pulsante **☰ Menu** a sinistra nell'intestazione (visibile dopo l'accesso) e scorre da sinistra sopra la pagina. Si chiude con ✕, toccando lo sfondo, con Esc o scegliendo una voce. Il nome della sezione aperta compare come titolo sopra il contenuto. Voci:
- **Utenti**;
- **Collegamenti:** QR, Link;
- **Formazione:** Video utili, Tutorial, Skills, FAQ, Documentazione;
- **Admin:** Qualità, Log, Backup, Chiave, Reset (Reset in rosso);
- **Logout:** dimentica la chiave e torna al login.

All'ingresso è aperta Utenti. In stampa menu e titolo non compaiono.

### Utenti

- Dati da `efg_admin_players`. Testo in alto: "N utenti registrati". Pulsanti **Aggiorna** e **Scarica CSV**.
- **Tabella**, ordinata per livelli totali, poi per punti totali:

  | Colonna | Contenuto |
  |---|---|
  | `#` | Posizione |
  | Tipo | Simbolo: 🎮 Giocatore, 🛡️🎮 Admin e giocatore, 🛡️ Solo admin (il nome del tipo compare passandoci sopra). Gli utenti senza tipo valgono come Giocatore |
  | Nome | Con l'etichetta rossa **disabilitato** se l'utente è disabilitato (tutta la riga in grigio) |
  | Email | |
  | Registrato | Data e ora |
  | Giochi | Giochi con almeno 1 livello, su 4 |
  | Livelli | Livelli totali, su 12 |
  | Punti | Punti totali |
  | Dettaglio per gioco | Per esempio `SysAdmin 2/3 · 150 — Timenet 1/3 · 40` |
  | (ultima) | Pulsante **Modifica** |

- **Modifica** apre un popup con nome ed email e tre gruppi di comandi:
  - **Tipo:** Giocatore, Admin e giocatore, Solo admin (quello attuale è evidenziato). Chiama `efg_admin_set_tipo(p_key, p_email, p_tipo)` (valori `giocatore`, `admin_giocatore`, `admin`); nel log "admin: tipo utente". Effetti: i tipi admin possono entrare nel pannello con email e chiave personale e fare tutto; tornando Giocatore la chiave personale viene cancellata. Nell'app per ora tutti i tipi giocano e compaiono in classifica. La domanda di conferma spiega questi effetti per il tipo scelto.
  - **Chiave admin personale** (solo per i tipi admin): stato "🔑 Impostata…" / "Non impostata…" e i pulsanti:
    - **🔑 Imposta / Modifica:** due campi (almeno 10 caratteri, uguali);
    - **🎲 Genera:** chiave casuale di 16 caratteri (`XXXX-XXXX-XXXX-XXXX`, generata nel browser con `crypto.getRandomValues`), mostrata **una sola volta** con il pulsante **Copia**;
    - **Togli:** l'utente non entra più nel pannello.
    Tutti chiamano `efg_admin_set_user_key(p_key, p_email, p_new)` (`p_new` vuoto = togli). La chiave viene salvata solo cifrata (bcrypt): non si può rileggere. Nella tabella un 🔑 accanto al tipo indica la chiave impostata.
  - **Accesso:** 🚫 **Disabilita** / ✅ **Riabilita**. Chiama `efg_admin_set_disabilitato(p_key, p_email, p_on)`; nel log "admin: utente disabilitato/riabilitato". Un utente disabilitato non può accedere all'app ("Il tuo account è stato disabilitato: chiedi agli organizzatori."), i nuovi punteggi non vengono salvati e non compare nelle classifiche. I punteggi restano nel database: riabilitandolo torna in classifica.
  - **Elimina utente:** chiama `efg_admin_delete_player(p_key, p_email)`, chiude il popup, ricarica la tabella e aggiunge "· eliminato *nome*". L'utente potrà registrarsi di nuovo con la stessa email, ripartendo da zero.
- **Ogni modifica chiede conferma** in una seconda finestra con la domanda ("Cambiare il tipo di…?", "Disabilitare…?", "Riabilitare…?", "Eliminare…?"), le conseguenze spiegate e i pulsanti **Annulla** e **Sì, …** (rosso per disabilitare ed eliminare). Con Annulla non cambia niente.
- Tipo e disabilitazione servono `supabase-tipi-utenti.sql`: senza, il popup dice di eseguirlo.

### Qualità

Mostra i risultati dei controlli automatici sul progetto. I dati vengono da `docs/qualita/ultimo.json` (ultimo controllo) e `docs/qualita/storico.json` (un punto per data), scritti dallo script `.claude/skills/efuture-games-commit/scripts/qualita.py`, che la skill di commit esegue prima di ogni salvataggio. La pagina non chiama il database.

- In alto: data, versione e commit dell'ultimo controllo, pulsante **Aggiorna**.
- **5 box**, ognuno con numeri e mini grafico per data; il bordo è giallo se ci sono avvisi, rosso se ci sono errori o vulnerabilità alte:
  | Box | Cosa controlla |
  |---|---|
  | Codice | Sintassi dei .js, script nelle pagine, id duplicati, collegamenti locali, file della cache, versione coerente |
  | Database | File SQL: RLS, `search_path`, controllo della chiave nelle funzioni admin, permessi, chiavi cifrate, classifica senza disabilitati |
  | Prestazioni | Peso delle pagine e dei file, immagini, cache offline, tempo di caricamento nel browser |
  | Spazio occupato | Totale del sito e per cartella, con trend per data |
  | Vulnerabilità | Segreti o codici in chiaro, link esterni, HTTPS, CDN, `innerHTML`, sblocco, blocco dei tentativi; gravità alta/media/bassa, con trend per data |
- **Cliccando un box** si apre sotto l'elenco dei dettagli: grafico grande per data (date e valori), tabella dei controlli (prima errori e avvisi) con esito, dettaglio e, per le vulnerabilità, la gravità; poi lo storico per data. Per lo spazio c'è anche la tabella delle cartelle.
- Se i file non ci sono la sezione lo dice e spiega come crearli.
- Lo storico si ricostruisce dai commit passati con `qualita.py --storico`.

### Log

- Dati da `efg_admin_logs(p_key, p_limit, p_kind)`, dal più recente.
- **Filtri:**
  - tipo di evento: Tutti, Partite (`partita`), Registrazioni (`registrazione`), Accessi giocatori (`accesso`), Operazioni admin (tutti i tipi che iniziano con `admin`);
  - numero di righe: 100, **300**, 1000 o 2000.
- **Aggiornamento automatico:** casella "aggiorna ogni 15 s". Si spegne all'uscita.
- Pulsanti **Aggiorna** e **Scarica CSV**.
- **Tabella:**
  - Quando;
  - Evento: etichetta rossa se contiene "errata", arancio se inizia con "admin";
  - Email;
  - Gioco;
  - Dettagli.
- **Contenuto di Dettagli:**
  - partita: `L/3 livelli · P punti`, più `· nuovo record` se è un record;
  - registrazione: il nome;
  - accesso: l'esito (`ok` o `email sconosciuta`);
  - altri eventi: le coppie chiave: valore del dettaglio.
- I tipi di evento sono elencati in [database.md](database.md#registro-eventi-efg_log).

### QR

Genera i 5 cartellini da stampare:

| Cartellino | Stand | Link | Testo sotto il QR |
|---|---|---|---|
| Installa l'app | Ingresso · ledwall | `PUBLIC_URL?installa=1` | L'indirizzo senza parametri |
| Sblocca *gioco* (×4) | Stand *sponsor* | `PUBLIC_URL?sblocca=CODICE` | Il codice in grande |

**Genera i QR:**
1. Legge `hub.js` dal sito, senza cache, e ne estrae gli hash dei 4 giochi.
2. Per ogni gioco ricava il codice provando le 10.000 combinazioni del suo prefisso di 3 lettere (definito in `QR_GAMES`).
3. Mostra i 4 codici in campi modificabili e genera i QR in SVG con `vendor/qrcode.js`, correzione d'errore M.

- I codici non sono scritti nella pagina.
- Se un codice modificato non corrisponde all'hash del suo gioco, il campo diventa rosso, il cartellino non viene generato e **Stampa** resta disabilitato.
- Messaggi: "5 QR pronti…" oppure "Alcuni codici non sbloccano il loro gioco…".
- **Stampa (A4, bianco e nero):** usa `window.print()`. Lo stile di stampa mette i cartellini su un foglio A4 verticale, 2 colonne × 92 mm, con bordo tratteggiato per ritagliarli, e nasconde il resto del pannello.
- Se cambiano un codice o `PUBLIC_URL`, i QR vanno rigenerati e ristampati. Va aggiornato anche l'`hash` in `hub.js`.

### Link

Elenco `LINKS` in `admin.html`. I link del sito si calcolano da `PUBLIC_URL`, gli altri sono fissi e sono gli stessi della skill `efuture-games-links`:

| Gruppo | Link |
|---|---|
| Sito | App (giocatori), App – installazione (`?installa=1`), Classifica da proiettare, Admin |
| GitHub | Repository, Pubblicazioni (Actions) |
| Claude | Claude, Claude Code, artifact di Efuture Games e dei 4 giochi |
| ChatGPT | ChatGPT (link generico) |

Ogni riga ha: nome, nota, indirizzo cliccabile e i pulsanti **Apri**, **Copia** e **QR**. QR mostra o nasconde il codice QR del link sotto la riga.

### FAQ

Domande frequenti sull'uso dell'app, raggruppate in **Iniziare**, **Giocare**, **Punti e classifica**, **Problemi** (array `FAQ` in `admin.html`). Ogni domanda si apre e si chiude con un tocco. **Scarica FAQ (.md)** salva `efuture-games-faq.md`. Le stesse FAQ entrano nella descrizione esportata della piattaforma e dell'app. Quando cambia il comportamento dell'app, aggiornare anche le FAQ.

### Documentazione

Tabella con una riga per: **Intera piattaforma**, **App Efuture Games** e i 4 giochi. Ogni riga ha due pulsanti che scaricano un file Markdown (`efuture-games-<voce>-descrizione.md` / `-tecnico.md`):

| Voce | Descrizione | Tecnico |
|---|---|---|
| Intera piattaforma | tutte le specifiche di `docs/specifiche/` (indice, app, classifica, admin, giochi, database) + FAQ | tutti i file di `docs/tecnico/` |
| App Efuture Games | `app-giocatori.md` + FAQ | `docs/tecnico/app.md` |
| Ogni gioco | `gioco-<id>.md` + `giochi-comune.md` | `docs/tecnico/gioco-<id>.md` |

I file vengono letti dal sito pubblicato al momento del clic (array `DOCS`, funzione `buildDoc`): quando si uniscono più file, il documento ha un titolo, la data di esportazione e i file separati da `---`. Se un file manca compare "Non riesco a preparare il documento: file non trovato: …".

### Skills

Card con comando, descrizione ed esempio di richiesta per ogni skill di Claude Code del progetto:
- `/efuture-games`;
- `/efuture-games-qr`;
- `/efuture-games-links`;
- `/efuture-games-commit`;
- `/efuture-games-preview`;
- `/efuture-games-admin`;
- `/efuture-games-skills`.

In alto a destra di ogni card c'è il pulsante **copia** (solo icona, tooltip "Copia il comando /…"). Copia il comando negli appunti; per un attimo l'icona diventa una spunta verde e il tooltip "Copiato!".

Le skill si usano in una sessione di Claude Code aperta sul repository.

### Video utili

Card con il lettore video (`preload="none"`), il titolo, la descrizione e i pulsanti **Apri**, **Copia link** e **Scarica**. Video presenti:
- The Fork con Claude in Chrome;
- Forza 4 con Claude;
- Foglio «Attività giornaliere» con Claude in Chrome.

Per evitare copie vecchie, l'indirizzo del video e della copertina riceve `?v=` ricavato dall'ETag o da Last-Modified del file (richiesta HEAD). Se non è disponibile, si usa l'ora attuale.

### Tutorial

- **Elenco:** card con copertina, titolo, descrizione, numero di slide e **Apri il tutorial**.
- **Presentazione:**
  - in alto: titolo, contatore `n / N`, **Schermo intero** (della sola presentazione) e **Chiudi**;
  - a sinistra l'immagine, a destra il testo. Sul telefono stanno uno sopra l'altro;
  - sotto: frecce ← → e pallini per saltare a una slide.
- **Navigazione:** tasti ← → e PagSu/PagGiù, swipe orizzontale di almeno 50 px, Esc per chiudere quando non si è a schermo intero.
- **Prompt:** dove la slide ne ha uno, compare un riquadro con **Copia il prompt**.
- **Tempo:** dove indicato, compare un'etichetta "⏱ tempo".

Tutorial presenti:

| id | Titolo | Slide |
|---|---|---|
| `forza4` | Crea e gioca a Forza 4 con Claude | 12 |
| `sheets` | Foglio "Attività giornaliere" con Claude in Chrome | 11 |

### Backup

- Campo **Nota** (facoltativo) e pulsante **Crea backup e scarica**, che chiama `efg_admin_backup(p_key, p_note)`:
  - salva la copia nel database, con nota predefinita "backup manuale";
  - scarica il file `efuture-games-backup-<id>-<AAAAMMGG-HHMM>.json`.
- **Tabella dei backup:** `#`, Creato, Nota, Utenti, Record e i pulsanti:
  - **Scarica**: `efuture-games-backup-<id>.json`, tramite `efg_admin_backup_get`;
  - **Ripristina**: chiede conferma e chiama `efg_admin_restore`. Prima salva lo stato attuale in un nuovo backup automatico, di cui mostra il numero.
- Il ripristino usa solo i backup salvati nel database. **Non si può caricare un file JSON dal computer.**
- Formato del file: vedi [database.md](database.md#backup-e-ripristino).

### Chiave

- Cambia **la chiave con cui si è entrati**: titolo "Cambia la tua chiave personale" o "Cambia la chiave principale", con una spiegazione.
- Campi: **Nuova chiave** (almeno 10 caratteri) e **Ripeti la nuova chiave**, che devono coincidere. Prima di salvare chiede conferma con le conseguenze.
- Il pulsante chiama `efg_admin_set_key(p_key, p_new)`: con chiave personale cambia quella dell'utente, altrimenti la principale.
- La sessione continua con la nuova chiave.

### Reset

Ci sono due riquadri rossi. Prima di ogni reset il server crea un **backup automatico**, ripristinabile dalla scheda Backup.

| Operazione | Conferma da scrivere | Effetto |
|---|---|---|
| **Azzera i punti** | `AZZERA` | Cancella tutti i punteggi. I giocatori restano registrati |
| **Cancella tutto** | `CANCELLA TUTTO` | Cancella punteggi **e giocatori**. Tutti devono registrarsi di nuovo |

- La parola di conferma non distingue maiuscole e minuscole e ignora gli spazi agli estremi.
- Chiama `efg_admin_reset(p_key, 'punti' | 'tutto')`.
- Messaggio: "Fatto: cancellati N record [e M giocatori]. Backup automatico #id…".

## Formati CSV

Tutti i CSV usano il separatore `;`, il BOM UTF-8 e righe CRLF, così si aprono bene in Excel in italiano. I campi che contengono `;`, `"` o un a capo vanno tra virgolette. Date in formato italiano `gg/mm/aaaa, hh:mm:ss`.

**Utenti** (`efuture-games-utenti-<AAAAMMGG-HHMM>.csv`). Righe nell'ordine del server, cioè per data di registrazione:

```
Nome;Email;Tipo;Disabilitato;Registrato;Giochi usati;Livelli totali;Punti totali;SysAdmin livelli;SysAdmin punti;CoreTech livelli;CoreTech punti;Timenet livelli;Timenet punti;Inncloud livelli;Inncloud punti
```

Se un giocatore non ha giocato a un gioco, le celle di quel gioco restano vuote.

**Log** (`efuture-games-log-<AAAAMMGG-HHMM>.csv`). Le righe caricate a video, con lo stesso filtro:

```
Quando;Evento;Email;Gioco;Dettagli
```

`Gioco` contiene l'id (`sysadmin`, …). `Dettagli` contiene lo stesso testo della tabella.

Il `<AAAAMMGG-HHMM>` nei nomi dei file è in ora UTC (`toISOString`).

## Come aggiungere contenuti

Tutti gli elenchi sono array nello script di `admin.html`. Dopo la modifica:
- si aumenta la versione dell'app;
- si aggiorna questa specifica.

- **Video:** si copiano in `video/` il file `.mp4` (H.264) e una copertina `.jpg`, poi si aggiunge a `VIDEOS` la riga:
  ```js
  { title:'…', file:'video/nome.mp4', poster:'video/nome.jpg', desc:'… durata.' }
  ```
- **Tutorial:** si mettono le immagini in `tutorial/<id>/`, poi si aggiunge a `TUTORIALS`:
  ```js
  { id:'<id>', title:'…', cover:'tutorial/<id>/copertina.jpg', desc:'…',
    slides:[ { k:'Passo 1', h:'Titolo', img:'file.jpg', html:'<p>…</p>', prompt:'(facoltativo)', time:'(facoltativo)' }, … ] }
  ```
  - `img` è relativo a `tutorial/<id>/`;
  - `html` può contenere `<p>`, `<ul>` e `<b>`;
  - `prompt` aggiunge il riquadro con "Copia il prompt";
  - `time` aggiunge l'etichetta ⏱.
- **Skill:** si aggiunge a `SKILLS` la riga `['/nome-skill', 'cosa fa', '“esempio di richiesta”']`. L'elenco deve corrispondere a `.claude/skills/`.
- **Link:**
  - un link del sito si aggiunge nel gruppo `Sito` di `LINKS`, calcolandolo da `b` (= `PUBLIC_URL`);
  - un link esterno si aggiunge come `['Nome', 'https://…', 'nota']` nel gruppo giusto.

  Va aggiornato anche `.claude/skills/efuture-games-links/links.json`.

---
Ultimo aggiornamento: 07/10/2026 (v27)
