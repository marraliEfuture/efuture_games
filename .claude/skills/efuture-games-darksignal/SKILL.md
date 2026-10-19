---
name: efuture-games-darksignal
description: Mette Claude in "modalità DarkSignal" per accedere, analizzare o modificare i dati della piattaforma DarkSignal (https://darksignal.efuture.it/) — leggere elenchi e dettagli, cercare, contare, fare riepiloghi e grafici, esportare in CSV/Excel e, solo dopo conferma, creare, modificare o cancellare dati. Usala quando l'utente scrive /darksignal o /efuture-games-darksignal, nomina DarkSignal o darksignal.efuture.it, o chiede dati, numeri, report o modifiche su quella piattaforma.
---

# DarkSignal – accesso, analisi e modifica dei dati

Rispondi all'utente in italiano, in modo semplice. `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).

Da ora, finché l'utente non cambia argomento, **ogni richiesta riguarda la piattaforma DarkSignal** (`https://darksignal.efuture.it/`).

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<repo>` è il repository efuture_games. Serve solo per salvare le note su DarkSignal (`<skill>/note.md`). Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.
- In una chat il clone non ha il permesso di push: per salvare serve il connettore GitHub o una sessione di Claude Code.

## 1. All'avvio

1. Leggi `<skill>/note.md`: contiene quello che si sa già della piattaforma (pagine, API, accesso, nomi dei dati). Parti da lì, non rifare scoperte già fatte.
2. Controlla che il sito sia raggiungibile e scopri com'è fatto:
   ```
   python3 <skill>/scripts/ds.py prova
   ```
   Lo script prova la home e gli indirizzi tipici delle API (`/api`, `/openapi.json`, `/swagger`, `/graphql`, …) e dice cosa risponde.
   - **403 dal proxy / "CONNECT tunnel failed"**: l'ambiente non può uscire verso `darksignal.efuture.it`. Dillo all'utente: va aggiunto il dominio in *Allowed domains* nelle impostazioni dell'ambiente (o scelto un accesso di rete più ampio). Nel frattempo puoi lavorare su file esportati che l'utente carica (CSV, Excel, JSON).
   - **401 / 403 dal sito, o pagina di login**: serve l'accesso (punto 2).
3. Rispondi in 3-4 righe: sei in modalità DarkSignal, il sito risponde o no, che accesso hai (lettura / scrittura / nessuno). Chiedi cosa vuole fare.

## 2. Accesso

Le credenziali **non** vanno mai scritte nei file della skill, nei commit o nelle risposte. Si passano allo script con variabili d'ambiente:

| Variabile | Cosa contiene |
|---|---|
| `DARKSIGNAL_URL` | indirizzo base (di default `https://darksignal.efuture.it`) |
| `DARKSIGNAL_TOKEN` | token / chiave API → inviato come `Authorization: Bearer …` |
| `DARKSIGNAL_COOKIE` | cookie di sessione copiato dal browser (`nome=valore; …`) |
| `DARKSIGNAL_HEADER` | un'intestazione a scelta, es. `X-API-Key: …` |

Se non c'è nessuna di queste, chiedi all'utente come si accede a DarkSignal (chiave API, utente e password, cookie dal browser). Per il cookie: browser → DarkSignal già loggato → F12 → Rete → una richiesta → copia l'intestazione `Cookie`. In Claude Code la variabile va messa nei *segreti* dell'ambiente; se l'utente la incolla in chat, usala solo per la sessione e consiglia di rigenerarla dopo.

Se l'accesso è con utente e password tramite un modulo, guarda il modulo con `ds.py get /login` (o la pagina indicata) e invia i campi con `ds.py post … --form`. Lo script tiene i cookie ricevuti in `--cookie-jar <file>` per le richieste successive.

## 3. Leggere e analizzare

```
python3 <skill>/scripts/ds.py get /api/percorso -q pagina=1 -q limite=100 -o <scratchpad>/dati.json
```
- `-q chiave=valore` aggiunge parametri, `-o` salva la risposta su file (usalo per risposte grandi, poi analizzala con Python/pandas).
- Se la risposta è HTML e non JSON, leggi le tabelle della pagina; cerca nei file JavaScript (`ds.py prova --js`) gli indirizzi `/api/...` che la pagina usa davvero.
- Se i dati sono paginati, scarica tutte le pagine prima di contare o fare medie, e dillo nella risposta.
- Per i risultati: numeri e tabelle brevi in chat; per elenchi lunghi un CSV/Excel con SendUserFile; per grafici o cruscotti usa le skill dataviz / data:build-dashboard.
- Scrivi sempre da dove vengono i numeri (indirizzo, filtri, data e ora del download).

## 4. Modificare (con conferma)

Ogni scrittura (`post`, `put`, `patch`, `delete`) **senza `--si` non fa niente**: mostra solo cosa verrebbe inviato.

1. Leggi prima il dato com'è adesso (`ds.py get …`) e salvane una copia in `<scratchpad>/backup-<data>.json`.
2. Mostra all'utente, in modo chiaro: cosa cambia, su quanti elementi, prima → dopo.
3. Solo dopo un "sì" esplicito, esegui con `--si`:
   ```
   python3 <skill>/scripts/ds.py patch /api/percorso/123 --json '{"campo": "nuovo valore"}' --si
   ```
4. Rileggi il dato e conferma che la modifica c'è. Se qualcosa va storto, proponi di ripristinare dal backup.

Per modifiche di massa (più di 10 elementi) fai prima una prova su uno solo e chiedi di nuovo conferma. Le cancellazioni vanno sempre confermate una per una o come elenco esplicito.

## 5. Ricordare

Quando scopri qualcosa di utile e stabile (indirizzi delle API, nomi dei campi, come si fa l'accesso, filtri utili, stranezze), aggiungilo a `<skill>/note.md` — **mai** token, password o dati personali. Poi proponi di salvarlo con la skill `efuture-games-commit` e ricorda che, per averlo nelle chat, la skill va ricaricata sull'account (`/efuture-games-skills`).

## Note

- DarkSignal può contenere dati sensibili: non pubblicarli in artifact condivisi o su GitHub senza chiedere; nei file d'esempio usa dati finti o anonimi.
- Non provare a forzare l'accesso, indovinare password o aggirare permessi: se manca un permesso, dillo all'utente.
- Non fare molte richieste in fretta: per scaricare tanti dati usa le pagine dell'API e, se serve, una pausa (`--pausa`).
