# Memoria di Efuture Games

Quello che i commit non dicono: decisioni, preferenze, chat fuori da Claude Code, cose in sospeso.
La aggiorna la skill `/efuture-games` a fine lavoro (o quando l'utente dice "ricordati che…").
Niente segreti qui: niente codici di sblocco, chiave admin, password o dati dei giocatori.

## Il progetto

- **Cos'è:** Efuture Games – CARE Conference Edition. Web app (PWA installabile) con 4 giochi da sbloccare con un QR allo stand dei 4 marchi, registrazione senza password e classifica comune.
- **I giochi:** SysAdmin Runner (Efuture), CoreTech Pac, Timenet Breakout, Inncloud Invaders.
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

Le chat di claude.ai e di ChatGPT non sono leggibili da Claude Code: se l'utente ne riassume una, aggiungila qui.

## In sospeso / da ricordare

- La sezione ChatGPT di `links.json` ha solo il link generico: mancano i link alle chat vere.
- Le skill sono disponibili solo nelle sessioni aperte sul repository. Per usarle nelle chat di claude.ai vanno caricate a mano (Impostazioni → Capabilities → Skills) e non si aggiornano da sole.
- Sblocco e punteggi sono controllati dal telefono: va bene per l'evento, non per premi di valore senza un controllo finale.
