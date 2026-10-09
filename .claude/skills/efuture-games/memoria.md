# Memoria di Efuture Games

Quello che i commit non dicono: decisioni, preferenze, chat fuori da Claude Code, cose in sospeso.
La aggiorna la skill `/efuture-games` a fine lavoro (o quando l'utente dice "ricordati che…").
Niente segreti qui: niente codici di sblocco, chiave admin, password o dati dei giocatori.

## Il progetto

- **Cos'è:** Efuture Games – CARE Conference Edition. Web app (PWA installabile) con 4 giochi da sbloccare con un QR allo stand dei 4 marchi, registrazione senza password e classifica comune.
- **I giochi:** Efuture Bros (Efuture, prima "SysAdmin Runner"), CoreTech Pac, Timenet Breakout, inncloud Invaders.
- **Dove gira:** GitHub Pages dal ramo `main` → https://marraliefuture.github.io/efuture_games/ · dati su Supabase (regione Frankfurt).
- **Referente:** marrali@efuture.it (Efuture). Scrive in italiano e preferisce spiegazioni semplici, senza gergo tecnico.

## Regole e convenzioni

- Risposte, commit e testi dell'app in **italiano**. Commit nello stile "Area: cosa cambia per chi usa l'app".
- Se cambia un file del sito si aumenta la **versione** (`sw.js` efuture-games-vN, `?v=N` negli html, `· vN` in hub.js) con `/efuture-games-commit`, così i telefoni scaricano l'aggiornamento.
- I file `supabase*.sql` non si applicano col push: vanno eseguiti a mano nel SQL Editor di Supabase.
- Si pubblica su `main` solo quando l'utente lo chiede (di solito con una pull request).
- Uscite di prova, anteprime e PDF vanno nello scratchpad, non nel repository.
- La chiave admin non è nel sito: è salvata cifrata nel database.
- Le skill di progetto vanno elencate anche nella scheda **Skills** di `admin.html` (array `SKILLS`).
- **Specifiche in markdown (decisione del 07/10):** finito il piano di modifiche qui sotto, si scrivono le specifiche di tutte le app in `docs/specifiche/`: app, 4 giochi, classifica online, pannello admin. Da quel momento:
  - ogni modifica all'app aggiorna anche il markdown corrispondente, nello stesso commit;
  - per studiare l'app si leggono prima i markdown e poi, solo se serve, il sorgente.
- Le modifiche si fanno **un po' alla volta**: uno step, l'utente lo prova, poi si chiede se andare avanti.

## Regole di gara (decise il 30/09)

- 3 livelli per gioco, al massimo 1 minuto ciascuno, 3 vite per livello.
- Punti di un livello = numero del livello × secondi avanzati × vite rimaste. Il livello perso vale 0, quelli superati restano.
- In classifica contano prima i livelli superati, poi i punti. Si tiene solo il risultato migliore per gioco. Totale = somma dei 4 giochi.
- Aperti fuori dall'app, i giochi hanno tutti i livelli e nessun limite.

## Cronologia delle chat

| Quando | Dove | Cosa si è fatto |
|---|---|---|
| prima del 30/09 | Claude (artifact) | Prime versioni dei 4 giochi e dell'app come artifact (link in `efuture-games-links/links.json`). |
| 30/09 – 01/10 | Claude Code `session_01JKnQNG9pCWK4bJDFMVQ8WJ` | Hub PWA con 4 giochi, Supabase, classifica da proiettare, accesso senza password, regole di punteggio, pannello admin (reset, backup, registro), installazione automatica Android/iPhone, Samsung Internet via Chrome, ritocchi a SysAdmin, CoreTech, Timenet. |
| 05/10 | Claude Code `session_016CF3Qht11DtgSKHThJZ6UZ` | Classifica con filtri a pulsanti (Classifica, Top, Giocatori Ospiti/Efuture, QR); countdown di apertura e chiusura della gara. |
| 06/10 | Claude Code `session_0174QLAunrqj9gZvMmRgiFii` | Skill `qr`, `commit`, `links`, `skills`, `preview`; schede admin QR, Link, Skills, Video utili, Tutorial; video TheFork e Forza 4; istruzioni a comparsa (v19). |
| 07/10 | Claude Code `session_014RiPo4gT2e1UtaJRgiE7ap` | Classifica: generale a destra, righe animate, pulsante Admin; versioni v20 e v21; PR #10 e #11 su main. |
| 07/10 | Claude Code `session_01E5nckLsAM9uFBEZoNu3pXB` | Spiegato perché le skill di progetto si vedono solo in Claude Code; creata la skill `/efuture-games` con questa memoria (v22). |
| 07/10 – 09/10 | Claude Code `session_015LsFVpYFCmd5CgErkamknr` | Skill caricabili sull'account (zip); CoreTech senza schermata a ogni livello, joystick a destra in orizzontale, bug che rinascono dal liv. 2; Timenet senza schermata e pallone grande che sfonda; risultato con solo punti/livelli/tempo; posizione in classifica nella home; SysAdmin (omino, piattaforme, bug, antivirus una volta); home: giochi che chiedono l'accesso, Classifica solo dopo l'accesso; titolo classifica arcade; pulsante Gioca nell'admin (v23-v34, PR #19-#22). |
| 09/10 | Claude Code `session_015LsFVpYFCmd5CgErkamknr` | Admin: tipi utente, menu a comparsa, popup Modifica con conferme, FAQ, Documentazione, chiavi admin personali cifrate, sezione Qualità (v35-v37, PR #25-#26); skill `/efuture-games-admin`. Classifica: Schermo intero sul secondo monitor (v38). |

Le chat di claude.ai e di ChatGPT non sono leggibili da Claude Code: se l'utente ne riassume una, aggiungila qui.

## Piano di modifiche dopo la presentazione (07/10)

Raccolte alla presentazione del 07/10. Si fanno uno step alla volta: l'utente prova ogni step e conferma prima del successivo.

- [x] **Step 1 – Privacy e utenti (v23):** cellulare tolto da registrazione, admin, CSV e database (anche dai backup); in admin "Elimina" cancella giocatore e punteggi (sparisce dalla classifica), il registro resta. SQL: `supabase-privacy-utenti.sql`.
- [x] **Step 2 – Classifiche (v24):** sull'app righe su due livelli (nome grande, dettaglio sotto, punti a destra, podio colorato); filtro Efuture: `supabase-classifica-gruppi.sql` aggiornato (anche sottodomini, ordine livelli poi punti) e avviso visibile sulla classifica se la funzione manca su Supabase, invece di mostrare tutti in silenzio (era la causa più probabile del problema).
- [x] **Step 3 – Aspetto (v25):** tema chiaro in app e nei 4 giochi (sfondo #eef4fa, pannelli bianchi, testo #0d2b45, arancio testi #c56a0c); testi accorciati; "powered by" tolto da app, classifica e giochi; la finestra Installa si apre da sola solo dal QR di installazione.
  - Richiesta aggiunta il 07/10: in fondo alla home 3 pulsanti Classifica · Installa app · Istruzioni (Esci accanto al nome); sotto "CARE Conference Edition" la frase "Sblocca, gioca e vinci!".
- [x] **Step 4 – Comandi dei giochi (v26):** joystick a manopola in SysAdmin (destra/sinistra, su = salto) e CoreTech (4 direzioni, svolta prenotata); pulsanti SALTA/MOUSE/ANTIVIRUS più grandi; comandi in una fascia separata (verticale) o ai lati del gioco (orizzontale), mai sopra il campo.
- [x] **Step 5 – SysAdmin Runner (v27):** testa (logo "e") specchiata quando va a sinistra; pulsante "Risolvi il ticket del cliente"; i bug si possono pestare anche mentre il personaggio lampeggia (contro il boss resta come prima).
- [x] **Step 6 – CoreTech Pac (v27):** C più lenta del ~22% (bug in proporzione); livelli 1–3 più facili (bug più lenti e meno insistenti, floppy più lunghi); bug mangiati non rinascono nel livello; uscita laterale in tutti i 5 labirinti; monetine ridotte nei livelli di gara per finirli in meno di un minuto.
- [x] **Step 7 – Timenet Breakout (v26):** mare e delfino alzati di 36 punti, più spazio sopra la barra di trascinamento.
- [x] **Step 8 – Video e tutorial (v27):** video `video/sheets-claude.mp4` (88 s) e tutorial `tutorial/sheets/` (11 slide) "Un foglio Google con Claude": foglio Attività giornaliere, TOTALE/MEDIA, salvataggio su Drive, mail con Gmail dopo conferma.
- [x] **Step 9 – Look Game Boy (v27):** in verticale i giochi sembrano un Game Boy (`games/gameboy.css` + `games/gameboy.js`): joystick o barra al posto della croce, A/B = SALTA/MOUSE (SysAdmin) o PAUSA/MUSICA, pulsantini ISTRUZIONI e AVVIA/PAUSA; in orizzontale invariato.
- [x] **Specifiche (v27):** `docs/specifiche/` con README, app-giocatori, classifica, admin, database, giochi-comune e una scheda per gioco. Da qui ogni modifica aggiorna la sua specifica.

Correzioni dell'08/10 (v28):
- Timenet: muro di mattoncini più in alto (y 64→28); la capsula T rende il pallone anche grande (×1,7) con alone viola, così sembra un vantaggio.
- inncloud: schieramento nemici più in alto (prima fila y 84→34); niente più sparo automatico: pulsante SPARA (tasto A nel look Game Boy, a destra in orizzontale), tieni premuto = raffica; tastiera Spazio/↑/Z.

Correzione dell'08/10 (v29): CoreTech livelli 1–3 semplificati (labirinti simmetrici, corridoi lunghi, niente vicoli), C più lenta di un altro ~15% (bug in proporzione, floppy +1 s), svolta assistita entro 0,35 casella dall'incrocio, joystick con zona morta 30% e isteresi sulle diagonali.

Risposte dell'utente (07/10):
- L'utente eliminato si cancella davvero dal database e sparisce dalla classifica; il registro eventi resta.
- Cellulare: via da tutto, anche dal database.
- Colori più chiari sia nei 4 giochi sia nell'app Efuture Games.
- Joystick solo in SysAdmin e CoreTech (Timenet e inncloud restano come sono).
- Ogni step si pubblica su main appena pronto, per provarlo sul telefono.

## In sospeso / da ricordare

- La sezione ChatGPT di `links.json` ha solo il link generico: mancano i link alle chat vere.
- Le skill sono disponibili solo nelle sessioni aperte sul repository. Per usarle nelle chat di claude.ai vanno caricate a mano (Impostazioni → Capabilities → Skills) e non si aggiornano da sole.
- Sblocco e punteggi sono controllati dal telefono: va bene per l'evento, non per premi di valore senza un controllo finale.
