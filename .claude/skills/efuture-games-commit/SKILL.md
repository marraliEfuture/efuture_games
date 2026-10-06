---
name: efuture-games-commit
description: Salva e carica su GitHub tutte le modifiche di Efuture Games. Controlla i file, aumenta la versione dell'app se è cambiato il sito, fa commit e push, e su richiesta pubblica su main (GitHub Pages). Usala quando l'utente chiede di salvare, aggiornare, caricare, committare o pubblicare le modifiche di efuture_games.
---

# Efuture Games – carica le modifiche su GitHub

Rispondi all'utente in italiano. Il sito è pubblicato da GitHub Pages dal ramo `main` (https://marraliefuture.github.io/efuture_games/).

## Procedura

1. **Guarda cosa è cambiato:** `git status --short` e `git diff --stat` (anche `git diff --cached --stat`).
   - Se non c'è niente da salvare né da caricare (`git status -sb` senza "ahead"), dillo e fermati.
   - Non aggiungere file temporanei, anteprime, PDF di prova o segreti. Le uscite delle skill vanno nello scratchpad, non nel repository. Se trovi file sospetti, chiedi prima di includerli.

2. **Versione dell'app.** Aumentala se è cambiato almeno un file del sito: html, js, css, immagini, icone, font, `manifest.webmanifest`, `qr/`, `games/`. Non serve se sono cambiati solo `.claude/`, `LEGGIMI.txt`, `README.md` o `supabase.sql`, e nemmeno se la versione è già stata aumentata in un commit non ancora pubblicato su `main`.
   ```
   python3 .claude/skills/efuture-games-commit/scripts/prepara.py versione
   ```
   Senza aumento di versione usa invece `prepara.py controlla`. Lo script controlla:
   - che esistano tutti i file della cache di `sw.js`;
   - la sintassi dei .js;
   - che la versione sia uguale in tutti i file.

   Se un controllo fallisce, correggi o riferisci all'utente. Non fare commit con controlli falliti.

3. **Se è cambiato `supabase.sql`**, ricorda all'utente che va rieseguito nel SQL Editor di Supabase: il push non aggiorna il database.

4. **Commit.** Fai `git add` dei file pertinenti. Il messaggio va in italiano, nello stile dei commit esistenti (`git log --oneline -10`): una riga "Area: cosa cambia per chi usa l'app", poi un corpo breve se serve. Se le modifiche riguardano cose diverse, fai più commit separati.

5. **Push sul ramo corrente:** `git push -u origin <ramo>`. Se fallisce per errore di rete, riprova fino a 4 volte con attesa crescente (2, 4, 8, 16 s).

6. **Pubblicazione.** Se il ramo corrente non è `main`, le modifiche non sono ancora online. Chiedi all'utente se vuole pubblicarle. Se lo chiede, apri una pull request verso `main` con gli strumenti GitHub disponibili, oppure unisci il ramo in `main` se l'utente lo chiede esplicitamente. Non fare push su `main` senza una richiesta esplicita.

7. **Riepilogo all'utente:**
   - commit creati (hash breve e titolo);
   - ramo caricato e versione dell'app;
   - se e quando sarà online. GitHub Pages pubblica `main` in circa un minuto; si verifica con l'ultima esecuzione "pages build and deployment" in GitHub Actions.
