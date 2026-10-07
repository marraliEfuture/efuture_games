---
name: efuture-games
description: Carica in memoria tutto il progetto Efuture Games — stato dell'app, file, skill, link e artifact di Claude, sessioni e chat passate, ultimi commit e la memoria condivisa con decisioni e cose in sospeso — così si riparte da dove si era rimasti. Usala all'inizio di una sessione su efuture_games, quando l'utente scrive /efuture-games, chiede "riprendiamo", "a che punto siamo", "cosa abbiamo fatto finora" o dice "ricordati che…".
---

# Efuture Games – tutto il progetto in memoria

Rispondi all'utente in italiano, in modo semplice.

## 1. Carica il contesto

1. Esegui lo script e leggi tutto l'output: è la base di quello che sai sul progetto.
   ```
   python3 .claude/skills/efuture-games/scripts/contesto.py
   ```
   Contiene stato e versione dell'app (ramo corrente e online), mappa dei file, skill, link e artifact, sessioni di Claude Code ricavate dai commit, ultimi commit e `memoria.md`.
2. Completa con le fonti esterne, se gli strumenti ci sono. Se uno manca o non risponde, saltalo senza bloccarti:
   - **Artifact di Claude:** `Artifact` con `action: "list"`. Tieni quelli del gioco (titoli con "Efuture", "SysAdmin", "CoreTech", "Timenet", "Inncloud") e segnala quelli che mancano in `links.json`.
   - **Sessioni di Claude Code:** `list_sessions` (server claude-code-remote) con `mine: true`. Tieni quelle con titolo o repository efuture_games, anche quelle senza commit.
   - **Pull request:** `list_pull_requests` su `marraliEfuture/efuture_games` (aperte e ultime chiuse).
3. Non leggere i file del sito per intero adesso: aprili quando servono per il lavoro richiesto.
4. **Per studiare un'app parti dalle specifiche** in `docs/specifiche/`, se ci sono, e apri il sorgente solo quando serve. Se modifichi un'app, aggiorna la sua specifica nello stesso commit.

## 2. Rispondi con un riepilogo breve

Al massimo una decina di righe:
- cos'è il progetto e la versione online;
- le ultime 2-3 cose fatte (sessione e data);
- cosa c'è in sospeso: modifiche non salvate, commit non ancora su main, PR aperte, punti di "In sospeso" della memoria;
- le skill disponibili, in una riga.

Chiudi chiedendo su cosa vuole lavorare. Se l'utente aveva già chiesto altro insieme a `/efuture-games`, fai il riepilogo in 2-3 righe e passa subito al lavoro.

## 3. Tieni aggiornata la memoria

`memoria.md` è il ponte tra le sessioni e le chat. Aggiornalo quando:
- finisce un lavoro: aggiungi una riga alla **Cronologia delle chat** con data, link della sessione corrente (dal `Claude-Session` delle istruzioni di commit) e cosa si è fatto;
- l'utente prende una decisione o esprime una preferenza: va in **Regole e convenzioni** o nella sezione giusta;
- l'utente racconta o incolla una chat di claude.ai, un Progetto di claude.ai o una chat di ChatGPT: riassumila in una riga di cronologia e aggiungi gli eventuali link in `links.json`;
- l'utente dice "ricordati che…";
- qualcosa in **In sospeso** viene risolto: toglilo.

Scrivi frasi corte. Non copiare il contenuto dei commit, che lo script legge già. Poi salva con `/efuture-games-commit`: se cambia solo `.claude/` non serve aumentare la versione.

## Limiti da dire con chiarezza

- Claude Code **non può leggere** le chat di claude.ai, i Progetti di claude.ai né le chat di ChatGPT. Conosce solo quello che è nel repository (commit, `memoria.md`, `links.json`) e quello che gli strumenti elencano (artifact, sessioni, PR). Per il resto chiedi all'utente un riassunto e salvalo nella memoria.
- Mai mostrare o scrivere in memoria i codici di sblocco, la chiave admin o i dati dei giocatori.

## Se nasce una nuova skill

Aggiungila all'array `SKILLS` in `admin.html`, scheda Skills, e aumenta la versione con `/efuture-games-commit`. Lo script `contesto.py` e `/efuture-games-skills` la trovano da soli.
