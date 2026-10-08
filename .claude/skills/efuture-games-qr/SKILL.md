---
name: efuture-games-qr
description: Genera e propone i 5 QR di Efuture Games — il QR dell'app (installazione) e i 4 QR di sblocco dei giochi (SysAdmin Runner, CoreTech Pac, Timenet Breakout, Inncloud Invaders) — come cartellini pronti da stampare. Usala quando l'utente chiede i QR dell'app o dei giochi, di rigenerarli, ristamparli o aggiornarli dopo un cambio di indirizzo o di codice.
---

# Efuture Games – i 5 QR

Rispondi all'utente in italiano.

## Cosa contengono i QR

| QR | Link | Dove va |
|---|---|---|
| App | `PUBLIC_URL?installa=1` | ingresso / ledwall: apre l'app e propone l'installazione |
| SysAdmin Runner | `PUBLIC_URL?sblocca=<codice>` | stand Efuture |
| CoreTech Pac | `PUBLIC_URL?sblocca=<codice>` | stand CoreTech |
| Timenet Breakout | `PUBLIC_URL?sblocca=<codice>` | stand Timenet |
| Inncloud Invaders | `PUBLIC_URL?sblocca=<codice>` | stand Inncloud |

- `PUBLIC_URL` viene da `config.js`.
- I codici di sblocco vengono da `LEGGIMI.txt`. Lo script li confronta con gli hash in `hub.js` e si ferma se non corrispondono. In quel caso non generare comunque i QR: dillo all'utente.

## Dove lavorare

Questa skill funziona sia in Claude Code sia nelle chat di claude.ai.
- `<skill>` è la cartella di questa skill (quella che contiene questo SKILL.md).
- `<repo>` è il repository efuture_games. Se la cartella corrente lo è già (c'è `config.js`), usa quella. Altrimenti, per esempio in una chat, scaricalo in una cartella temporanea:
  ```
  git clone --depth 1 https://github.com/marraliEfuture/efuture_games <temp>/efuture_games
  ```
  ed esegui i comandi da lì, con `export EFG_REPO=<temp>/efuture_games`. Se il download non riesce, dillo all'utente.

## Procedura

1. Installa le dipendenze se mancano: `pip install -q segno pillow zxing-cpp`. `zxing-cpp` serve per la verifica: rilegge ogni QR generato e controlla il link.
2. Genera i QR nello scratchpad, non in `qr/`:
   ```
   python3 <skill>/scripts/genera_qr.py <scratchpad>/qr
   ```
   Opzione: `--url https://altro-indirizzo/` per un indirizzo pubblico diverso da quello in `config.js`.
3. Proponi i 5 QR all'utente:
   - invia `anteprima.png` con SendUserFile (display `render`);
   - poi invia i 5 cartellini singoli (`qr-app-card.png`, `qr-sysadmin.png`, `qr-coretech.png`, `qr-timenet.png`, `qr-inncloud.png`) e `proposta.html`, la pagina da stampare;
   - riporta la tabella con titolo, stand, link e codice (dall'output dello script o da `qr.json`) e l'esito della verifica.
4. Solo se l'utente lo chiede, aggiorna quelli del sito:
   - copia `qr-app.png` (QR quadrato semplice, usato da `classifica.html`) e i 4 `qr-<gioco>.png` in `qr/`;
   - incrementa la versione `CACHE` in `sw.js`, perché `qr/qr-app.png` è nella cache dell'app;
   - fai commit e push sul ramo di lavoro.
   Non pubblicare `qr-app-card.png` se l'utente non lo chiede.

## Note

- I codici di sblocco sono riservati: stanno solo sui cartellini degli stand. Non metterli in pagine pubbliche del sito.
- Se cambiano i codici, cambiano anche gli hash in `hub.js` (`SHA-256("efg:" + codice senza trattino, maiuscolo)`) e il testo di `LEGGIMI.txt`. Aggiorna tutti e tre insieme, poi rigenera i QR.
