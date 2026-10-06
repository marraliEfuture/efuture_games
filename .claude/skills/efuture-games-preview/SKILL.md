---
name: efuture-games-preview
description: Mostra subito l'app Efuture Games com'è adesso nel repository — home e schermata iniziale dei 4 giochi su un telefono simulato, più la classifica da PC — con il link al sito online. Usala quando l'utente chiede di vedere, mostrare o fare un'anteprima dell'app o dei giochi, anche prima di pubblicare le modifiche.
---

# Efuture Games – anteprima dell'app

Rispondi all'utente in italiano. L'obiettivo è far vedere l'app il prima possibile: prima l'immagine, poi i dettagli.

## Procedura

1. Genera le schermate. Lo script apre in Chromium i file del repository, quindi anche le modifiche non ancora pubblicate, su un telefono simulato (Pixel 7):
   ```
   node .claude/skills/efuture-games-preview/scripts/anteprima.mjs <scratchpad>/anteprima
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
- I giochi appaiono bloccati nella home: è il comportamento normale per un nuovo giocatore. Non mostrare né usare i codici di sblocco.
- Se Playwright o Chromium mancano, dillo e dai solo il link al sito online.
