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

- Modulo "Accesso amministratore", con il campo **Chiave admin**.
- Il logo Efuture non è nell'intestazione ma nel piè di pagina bianco, in basso a destra (nascosto in stampa).
- **Entra** chiama `efg_admin_login(p_key)`.
- Se la chiave è giusta:
  - compare la dashboard;
  - in alto a destra compaiono **Gioca ↗** (apre l'app dei giocatori in una nuova scheda) e **Classifica ↗**;
  - la chiave si salva in `sessionStorage` (`efgAdminKey`). Vale solo per quella scheda del browser e si perde chiudendola.
- Ricaricando la pagina si rientra da soli con la chiave salvata.
- **Errori**, restituiti dal server come `{errore: …}`:
  - "chiave admin errata";
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

## Menu laterale

A sinistra del contenuto (sopra, sul telefono):
- **Utenti**;
- **Collegamenti:** QR, Link;
- **Formazione:** Video utili, Tutorial, Skills;
- **Admin:** Log, Backup, Chiave, Reset (Reset in rosso);
- **Logout:** dimentica la chiave e torna al login.

All'ingresso è aperta Utenti. In stampa il menu non compare.

### Utenti

- Dati da `efg_admin_players`. Testo in alto: "N utenti registrati". Pulsanti **Aggiorna** e **Scarica CSV**.
- **Tabella**, ordinata per livelli totali, poi per punti totali:

  | Colonna | Contenuto |
  |---|---|
  | `#` | Posizione |
  | Nome | |
  | Email | |
  | Tipo | Menu a tendina: **Giocatore** (predefinito), **Admin e giocatore**, **Solo admin**. Cambiandolo chiama `efg_admin_set_tipo(p_key, p_email, p_tipo)` (valori `giocatore`, `admin_giocatore`, `admin`) e scrive "admin: tipo utente" nel log. Serve `supabase-tipi-utenti.sql`: senza, il menu torna indietro e chiede di eseguirlo. |
  | Registrato | Data e ora |
  | Giochi | Giochi con almeno 1 livello, su 4 |
  | Livelli | Livelli totali, su 12 |
  | Punti | Punti totali |
  | Dettaglio per gioco | Per esempio `SysAdmin 2/3 · 150 — Timenet 1/3 · 40` |
  | (ultima) | Pulsante **Elimina** |

- **Elimina:**
  1. chiede conferma ("…vengono cancellati dal database e spariscono dalla classifica. Il log resta. Non si può annullare.");
  2. chiama `efg_admin_delete_player(p_key, p_email)`;
  3. ricarica la tabella e aggiunge "· eliminato *nome*".

  L'utente potrà registrarsi di nuovo con la stessa email.

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

### Skills

Card con comando, descrizione ed esempio di richiesta per ogni skill di Claude Code del progetto:
- `/efuture-games`;
- `/efuture-games-qr`;
- `/efuture-games-links`;
- `/efuture-games-commit`;
- `/efuture-games-preview`;
- `/efuture-games-skills`.

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

- Campi: **Nuova chiave** (almeno 10 caratteri) e **Ripeti la nuova chiave**, che devono coincidere.
- Il pulsante chiama `efg_admin_set_key(p_key, p_new)`.
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
Nome;Email;Tipo;Registrato;Giochi usati;Livelli totali;Punti totali;SysAdmin livelli;SysAdmin punti;CoreTech livelli;CoreTech punti;Timenet livelli;Timenet punti;Inncloud livelli;Inncloud punti
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
