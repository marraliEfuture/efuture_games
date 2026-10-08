---
name: efuture-games-preview
description: Mostra subito l'app Efuture Games com'è adesso nel repository — home e schermata iniziale dei 4 giochi su un telefono simulato, più la classifica da PC — con il link al sito online. Usala quando l'utente chiede di vedere, mostrare o fare un'anteprima dell'app o dei giochi, anche prima di pubblicare le modifiche.
---

# Efuture Games – anteprima dell'app

Rispondi all'utente in italiano. L'obiettivo è far vedere l'app il prima possibile: prima l'immagine, poi i dettagli.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.

## Procedura

1. Genera le schermate. Lo script apre in Chromium i file del repository, quindi anche le modifiche non ancora pubblicate, su un telefono simulato (Pixel 7):
   ```
   node <skill>/scripts/anteprima.mjs <scratchpad>/anteprima
   ```
   Salva le immagini nello scratchpad, mai nel repository.
2. Invia **subito** `00-anteprima.png` con SendUserFile (display `render`): sono home e 4 giochi affiancati.
3. Invia poi le schermate singole:
   - `01-home.png`;
   - `04…07-<gioco>.png`;
   - `03-classifica.png`;
   - `02-installa.png`, se è stata creata.
4. Sotto, in poche righe:
   - il link al sito online, https://marraliefuture.github.io/efuture_games/ (o `PUBLIC_URL` di `config.js`), con la nota che l'anteprima mostra il codice del repository e potrebbe avere modifiche non ancora pubblicate (confronta `git log origin/main..HEAD`);
   - gli errori JavaScript stampati dallo script, oppure che non ce ne sono.

## Note

- Nell'anteprima il database online non viene contattato. L'app va in modalità demo e la classifica può mostrare "Classifica non raggiungibile": sul sito vero si carica normalmente. Dillo all'utente, non è un errore.
- Nella home i giochi non si vedono e compare "Registrati o accedi": è il comportamento normale per chi non ha fatto l'accesso. Le schermate dei 4 giochi arrivano comunque dallo script. Non mostrare né usare i codici di sblocco.
- Se Playwright o Chromium mancano, dillo e dai solo il link al sito online.
