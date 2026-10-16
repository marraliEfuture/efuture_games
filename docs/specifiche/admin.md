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
  - **📺 Proietta** apre la classifica (`classifica.html?proietta=1`) in una finestra a parte sul **secondo monitor** (ledwall o proiettore), mentre l'admin resta sul primo. Con Chrome o Edge usa la Window Management API (`getScreenDetails`) e posiziona la finestra (`window.open` con `left/top/width/height`) sull'altro schermo; la prima volta il browser chiede il permesso "Gestione finestre" e, se la finestra viene bloccata, il messaggio dice di premere di nuovo. Fa la stessa cosa del pulsante 📺 Proietta della classifica. Sulla classifica non serve più un secondo clic: la finestra si apre già grande quanto lo schermo (finestra senza barre, `popup,fullscreen,left,top,width,height`) e con l'aspetto da schermo intero (classe `.proj`: niente pulsanti di visualizzazione, Countdown e Admin). Se il browser lo consente (finestre `fullscreen` o schermo intero automatico, previsti da Chrome/Edge con il permesso "Gestione finestre" ma non ancora disponibili ovunque) va subito a schermo intero vero; altrimenti resta solo la barra della finestra, che sparisce con un clic in un punto qualsiasi della classifica. Senza secondo monitor o con altri browser la finestra si apre normale e il messaggio dice di trascinarla sull'altro schermo;
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
- **Contatti** (v95);
- **Collegamenti:** QR, Link;
- **Formazione:** Video utili, Tutorial, Laboratorio, Skills, FAQ, Documentazione;
- **Admin:** Impostazioni, Qualità, Log, Backup, Chiave, Reset (Reset in rosso);
- **Logout:** dimentica la chiave e torna al login.

All'ingresso è aperta Utenti. In stampa menu e titolo non compaiono.

### Utenti

- **Modifica › Dati (v84):** in cima alla finestra Modifica i campi Nome e cognome, Azienda, Email e Cellulare, già compilati, e **Salva dati** (`efg_admin_set_dati`). Controlli: nome 2-40 caratteri, azienda fino a 40, email valida e non già usata, cellulare valido, nome + azienda non già di un altro utente; gli errori compaiono sotto ("Non salvato: …"). Cambiando l'email i punteggi restano dell'utente (chiave esterna `on update cascade`) e nell'app si accede con l'email nuova. Il log registra cosa è cambiato (il cellulare solo come "cambiato"). Serve `supabase-modifica-utente.sql`.

- **Categorie (v82, icone dalla v84):** sopra la tabella i filtri **Tutti · Staff · Sponsor · Ospiti** con il numero di utenti. In tabella la colonna **Categoria** mostra solo un'icona tonda: la «e» di efuture (`img/efuture-e.png`) per Staff, 🤝 per Sponsor, 🧑‍💼 per Ospite. Cliccandola si apre Modifica direttamente su **Categoria**, dove tre pulsanti con le stesse icone salvano subito (`efg_admin_set_categoria`). Ci sono anche le colonne **Azienda** e **Email · cellulare** (il cellulare sotto l'email, con 📱). Il CSV ha in più Azienda, Cellulare e Categoria.
- **Dettaglio di gioco (v84):** non è più una colonna della tabella: si vede in Modifica, in una tabellina con livelli, punti e ora dell'ultimo record per ciascuno dei 4 giochi.

- Dati da `efg_admin_players`. Testo in alto: "N utenti registrati". Pulsanti **➕ Nuovo utente**, **Aggiorna** e **Scarica CSV**.
- **➕ Nuovo utente** (v75): popup con Email, Nome (2-20 caratteri) e Tipo scelto dall'admin: **🎮 Giocatore** (predefinito), **🎮🛡️ Admin e giocatore** o **🛡️ Solo admin**, con una riga che spiega il tipo. **Crea utente** chiede conferma e chiama `efg_admin_create_user(p_key, p_email, p_name, p_tipo, p_new)`: crea l'utente senza passare dall'app; se l'email esiste già, l'utente prende il tipo scelto (nome, blocco e punteggi restano). Per i tipi admin il pulsante diventa **Crea utente e genera la chiave**: il browser genera una chiave casuale `XXXX-XXXX-XXXX-XXXX` che compare **una sola volta** con **Copia** (nel database solo cifrata); l'admin entra con email + chiave, ha pieni poteri e può cambiarla dalla scheda Chiave. Un giocatore non ha chiave (se era admin la perde). Nel log: "admin: nuovo utente" o "admin: tipo utente". Serve `supabase-nuovo-utente.sql`; senza, il popup dice di eseguirlo.
- **Bonus Recensione** (riquadro sopra la tabella): campo **⭐ Link recensioni Google** (deve iniziare con `https://`; vuoto = il pulsante dell'app apre la ricerca di efuture su Google Maps), campo **Punti** (da 0 a 5000, predefinito 200) e pulsante **Salva**. Chiama `efg_admin_set_recensione_link` e `efg_admin_set_impostazione('recensione_punti')`. Sotto, una riga spiega i colori della colonna ⭐. Il CSV aggiunge le colonne "Clic Bonus Recensione" e "Recensione confermata". Serve `supabase-recensioni.sql`.
- **Tabella**, ordinata per livelli totali, poi per punti totali:

  | Colonna | Contenuto |
  |---|---|
  | `#` | Posizione |
  | ⭐ | Bonus Recensione: ☆ grigia = non ha cliccato il pulsante nell'app; ★ **gialla** = ha cliccato (data nel suggerimento); ★ **verde** = recensione confermata dall'admin. Clic sulla gialla → conferma (diventa verde, il giocatore riceve i punti del bonus nella classifica generale); clic sulla verde → la toglie. Chiama `efg_admin_set_recensione(p_key, p_email, p_ok)`; nel log "admin: recensione confermata/tolta" |
  | Tipo | Simbolo: 🎮 Giocatore, 🎮🛡️ Admin e giocatore (prima il joystick, poi lo scudo), 🛡️ Solo admin (il nome del tipo compare passandoci sopra). Gli utenti senza tipo valgono come Giocatore |
  | Nome | Con l'etichetta rossa **bloccato** se l'utente è bloccato (tutta la riga in grigio) |
  | Email | |
  | Registrato | Data e ora |
  | Giochi sbloccati | Giochi con almeno 1 livello superato, su 4 (lo sblocco con il QR resta solo sul telefono: il server vede un gioco solo quando arriva un punteggio) |
  | Livelli | Livelli totali, su 12 |
  | Punti | Punti totali |
  | Dettaglio per gioco | Per esempio `Efuture Bros 2/3 · 150 — Timenet 1/3 · 40` |
  | (ultima) | Pulsanti **Modifica** e **🚫 Blocca** / **✅ Sblocca** (lo stesso comando del popup, con la stessa conferma; il risultato compare accanto a "N utenti registrati") |

- **Modifica** apre un popup con nome ed email e tre gruppi di comandi:
  - **Tipo:** Giocatore, Admin e giocatore, Solo admin (quello attuale è evidenziato). Chiama `efg_admin_set_tipo(p_key, p_email, p_tipo)` (valori `giocatore`, `admin_giocatore`, `admin`); nel log "admin: tipo utente". Effetti: i tipi admin possono entrare nel pannello con email e chiave personale e fare tutto; tornando Giocatore la chiave personale viene cancellata. Nell'app per ora tutti i tipi giocano e compaiono in classifica. La domanda di conferma spiega questi effetti per il tipo scelto.
  - **Password** (solo per i giocatori): spiega che i giocatori non hanno una password, entrano con la sola email, quindi non c'è niente da reimpostare.
  - **Chiave admin personale (la password del pannello)** (solo per i tipi admin): stato "🔑 Impostata…" / "Non impostata…" e i pulsanti:
    - **🔑 Imposta / Modifica:** due campi (almeno 10 caratteri, uguali);
    - **🔄 Reset chiave:** nuova chiave casuale di 16 caratteri (`XXXX-XXXX-XXXX-XXXX`, generata nel browser con `crypto.getRandomValues`), mostrata **una sola volta** con il pulsante **Copia**;
    - **Togli:** l'utente non entra più nel pannello.
    Tutti chiamano `efg_admin_set_user_key(p_key, p_email, p_new)` (`p_new` vuoto = togli). La chiave viene salvata solo cifrata (bcrypt): non si può rileggere. Nella tabella un 🔑 accanto al tipo indica la chiave impostata.
  - **Blocca / sblocca:** 🚫 **Blocca** / ✅ **Sblocca** (nel database: disabilitato sì/no). Chiama `efg_admin_set_disabilitato(p_key, p_email, p_on)`; nel log "admin: utente disabilitato/riabilitato". Un utente disabilitato non può accedere all'app ("Il tuo account è stato disabilitato: chiedi agli organizzatori."), i nuovi punteggi non vengono salvati e non compare nelle classifiche. I punteggi restano nel database: riabilitandolo torna in classifica.
  - **Elimina utente:** chiama `efg_admin_delete_player(p_key, p_email)`, chiude il popup, ricarica la tabella e aggiunge "· eliminato *nome*". L'utente potrà registrarsi di nuovo con la stessa email, ripartendo da zero.
- **Ogni modifica chiede conferma** in una seconda finestra con la domanda ("Cambiare il tipo di…?", "Bloccare…?", "Sbloccare…?", "Reset della chiave di…?", "Eliminare…?"), le conseguenze spiegate e i pulsanti **Annulla** e **Sì, …** (rosso per bloccare ed eliminare). Con Annulla non cambia niente.
- Tipo e disabilitazione servono `supabase-tipi-utenti.sql`: senza, il popup dice di eseguirlo.

### Contatti

*Aggiunta il 16/10/2026, v95. Serve `supabase-contatti.sql` (anche in 5 parti in `supabase-parti/contatti-1…5.sql`); senza, la sezione dice "Per usare i contatti esegui prima supabase-contatti.sql…".*

Feedback, richieste e segnalazioni raccolti all'evento, inseriti a mano dall'admin (solo admin: la tabella `efg_contatti` non è leggibile dall'app).
- **Barra:** "N contatti registrati", filtri **Tutti / 🔴 Alto / 🟡 Medio / ⚪ Base** con il numero, ricerca (nome, azienda, servizio, email, descrizione, tipo), **➕ Nuovo contatto**, **Scarica CSV** (`efuture-games-contatti-<data>.csv`: Data, Tipo, Nome e cognome, Azienda, Telefono, Email, Servizio, Descrizione, Interesse, Inserito da).
- **Tabella** (dal più recente): Data, Tipo (💬 Feedback, 📩 Richiesta, ⚠️ Segnalazione), Nome, Azienda, Email · telefono, Servizio (etichetta), Descrizione (prime 2 righe, intera al passaggio del mouse), Interesse (pillola grigia/gialla/rossa), **Modifica**.
- **Popup Nuovo / Modifica contatto** (`#pCont`): Nome e cognome (obbligatorio, 2–80 caratteri), Azienda, Telefono, Email, Servizio, Descrizione (fino a 4000 caratteri), Tipo (predefinito Richiesta), Grado di interesse (predefinito Base). In modifica: "Inserito il … da …", "modificato il …" e **Elimina** (con conferma).
- **Servizio:** campo libero con l'elenco dei servizi già usati (`datalist`, da `efg_admin_contatti().servizi`). Un servizio nuovo mostra "✨ Nuovo servizio: dopo il salvataggio sarà tra le scelte."; se ha solo maiuscole diverse da uno esistente si salva con la scrittura già usata.
- Funzioni: `efg_admin_contatti`, `efg_admin_contatto_salva` (p_id null = nuovo), `efg_admin_contatto_elimina`. Ogni inserimento, modifica ed eliminazione va nel Log ("admin: contatto …"). "Inserito da" = email dell'admin con chiave personale, oppure "chiave principale".
- I contatti sono nei backup (colonna Contatti nella tabella Backup) e il ripristino li rimette; reset e "Cancella tutto" non li toccano.

### Impostazioni

- **🎮 Visualizzazione dei giochi:** tre scelte, quella attiva evidenziata: **🎮 Game** (scocca Game Boy in verticale, predefinita), **☀ Normal** (chiaro, gioco a tutta larghezza; nel database `light`), **☾ Dark** (scuro, gioco a tutta larghezza). È la visualizzazione con cui si aprono i giochi per chi non ne ha ancora scelta una con il pulsante in alto nel gioco. Chiama `efg_admin_set_impostazione(p_key, 'vista_default', …)`; nel log "admin: impostazione". L'app la legge all'avvio (`efg_impostazioni`), quindi vale dalla prossima apertura dell'app.
- **⭐ Bonus Recensione:** rimanda a Utenti, dove si impostano link e punti.
- Serve `supabase-recensioni.sql`: senza, compare l'avviso di eseguirlo.

### Campi della registrazione (Impostazioni, v82)

**Schermata dei giochi (v83):** sotto i campi, quattro scelte per la home dell'app con il pulsante Bonus Recensione: 1 · Griglia 2×2 con il bonus sotto, 2 · Bonus in alto (riquadro giallo sopra ai giochi), 3 · Giochi in lista (predefinita), 4 · Bonus sempre visibile in basso. Il clic salva subito (`efg_admin_set_impostazione('home_layout', 'ora'|'alto'|'lista'|'fisso')`); vale dalla prossima apertura dell'app. Serve `supabase-home-layout.sql`.

In cima a Impostazioni una tabella con una riga per campo (Nome e cognome, Azienda, Email, Cellulare) e tre scelte: 🚫 Non visibile, ◻️ Facoltativo, ✳️ Obbligatorio. Il clic salva subito (`efg_admin_set_impostazione('campi_registrazione', JSON)`), "Salvato: vale dalla prossima registrazione.". **Email (v93):** anche l'email si sceglie (predefinito Obbligatorio); nota "Serve per accedere da un altro telefono. Chi si registra senza email gioca solo dal telefono con cui si è registrato". Il valore "obbligatorio" dell'email non si salva (è il predefinito); per Facoltativo o Non visibile serve `supabase-email-facoltativa.sql`, altrimenti "Prima esegui supabase-email-facoltativa.sql…". Chi si è registrato senza email ha nel database un identificativo interno `…@senza-email.invalid`: in Utenti compare "✉️ senza email" (grigio), in Modifica il campo Email è vuoto (scrivendone una gliela si assegna, lasciandolo vuoto resta senza), nel CSV e nel log la colonna Email è vuota. Nome e azienda non possono essere entrambi non visibili. Senza `supabase-campi-registrazione.sql` compare "Per salvarli esegui prima supabase-campi-registrazione.sql…".

### Qualità

Mostra i risultati dei controlli automatici sul progetto. I dati vengono da `docs/qualita/ultimo.json` (ultimo controllo) e `docs/qualita/storico.json` (un punto per data), scritti dallo script `.claude/skills/efuture-games-commit/scripts/qualita.py`, che la skill di commit esegue prima di ogni salvataggio. Solo il box Backup fatti legge il database (`efg_admin_backups`).

- In alto: data, versione e commit dell'ultimo controllo, pulsante **Aggiorna**.
- **7 box**, ognuno con numeri e mini grafico per data; il bordo è giallo se ci sono avvisi, rosso se ci sono errori o vulnerabilità alte:
  | Box | Cosa controlla |
  |---|---|
  | Codice | Sintassi dei .js, script nelle pagine, id duplicati, collegamenti locali, file della cache, versione coerente |
  | Database | File SQL: RLS, `search_path`, controllo della chiave nelle funzioni admin, permessi, chiavi cifrate, classifica senza disabilitati |
  | Prestazioni | Peso delle pagine e dei file, immagini, cache offline, tempo di caricamento nel browser |
  | Spazio occupato | Totale del sito e per cartella, con trend per data |
  | Vulnerabilità | Segreti o codici in chiaro, link esterni, HTTPS, CDN, `innerHTML`, sblocco, blocco dei tentativi; gravità alta/media/bassa, con trend per data |
| Sicurezza della piattaforma | Punteggio da 0 a 100 e livello (90+ Ottimo, 75+ Buono, 50+ Sufficiente, sotto A rischio), con trend per data. Si parte da 100 e si tolgono: 25 per ogni vulnerabilità alta, 10 media, 3 bassa, 15 per ogni errore e 5 per ogni avviso del box Database. Nel dettaglio: i problemi con i punti tolti, il punteggio di partenza e i controlli superati. Calcolato da `qualita.py` (`sicurezza` in `ultimo.json` e nello storico; i giorni vecchi si ricalcolano dal riepilogo) |
| Backup fatti | Letto dal database: numero di backup, quando è stato fatto l'ultimo, quanti manuali e quanti automatici (nota che inizia con "automatico"), grafico dei backup per giorno negli ultimi 14 giorni. Bordo rosso se non c'è nessun backup, giallo se l'ultimo ha più di un giorno. Nel dettaglio: grafico grande e tabella #, Creato, Tipo, Nota, Utenti, Record. Per scaricare o ripristinare si usa la scheda Backup |
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
- `/efuture-games-efuture-bros`;
- `/efuture-games-coretech-pac`;
- `/efuture-games-timenet-breakout`;
- `/efuture-games-inncloud-invaders`;
- `/efuture-games-skills`.

Le skill `/efuture-games-admin` e le 4 skill dei giochi mettono Claude in una "modalità": da quel momento ogni richiesta riguarda il pannello admin o quel gioco, finché l'utente non dice "basta …" o richiama un'altra skill.

In alto a destra di ogni card c'è il pulsante **copia** (solo icona, tooltip "Copia il comando /…"). Copia il comando negli appunti; per un attimo l'icona diventa una spunta verde e il tooltip "Copiato!".

Le skill si usano in una sessione di Claude Code aperta sul repository.

### Video utili

Card con il lettore video (`preload="none"`), il titolo, la descrizione e i pulsanti **Apri**, **Copia link** e **Scarica**. Video presenti:
- Presentazione «Laboratorio AI» (`video/laboratorio-ai.mp4`, 4 min 52 s): la presentazione `laboratorio.html` registrata; per presentarla dal vivo si usa Formazione › Laboratorio › Presenta;
- The Fork con Claude in Chrome;
- Forza 4 con Claude;
- Foglio «Attività giornaliere» con Claude in Chrome;
- Tutorial RCM² per ISO 9001, 27001, 27017, 27018, GDPR e NIS2 (`video/tutorial-rcm2-am-solutions.mp4`, 13 min 36 s, senza audio). Dalla v94 la prima schermata, sotto il titolo, dice «Un unico programma per gestire certificazioni ISO, privacy e NIS2: audit sempre pronti, scadenze sotto controllo, miglioramento continuo e meno rischio di sanzioni.» (prima: «Tutorial pratico sul caso AM Solutions Srl – eCRF SaaS per la ricerca clinica»); aggiornata anche la copertina.

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
| `forza4` | Crea e gioca con Claude | 12 |
| `sheets` | Foglio "Attività giornaliere" con Claude in Chrome | 11 |

### Laboratorio

*Aggiunto il 14/10/2026, v73.*

- Testo: "La scaletta degli interventi da presentare all'evento, in ordine. Tocca **Presenta**: l'intervento va a schermo intero sul proiettore e qui resta la regia."; a destra "N interventi · circa X min".
- Una card per intervento (`LAB_EVENTS`, in ordine): numero in un cerchio, titolo, descrizione, etichette (⏱ minuti, 🎤 relatore e altre). L'intervento 1 è in risalto: bordo e cerchio arancioni (`--brand-orange`), sfondo sfumato, etichetta "Evento n. 1", e sotto la riga "⌨️ Presenta: va a schermo intero sul proiettore; si va avanti e indietro dalla regia, con le frecce ← → o il telecomando. Video: la stessa presentazione registrata, 4 min 52 s."
- A destra **Presenta** e, per chi ha un video, **▶ Video (mp4)**:
  - Presenta con `deck` o `tutorial` (v88, `labProj`): **l'admin resta dov'è** e fa da regia. La presentazione va nella finestra `proiettore.html` sul secondo monitor (Window Management API per trovare lo schermo): la prima volta Presenta la apre lì (popup grande quanto lo schermo, nome `efgLabProj`); poi le manda `{ type:'show', url }` con `postMessage(…, { delegate:'fullscreen' })` (Capability Delegation), così il proiettore carica la presentazione e va a schermo intero **senza clic sul proiettore**. L'url è `deck` + `?embed=1`, oppure per un tutorial `laboratorio.html?embed=1&t=<id>` (solo i passi di quel tutorial). Il proiettore risponde `{ type:'fs', ok }` e l'admin mostra "La presentazione è a schermo intero sul proiettore…" oppure "Il proiettore è pronto sull'altro schermo: premi di nuovo «Presenta» per lo schermo intero" (aprire la finestra consuma il clic, quindi la prima volta può servire un secondo Presenta). Le sessioni successive: un clic, la finestra resta aperta e cambia solo la presentazione. **Focus sul proiettore (v89):** dopo ogni Presenta e ogni pulsante della barra di regia l'admin chiama `projWin.focus()` e manda `{ type:'focus' }` (con il permesso delegato: se il proiettore era uscito dallo schermo intero ci torna); il proiettore mette il focus dentro l'iframe della presentazione, così il puntatore laser o il telecomando (frecce, PagSu/PagGiù) muovono le slide direttamente. Se il focus torna sull'admin, le stesse frecce vengono comunque inoltrate. La prima volta il browser chiede il permesso "Gestione finestre": dopo "Permesso concesso: premi di nuovo «Presenta»". Popup bloccati: messaggio per consentirli.
  - **Un solo monitor** (o browser senza Window Management API) — `labFull`: questa finestra va a schermo intero con la presentazione in `#labStage` (iframe `#labFrame`); Esc chiude. Se c'è un secondo schermo `labFull` userebbe `requestFullscreen({ screen })` e aprirebbe la regia `admin.html?regia=lab` (entra da sola con la chiave della scheda, apre Laboratorio, titolo "Regia · …"), ma dalla v88 si usa `labProj`, che non sposta la scheda dell'admin;
  - altrimenti: "Le slide di «…» non sono ancora pronte.";
  - Video (mp4): apre l'mp4 sul secondo monitor;
  - **⬇ PPTX** (v86, per chi ha `pptx`): scarica il PowerPoint della sessione da `presentazioni/` (link con `download`).
- **Barra di regia** (nascosta finché la presentazione non è aperta): "● In onda", slide corrente "n / N · titolo", **⟲ Inizio**, **←**, **Avanti →**, **⏯ Video** (avvia o mette in pausa il video della slide) e **✕ Chiudi** (chiude la finestra del proiettore, o lo schermo intero se si è su un solo monitor). Con la barra visibile, le frecce ← → e PagSu/PagGiù del telecomando nella finestra di regia comandano la presentazione. Parla con la presentazione con `BroadcastChannel('efg-lab')`: l'admin manda `next`, `prev`, `go {i}`, `ping`, `play`, `stop` (`stop` lo riceve la finestra a schermo intero, che esce; `proiettore.html` torna nera con il logo); la presentazione risponde `state {i, n, title}` (e `bye` quando si chiude). Funziona con admin e presentazione nello stesso browser e sullo stesso sito.

Interventi:

| # | Titolo | Min | Presenta |
|---|---|---|---|
| 1 | Presentazione "Laboratorio AI" | 20 | `laboratorio.html` (+ video `video/laboratorio-ai.mp4`) |
| 2 | Crea e gioca con Claude | 15 | tutorial `forza4` |
| 3 | Foglio "Attività giornaliere" con Claude in Chrome | 5 | tutorial `sheets` |
| 4 | Efuture Games: i 4 giochi degli stand | 5 | slide non pronte (c'è il PPTX) |
| 5 | Classifica e premiazione | 10 | slide non pronte (c'è il PPTX) |

#### PowerPoint delle sessioni (v86)

In `presentazioni/`, 16:9 (13,33 × 7,5 in), tema "Efuture" (blu notte `002238`, arancio `F18C22`, azzurro `8AD0FF`, font Calibri), note per il relatore in ogni slide:

| File | Contenuto |
|---|---|
| `1-laboratorio-ai.pptx` | Le 20 slide di `laboratorio.html` come immagini 1920×1080; le slide 3 e 6 contengono i video TheFork e Forza 4 |
| `2-forza4-claude.pptx` | Tutorial `forza4` con testi modificabili (layout immagine a sinistra, testo a destra, prompt e tempo) + video |
| `3-foglio-attivita.pptx` | Tutorial `sheets`, come sopra + video |
| `4-efuture-games.pptx` | Copertina, regole (3 livelli · 1 minuto · 3 vite, formula dei punti, sblocco agli stand), una slide per gioco con schermata di gioco, QR dell'app |
| `5-classifica-premiazione.pptx` | Le due classifiche, le fasi Live e Finale, conto alla rovescia, podio con "Nome Cognome / Azienda" da compilare, ringraziamenti |

Si rifanno tutti con `.claude/skills/efuture-games-admin/scripts/pptx_laboratorio.mjs` (serve `pptxgenjs`, vedi la skill efuture-games-admin): prende i testi da `tutorial/tutorials.js` e fa al momento gli screenshot di `laboratorio.html` e dei 4 giochi.

#### Finestra proiettore.html (v88)

- Pagina nera con il logo Efuture bianco al centro e un iframe a tutto schermo per la presentazione. Non ha accesso: accetta solo indirizzi `laboratorio.html` dello stesso sito.
- Riceve dall'admin `show` (carica l'url e chiama subito `requestFullscreen`, usando il permesso delegato), `focus` (rimette lo schermo intero se serve e il focus nella presentazione) e `blank`; quando la presentazione è caricata o cambia lo schermo intero, il focus va dentro l'iframe; sul canale `efg-lab` `stop` la riporta al logo.
- Se lo schermo intero non riesce compare in alto "Clicca una volta qui per lo schermo intero" (ultima risorsa).
- Frecce, PagSu/PagGiù, spazio e Invio premuti su questa finestra mandano `next`/`prev` sul canale `efg-lab`.

#### Presentazione laboratorio.html

- Parametri: `?rec=1` nasconde comandi e inviti (registrazione del video); `?embed=1` (dentro l'admin, già a schermo intero) nasconde comandi e inviti, non chiede lo schermo intero al clic ma fa partire i video; `?t=<id>` mostra solo i passi di quel tutorial di `tutorial/tutorials.js`.
- Pagina senza accesso, stile PowerPoint: palco fisso 1920×1080 scalato sulla finestra, bande nere ai lati. Font locali Montserrat, Poppins e Press Start 2P; colori navy `#002238`, arancione `#f18c22`, azzurro `#8ad0ff`.
- Slide (`DECK`, 20 in tutto):
  1. Copertina "Laboratorio **AI**" (AI arancione) e "CARE CONFERENCE" spaziato in azzurro;
  2. "CLAUDE IN CHROME" · **Claude, aiutami tu!** · "Installa l'estensione di Claude sul tuo browser e risolvi **operazioni quotidiane.**";
  3. video `video/thefork-claude.mp4` a tutto schermo, con didascalia che sparisce quando parte;
  4. grande "?" arancione · "E tu cosa potresti chiedere a Claude per le tue *operazioni quotidiane?*" con gli esempi Prenotare un ristorante, Inviare una mail, Compilare un foglio di calcolo, Confrontare offerte, Organizzare una trasferta (v90);
  5. "CREA CON CLAUDE" · **Crea il tuo videogioco!** · "4 prompt e il gioco è fatto! Realizza la tua app in meno di 15 minuti." con "GAME ON" pixel in alto a destra;
  6. video `video/forza4-claude.mp4`;
  7–18. i 12 passi del tutorial `forza4` (da `tutorial/tutorials.js`): immagine a sinistra su sfondo chiaro, a destra "Tutorial · Forza 4 con Claude", passo, titolo, testo, prompt, ⏱.
  19. (v91) grande "?" arancione · "Ho creato il mio primo videogioco. *E adesso?*" con le domande Come posso creare un’applicazione per la mia azienda?, Con quale scopo?, Come posso migliorare un processo aziendale?, Come posso digitalizzare un’operazione di routine?;
  20. (v91) "**Grazie**" grande e sotto "e buona *accelerazione…*" (accelerazione arancione).
  Le slide 19 e 20 ci sono solo nella presentazione completa, non con `?t=<id>`. Nel video sono 5 s ciascuna.
- Slide scure: sfondo navy sfumato, due quadratini bianchi in alto a sinistra, logo `img/efuture-logo-white.png` in basso a sinistra (nei passi del tutorial sulla parte scura). Barra di avanzamento arancione in basso e "n / N" in basso a destra (nascosto sui video).
- Comandi: → ↓ PagGiù spazio Invio avanti; ← ↑ PagSu indietro; Home/Fine; F schermo intero; K o clic sul video pausa/riprendi. Muovendo il mouse compaiono ← → e "Schermo intero", che spariscono dopo 2,5 s insieme al cursore.
- I video partono da soli entrando nella slide e si fermano uscendo; se il browser blocca l'audio partono muti con "🔇 Clic per attivare l'audio".
- Fuori dallo schermo intero compare in alto "Clicca una volta qui per lo schermo intero · frecce o telecomando per avanzare"; un clic attiva lo schermo intero.
- La slide corrente è nell'indirizzo (`#n`). Con `?rec=1` spariscono comandi e inviti (per registrare il video).
- Il numero di pagina (`#cnt`) è nascosto su tutte le slide (v90); resta la barra arancione di avanzamento.
- Testi dei passi del tutorial (v90): pagina 7 «Crea un gioco con l’AI» (… richieste a Claude (o ChatGPT, ecc.) e gioca subito), pagina 10 prompt «Creami un gioco come Forza 4 …», pagina 13 «Grafica e immagini» (v92), pagina 14 «Scatena un evento», 15 «Prova subito il tuo gioco!», 16 «Ricorda le regole…»; la didascalia del video Forza 4 è «Crea e gioca con Claude»; tolti i due quadratini bianchi decorativi in alto a sinistra da tutte le slide. Rifatti `video/laboratorio-ai.mp4` (stesse durate, slide nuove) e la scheda iniziale di `video/forza4-claude.mp4` (+ copertina): «Crea e gioca con Claude».
- Il video `video/laboratorio-ai.mp4` (+ copertina `.jpg`) è la presentazione registrata: slide 1–5 per 5 s, passi del tutorial per 4 s, al posto delle slide 3 e 6 i due mp4 interi con l'audio; H.264 1280×720, crf 26, AAC, faststart.

### Backup

- Campo **Nota** (facoltativo) e pulsante **Crea backup e scarica**, che chiama `efg_admin_backup(p_key, p_note)`:
  - salva la copia nel database, con nota predefinita "backup manuale";
  - scarica il file `efuture-games-backup-<id>-<AAAAMMGG-HHMM>.json`.
- **Tabella dei backup:** `#`, Creato, Nota, Utenti, Record, Contatti (v95; "—" per i backup fatti prima dei contatti, che al ripristino non toccano i contatti) e i pulsanti:
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
| **Cancella tutto** | `CANCELLA TUTTO` | Cancella tutti i punteggi **e gli utenti di tipo giocatore**, che devono registrarsi di nuovo. Gli utenti `admin` e `admin_giocatore` restano (con chiave e tipo), senza punti. Serve `supabase-reset-sblocchi.sql` |

- La parola di conferma non distingue maiuscole e minuscole e ignora gli spazi agli estremi.
- Chiama `efg_admin_reset(p_key, 'punti' | 'tutto')`.
- Con entrambi i reset il server aggiorna il "numero di reset" (`reset_id` in `efg_settings`, da `supabase-reset-sblocchi.sql`): all'apertura successiva l'app di ogni telefono riblocca i 4 giochi e cancella i record salvati sul telefono (vedi app-giocatori › Sblocco).
- Messaggio: "Fatto: cancellati N record [e M giocatori (tenuti K admin)]. Backup automatico #id…".

## Formati CSV

Tutti i CSV usano il separatore `;`, il BOM UTF-8 e righe CRLF, così si aprono bene in Excel in italiano. I campi che contengono `;`, `"` o un a capo vanno tra virgolette. Date in formato italiano `gg/mm/aaaa, hh:mm:ss`.

**Utenti** (`efuture-games-utenti-<AAAAMMGG-HHMM>.csv`). Righe nell'ordine del server, cioè per data di registrazione:

```
Nome;Email;Tipo;Bloccato;Registrato;Giochi sbloccati;Livelli totali;Punti totali;Efuture Bros livelli;Efuture Bros punti;CoreTech livelli;CoreTech punti;Timenet livelli;Timenet punti;inncloud livelli;inncloud punti
```

Se un giocatore non ha giocato a un gioco, le celle di quel gioco restano vuote.

**Log** (`efuture-games-log-<AAAAMMGG-HHMM>.csv`). Le righe caricate a video, con lo stesso filtro:

```
Quando;Evento;Email;Gioco;Dettagli
```

`Gioco` contiene l'id (`sysadmin`, …). `Dettagli` contiene lo stesso testo della tabella.

Il `<AAAAMMGG-HHMM>` nei nomi dei file è in ora UTC (`toISOString`).

## Come aggiungere contenuti

Tutti gli elenchi sono array nello script di `admin.html`, tranne i tutorial, che sono in `tutorial/tutorials.js`. Dopo la modifica:
- si aumenta la versione dell'app;
- si aggiorna questa specifica.

- **Video:** si copiano in `video/` il file `.mp4` (H.264) e una copertina `.jpg`, poi si aggiunge a `VIDEOS` la riga:
  ```js
  { title:'…', file:'video/nome.mp4', poster:'video/nome.jpg', desc:'… durata.' }
  ```
- **Tutorial:** si mettono le immagini in `tutorial/<id>/`, poi si aggiunge a `window.EFG_TUTORIALS` in `tutorial/tutorials.js` (lo legge l'admin come `TUTORIALS`, e laboratorio.html per i passi di Forza 4):
  ```js
  { id:'<id>', title:'…', short:'titolo breve (facoltativo)', cover:'tutorial/<id>/copertina.jpg', desc:'…',
    slides:[ { k:'Passo 1', h:'Titolo', img:'file.jpg', html:'<p>…</p>', prompt:'(facoltativo)', time:'(facoltativo)' }, … ] }
  ```
  - `img` è relativo a `tutorial/<id>/`;
  - `html` può contenere `<p>`, `<ul>` e `<b>`;
  - `prompt` aggiunge il riquadro con "Copia il prompt";
  - `time` aggiunge l'etichetta ⏱.
- **Interventi del Laboratorio:** si aggiunge a `LAB_EVENTS`, nell'ordine dell'evento:
  ```js
  { title:'…', desc:'…', min:10, who:'relatore', tags:['…'], deck:'pagina.html', tutorial:'<id>', video:'video/nome.mp4', pptx:'presentazioni/nome.pptx' }
  ```
  `deck`, `tutorial`, `video` e `pptx` sono facoltativi: senza `deck` né `tutorial`, Presenta dice che le slide non sono pronte. Le slide di `laboratorio.html` sono nell'array `DECK` della pagina.
- **Skill:** si aggiunge a `SKILLS` la riga `['/nome-skill', 'cosa fa', '“esempio di richiesta”']`. L'elenco deve corrispondere a `.claude/skills/`.
- **Link:**
  - un link del sito si aggiunge nel gruppo `Sito` di `LINKS`, calcolandolo da `b` (= `PUBLIC_URL`);
  - un link esterno si aggiunge come `['Nome', 'https://…', 'nota']` nel gruppo giusto.

  Va aggiornato anche `.claude/skills/efuture-games-links/links.json`.

---
Ultimo aggiornamento: 07/10/2026 (v27)

## Occhio sulle chiavi (v68)

- I campi "Nuova chiave" e "Ripeti la chiave" (scheda Chiave e chiave personale nella scheda Utenti) hanno un pulsante a forma di occhio per vedere quello che si scrive. Di default la chiave è nascosta; torna nascosta a ogni salvataggio, annullamento o nuova apertura.
